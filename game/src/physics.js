import { FLIGHT, clamp, mix } from './config.js';
import { onRunway, slopeAt } from './terrain.js';
export function createPlane(terrain) {
  return { x: 0, z: 90, y: terrain.runway.y + FLIGHT.gear, heading: 0, pitch: 0, roll: 0, speed: 0, vz: 0, throttle: .12, fuel: 100, damage: 0, onGround: true, airborne: false, stall: false, distance: 0, touchdown: null };
}
export function stepPhysics(p, c, t, dt) {
  p.touchdown = null;
  if (c.throttleSet !== undefined) p.throttle = clamp(c.throttleSet, 0, 1);
  else p.throttle = clamp(p.throttle + (c.throttle || 0) * dt * .35 + (c.boost ? dt * .7 : 0), 0, 1);
  if (p.fuel <= 0) p.throttle = 0;
  p.fuel = Math.max(0, p.fuel - dt * (.025 + p.throttle * FLIGHT.fuelBurn));
  p.roll = mix(p.roll, (c.roll || 0) * FLIGHT.maxRoll, Math.min(1, dt * 2.8));
  p.pitch = mix(p.pitch, (c.pitch || 0) * FLIGHT.maxPitch, Math.min(1, dt * 2));
  const drag = p.speed * p.speed * .0027;
  const brake = p.onGround ? (p.throttle < .28 ? 7 : .8) : 0;
  const thrust = p.throttle * 12 * (1 - p.damage * .004);
  p.speed = clamp(p.speed + dt * (thrust - drag - brake - Math.sin(p.pitch) * 3.1), 0, 105);
  p.heading += dt * (Math.tan(p.roll) * 9.81 / Math.max(p.speed, 25) + (c.yaw || 0) * .15) * (p.onGround ? Math.min(p.speed / 25, .6) : 1);
  const old = { x: p.x, y: p.y, z: p.z };
  const travel = p.speed * Math.cos(p.pitch) * dt;
  p.x += Math.sin(p.heading) * travel; p.z += Math.cos(p.heading) * travel; p.distance += travel;
  const ground = t.heightAt(p.x, p.z) + FLIGHT.gear;
  if (p.onGround && p.speed > 32 && p.pitch > .055) { p.onGround = false; p.airborne = true; p.vz = 2; }
  p.stall = !p.onGround && p.speed < FLIGHT.stall;
  if (!p.onGround) {
    const lift = (p.speed - 40) * .13;
    const sink = p.stall ? (FLIGHT.stall - p.speed) * .7 + 3 : 0;
    const targetVz = Math.sin(p.pitch) * p.speed + lift - sink - Math.abs(p.roll) * 1.25;
    p.vz = mix(p.vz, targetVz, Math.min(1, dt * 1.5));
    p.y += p.vz * dt;
    if (p.y <= ground) {
      p.touchdown = { vz: p.vz, speed: p.speed, bank: p.roll, pitch: p.pitch, x: p.x, z: p.z, heading: p.heading, slope: slopeAt(t, p.x, p.z), runway: onRunway(p.x, p.z) };
      p.onGround = true; p.y = ground; p.vz = 0;
    }
  } else {
    p.y = ground; p.vz = (p.y - old.y) / dt;
    if (!onRunway(p.x, p.z, 8) && p.speed > 22) p.damage += dt * (2 + slopeAt(t, p.x, p.z) * 40);
  }
  if (p.speed > FLIGHT.maxSpeed) p.damage += dt * (p.speed - FLIGHT.maxSpeed) * .2;
  p.damage = clamp(p.damage, 0, 100);
  return old;
}
