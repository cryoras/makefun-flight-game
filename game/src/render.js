import { clamp, mix, PALETTE as P, TAU } from './config.js';
import { course, target } from './missions.js';
export function createRenderer(canvas) {
  const c = canvas.getContext('2d', { alpha: true });
  let w = 1, h = 1, ratio = 1, use3d = false;
  // When the three.js scene is live, this canvas stays transparent and only
  // carries the cockpit frame, vignette and (via hud.js) the instruments.
  function set3D(on) { use3d = !!on; }
  function drawCockpit(g) {
    c.strokeStyle = '#162c32'; c.lineWidth = 18;
    c.beginPath(); c.moveTo(w * .12, h); c.lineTo(w * .25, h * .22); c.quadraticCurveTo(w * .5, h * .03, w * .75, h * .22); c.lineTo(w * .88, h); c.stroke();
    c.lineWidth = 2; c.strokeStyle = '#c7c1a474'; c.stroke();
    c.fillStyle = '#14262d'; c.beginPath(); c.ellipse(w * .5, h * .94, w * .27, h * .22, 0, Math.PI, TAU); c.fill();
    c.fillStyle = '#e5d7aa25'; c.beginPath(); c.ellipse(w * .5, h * .68, w * .17, h * .012, Math.sin(g.time * 40) * .05, 0, TAU); c.fill();
  }
  function drawVignette() {
    const vignette = c.createRadialGradient(w / 2, h * .44, h * .2, w / 2, h / 2, w * .75);
    vignette.addColorStop(0, '#001a2100'); vignette.addColorStop(1, '#071d2a78'); c.fillStyle = vignette; c.fillRect(0, 0, w, h);
  }
  function resize() {
    w = innerWidth; h = innerHeight; ratio = Math.min(devicePixelRatio || 1, 1.8);
    canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  window.addEventListener('resize', resize); resize();
  function polygon(points, fill, stroke) {
    if (points.some(p => !p)) return;
    c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath();
    c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = .5; c.stroke(); }
  }
  function scene(g, scenic = false) {
    const p = g.plane, terrain = g.terrain, cockpit = g.camera === 1 && !scenic;
    if (use3d) {
      c.clearRect(0, 0, w, h);
      if (cockpit) drawCockpit(g);
      drawVignette();
      return { ctx: c, width: w, height: h, project: null };
    }
    const sky = c.createLinearGradient(0, 0, 0, h * .72);
    sky.addColorStop(0, '#427b91'); sky.addColorStop(.45, '#a8b6af'); sky.addColorStop(.76, '#e8cc9e'); sky.addColorStop(1, '#c7c7a3');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    const sunX = w * .78, sunY = h * .18;
    let glow = c.createRadialGradient(sunX, sunY, 4, sunX, sunY, h * .32);
    glow.addColorStop(0, '#ffe2a659'); glow.addColorStop(1, '#ffe2a600'); c.fillStyle = glow; c.fillRect(0, 0, w, h * .6);
    c.fillStyle = '#ffdf9c'; c.beginPath(); c.arc(sunX, sunY, h * .027, 0, TAU); c.fill();
    const heading = scenic ? -.28 : p.heading, sn = Math.sin(heading), cs = Math.cos(heading);
    const back = scenic ? 850 : cockpit ? -5 : 128, up = scenic ? 430 : cockpit ? 4 : 44;
    const cam = { x: p.x - sn * back, z: p.z - cs * back, y: p.y + up };
    const down = scenic ? .22 : .105 - p.pitch * .22, cd = Math.cos(down), sd = Math.sin(down), focal = h * .86;
    const cr = Math.cos(cockpit ? -p.roll * .35 : -p.roll * .11), sr = Math.sin(cockpit ? -p.roll * .35 : -p.roll * .11);
    function project(x, y, z) {
      const dx = x - cam.x, dz = z - cam.z, dy = y - cam.y;
      const side = dx * cs - dz * sn, forward = dx * sn + dz * cs, depth = forward * cd - dy * sd;
      if (depth < 18) return null;
      const sx = side * focal / depth, sy = -(dy * cd + forward * sd) * focal / depth;
      return { x: w / 2 + sx * cr - sy * sr, y: h * .43 + sx * sr + sy * cr, depth, scale: focal / depth };
    }
    for (const cloud of terrain.clouds) {
      const a = project(cloud.x, cloud.y, cloud.z);
      if (!a || a.x < -500 || a.x > w + 500) continue;
      c.fillStyle = '#f4e4c14d';
      for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(a.x + i * cloud.size * a.scale * .42, a.y + (i % 2) * 7, cloud.size * a.scale * .6, cloud.size * a.scale * .13, -.04, 0, TAU); c.fill(); }
    }
    const items = [];
    const add = (points, color, line, bias = 0) => {
      const pts = points.map(v => project(...v));
      if (pts.some(a => !a)) return;
      const depth = pts.reduce((s, a) => s + a.depth, 0) / pts.length;
      if (pts.every(a => a.x < -80) || pts.every(a => a.x > w + 80) || pts.every(a => a.y > h + 150)) return;
      items.push({ depth: depth - bias, draw: () => polygon(pts, color, line) });
    };
    // Camera-oriented strips form a continuous, shaded terrain mesh.
    let far = [];
    const rows = 36, cols = 40;
    for (let row = rows; row >= 0; row--) {
      const distance = 45 + Math.pow(row / rows, 1.65) * 8200, width = distance * (w / h * .65 + .1) + 360;
      const near = [];
      for (let col = 0; col <= cols; col++) {
        const side = (col / cols * 2 - 1) * width, x = cam.x + sn * distance + cs * side, z = cam.z + cs * distance - sn * side;
        near.push([x, terrain.heightAt(x, z), z]);
      }
      if (far.length) for (let col = 0; col < cols; col++) {
        const a = near[col], b = near[col + 1], d = far[col], y = (a[1] + b[1] + d[1]) / 3;
        const light = clamp(.62 + (b[1] - a[1]) * .0018 + (d[1] - a[1]) * .0012, .40, .92);
        const fog = clamp(distance / 8800, 0, .8);
        let base = y > 510 ? [137, 143, 124] : y > 300 ? [112, 132, 104] : [91, 133, 111];
        const r = Math.round(mix(base[0] * light, 180, fog)), green = Math.round(mix(base[1] * light, 184, fog)), blue = Math.round(mix(base[2] * light, 164, fog));
        const fill = `rgb(${r},${green},${blue})`;
        add([a, b, far[col + 1], d], fill, fill);
      }
      far = near;
    }
    // The river follows the valley floor and remains distinct from the hills.
    for (let i = 0; i < terrain.river.length - 1; i++) {
      const a = terrain.river[i], b = terrain.river[i + 1];
      if (Math.hypot(a.x - p.x, a.z - p.z) > 8500) continue;
      add([[a.x - 28, terrain.heightAt(a.x - 28, a.z) + 1.5, a.z], [a.x + 28, terrain.heightAt(a.x + 28, a.z) + 1.5, a.z], [b.x + 28, terrain.heightAt(b.x + 28, b.z) + 1.5, b.z], [b.x - 28, terrain.heightAt(b.x - 28, b.z) + 1.5, b.z]], '#87b9b5');
      if (i % 3 === 0) add([[a.x - 3, 24, a.z], [a.x + 2, 24, a.z], [b.x + 2, 24, b.z], [b.x - 3, 24, b.z]], '#d4d4ac');
    }
    const rect = (x1, z1, x2, z2, y, color) => add([[x1, y, z1], [x2, y, z1], [x2, y, z2], [x1, y, z2]], color, null, 180);
    for (let z = -100; z < 1200; z += 100) rect(-135, z, 135, z + 100, 42.3, z % 200 === 0 ? '#859471' : '#8b9976');
    for (let z = 0; z < 1000; z += 50) {
      rect(-34, z, 34, z + 50, 43, '#35484b');
      if (z > 80 && z < 900 && z % 100 === 0) rect(-1.7, z, 1.7, z + 35, 43.5, '#e9dfb8');
      rect(-33, z, -32, z + 50, 43.4, '#b4baa3'); rect(32, z, 33, z + 50, 43.4, '#b4baa3');
      if (z < 50 || z > 900) for (let x = -25; x <= 25; x += 10) rect(x, z + 8, x + 4, z + 36, 43.5, '#ece4c6');
      for (const x of [-37, 37]) {
        const a = project(x, 45, z);
        if (a) items.push({ depth: a.depth - 2, draw: () => {
          c.save(); c.shadowColor = '#ffe4a4'; c.shadowBlur = 8; c.fillStyle = z < 50 ? '#99e5b7' : '#ffe4a4'; c.beginPath(); c.arc(a.x, a.y, clamp(a.scale * 1.5, 1.2, 4), 0, TAU); c.fill(); c.restore();
        } });
      }
    }
    // Approach lamps lead the eye straight onto runway 36.
    for (let z = -480; z < 0; z += 60) for (const x of [-10, 0, 10]) {
      const a = project(x, terrain.heightAt(x, z) + 2, z);
      if (a) items.push({ depth: a.depth - 3, draw: () => { c.fillStyle = '#f9d897'; c.fillRect(a.x - 1, a.y - 1, 2.5, 2.5); } });
    }
    function building(x, z, ww, dd, hh) {
      const y = terrain.heightAt(x, z) + 1;
      add([[x, y, z], [x + ww, y, z], [x + ww, y + hh, z], [x, y + hh, z]], '#56635c');
      add([[x + ww, y, z], [x + ww, y, z + dd], [x + ww, y + hh, z + dd], [x + ww, y + hh, z]], '#3d534e');
      rect(x, z, x + ww, z + dd, y + hh, '#b8b19a');
      rect(x + 3, z + 2, x + ww - 3, z + dd - 2, y + hh + .3, '#bdb99f');
    }
    building(-125, 650, 60, 90, 27); building(100, 730, 18, 22, 44); building(95, 725, 28, 32, 47);
    for (const t of terrain.trees) {
      const a = project(t.x, t.y + t.size / 2, t.z);
      if (!a || a.depth > 6500 || a.x < -10 || a.x > w + 10 || a.y > h + 15) continue;
      const s = clamp(t.size * a.scale, 1, 25);
      items.push({ depth: a.depth, draw: () => { c.fillStyle = a.depth > 3300 ? '#607e71' : '#2c5148'; c.beginPath(); c.ellipse(a.x, a.y, s * .4, s * .65, 0, 0, TAU); c.fill(); c.fillStyle = '#72916b'; c.beginPath(); c.arc(a.x - s * .12, a.y - s * .18, s * .22, 0, TAU); c.fill(); } });
    }
    if (!scenic) {
      const route = course(g);
      route.forEach((ring, i) => {
        if (i < g.ring) return;
        const a = project(ring.x, ring.y, ring.z); if (!a || a.depth > 6500) return;
        items.push({ depth: a.depth, draw: () => {
          const current = i === g.ring, color = current ? P.gold : '#d0d9be';
          const points = [], cs = Math.cos(ring.heading), sn = Math.sin(ring.heading);
          const radius = g.mode === 1 ? 55 : ring.radius;
          for (let j = 0; j <= 48; j++) { const t = j / 48 * TAU; points.push(project(ring.x + Math.cos(t) * radius * cs, ring.y + Math.sin(t) * radius, ring.z - Math.cos(t) * radius * sn)); }
          if (points.some(x => !x)) return;
          c.save(); c.strokeStyle = color; c.lineWidth = current ? clamp(a.scale * 3, 2.5, 7) : 1.3; c.globalAlpha = current ? 1 : .38;
          if (current) { c.shadowColor = color; c.shadowBlur = 16; }
          c.beginPath(); points.forEach((pt, j) => j ? c.lineTo(pt.x, pt.y) : c.moveTo(pt.x, pt.y)); c.stroke();
          c.shadowBlur = 0;
          if (current) {
            c.fillStyle = color; c.font = '600 11px system-ui'; c.textAlign = 'center';
            const top = project(ring.x, ring.y + radius + 22, ring.z);
            if (top) { c.fillText(`${g.mode === 0 ? 'RING' : 'CIRCUIT'} ${i + 1}   /   ${Math.round(Math.hypot(p.x - ring.x, p.z - ring.z))} M`, top.x, top.y - 10); c.beginPath(); c.moveTo(top.x, top.y); c.lineTo(top.x - 4, top.y - 6); c.lineTo(top.x + 4, top.y - 6); c.fill(); }
          }
          c.restore();
        } });
      });
    }
    items.sort((a, b) => b.depth - a.depth); items.forEach(item => item.draw());
    // Runway numerals are projected as ground-plane vector strokes.
    const label = project(0, 44, 130);
    if (label && label.depth < 3000) { c.save(); c.translate(label.x, label.y); c.scale(clamp(label.scale * 10, .25, 5), clamp(label.scale * 3, .15, 2)); c.fillStyle = '#eae0bb'; c.textAlign = 'center'; c.font = '700 13px system-ui'; c.fillText('36', 0, 0); c.restore(); }
    if (!scenic && !cockpit) drawPlane(p, project(p.x, p.y, p.z), g.time, g.terrain);
    if (cockpit) drawCockpit(g);
    drawVignette();
    return { ctx: c, width: w, height: h, project };
  }
  function drawPlane(p, pos, time, terrain) {
    if (!pos) return;
    const scale = clamp(Math.min(w / 1250, h / 750), .45, 1.15);
    c.save(); c.translate(pos.x, pos.y); c.rotate(p.roll * .85); c.scale(scale, scale * (1 - Math.abs(p.pitch) * .4));
    c.shadowColor = '#1b303a55'; c.shadowBlur = 18; c.shadowOffsetY = 10;
    const shape = (points, color, stroke = '#263e43') => polygon(points.map(([x, y]) => ({ x, y })), color, stroke);
    shape([[-12,-14],[-116,9],[-124,24],[-16,16],[0,6],[16,16],[124,24],[116,9],[12,-14]], '#e8dfbc');
    c.shadowBlur = 0; c.shadowOffsetY = 0;
    shape([[-92,4],[-109,8],[-114,23],[-95,22]], '#d98550'); shape([[92,4],[109,8],[114,23],[95,22]], '#d98550');
    shape([[-15,8],[-113,20],[-115,23],[-16,16]], '#9faaa0'); shape([[15,8],[113,20],[115,23],[16,16]], '#b8c0a9');
    shape([[-5,29],[-44,44],[-47,53],[-4,48],[4,48],[47,53],[44,44],[5,29]], '#e7dab6');
    shape([[-6,34],[-11,-17],[-8,-35],[0,-40],[8,-35],[11,-17],[6,34],[0,60]], '#f5e8c4');
    shape([[0,-38],[8,-33],[11,-15],[6,34],[0,60],[0,13]], '#c7c9ae');
    shape([[-8,-19],[-7,-31],[7,-31],[8,-19]], '#d18149');
    shape([[-7,-10],[-5,-18],[5,-18],[7,-10],[5,5],[-5,5]], '#27444b');
    shape([[0,24],[-4,48],[0,61],[4,48],[3,24]], '#d48a4f');
    c.strokeStyle = '#dce8c780'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(0, -39, 33, 5 + Math.sin(time * 60) * 2, 0, 0, TAU); c.stroke();
    c.fillStyle = '#36474a'; c.beginPath(); c.arc(0, -39, 3, 0, TAU); c.fill();
    c.fillStyle = '#f88568'; c.beginPath(); c.arc(-121, 20, 2.4, 0, TAU); c.fill(); c.fillStyle = '#a2e3bc'; c.beginPath(); c.arc(121, 20, 2.4, 0, TAU); c.fill();
    if (p.y - terrain.heightAt(p.x, p.z) < 60) { c.fillStyle = '#1c3035'; c.fillRect(-22, 27, 5, 10); c.fillRect(17, 27, 5, 10); }
    c.restore();
  }
  return { scene, resize, set3D };
}
