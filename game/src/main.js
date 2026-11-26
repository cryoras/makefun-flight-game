import { MISSIONS, STEP } from './config.js';
import { createGame, stepGame } from './missions.js';
import { createInput, ACTION } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { drawHud } from './hud.js';
import { stageShot } from './shots.js';
const canvas = document.querySelector('#game'), renderer = createRenderer(canvas), input = createInput(canvas), audio = createAudio();
const $ = id => document.getElementById(id), params = new URLSearchParams(location.search);
const parsedSeed = Number(params.get('seed') ?? 1), seed = Number.isFinite(parsedSeed) ? parsedSeed >>> 0 : 1;
let mode = 0, world = createGame(seed, mode), screen = 'title', muted = false, last = 0, accumulator = 0, staging = params.has('shot');
const bests = [0, 0, 0];
try { const saved = JSON.parse(localStorage.getItem('kestrel-ridge-bests') || '[]'); bests.forEach((_, i) => bests[i] = Number(saved?.[i]) || 0); } catch { /* Storage is optional in private and offline contexts. */ }
function setScreen(value) {
  screen = value;
  for (const name of ['title', 'paused', 'over']) $(name).hidden = value !== name;
  $('brief').hidden = true;
  if (value === 'paused') $('pause-brief').textContent = world.mission.brief;
  if (value === 'over' && world.result) {
    const r = world.result;
    if (r.won) { bests[world.mode] = Math.max(bests[world.mode], r.score); try { localStorage.setItem('kestrel-ridge-bests', JSON.stringify(bests)); } catch {} }
    $('result-label').textContent = r.won ? 'LOGBOOK / SAFE ARRIVAL' : 'LOGBOOK / SORTIE ENDED';
    $('result-title').textContent = r.title; $('result-detail').textContent = r.detail;
    $('score').textContent = r.score.toLocaleString(); $('best').textContent = bests[world.mode].toLocaleString();
    const sec = Math.floor(world.airTime); $('airtime').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }
  input.clear(); accumulator = 0;
}
function select(i) {
  mode = (i + 3) % 3;
  document.querySelectorAll('.mission').forEach((b, index) => { b.classList.toggle('selected', index === mode); b.setAttribute('aria-pressed', String(index === mode)); });
}
const nav = document.querySelector('.missions');
MISSIONS.forEach((m, i) => {
  const b = document.createElement('button'); b.className = 'mission';
  b.innerHTML = `<small>${m.tag}</small><strong>${m.name}</strong><em>${m.description}</em>`;
  b.addEventListener('click', () => select(i)); nav.append(b);
}); select(0);
const frame = document.querySelector('iframe');
function themeFigure() {
  try {
    const doc = frame.contentDocument; doc.documentElement.dataset.theme = 'dark';
    const style = doc.createElement('style'); style.textContent = '*{font-family:system-ui,sans-serif!important}body{padding:12px 20px}'; doc.head.append(style);
  } catch { /* The canvas and flight menus are independent of the hero figure. */ }
}
frame.addEventListener('load', themeFigure);
if (frame.contentDocument?.readyState === 'complete') themeFigure();
function launch() { staging = false; world = createGame(seed, mode); audio.start(); setScreen('play'); }
function menu() { staging = false; world = createGame(seed, mode); setScreen('title'); }
$('launch').onclick = launch; $('again').onclick = launch; $('resume').onclick = () => { audio.start(); setScreen('play'); };
document.querySelectorAll('.menu').forEach(b => b.onclick = menu);
function paint() {
  const view = renderer.scene(world, screen === 'title');
  if (screen !== 'title') drawHud(world, view, muted);
  if (screen === 'play' && world.time < 10) { $('brief').hidden = false; $('brief').textContent = world.mission.brief; } else $('brief').hidden = true;
}
function actions(a) {
  if (a & ACTION.MUTE) { audio.start(); muted = audio.toggle(); }
  if (screen === 'title') {
    if (a & ACTION.MENU) select(0); if (a & ACTION.NEXT) select(1); if (a & ACTION.PREV) select(2);
    if (a & ACTION.CONFIRM) launch();
    return;
  }
  if (a & ACTION.RESTART || screen === 'over' && a & ACTION.CONFIRM) { launch(); return; }
  if ((a & ACTION.PAUSE) && screen !== 'over') { setScreen(screen === 'paused' ? 'play' : 'paused'); audio.start(); }
  else if (screen === 'paused' && a & ACTION.CONFIRM) setScreen('play');
  if (a & ACTION.CAMERA) world.camera ^= 1;
}
function tick(now) {
  const delta = Math.min(.1, (now - (last || now)) / 1000); last = now;
  const control = input.read(delta); actions(control.actions);
  if (!staging && screen === 'play') {
    accumulator += delta;
    while (accumulator >= STEP) {
      stepGame(world, control, STEP); world.events.forEach(event => audio.event(event)); accumulator -= STEP;
      if (world.ended) { setScreen('over'); break; }
    }
  }
  audio.update(world.plane, screen === 'play' && !staging); paint(); requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'play' && !staging) setScreen('paused'); last = 0; });
window.addEventListener('blur', () => { if (screen === 'play' && !staging) setScreen('paused'); });
if (staging) {
  await stageShot(params.get('shot'), seed, { setWorld(g, state) { world = g; mode = g.mode; setScreen(state); }, paint });
} else paint();
requestAnimationFrame(tick);
