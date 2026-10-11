// Standard Gamepad API mapping used by Xbox controllers in browser "standard" layout.
const DEADZONE = 0.18;
function axis(value) {
  if (!Number.isFinite(value) || Math.abs(value) < DEADZONE) return 0;
  return Math.sign(value) * (Math.abs(value) - DEADZONE) / (1 - DEADZONE);
}
export function normalizeGamepad(gamepad) {
  return {
    x: axis(gamepad?.axes?.[0] ?? 0),
    y: axis(gamepad?.axes?.[1] ?? 0),
    buttons: Array.from({ length: 16 }, (_, index) => !!gamepad?.buttons?.[index]?.pressed),
  };
}
