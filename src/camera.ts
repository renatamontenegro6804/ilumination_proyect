import type { Mat4, Vec3 } from "./math";
import { mat4 } from "./math";

export class Camera {
  target: Vec3 = [0, 0, 0];

  yaw = 0;
  pitch = 0;

  distance = 3.2;
  minDistance = 1.15;
  maxDistance = 12.0;

  rotateSpeed = 0.01;
  zoomSpeed = 0.0015;

  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private onChange?: () => void;

  constructor(private canvas: HTMLCanvasElement, onChange?: () => void) {
    this.onChange = onChange;
    this.attachEvents();
  }

  private changed() {
    if (this.onChange) this.onChange();
  }

  private attachEvents() {
    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });

    window.addEventListener("mouseup", () => {
      this.dragging = false;
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.dragging) return;

      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;

      this.lastX = e.clientX;
      this.lastY = e.clientY;

      this.yaw -= dx * this.rotateSpeed;
      this.pitch -= dy * this.rotateSpeed;

      const lim = Math.PI / 2 - 0.01;
      if (this.pitch > lim) this.pitch = lim;
      if (this.pitch < -lim) this.pitch = -lim;

      this.changed();
    });

    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();

        const factor = Math.exp(e.deltaY * this.zoomSpeed);
        this.distance *= factor;

        if (this.distance < this.minDistance) this.distance = this.minDistance;
        if (this.distance > this.maxDistance) this.distance = this.maxDistance;

        this.changed();
      },
      { passive: false }
    );
  }

  setArcball(target: Vec3, radius: number, fovyRad: number, aspect: number) {
    this.target = [target[0], target[1], target[2]];

    const halfFovY = fovyRad * 0.5;
    const halfFovX = Math.atan(Math.tan(halfFovY) * aspect);
    const limitingHalfFov = Math.min(halfFovX, halfFovY);

    const fitDistance = radius / Math.sin(limitingHalfFov);
    this.distance = fitDistance * 1.15;

    this.minDistance = radius * 1.05;
    this.maxDistance = radius * 10.0;

    this.changed();
  }

  getPosition(): Vec3 {
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);

    return [
      this.target[0] + this.distance * cp * sy,
      this.target[1] + this.distance * sp,
      this.target[2] + this.distance * cp * cy,
    ];
  }

  getViewMatrix(): Mat4 {
    const eye = this.getPosition();
    return mat4.lookAt(eye, this.target, [0, 1, 0]);
  }

  update(_keys: Set<string>, _dt: number) {
    // Arcball: sin teclado
  }
}