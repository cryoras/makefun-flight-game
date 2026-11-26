import { clamp } from './config.js';
export const ACTION = { CONFIRM: 1, PAUSE: 2, CAMERA: 4, MUTE: 8, RESTART: 16, NEXT: 32, PREV: 64, MENU: 128 };
export function createInput(canvas) {
  const keys = new Set(); let flags = 0, mouse = false, mx = 0, my = 0, boost = 0;
  const map = { Space: 1, Enter: 1, KeyP: 2, Escape: 2, KeyC: 4, KeyM: 8, KeyR: 16, Digit1: 128, Digit2: 32, Digit3: 64 };
  window.addEventListener('keydown', e => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ControlLeft','ControlRight','ShiftLeft','ShiftRight'].includes(e.code)) e.preventDefault();
    keys.add(e.code); if (!e.repeat && map[e.code]) flags |= map[e.code];
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  const clear = () => { keys.clear(); mouse = false; boost = 0; flags = 0; };
  window.addEventListener('blur', clear);
  canvas.addEventListener('pointermove', e => { mx = e.clientX / innerWidth * 2 - 1; my = e.clientY / innerHeight * 2 - 1; mouse = true; });
  canvas.addEventListener('pointerleave', () => { mouse = false; });
  canvas.addEventListener('pointerdown', () => { flags |= ACTION.CONFIRM; boost = 1.4; });
  return {
    action(a) { flags |= a; }, clear,
    read(dt) {
      const has = (...a) => a.some(k => keys.has(k));
      const horizontal = Number(has('ArrowRight','KeyD')) - Number(has('ArrowLeft','KeyA'));
      const vertical = Number(has('ArrowUp','KeyW')) - Number(has('ArrowDown','KeyS'));
      const throttle = Number(has('ShiftLeft','ShiftRight','Equal')) - Number(has('ControlLeft','ControlRight','Minus'));
      boost = Math.max(0, boost - dt);
      const actions = flags; flags = 0;
      return { actions, roll: horizontal || (mouse ? clamp(mx * .65, -.65, .65) : 0), pitch: vertical || (mouse ? clamp(-my * .5, -.5, .5) : 0), throttle, boost: boost > 0 };
    }
  };
}
