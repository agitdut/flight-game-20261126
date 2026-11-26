// Sky Courier — masukan keyboard + mouse.
// Keyboard adalah kontrol utama; mouse mengarahkan pesawat dengan
// menggerakkan kursor (mode "ikuti kursor" aktif saat mouse bergerak).

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pitch = 0; // -1 menukik, +1 mendaki
    this.roll = 0; // -1 ke kiri, +1 ke kanan
    this.throttleUp = false;
    this.throttleDown = false;
    this.mouseActive = false;
    this.mouseX = 0; // -1..1 relatif ke tengah layar
    this.mouseY = 0; // -1..1 relatif ke tengah layar
    this.mouseSteer = false;
    this.lastMouseMove = 0;
    this.pressed = new Set(); // tombol yang baru ditekan (sekali pakai)
    this.canvas = canvas;
    this.attach();
  }

  attach() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      this.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      this.recompute();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      this.recompute();
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.recompute();
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      this.mouseActive = true;
      this.lastMouseMove = performance.now();
    });
    this.canvas.addEventListener('mousedown', () => {
      this.mouseSteer = true;
    });
    window.addEventListener('mouseup', () => {
      this.mouseSteer = false;
    });
  }

  recompute() {
    const k = this.keys;
    const up = k.has('ArrowUp') || k.has('w');
    const down = k.has('ArrowDown') || k.has('s');
    const left = k.has('ArrowLeft') || k.has('a');
    const right = k.has('ArrowRight') || k.has('d');
    this.pitch = (up ? 1 : 0) + (down ? -1 : 0);
    this.roll = (right ? 1 : 0) + (left ? -1 : 0);
    this.throttleUp = k.has('Shift') || k.has('e');
    this.throttleDown = k.has('Control') || k.has('q');
  }

  // Mouse mengemudi hanya bila kursor digerakkan baru-baru ini (2 detik)
  // dan tidak ada input keyboard aktif — keyboard selalu menang.
  mouseSteering(now) {
    if (this.pitch !== 0 || this.roll !== 0) return null;
    if (!this.mouseActive) return null;
    if (now - this.lastMouseMove > 2000) return null;
    return { x: this.mouseX, y: this.mouseY };
  }

  consume(key) {
    if (this.pressed.has(key)) {
      this.pressed.delete(key);
      return true;
    }
    return false;
  }

  endFrame() {
    this.pressed.clear();
  }
}
