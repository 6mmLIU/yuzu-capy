/**
 * 浮动摇杆输入：按在战斗区空白处时出现，松手后回到自动战斗。
 * 按钮和强化卡会先处理自己的点击，不会触发摇杆。
 */
export class JoystickInput {
    constructor(options) {
        this.host = options.host;
        this.game = options.game;
        this.renderer = options.renderer;
        this.onStart = options.onStart || null;
        this.pointerId = null;
        this.onDown = (event) => this.handleDown(event);
        this.onMove = (event) => this.handleMove(event);
        this.onUp = (event) => this.handleUp(event);
        this.onBlur = () => this.release();
    }

    mount() {
        this.host.addEventListener("pointerdown", this.onDown);
        window.addEventListener("pointermove", this.onMove, { passive: false });
        window.addEventListener("pointerup", this.onUp);
        window.addEventListener("pointercancel", this.onUp);
        window.addEventListener("blur", this.onBlur);
    }

    dispose() {
        this.host.removeEventListener("pointerdown", this.onDown);
        window.removeEventListener("pointermove", this.onMove);
        window.removeEventListener("pointerup", this.onUp);
        window.removeEventListener("pointercancel", this.onUp);
        window.removeEventListener("blur", this.onBlur);
    }

    handleDown(event) {
        if (this.pointerId !== null || event.target !== this.renderer.canvas) return;
        if (event.button !== undefined && event.button !== 0) return;
        const point = this.renderer.screenToView(event.clientX, event.clientY);
        if (!point || !this.game.joystickStart(point.x, point.y)) return;
        this.pointerId = event.pointerId;
        if (this.onStart) this.onStart();
        event.preventDefault();
    }

    handleMove(event) {
        if (event.pointerId !== this.pointerId) return;
        const point = this.renderer.screenToView(event.clientX, event.clientY);
        if (point) this.game.joystickMove(point.x, point.y);
        event.preventDefault();
    }

    handleUp(event) {
        if (event.pointerId === this.pointerId) this.release();
    }

    release() {
        this.pointerId = null;
        this.game.joystickEnd();
    }
}
