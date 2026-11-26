import { MISSIONS, clamp, angle } from './config.js';
import { createTerrain } from './terrain.js';
import { createPlane, stepPhysics } from './physics.js';
export function createGame(seed = 1, mode = 0) {
  const terrain = createTerrain(seed), mission = MISSIONS[mode];
  return { seed, mode, mission, terrain, plane: createPlane(terrain), time: 0, airTime: 0, maxAgl: 0, ring: 0, score: 0, camera: 0, ended: false, result: null, pending: null, landedFor: 0, events: [], message: 'OPEN THROTTLE · SHIFT TO ACCELERATE', messageTime: 4, trail: [], trailTick: 0 };
}
export function course(g) {
  const r = g.terrain.rings;
  return g.mode === 0 ? r : g.mode === 1 ? [[0,1800,260],[1000,2200,480],[1100,-1300,500],[0,-2400,240]].map(([x,z,y],i) => ({x,z,y,radius:190,heading:i === 0 ? 0 : Math.PI,index:i})) : [];
}
export function target(g) {
  return course(g)[g.ring] || { x: 0, z: 180, y: 45, radius: 70, heading: 0, home: true };
}
export function say(g, text, seconds = 5) { g.message = text; g.messageTime = seconds; }
function finish(g, won, title, detail, landing = null) {
  if (g.ended) return;
  g.ended = true;
  if (won) g.score += Math.round(g.plane.fuel * 12 + Math.max(0, g.mission.limit - g.time) * 3 + (100 - g.plane.damage) * 5);
  g.result = { won, title, detail, landing, score: Math.round(g.score) };
  g.events.push(won ? 'win' : 'crash');
}
function crossed(p, old, ring) {
  const nx = Math.sin(ring.heading), nz = Math.cos(ring.heading);
  const a = (old.x - ring.x) * nx + (old.z - ring.z) * nz;
  const b = (p.x - ring.x) * nx + (p.z - ring.z) * nz;
  if (a * b > 0 || a === b) return false;
  const t = a / (a - b), x = old.x + (p.x - old.x) * t - ring.x, y = old.y + (p.y - old.y) * t - ring.y, z = old.z + (p.z - old.z) * t - ring.z;
  return x * x + y * y + z * z < ring.radius * ring.radius;
}
export function stepGame(g, control, dt) {
  if (g.ended) return;
  g.events.length = 0; g.time += dt; g.messageTime = Math.max(0, g.messageTime - dt);
  const p = g.plane, old = stepPhysics(p, g.pending ? { pitch: 0, roll: 0, throttleSet: 0 } : control, g.terrain, dt);
  const agl = p.y - g.terrain.heightAt(p.x, p.z) - 3;
  if (!p.onGround) g.airTime += dt;
  g.maxAgl = Math.max(g.maxAgl, agl);
  g.trailTick += dt;
  if (g.trailTick > 1) { g.trailTick = 0; g.trail.push({ x: p.x, z: p.z }); if (g.trail.length > 400) g.trail.shift(); }
  const route = course(g), next = route[g.ring];
  if (next && !p.onGround && (g.mode === 0 ? crossed(p, old, next) : Math.hypot(p.x - next.x, p.z - next.z, p.y - next.y) < 230)) {
    g.ring++; g.score += g.mode === 0 ? 500 : 350; g.events.push('ring');
    say(g, g.ring === route.length ? 'CIRCUIT COMPLETE · RETURN TO RUNWAY 36' : `${g.mode === 0 ? 'RING' : 'MARKER'} ${g.ring} / ${route.length} · CLEAR`, 4);
  }
  if (p.stall && g.messageTime < 1) say(g, 'STALL · LOWER NOSE + ADD THROTTLE', 1);
  else if (p.fuel < 18 && g.messageTime < 1) say(g, p.fuel > 0 ? 'LOW FUEL · CHOOSE A LANDING SITE' : 'ENGINE OUT · GLIDE TO FLAT GROUND', 2);
  if (p.touchdown && !g.pending) {
    const l = p.touchdown, headingError = Math.min(Math.abs(angle(l.heading)), Math.abs(angle(l.heading - Math.PI)));
    const violent = Math.abs(l.vz) > 5.5 || Math.abs(l.bank) > .48 || Math.abs(l.pitch) > .4 || l.speed > 64 || l.slope > .25;
    if (violent) { finish(g, false, 'A rough end to the day.', 'Impact exceeded the airframe limits. Ease the descent and level the wings before touchdown.', l); return; }
    g.events.push('touchdown');
    const ready = g.mode === 2 ? p.airborne : g.ring === route.length;
    const good = Math.abs(l.vz) < 3.6 && Math.abs(l.bank) < .28 && l.speed < 53 && l.slope < .14 && (g.mode === 2 || (l.runway && headingError < .32));
    if (ready && good) {
      const softness = clamp(1 - Math.abs(l.vz) / 3.6, 0, 1), centre = clamp(1 - Math.abs(l.x) / 34, 0, 1);
      g.score += Math.round(1500 + softness * 1500 + (l.runway ? centre * 1200 : 500));
      g.pending = { won: true, title: g.mode === 1 ? 'Feather-light. Welcome home.' : g.mode === 2 ? 'A place to call it a day.' : 'The valley is yours.', detail: `${l.runway ? 'Runway' : 'Field'} landing · ${Math.abs(l.vz).toFixed(1)} m/s touchdown · ${Math.round(Math.abs(l.x))} m from runway centre`, landing: l };
      say(g, 'TOUCHDOWN · THROTTLE IDLE · ROLLING OUT', 8);
    } else {
      g.pending = { won: false, title: ready ? 'Almost a keeper.' : 'The circuit is still waiting.', detail: !ready ? 'Complete the flight objective before landing.' : 'Land below 103 kt, under 3.6 m/s descent, wings level. Use the runway and align within 18° for scored missions.', landing: l };
      say(g, 'SORTIE FINISHED · ROLLING OUT', 6);
    }
  }
  if (g.pending) {
    g.landedFor += dt;
    if (g.landedFor > 2.5 && p.speed < 32) finish(g, g.pending.won, g.pending.title, g.pending.detail, g.pending.landing);
  }
  if (g.mode === 2 && p.fuel <= 0) finish(g, false, 'The tank ran dry.', 'Find a flat landing site before your fuel is exhausted. Lower power extends your range.');
  if (p.damage >= 100) finish(g, false, 'The airframe gave out.', 'Rough ground and excessive speed damage the plane. Keep the departure on the runway.');
  if (g.time > g.mission.limit) finish(g, false, 'Daylight ran out.', 'The sortie timer expired. Fly a tighter circuit and leave time for the approach.');
  if (p.fuel <= 0 && p.onGround && p.speed < 1 && !g.pending) finish(g, false, 'No fuel. No flight.', 'Use the available fuel to complete a sortie and make a safe landing.');
  if (Math.hypot(p.x, p.z) > 12500) finish(g, false, 'Beyond the ridge.', 'The valley boundary is 12.5 km from the airfield. Turn home sooner.');
}
