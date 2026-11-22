/**
 * GameApp:游戏统一入口与主循环(架构骨架固定件)。
 *
 * 所有游戏共用同一入口形状:
 *   const app = new GameApp({ host, initialWorld, renderer })
 *   app.addSystem(new SpawnSystem()) ...
 *   app.start()
 *
 * 职责:
 * - 持有 store / events / state 三件套并注入各系统。
 * - 唯一的 requestAnimationFrame 循环:驱动 systems.update() 与 renderer.render()。
 *   系统与适配器**禁止**自己另起 rAF 循环(多循环会导致速度异常与耗电)。
 * - resize / orientationchange 统一分发给 renderer(Chrome 60 兼容:不依赖 ResizeObserver)。
 *
 * 纪律(平台架构骨架):
 * - update 仅在 playing 状态执行;暂停/结算时循环仍在跑渲染,但玩法逻辑冻结。
 * - 页面 hidden 时跳过 update/render 并清零 lastTs,恢复时不另挂一条 rAF。
 * - 工作台切离预览面时真正取消 rAF；恢复时只续接一条循环并重置帧间隔。
 * - 新增玩法 = 新增 System 后 addSystem 注册;改画面 = 改适配器;改 HUD = 改 ui/。
 * - 范围伤害/弹幕选目标用 src/utils/spatialHash.js,热路径对象用 objectPool.js,特效名额用 frameBudget.js。
 */
import { EventBus } from "./eventBus.js";
import { StateMachine } from "./stateMachine.js";
import { Store } from "./store.js";
export class GameApp {
    constructor(options) {
        Object.defineProperty(this, "store", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "events", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "renderer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "host", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "systems", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "rafId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastTs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "running", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "runtimeActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "onResize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                // 用 clientWidth/Height 而非 100vh:旧移动浏览器 100vh 受地址栏影响(50_ui 契约)
                this.renderer.resize(this.host.clientWidth, this.host.clientHeight);
            }
        });
        Object.defineProperty(this, "onVisibility", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                if (typeof document === 'undefined')
                    return;
                this.lastTs = 0;
                if (document.hidden) {
                    this.stopFrame();
                    return;
                }
                this.scheduleFrame();
            }
        });
        Object.defineProperty(this, "onRuntimeLifecycle", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (event) => {
                const payload = event.data;
                if (!payload || payload.type !== 'pm-preview-runtime-lifecycle' || payload.version !== 1)
                    return;
                if (window.parent !== window && event.source !== window.parent)
                    return;
                const active = payload.active !== false;
                this.runtimeActive = active;
                this.lastTs = 0;
                if (active)
                    this.scheduleFrame();
                else
                    this.stopFrame();
                try {
                    if (window.parent !== window) {
                        window.parent.postMessage({
                            type: 'pm-preview-runtime-lifecycle-ack',
                            version: 1,
                            action: active ? 'resume' : 'pause',
                            active,
                        }, '*');
                    }
                }
                catch {
                    // 独立发布页没有父工作台，生命周期控制保持本地 fail-soft。
                }
            }
        });
        Object.defineProperty(this, "scheduleFrame", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                if (!this.running || !this.runtimeActive || this.rafId)
                    return;
                if (typeof document !== 'undefined' && document.hidden)
                    return;
                this.rafId = window.requestAnimationFrame(this.loop);
            }
        });
        Object.defineProperty(this, "stopFrame", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => {
                if (!this.rafId)
                    return;
                window.cancelAnimationFrame(this.rafId);
                this.rafId = 0;
            }
        });
        Object.defineProperty(this, "loop", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (ts) => {
                this.rafId = 0;
                if (!this.running || !this.runtimeActive)
                    return;
                if (typeof document !== 'undefined' && document.hidden) {
                    this.lastTs = 0;
                    return;
                }
                const deltaMs = this.lastTs === 0 ? 16 : Math.min(ts - this.lastTs, 100);
                this.lastTs = ts;
                if (this.state.is('playing')) {
                    for (const system of this.systems) {
                        try {
                            system.update(deltaMs);
                        }
                        catch (err) {
                            // 单系统异常不崩整局;错误进控制台由 APM 采集
                            console.error(`[game] 系统 ${system.id} update 异常`, err);
                        }
                    }
                }
                this.renderer.render(this.store.get(), deltaMs);
                this.scheduleFrame();
            }
        });
        this.host = options.host;
        this.store = new Store(options.initialWorld);
        this.events = new EventBus();
        this.state = new StateMachine('loading');
        this.renderer = options.renderer;
    }
    /** 注册玩法系统(顺序即 update 顺序);须在 start() 前完成注册。 */
    addSystem(system) {
        this.systems.push(system);
        return this;
    }
    async start() {
        if (this.running)
            return;
        this.running = true;
        await this.renderer.init(this.host);
        const ctx = { store: this.store, events: this.events, state: this.state };
        for (const system of this.systems)
            system.init(ctx);
        window.addEventListener('resize', this.onResize);
        window.addEventListener('orientationchange', this.onResize);
        window.addEventListener('message', this.onRuntimeLifecycle);
        document.addEventListener('visibilitychange', this.onVisibility);
        this.onResize();
        this.lastTs = 0;
        this.scheduleFrame();
    }
    destroy() {
        if (!this.running)
            return;
        this.running = false;
        this.stopFrame();
        window.removeEventListener('resize', this.onResize);
        window.removeEventListener('orientationchange', this.onResize);
        window.removeEventListener('message', this.onRuntimeLifecycle);
        document.removeEventListener('visibilitychange', this.onVisibility);
        for (const system of this.systems) {
            try {
                system.teardown();
            }
            catch (err) {
                console.error(`[game] 系统 ${system.id} teardown 异常`, err);
            }
        }
        this.systems = [];
        this.events.clear();
        this.renderer.dispose();
    }
}
