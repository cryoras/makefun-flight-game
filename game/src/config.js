export const TAU = Math.PI * 2;
export const STEP = 1 / 60;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const angle = a => Math.atan2(Math.sin(a), Math.cos(a));
export const PALETTE = { ink: '#101e27', cream: '#f3efdc', gold: '#f6c86a', mint: '#9ce0cd', red: '#ff806b', sky: '#709aa7', haze: '#c4bc9e' };
export const FLIGHT = { gear: 3, stall: 29, maxRoll: .85, maxPitch: .32, fuelBurn: .12, maxSpeed: 68 };
export const MISSIONS = [
  { id: 'rings', name: 'RING RUN', tag: '01 / THE RIDGE CIRCUIT', description: 'Thread eight gold rings, then bring it home.', brief: 'Eight rings in order. Follow the valley clockwise, then land on Runway 36.', limit: 480 },
  { id: 'landing', name: 'PRECISION LANDING', tag: '02 / THE SOFT ARRIVAL', description: 'One circuit. One beautifully gentle landing.', brief: 'Take off, visit four circuit markers, then land softly on the runway centreline.', limit: 420 },
  { id: 'free', name: 'FREE FLIGHT', tag: '03 / A LITTLE WANDER', description: 'Explore the valley. Find your own way down.', brief: 'Explore the valley, then land anywhere flat before fuel runs out.', limit: 720 }
];
