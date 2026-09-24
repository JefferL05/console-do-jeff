import { CONFIG, clamp } from './config.js';

export function bindInput(canvas, renderer, { select, cancel, pause, cursor }) {
  let pointer = null, keyboard = { x: 95, y: 130 };
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true }); cursor(null);
  });
  canvas.addEventListener('pointermove', event => {
    if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10) pointer.moved = true;
  });
  canvas.addEventListener('pointerup', event => {
    if (pointer?.id !== event.pointerId) return;
    if (!pointer.moved) select(renderer.worldPoint(event.clientX, event.clientY));
    pointer = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  });
  const reset = () => { pointer = null; };
  canvas.addEventListener('pointercancel', reset); canvas.addEventListener('lostpointercapture', reset);
  window.addEventListener('resize', reset);
  canvas.addEventListener('keydown', event => {
    if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      keyboard = { x: clamp(keyboard.x + (event.key === 'ArrowLeft' ? -10 : event.key === 'ArrowRight' ? 10 : 0), 0, CONFIG.world.width), y: clamp(keyboard.y + (event.key === 'ArrowUp' ? -10 : event.key === 'ArrowDown' ? 10 : 0), CONFIG.world.surface + 15, CONFIG.world.height) };
      cursor(keyboard);
    } else if (event.key === 'Enter') { event.preventDefault(); select(keyboard); }
    else if (event.key === 'Escape') { event.preventDefault(); cancel(); }
    else if (event.code === 'Space') { event.preventDefault(); pause(); }
  });
}
