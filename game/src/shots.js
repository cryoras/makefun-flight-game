import { angle, clamp, STEP } from './config.js';
import { createGame, target, course, stepGame } from './missions.js';
// The staging pilot only supplies the same controls a player can use.
export function autopilot(g) {
  const p = g.plane, next = target(g), home = next.home;
  if (g.pending || g.ended) return { throttleSet: 0, pitch: 0, roll: 0 };
  if (!p.airborne) return { throttleSet: 1, pitch: .7, roll: clamp(-p.x * .01 - p.heading * 3, -.3, .3) };
  let tx = next.x, tz = next.z, altitude = next.y;
  if (home) {
    // Intercept the centreline before following the shallow approach path.
    if (Math.abs(p.x) > 150 || p.z > 900) { tz = -1800; altitude = 190; }
    else { tx = clamp(-p.x * .7, -35, 35); tz = p.z + 700; altitude = 43 + Math.max(0, -p.z) * .067; }
  }
  const error = angle(Math.atan2(tx - p.x, tz - p.z) - p.heading);
  const bank = clamp(error * 1.7, -.75, .75);
  const desiredSpeed = home && p.z > -1700 && Math.abs(p.x) < 150 ? 39 : clamp(58 - Math.abs(error) * 21, 34, 58);
  const throttle = clamp(desiredSpeed * desiredSpeed * .0027 / 12 + (desiredSpeed - p.speed) * .025, .06, 1);
  const targetVz = clamp((altitude - p.y) * (home ? .22 : .19) - (home ? (p.z < 0 ? 2.5 : .6) : 0), home ? -3.0 : -12, 17);
  const trim = (p.speed - 40) * .13 - Math.abs(p.roll) * 1.25;
  const pitch = Math.asin(clamp((targetVz - trim) / Math.max(p.speed, 30), -.31, .31));
  return { roll: bank / .85, pitch: pitch / .32, throttleSet: throttle };
}
export function stageWorld(kind, seed = 1) {
  const g = createGame(seed, 0);
  if (kind === 'start') return g;
  const limit = Math.ceil(g.mission.limit / STEP) + 20;
  for (let i = 0; i < limit; i++) {
    stepGame(g, autopilot(g), STEP);
    if (kind === 'play' && g.time > 17 && !g.plane.onGround) break;
    if (kind === 'land' && g.ring === course(g).length && g.plane.z > -620 && !g.plane.onGround) break;
    if (g.ended) break;
  }
  return g;
}
export async function stageShot(kind, seed, app) {
  const valid = ['start', 'play', 'land', 'end'].includes(kind) ? kind : 'start';
  const g = stageWorld(valid, seed);
  app.setWorld(g, valid === 'start' ? 'title' : g.ended ? 'over' : 'play');
  app.paint(); await new Promise(resolve => requestAnimationFrame(resolve)); app.paint();
  window.__shotReady = true;
}
