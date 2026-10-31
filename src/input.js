export const keys = { l: 0, r: 0, u: 0 };

const km = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', Space: 'u' };

export function initInput() {
  const coarse = matchMedia('(pointer:coarse)').matches;
  document.getElementById(coarse ? 'controls' : 'keys').hidden = false;

  addEventListener('keydown', e => {
    const k = km[e.code];
    if (k) { keys[k] = 1; e.preventDefault(); }
  });
  addEventListener('keyup', e => {
    const k = km[e.code];
    if (k) { keys[k] = 0; e.preventDefault(); }
  });

  [['lt', 'l'], ['rt', 'r'], ['up', 'u']].forEach(([id, k]) => {
    const el = document.getElementById(id);
    const on = e => {
      e.preventDefault();
      keys[k] = 1;
      el.classList.add('on');
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    };
    const off = () => { keys[k] = 0; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => el.addEventListener(n, off));
    el.addEventListener('contextmenu', e => e.preventDefault());
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) keys.l = keys.r = keys.u = 0;
  });
}
