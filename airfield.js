/** Short-field departure: a pocket airfield on gently rising ground. */
const {
  Cam, clamp, facing, fit, proj, unproj, rings, rrect, prism, ringAt, run,
  hull, poly, open, fillet, seg, spring, stepS, mk, solid, put,
  pointer, register, disposer,
} = HL;

function mount({ stage, svg, read }, value) {
  const bag = disposer(), C = Cam(45, 0.5, 1.68);
  fit(C, [[-83, -57, -5], [83, -57, 0], [-83, 57, 0], [83, 57, 0],
    [-60, -39, 72], [18, 32, 65]], 200, 166);
  const P = proj(C), front = facing(C), root = mk("g", {}, svg);
  const cells = [], flight = spring(8), plane = mk("g", {}, root);
  let strength = value, over = null, chosen = "", lastPlane = NaN;
  function block(parent, bounds, z0, z1, radius = 2, inset = 0.7) {
    const [a, b] = rings(...bounds, radius, inset), el = solid(parent);
    return { el, draw: (h) => put(el, prism(P, front, a, b, z0 + h, z1 + h)) };
  }
  function tapered(parent, foot, top, inner, z0, z1) {
    const el = solid(parent);
    return (h) => put(el, {
      sil: poly(hull(ringAt(P, foot, z0 + h).concat(ringAt(P, top, z1 + h)))),
      crease: open(ringAt(P, run(inner, front), z1 + h)),
    });
  }
  const base = block(root, [-83, -57, 83, 57], -5, 0, 8, 1.5);
  base.draw(0);
  // Land plates and one unbroken runway, painted from the far corner.
  for (let s = 0; s < 6; s++) for (let i = 0; i < 4; i++) {
    const j = s - i;
    if (j < 0 || j > 2 || (j === 2 && i > 0)) continue;
    const x = -80 + i * 40, y = -54 + j * 36;
    const h0 = j === 2 ? 2.5 : 2 + 2.5 * Math.exp(-((i - 0.4) ** 2 + j ** 2));
    const g = mk("g", {}, root), land = block(g, [x, y, j === 2 ? 78.5 : x + 38.5, y + 34.5], 0, 1, 3, 0.8);
    const c = { x: j === 2 ? 0 : x + 20, y: y + 18, h0, sp: spring(h0), g, land, drawn: NaN, parts: [] };
    if (j === 2) {
      const strip = block(g, [-75, 23, 75, 48], 1.1, 1.8, 1.8, 0.6);
      const marks = mk("path", { class: "lo nf" }, g);
      c.parts.push((h) => {
        strip.draw(h);
        marks.setAttribute("d", [-60, -30, 0, 30, 60].map((x) => seg(P(x - 5, 35.5, h + 1.9), P(x + 5, 35.5, h + 1.9))).join(""));
      });
    }
    if (i === 0 && j === 0) {
      const foot = rrect(-69, -48, -53, -32, 2), top = rrect(-66, -45, -56, -35, 1.5);
      c.parts.push(tapered(g, foot, top, rrect(-65.3, -44.3, -56.7, -35.7, 1), 1, 35));
      const cab = block(g, [-72, -51, -50, -29], 35, 46, 3);
      const windows = mk("path", { class: "lo nf" }, g);
      const roof = block(g, [-74, -53, -48, -27], 47, 49, 3);
      c.accent = cab.el.sil;
      c.parts.push((h) => {
        cab.draw(h);
        windows.setAttribute("d", open(ringAt(P, run(rrect(-71.6, -50.6, -50.4, -29.4, 2.6), front), h + 39)));
        roof.draw(h);
      });
      c.name = "tower";
    }
    if (i === 2 && j === 0) {
      // A barrel roof, extruded back from its arched front opening.
      const shell = solid(g), arc = (y, inset, h) => {
        const pts = [[4 + inset, y, h + 1]];
        for (let n = 0; n <= 28; n++) {
          const a = Math.PI - n * Math.PI / 28;
          pts.push([20 + (16 - inset) * Math.cos(a), y, h + 6 + (17 - inset) * Math.sin(a)]);
        }
        pts.push([36 - inset, y, h + 1]);
        return pts.map((p) => P(...p));
      };
      c.accent = shell.sil;
      c.parts.push((h) => {
        const outline = hull(arc(-50, 0, h).concat(arc(-22, 0, h)));
        put(shell, { sil: poly(fillet(outline, outline.map(() => 0.7), 4)), crease: open(arc(-21.9, 2.6, h)) });
      });
      c.name = "hangar";
    }
    cells.push(c);
  }
  root.append(cells.find((c) => c.y === 36).g);
  // The aircraft is a collection of rounded, opaque little lifting surfaces.
  root.append(plane);
  const tail = block(plane, [-8, 21, 0, 43], 3.1, 4.2, 2);
  const wing = solid(plane);
  const wingRing = fillet([[6, 11], [12, 11], [19, 30], [19, 34], [12, 53], [6, 53], [9, 34], [9, 30]], Array(8).fill(1.4), 6);
  const wingPath = (h) => open(wingRing.filter(([, y]) => y > 33).map(([x, y]) => P(12 + (x - 12) * 0.85, 32 + (y - 32) * 0.94, h)));
  const body = block(plane, [-9, 28.5, 40, 35.5], 2, 6, 3.5, 0.6);
  const canopy = block(plane, [17, 29.2, 29, 34.8], 5.8, 9, 2.7, 0.5);
  const fin = tapered(plane, rrect(-8, 30.8, 3, 33.2, 1),
    rrect(-6, 31.3, -1, 32.7, 0.6), rrect(-5.6, 31.6, -1.4, 32.4, 0.3), 5, 13);
  const prop = mk("path", { class: "lo nf" }, plane);
  function drawPlane(h) {
    if (h === lastPlane) return;
    lastPlane = h;
    tail.draw(h);
    put(wing, { sil: poly(hull(wingRing.flatMap(([x, y]) => [P(x, y, h + 3), P(x, y, h + 4)]))), crease: wingPath(h + 4) });
    body.draw(h); canopy.draw(h); fin(h);
    prop.setAttribute("d", seg(P(40.8, 26, h + 4), P(40.8, 38, h + 4)));
  }
  const B = register(stage, (dt) => {
    let moving = stepS(flight, dt);
    for (const c of cells) {
      if (stepS(c.sp, dt)) moving = true;
      if (c.drawn === c.sp.x) continue;
      c.drawn = c.sp.x; c.land.draw(c.sp.x);
      for (const draw of c.parts) draw(c.sp.x);
    }
    drawPlane(flight.x);
    return moving;
  });
  bag.add(B.unregister);
  const falloff = (x, y) => over ? Math.max(0, 1 - Math.hypot(x - over[0], y - over[1]) / 92) ** 2 : 0;
  function retarget() {
    for (const c of cells) {
      c.sp.t = c.h0 + strength * 0.34 * falloff(c.x, c.y);
      c.land.el.sil.classList.toggle("hi", chosen === `ground ${cells.indexOf(c)}`);
    }
    flight.t = 8 + strength * falloff(18, 32);
    body.el.sil.classList.toggle("hi", !over || chosen === "plane");
    for (const c of cells) if (c.accent) c.accent.classList.toggle("hi", chosen === c.name);
    read.textContent = !over ? "rest" : chosen.startsWith("ground") ? (over[1] > 18 ? "runway" : "apron") : chosen;
    B.wake();
  }
  bag.add(pointer(stage, {
    move: ([sx, sy]) => {
      const q = unproj(C, sx, sy, 12);
      const t = unproj(C, sx, sy, 44), h = unproj(C, sx, sy, 20);
      if ((q[0] > -10 && q[0] < 41 && Math.abs(q[1] - 32) < 5) ||
          (q[0] > 5 && q[0] < 20 && q[1] > 11 && q[1] < 53)) { over = q; chosen = "plane"; }
      else if (t[0] > -75 && t[0] < -47 && t[1] > -54 && t[1] < -26) { over = t; chosen = "tower"; }
      else if (h[0] > 3 && h[0] < 37 && h[1] > -51 && h[1] < -21) { over = h; chosen = "hangar"; }
      else {
        over = unproj(C, sx, sy, 3);
        if (Math.abs(over[0]) > 81 || Math.abs(over[1]) > 55) { over = null; chosen = ""; }
        else {
          const c = over[1] > 18 ? cells.find((c) => c.y === 36) : cells.filter((c) => c.y !== 36).reduce((a, b) => Math.hypot(a.x - over[0], a.y - over[1]) < Math.hypot(b.x - over[0], b.y - over[1]) ? a : b);
          chosen = `ground ${cells.indexOf(c)}`;
        }
      }
      retarget();
    },
    leave: () => { over = null; chosen = ""; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());
  retarget();
  return { set: (v) => { strength = clamp(v, 12, 38); retarget(); }, destroy: bag.dispose };
}

hairline({
  name: "airfield",
  means: "A pocket airfield: the pointer lifts the plane and the ground rises nearby.",
  rules: [1, 3, 4, 5, 6, 9],
  range: [12, 25, 38],
  tour: [[100, 194], [183, 211], [238, 272], null],
  mount,
});
