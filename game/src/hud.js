import { clamp, angle, PALETTE as P, TAU } from './config.js';
import { course, target } from './missions.js';
export function drawHud(g, view, muted = false) {
  const {ctx:c, width:w, height:h} = view, p = g.plane;
  const s = clamp(Math.min(w / 1200, h / 690), .55, 1.2), margin = 26 * s;
  const text = (value, x, y, size = 12, color = P.cream, align = 'left', weight = 500) => { c.fillStyle = color; c.font = `${weight} ${size * s}px system-ui`; c.textAlign = align; c.fillText(value, x, y); };
  const panel = (x, y, ww, hh) => { c.fillStyle = '#10252de6'; c.strokeStyle = '#c1d9c02b'; c.lineWidth = 1; c.beginPath(); c.roundRect(x, y, ww, hh, 9 * s); c.fill(); c.stroke(); };
  const heading = ((p.heading * 180 / Math.PI) % 360 + 360) % 360, agl = Math.max(0, p.y - g.terrain.heightAt(p.x, p.z) - 3);
  const kt = Math.round(p.speed * 1.944), ft = Math.round(p.y * 3.281), vsi = Math.round(p.vz * 196.85);
  c.save();
  const fade = c.createLinearGradient(0, 0, 0, 170 * s); fade.addColorStop(0, '#0b242ccd'); fade.addColorStop(1, '#0b242c00'); c.fillStyle = fade; c.fillRect(0, 0, w, 170 * s);
  text('K E S T R E L  /  R I D G E', margin, 30 * s, 12, P.cream, 'left', 750);
  text(g.mission.name, margin, 53 * s, 10, P.gold);
  const total = course(g).length;
  text(g.mode === 2 ? 'EXPLORE · FIND A SOFT PLACE TO LAND' : `${g.mode === 0 ? 'RINGS' : 'CIRCUIT'}  ${String(g.ring).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, margin, 77 * s, 11, P.mint);
  const remaining = Math.max(0, Math.ceil(g.mission.limit - g.time)), time = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  text(String(Math.round(g.score)).padStart(5, '0'), w - margin, 34 * s, 25, P.cream, 'right', 650);
  text(`SCORE     /     ${time} REMAINING`, w - margin, 56 * s, 10, P.gold, 'right');
  // A real moving compass strip, clipped under a fixed heading bug.
  const compassW = Math.min(w * .29, 360 * s), cx = w / 2;
  c.save(); c.beginPath(); c.rect(cx - compassW / 2, 16 * s, compassW, 56 * s); c.clip();
  for (let d = -90; d <= 90; d += 5) {
    const tick = Math.floor(heading / 5) * 5 + d, x = cx + (tick - heading) * 3.6 * s;
    c.strokeStyle = '#d9e4c880'; c.beginPath(); c.moveTo(x, 41 * s); c.lineTo(x, (tick % 30 === 0 ? 32 : 37) * s); c.stroke();
    if (tick % 30 === 0) { const v = (tick % 360 + 360) % 360, name = ({0:'N',90:'E',180:'S',270:'W'})[v] || String(v).padStart(3, '0'); text(name, x, 26 * s, 10, P.cream, 'center'); }
  }
  c.restore(); text(`HDG   ${String(Math.round(heading) % 360).padStart(3, '0')}°`, cx, 65 * s, 12, P.gold, 'center', 700);
  c.fillStyle = P.gold; c.beginPath(); c.moveTo(cx, 43 * s); c.lineTo(cx - 4 * s, 49 * s); c.lineTo(cx + 4 * s, 49 * s); c.fill();
  // Navigation cue also works when the next objective is outside the camera.
  const dest = target(g), bearing = angle(Math.atan2(dest.x - p.x, dest.z - p.z) - p.heading), distance = Math.hypot(dest.x - p.x, dest.z - p.z);
  const label = g.mode === 2 ? 'AIRFIELD  /  36' : dest.home ? 'HOME  /  RUNWAY 36' : `${g.mode === 0 ? 'RING' : 'MARKER'} ${g.ring + 1}`;
  panel(margin, 100 * s, 194 * s, 67 * s);
  text(label, margin + 14 * s, 121 * s, 10, P.gold);
  text(`${bearing < -.12 ? '‹' : bearing > .12 ? '›' : '↑'}  ${(distance / 1000).toFixed(2)} KM`, margin + 14 * s, 149 * s, 20, P.cream, 'left', 650);
  if (agl < 35 && !p.onGround) text('LOW TERRAIN', cx, h * .35, 12, P.gold, 'center', 700);
  if (p.stall) text('STALL', cx, h * .40, 26, P.red, 'center', 800);
  if (g.messageTime > 0) {
    const yy = h * .19, ww = Math.min(w - 30, 520 * s);
    panel(cx - ww / 2, yy, ww, 33 * s); text(g.message, cx, yy + 21 * s, 10, g.message.includes('STALL') ? P.red : P.gold, 'center', 650);
  }
  // The panel's tapes and attitude ball remain lit in both camera modes.
  const panelW = 548 * s, ph = 126 * s, py = h - ph - 34 * s, px = cx - panelW / 2;
  panel(px, py, panelW, ph);
  text('KESTREL  /  FLIGHT SYSTEMS', cx, py + 16 * s, 8, '#b3c6b0', 'center');
  const ballX = cx, ballY = py + 72 * s, radius = 41 * s;
  c.save(); c.beginPath(); c.arc(ballX, ballY, radius, 0, TAU); c.clip(); c.translate(ballX, ballY); c.rotate(-p.roll);
  const horizon = p.pitch * 130 * s;
  c.fillStyle = '#5a96aa'; c.fillRect(-100 * s, -130 * s + horizon, 200 * s, 130 * s); c.fillStyle = '#81745c'; c.fillRect(-100 * s, horizon, 200 * s, 150 * s);
  c.strokeStyle = '#f8e9bd'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-70 * s, horizon); c.lineTo(70 * s, horizon); c.stroke();
  for (let a = -3; a <= 3; a++) if (a) { c.strokeStyle = '#ecedce99'; c.beginPath(); c.moveTo(-10 * s, horizon + a * 14 * s); c.lineTo(10 * s, horizon + a * 14 * s); c.stroke(); }
  c.restore(); c.strokeStyle = '#b9c8af77'; c.lineWidth = 2; c.beginPath(); c.arc(ballX, ballY, radius, 0, TAU); c.stroke();
  c.strokeStyle = P.gold; c.lineWidth = 2; c.beginPath(); c.moveTo(ballX - 27 * s, ballY); c.lineTo(ballX - 9 * s, ballY); c.lineTo(ballX - 9 * s, ballY + 5 * s); c.moveTo(ballX + 27 * s, ballY); c.lineTo(ballX + 9 * s, ballY); c.lineTo(ballX + 9 * s, ballY + 5 * s); c.stroke(); c.fillStyle = P.gold; c.fillRect(ballX - 2 * s, ballY - 2 * s, 4 * s, 4 * s);
  function tape(x, value, unit, step, caption) {
    const yy = py + 31 * s, hh = 74 * s, ww = 88 * s;
    c.fillStyle = '#0a1c23'; c.fillRect(x, yy, ww, hh);
    c.save(); c.beginPath(); c.rect(x, yy, ww, hh); c.clip();
    for (let i = -3; i <= 3; i++) {
      const v = Math.floor(value / step) * step + i * step, ty = yy + hh / 2 - (v - value) / step * 19 * s;
      if (v < 0) continue;
      text(String(v), x + ww - 15 * s, ty + 3 * s, 9, '#a6c5b1', 'right'); c.strokeStyle = '#91b8a57a'; c.beginPath(); c.moveTo(x + ww - 10 * s, ty); c.lineTo(x + ww - 3 * s, ty); c.stroke();
    }
    c.restore(); c.fillStyle = '#203d42'; c.fillRect(x - 4 * s, yy + hh / 2 - 12 * s, 62 * s, 26 * s);
    text(String(Math.round(value)), x + 48 * s, yy + hh / 2 + 7 * s, 21, P.mint, 'right', 700);
    text(`${caption}  /  ${unit}`, x, py + 22 * s, 9, P.gold); text(caption === 'ALT' ? `${Math.round(agl * 3.281)} AGL` : p.stall ? 'STALL' : 'AIRSPEED', x, py + 117 * s, 8, P.mint);
  }
  tape(px + 22 * s, kt, 'KT', 10, 'SPD'); tape(px + panelW - 110 * s, ft, 'FT', 100, 'ALT');
  text('VSI', cx + 70 * s, py + 49 * s, 9, P.gold); text(`${vsi >= 0 ? '+' : ''}${vsi}`, cx + 70 * s, py + 69 * s, 14, P.mint); text('FT / MIN', cx + 70 * s, py + 85 * s, 8, '#a4bcaa');
  text(p.onGround ? 'GROUND' : 'AIRBORNE', cx - 68 * s, py + 53 * s, 8, P.gold, 'right'); text(g.camera ? 'COCKPIT' : 'CHASE', cx - 68 * s, py + 73 * s, 9, P.mint, 'right');
  // Power and condition: three separate decisions on every sortie.
  if (w > 760) {
    const x = margin, y = h - 148 * s;
    for (const [i, name, value, col] of [[0,'THR',p.throttle * 100,P.gold],[1,'FUEL',p.fuel,p.fuel < 18 ? P.red : P.mint],[2,'HULL',100-p.damage,p.damage > 45 ? P.red : P.mint]]) {
      text(name, x, y + i * 31 * s, 9, '#e2e5c9'); text(`${Math.round(value)}%`, x + 140 * s, y + i * 31 * s, 10, col, 'right');
      c.fillStyle = '#10272d'; c.fillRect(x, y + (7 + i * 31) * s, 140 * s, 4 * s); c.fillStyle = col; c.fillRect(x, y + (7 + i * 31) * s, value * 1.4 * s, 4 * s);
    }
  }
  // Compact north-up course chart.
  if (w > 960) {
    const size = 145 * s, x = w - margin - size, y = h - size - 34 * s;
    panel(x, y, size, size); text('VALLEY CHART', x + 10 * s, y + 17 * s, 8, P.gold);
    const point = q => ({ x: x + size * .30 + q.x / 5100 * size, y: y + size * .60 - q.z / 6800 * size });
    c.save(); c.beginPath(); c.rect(x + 4, y + 23 * s, size - 8, size - 26 * s); c.clip();
    c.strokeStyle = '#8cb5a24d'; c.lineWidth = 1;
    for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(x + size * .87, y + size * .45, (20 + i * 13) * s, (50 + i * 12) * s, -.1, 0, TAU); c.stroke(); }
    c.strokeStyle = '#a8baa868'; c.setLineDash([3,4]); c.beginPath(); course(g).forEach((r, i) => { const q = point(r); if(i) c.lineTo(q.x,q.y); else c.moveTo(q.x,q.y); }); c.stroke(); c.setLineDash([]);
    course(g).forEach((r, i) => { const q = point(r); c.strokeStyle = i === g.ring ? P.gold : i < g.ring ? P.mint : '#849e8c'; c.beginPath(); c.arc(q.x, q.y, i === g.ring ? 4 : 2, 0, TAU); c.stroke(); });
    const a = point({x:0,z:0}), b = point({x:0,z:1000}); c.strokeStyle = P.cream; c.lineWidth = 3; c.beginPath(); c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();
    const pp = point(p); c.translate(pp.x, pp.y); c.rotate(p.heading); c.fillStyle = P.gold; c.beginPath(); c.moveTo(0,-6); c.lineTo(-4,5);c.lineTo(0,3);c.lineTo(4,5);c.fill(); c.restore();
  }
  text('ARROWS / WASD  STEER     SHIFT / CTRL  THROTTLE     C  VIEW     P  PAUSE', margin, h - 12 * s, 9, '#dfdfc5b3');
  text(muted ? 'M  SOUND OFF' : 'M  SOUND ON', w - margin, h - 12 * s, 9, P.gold, 'right');
  c.restore();
}
