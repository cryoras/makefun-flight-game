// Kestrel Ridge — real-time 3D scene renderer (three.js, vendored locally).
//
// The game logic (physics.js, missions.js) and the HUD stay exactly as they
// were; this module only replaces the *picture*: a three.js WebGL scene with
// a heightfield terrain mesh, an instanced pine forest, a continuous river
// ribbon, the airfield (apron, runway, tower, hangar), gold ring gates and
// a propeller plane mesh, lit by a shadow-casting sun plus hemisphere sky
// light, under fog and a gradient sky dome. The 2D canvas renderer remains
// the fallback when WebGL is unavailable (see render.js / main.js).
import * as THREE from '../vendor/three.module.js';
import { clamp, TAU } from './config.js';
import { course } from './missions.js';
import { mulberry32 } from './random.js';
import { riverX } from './terrain.js';

// The game world is left-handed (heading 0 = +Z north, +X east, +Y up),
// while three.js is right-handed. The scene is therefore built in three.js
// coordinates (x, y, -z): north is -Z, east stays +X, so east is on the
// right when facing north — the same as the Canvas 2D fallback. Every
// world position below is written with a negated z for that reason.
const SUN_DIR = new THREE.Vector3(0.5, 0.62, -0.42).normalize();

function skyTexture() {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
  const c = cv.getContext('2d'), g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#3d748c'); g.addColorStop(0.45, '#8fb0bd');
  g.addColorStop(0.72, '#d9c9a4'); g.addColorStop(0.85, '#e8cc9e'); g.addColorStop(1, '#c7c7a3');
  c.fillStyle = g; c.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function apronTexture() {
  // Small procedural tan apron texture: speckle + faint tyre streaks.
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#8b9976'; c.fillRect(0, 0, 256, 256);
  const rng = mulberry32(42);
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = rng() > 0.5 ? '#7d8a68' : '#99a683';
    c.globalAlpha = 0.16 + rng() * 0.2;
    c.fillRect(rng() * 256, rng() * 256, 1 + rng() * 3, 1 + rng() * 2);
  }
  c.globalAlpha = 0.10; c.fillStyle = '#5d6a52';
  for (let i = 0; i < 8; i++) c.fillRect(20 + rng() * 200, rng() * 256, 30 + rng() * 60, 2 + rng() * 3);
  c.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 5);
  return tex;
}

function terrainColor(x, z, y, rng) {
  // Same height bands as the 2D renderer, with a little per-vertex grain
  // and a darker, wetter strip along the valley floor.
  let base = y > 510 ? [137, 143, 124] : y > 300 ? [112, 132, 104] : [91, 133, 111];
  const v = 0.9 + rng() * 0.2;
  let [r, g, b] = [base[0] * v, base[1] * v, base[2] * v];
  if (Math.abs(x - riverX(z)) < 110) { r *= 0.82; g *= 0.88; b *= 0.82; }
  return [r / 255, g / 255, b / 255];
}

function probeGL() {
  // A probe context tells us whether the GPU is real, a software rasteriser
  // (SwiftShader / llvmpipe), or absent entirely. Software GL still runs
  // the scene, just without antialiasing and with a smaller shadow map, so
  // verification and low-end machines stay usable; with no WebGL at all the
  // caller falls back to the 2D renderer without ever constructing a
  // WebGLRenderer (which would log context errors to the console).
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return 'none';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|software|basic render/i.test(name) ? 'software' : 'gpu';
  } catch { return 'none'; }
}

export function createRenderer3D(canvas) {
  const glKind = probeGL();
  if (glKind === 'none') return null;
  const software = glKind === 'software';
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !software, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  const ctx = renderer.getContext();
  if (!ctx || ctx.isContextLost()) return null;
  renderer.setPixelRatio(software ? 1 : Math.min(devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc9c9a8, 3200, 15000);
  const camera = new THREE.PerspectiveCamera(62, 1, 2, 45000);

  // Gradient sky dome (unaffected by fog) that follows the camera.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(20000, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  sky.renderOrder = -1; scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xbfd8e6, 0x5c6b4a, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2a6, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(software ? 512 : 1024, software ? 512 : 1024);
  sun.shadow.camera.left = -800; sun.shadow.camera.right = 800;
  sun.shadow.camera.top = 800; sun.shadow.camera.bottom = -800;
  sun.shadow.camera.near = 100; sun.shadow.camera.far = 5200;
  sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);

  // ---- world (rebuilt when the seed changes) ----
  let world = null;
  const tmpColor = new THREE.Color(), tmpMatrix = new THREE.Matrix4(),
    tmpQuat = new THREE.Quaternion(), tmpScale = new THREE.Vector3(),
    tmpPos = new THREE.Vector3(), tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');

  function buildWorld(g) {
    if (world) {
      scene.remove(world.group);
      world.group.traverse(o => { o.geometry?.dispose?.(); });
    }
    const terrain = g.terrain, rng = mulberry32(terrain.seed);
    const group = new THREE.Group();

    // Heightfield terrain: 120x120 grid over 20 km, vertex colours by band.
    const SEG = 120, SIZE = 20000, CX = 0, CZ = 1000;
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array((SEG + 1) * (SEG + 1) * 3);
    const cols = new Float32Array((SEG + 1) * (SEG + 1) * 3);
    const idx = [];
    let vi = 0;
    for (let j = 0; j <= SEG; j++) {
      for (let i = 0; i <= SEG; i++) {
        const x = CX - SIZE / 2 + (i / SEG) * SIZE, z = CZ - SIZE / 2 + (j / SEG) * SIZE;
        const y = terrain.heightAt(x, z);
        verts[vi * 3] = x; verts[vi * 3 + 1] = y; verts[vi * 3 + 2] = -z;
        const [r, gg, b] = terrainColor(x, z, y, rng);
        cols[vi * 3] = r; cols[vi * 3 + 1] = gg; cols[vi * 3 + 2] = b;
        if (i < SEG && j < SEG) {
          const a = vi, b2 = vi + 1, c2 = vi + SEG + 1, d = vi + SEG + 2;
          idx.push(a, b2, c2, b2, d, c2); // wound so the top face is +Y here
        }
        vi++;
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
    ground.receiveShadow = true;
    group.add(ground);

    // Continuous river ribbon following the valley floor (one strip, no gaps).
    const rp = terrain.river, rverts = new Float32Array(rp.length * 2 * 3), ridx = [];
    rp.forEach((pt, i) => {
      const y = terrain.heightAt(pt.x, pt.z) + 1.6;
      rverts[i * 6] = pt.x - 28; rverts[i * 6 + 1] = y; rverts[i * 6 + 2] = -pt.z;
      rverts[i * 6 + 3] = pt.x + 28; rverts[i * 6 + 4] = y; rverts[i * 6 + 5] = -pt.z;
      if (i < rp.length - 1) { const a = i * 2; ridx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const rgeo = new THREE.BufferGeometry();
    rgeo.setAttribute('position', new THREE.BufferAttribute(rverts, 3));
    rgeo.setIndex(ridx); rgeo.computeVertexNormals();
    const river = new THREE.Mesh(rgeo, new THREE.MeshStandardMaterial({ color: 0x7fb3ae, roughness: 0.25, metalness: 0.15 }));
    group.add(river);

    // Airfield: textured tan apron, dark runway, centreline dashes, threshold bars.
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(270, 1300),
      new THREE.MeshStandardMaterial({ map: apronTexture(), roughness: 0.95 }),
    );
    apron.rotation.x = -Math.PI / 2; apron.position.set(0, 42.6, -550); apron.receiveShadow = true;
    group.add(apron);
    const runway = new THREE.Mesh(
      new THREE.PlaneGeometry(68, 1000),
      new THREE.MeshStandardMaterial({ color: 0x35484b, roughness: 0.9 }),
    );
    runway.rotation.x = -Math.PI / 2; runway.position.set(0, 43.1, -500); runway.receiveShadow = true;
    group.add(runway);
    const markMat = new THREE.MeshBasicMaterial({ color: 0xe9dfb8 });
    for (let z = 80; z < 900; z += 100) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 35), markMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(0, 43.4, -(z + 17)); group.add(dash);
    }
    for (const z of [8, 44]) for (let x = -25; x <= 25; x += 10) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(4, 28), markMat);
      bar.rotation.x = -Math.PI / 2; bar.position.set(x + 2, 43.4, -(z + 14)); group.add(bar);
    }
    for (const z of [936, 972]) for (let x = -25; x <= 25; x += 10) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(4, 28), markMat);
      bar.rotation.x = -Math.PI / 2; bar.position.set(x + 2, 43.4, -(z + 14)); group.add(bar);
    }
    // Approach lamps (small emissive dots leading onto runway 36).
    const lampGeo = new THREE.SphereGeometry(1.6, 6, 6);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xf9d897 });
    for (let z = -480; z < 0; z += 60) for (const x of [-10, 0, 10]) {
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x, terrain.heightAt(x, z) + 2.5, -z); group.add(lamp);
    }
    // Runway edge lights.
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffe4a4 });
    for (let z = 0; z < 1000; z += 100) for (const x of [-37, 37]) {
      const lamp = new THREE.Mesh(lampGeo, edgeMat);
      lamp.position.set(x, 45.5, -z); group.add(lamp);
    }

    // Buildings: hangar, tower, small block (same spots as the 2D version).
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x6b7a6e, roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xb8b19a, roughness: 0.9 });
    function building(x, z, ww, dd, hh) {
      const y = terrain.heightAt(x, z) + 1;
      const body = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), wallMat);
      body.position.set(x + ww / 2, y + hh / 2, -(z + dd / 2));
      body.castShadow = true; body.receiveShadow = true; group.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(ww + 2, 1.5, dd + 2), roofMat);
      roof.position.set(x + ww / 2, y + hh + 0.75, -(z + dd / 2)); group.add(roof);
    }
    building(-125, 650, 60, 90, 27);
    building(100, 730, 18, 22, 44);
    building(95, 725, 28, 32, 47);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(22, 7, 26), new THREE.MeshStandardMaterial({ color: 0x4a5f58, roughness: 0.6 }));
    cab.position.set(109, terrain.heightAt(100, 730) + 48, -741); cab.castShadow = true; group.add(cab);

    // Pine forest: the terrain's trees plus clustered groves on the ridges
    // (density varies — sparse on the valley floor, dense on the slopes).
    const clusterRng = mulberry32(terrain.seed + 7);
    const trees = terrain.trees.slice();
    for (let cI = 0; cI < 42; cI++) {
      const side = clusterRng() > 0.5 ? 1 : -1;
      const cx = side * (900 + clusterRng() * 1700) + riverX(0) * 0.3;
      const cz = (clusterRng() - 0.5) * 9000;
      for (let k = 0; k < 12; k++) {
        const x = cx + (clusterRng() - 0.5) * 320, z = cz + (clusterRng() - 0.5) * 320;
        const y = terrain.heightAt(x, z);
        if (y < 490 && Math.abs(x - riverX(z)) > 65) trees.push({ x, z, y, size: 5 + clusterRng() * 8 });
      }
    }
    const treeGeo = new THREE.ConeGeometry(1, 1, 6);
    const treeMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
    const forest = new THREE.InstancedMesh(treeGeo, treeMat, trees.length);
    trees.forEach((t, i) => {
      tmpPos.set(t.x, t.y + t.size * 0.8, -t.z);
      tmpQuat.setFromEuler(tmpEuler.set(0, clusterRng() * TAU, 0));
      tmpScale.set(t.size * 0.55, t.size * 1.7, t.size * 0.55);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      forest.setMatrixAt(i, tmpMatrix);
      forest.setColorAt(i, tmpColor.setHSL(0.36 + clusterRng() * 0.04, 0.32, 0.22 + clusterRng() * 0.12));
    });
    forest.instanceMatrix.needsUpdate = true;
    if (forest.instanceColor) forest.instanceColor.needsUpdate = true;
    group.add(forest);

    // Clouds: flattened white blobs drifting high above the valley.
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xf4e4c1, transparent: true, opacity: 0.82, fog: true });
    for (const cl of terrain.clouds) {
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), cloudMat);
      cloud.scale.set(cl.size, cl.size * 0.16, cl.size * 0.5);
      cloud.position.set(cl.x, cl.y, -cl.z);
      group.add(cloud);
    }

    // Ring gates for the current mission.
    const rings = course(g).map((ring, i) => {
      const radius = g.mode === 1 ? 190 : ring.radius;
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 3, 8, 48),
        new THREE.MeshStandardMaterial({ color: 0xd9a441, emissive: 0x000000, metalness: 0, roughness: 0.4 }),
      );
      return mesh;
    });
    // (Materials are swapped per frame below; torus geometry is per-ring.)
    rings.forEach((mesh, i) => {
      const ring = course(g)[i];
      mesh.position.set(ring.x, ring.y, -ring.z);
      mesh.rotation.y = Math.PI - ring.heading; // torus normal -> flight direction
      group.add(mesh);
    });

    scene.add(group);
    world = { group, rings, seed: terrain.seed, mode: g.mode };
  }

  // ---- the plane ----
  const plane = new THREE.Group();
  {
    const cream = new THREE.MeshStandardMaterial({ color: 0xf5e8c4, roughness: 0.55, metalness: 0.05 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xd98550, roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x27444b, roughness: 0.35, metalness: 0.25 });
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.55, 11, 10), cream);
    fuselage.rotation.x = Math.PI / 2; plane.add(fuselage);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.6, 10), cream);
    nose.rotation.x = Math.PI / 2; nose.position.z = 6.8; plane.add(nose);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), dark);
    canopy.scale.set(0.85, 0.62, 1.9); canopy.position.set(0, 0.85, 2.4); plane.add(canopy);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(17, 0.35, 3.2), cream);
    wing.position.set(0, 0.05, 1.1); plane.add(wing);
    for (const sx of [-1, 1]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.38, 3.2), orange);
      tip.position.set(sx * 7.9, 0.05, 1.1); plane.add(tip);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6),
        new THREE.MeshBasicMaterial({ color: sx < 0 ? 0xf88568 : 0xa2e3bc }));
      light.position.set(sx * 8.6, 0.05, 1.1); plane.add(light);
    }
    const tailplane = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.3, 2.2), cream);
    tailplane.position.set(0, 0.45, -5.2); plane.add(tailplane);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.1, 2.6), orange);
    fin.position.set(0, 1.7, -5.1); plane.add(fin);
    for (const sx of [-1, 1]) {
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.1, 8), dark);
      gear.position.set(sx * 1.5, -1.25, 2.6); plane.add(gear);
    }
    plane.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }
  const prop = new THREE.Group();
  {
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x2c3a3e, roughness: 0.5 });
    for (const a of [0, Math.PI / 2]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.45, 7.6, 0.16), bladeMat);
      blade.rotation.z = a; prop.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 8), bladeMat);
    hub.rotation.x = Math.PI / 2; hub.position.z = 0.5; prop.add(hub);
  }
  prop.position.z = 8.2; plane.add(prop);
  // Translucent prop disc: from the cockpit the solid blades would read as
  // a black bar across the windscreen, so the cockpit sees a faint disc
  // instead (swapped per frame in render()).
  const propDisc = new THREE.Mesh(new THREE.CircleGeometry(3.8, 24),
    new THREE.MeshBasicMaterial({ color: 0x2c3a3e, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }));
  propDisc.position.z = 8.2; propDisc.visible = false; plane.add(propDisc);
  scene.add(plane);
  // Exact plane orientation as a basis (right, up, forward) in three.js
  // coordinates — built from heading/pitch/roll, so the handedness mapping
  // (world z -> three -z) stays exact where Euler angles would drift.
  const _basis = new THREE.Matrix4(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3();
  function planeBasis(p) {
    _f.set(Math.sin(p.heading) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.heading) * Math.cos(p.pitch));
    _r.set(Math.cos(p.heading) * Math.cos(p.roll), -Math.sin(p.roll), Math.sin(p.heading) * Math.cos(p.roll));
    _u.crossVectors(_r, _f).normalize();
    return _basis.makeBasis(_r, _u, _f);
  }

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  let last = 0, scenicAngle = 0;
  function render(g, scenic = false) {
    const now = performance.now();
    const dt = clamp((now - (last || now)) / 1000, 0.001, 0.05); last = now;
    if (!world || world.seed !== g.terrain.seed || world.mode !== g.mode) buildWorld(g);
    const p = g.plane;
    // Ring gates: hide cleared ones, light the current one gold.
    const route = course(g);
    world.rings.forEach((mesh, i) => {
      mesh.visible = i >= g.ring && i < route.length;
      const current = i === g.ring;
      const mat = mesh.material;
      mat.emissive.setHex(current ? 0xa86f14 : 0x241a08);
      mat.emissiveIntensity = current ? 0.9 + Math.sin(now * 0.005) * 0.35 : 0.25;
      mat.color.setHex(current ? 0xf6c86a : 0x8a7a52);
    });
    // Plane pose from the physics state.
    plane.position.set(p.x, p.y, -p.z);
    plane.quaternion.setFromRotationMatrix(planeBasis(p));
    prop.rotation.z += dt * (4 + p.throttle * 55) * (p.onGround && p.speed < 1 ? 0.2 : 1);
    const cockpitView = g.camera === 1 && !scenic;
    prop.visible = !cockpitView; propDisc.visible = cockpitView;
    const fwd = new THREE.Vector3(Math.sin(p.heading) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.heading) * Math.cos(p.pitch));
    const planePos = new THREE.Vector3(p.x, p.y, -p.z);
    // Sun + shadows follow the plane.
    sun.position.copy(planePos).addScaledVector(SUN_DIR, 1800);
    sun.target.position.copy(planePos);
    sky.position.copy(camera.position);
    if (scenic) {
      scenicAngle += dt * 0.045;
      const r = 1500;
      camera.position.set(Math.sin(scenicAngle) * r, 620 + Math.sin(scenicAngle * 0.6) * 120, -500 + Math.cos(scenicAngle) * r);
      camera.lookAt(0, 120, -500);
      camera.up.set(0, 1, 0);
    } else if (g.camera === 1) {
      // Cockpit: ride the plane's own orientation, read back from its
      // world matrix (forward = +Z column, up = +Y column).
      plane.updateWorldMatrix(true, false);
      const e = plane.matrixWorld.elements;
      const fwdW = new THREE.Vector3(e[8], e[9], e[10]), upW = new THREE.Vector3(e[4], e[5], e[6]), posW = new THREE.Vector3(e[12], e[13], e[14]);
      camera.position.copy(posW).addScaledVector(upW, 1.9).addScaledVector(fwdW, 2.2);
      camera.up.copy(upW);
      camera.lookAt(posW.clone().addScaledVector(fwdW, 100));
    } else {
      // Chase: smooth follow behind and above, banking slightly with the plane.
      const desired = planePos.clone().addScaledVector(fwd, -40).add(new THREE.Vector3(0, 13, 0));
      if (camera.position.distanceTo(desired) > 400) camera.position.copy(desired);
      else camera.position.lerp(desired, 1 - Math.exp(-dt * 3.5));
      camera.up.set(0, 1, 0);
      camera.lookAt(planePos.clone().addScaledVector(fwd, 70).add(new THREE.Vector3(0, 2, 0)));
      camera.rotateZ(-p.roll * 0.22);
    }
    renderer.render(scene, camera);
  }
  return { render };
}
