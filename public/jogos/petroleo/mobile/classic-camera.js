import { CONFIG } from '../modules/config.js';

export function classicCamera(renderer) {
  const originalResize = renderer.resize.bind(renderer);
  const camera = {
    zoom: 1, pan: { x: 0, y: 0 },
    get scale() { return renderer.camera.scale; }, get x() { return renderer.camera.x; }, get y() { return renderer.camera.y; },
    world(x, y) { return renderer.worldPoint(x, y); },
    setZoom(value) { this.zoom = Math.max(1, Math.min(3, value)); this.camera(); },
    camera() {
      const { width, height } = renderer.camera;
      const scale = Math.min(width / CONFIG.world.width, height / CONFIG.world.height) * this.zoom;
      const maxX = Math.max(0, (CONFIG.world.width * scale - width) / 2), maxY = Math.max(0, (CONFIG.world.height * scale - height) / 2);
      this.pan.x = Math.max(-maxX, Math.min(maxX, this.pan.x)); this.pan.y = Math.max(-maxY, Math.min(maxY, this.pan.y));
      renderer.camera = { width, height, scale, x: (width - CONFIG.world.width * scale) / 2 + this.pan.x, y: (height - CONFIG.world.height * scale) / 2 + this.pan.y }; renderer.backgroundKey = '';
    },
  };
  renderer.resize = () => { originalResize(); camera.camera(); };
  return camera;
}
