/**
 * UI 组件基类(架构骨架固定件,同构模式)。
 *
 * 所有 UI 组件(按钮/弹窗/进度条/HUD 面板等)继承本类,统一
 * `new Xxx(opts)` → `mount(parent)` → `setState(patch)` → `destroy()` 生命周期,
 * 并强制携带 uiId。
 *
 * 纪律(平台架构骨架):
 * - UI 组件**只读** store、通过 EventBus 发指令,禁止直接 mutate 业务状态。
 * - 样式走 CSS class + var(--pm-*) 变量,禁止在业务层写死颜色。
 * - 组件文件放 src/ui/components/(原子)或 src/ui/game/(模板页),命名 PascalCase。
 * - destroy 必须清理事件与订阅;subscribe 返回的取消函数统一压入 this.disposers。
 */
import { applyUiId } from "./uiId.js";
export class UiComponent {
    constructor(uiId, initialState) {
        /** 稳定标识,构造时必填(见 uiId.js 命名规则)。 */
        Object.defineProperty(this, "uiId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "el", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** 订阅/监听的取消函数集中放这里,destroy 统一执行。 */
        Object.defineProperty(this, "disposers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        this.uiId = uiId;
        this.state = initialState;
    }
    mount(parent) {
        if (this.el)
            return this;
        this.el = applyUiId(this.createElement(), this.uiId);
        parent.appendChild(this.el);
        this.render();
        return this;
    }
    setState(patch) {
        Object.assign(this.state, patch);
        if (this.el)
            this.render();
    }
    destroy() {
        for (const dispose of this.disposers.splice(0)) {
            try {
                dispose();
            }
            catch {
                /* 清理失败静默,不影响玩家 */
            }
        }
        if (this.el && this.el.parentNode) {
            this.el.parentNode.removeChild(this.el);
        }
        this.el = null;
    }
}
