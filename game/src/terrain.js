import { mulberry32 } from './random.js';
import { clamp, mix } from './config.js';
export const RUNWAY = { x: 0, z: 0, length: 1000, width: 68, y: 42, heading: 0 };
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export function riverX(z) { return -680 + Math.sin(z / 850) * 140 + Math.sin(z / 2100) * 200; }
export function heightAt(x, z, seed = 1) {
  const phase = (seed % 997) * .003;
  const valley = riverX(z);
  const west = Math.exp(-Math.pow((x - valley + 1450 + 210 * Math.sin(z / 740)) / 830, 2));
  const east = Math.exp(-Math.pow((x - 2150 - 360 * Math.sin(z / 1100 + phase)) / 1050, 2));
  const ripple = Math.sin(x / 260 + Math.sin(z / 530)) * Math.cos(z / 330 + phase);
  let h = 36 + 440 * west * (.72 + .28 * Math.sin(z / 960 + .8)) + 510 * east * (.75 + .25 * Math.sin(z / 1250 + 2));
  h += (13 + 24 * (east + west)) * ripple;
  h = mix(h, 21, Math.exp(-Math.pow((x - valley) / 95, 2)));
  const field = (1 - smooth((Math.abs(x) - 140) / 280)) * (1 - smooth((Math.abs(z - 500) - 650) / 420));
  return mix(h, RUNWAY.y, field);
}
export function createTerrain(seed = 1) {
  const rng = mulberry32(seed), height = (x, z) => heightAt(x, z, seed);
  const trees = [];
  for (let i = 0; i < 1800; i++) {
    const x = (rng() - .5) * 10000, z = (rng() - .4) * 12000, y = height(x, z);
    if (Math.abs(x - riverX(z)) > 65 && !(Math.abs(x) < 260 && z > -350 && z < 1400) && y < 490) trees.push({ x, z, y, size: 5 + rng() * 8 });
  }
  const route = [[0, 1550, 235], [650, 2700, 310], [1750, 2550, 580], [2250, 1050, 625], [1500, -800, 480], [450, -2050, 240], [0, -1650, 165], [0, -680, 112]];
  let prev = { x: 0, z: 450 };
  const rings = route.map(([x, z, y], i) => {
    const heading = Math.atan2(x - prev.x, z - prev.z);
    const r = { x, z, y: Math.max(y, height(x, z) + (i < 6 ? 150 : 65)), radius: i < 6 ? 86 : 72, heading, index: i };
    prev = r; return r;
  });
  const river = [];
  for (let z = -10000; z <= 12000; z += 110) river.push({ x: riverX(z), z, y: 23 });
  const clouds = Array.from({ length: 22 }, () => ({ x: (rng() - .5) * 20000, z: (rng() - .5) * 20000, y: 1600 + rng() * 900, size: 220 + rng() * 350 }));
  return { seed, heightAt: height, runway: RUNWAY, rings, trees, river, clouds };
}
export function onRunway(x, z, margin = 0) { return Math.abs(x) < RUNWAY.width / 2 + margin && z > RUNWAY.z - margin && z < RUNWAY.length + margin; }
export function slopeAt(terrain, x, z) {
  const h = terrain.heightAt(x, z);
  return Math.hypot(terrain.heightAt(x + 12, z) - h, terrain.heightAt(x, z + 12) - h) / 12;
}
