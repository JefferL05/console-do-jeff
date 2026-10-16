// Pointer-only state machine: a cancelled contact, drag or pinch can never tap.
export function bindFieldGestures(canvas, camera, { select, cursor = () => {}, precision = () => false, change = () => {} }) {
  const contacts = new Map(); let gesture = null, pinched = false;
  const pair = () => [...contacts.values()].slice(0, 2);
  const metrics = () => { const [a, b] = pair(); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) }; };
  const point = e => camera.world(e.clientX, e.clientY - (e.pointerType === 'touch' && precision() ? 42 : 0));
  const resetPinch = () => { const m = metrics(); gesture = { mode: 'pinch', ...m, zoom: camera.zoom, anchor: camera.world(m.x, m.y) }; pinched = true; cursor(null); };
  function down(e) {
    if (e.button !== 0 || contacts.size >= 2) return;
    contacts.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture(e.pointerId);
    if (contacts.size === 2) { resetPinch(); return; }
    pinched = false; gesture = { mode: 'tap', startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, type: e.pointerType };
    cursor(point(e));
  }
  function move(e) {
    if (!contacts.has(e.pointerId) || !gesture) return;
    contacts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (contacts.size === 2) {
      if (gesture.mode !== 'pinch') resetPinch();
      const m = metrics(); camera.setZoom(gesture.zoom * m.distance / gesture.distance);
      const box = canvas.getBoundingClientRect();
      camera.pan.x += m.x - box.left - (camera.x + gesture.anchor.x * camera.scale);
      camera.pan.y += m.y - box.top - (camera.y + gesture.anchor.y * camera.scale);
      camera.camera(); change(); return;
    }
    if (pinched) return;
    if (Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) > 9) gesture.mode = 'pan';
    if (gesture.mode === 'pan') { camera.pan.x += e.clientX - gesture.x; camera.pan.y += e.clientY - gesture.y; camera.camera(); cursor(null); change(); }
    else cursor(point(e));
    gesture.x = e.clientX; gesture.y = e.clientY;
  }
  function end(e) {
    if (!contacts.has(e.pointerId)) return;
    if (gesture?.mode === 'tap' && !pinched && contacts.size === 1) select(point(e));
    contacts.delete(e.pointerId); cursor(null);
    if (!contacts.size) { gesture = null; pinched = false; }
  }
  function cancel(e) { contacts.delete(e.pointerId); pinched = true; gesture = null; cursor(null); }
  const reset = () => { contacts.clear(); pinched = true; gesture = null; cursor(null); };
  const handlers = { pointerdown: down, pointermove: move, pointerup: end, pointercancel: cancel, lostpointercapture: cancel };
  for (const [name, fn] of Object.entries(handlers)) canvas.addEventListener(name, fn);
  globalThis.addEventListener?.('resize', reset);
  return () => { for (const [name, fn] of Object.entries(handlers)) canvas.removeEventListener(name, fn); globalThis.removeEventListener?.('resize', reset); };
}
