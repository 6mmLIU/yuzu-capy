/** 合法迁移表:集中声明,改流程只改这里,禁止绕过状态机直接切场景。 */
const ALLOWED_TRANSITIONS = {
    loading: ['menu', 'playing'],
    menu: ['playing', 'loading'],
    playing: ['paused', 'gameOver', 'result', 'menu'],
    paused: ['playing', 'menu'],
    gameOver: ['result', 'menu', 'playing'],
    result: ['menu', 'playing'],
};
export class StateMachine {
    constructor(initial = 'loading') {
        Object.defineProperty(this, "current", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        this.current = initial;
    }
    get state() {
        return this.current;
    }
    is(state) {
        return this.current === state;
    }
    /**
     * 唯一状态切换入口。
     * 非法迁移仅 console.warn(内部诊断,不向玩家抛错),并拒绝切换。
     */
    setState(next) {
        const prev = this.current;
        if (next === prev)
            return true;
        if (!ALLOWED_TRANSITIONS[prev] || ALLOWED_TRANSITIONS[prev].indexOf(next) === -1) {
            console.warn(`[state] 非法状态迁移 ${prev} -> ${next},已拒绝(如确需请修改 ALLOWED_TRANSITIONS)`);
            return false;
        }
        this.current = next;
        for (const listener of this.listeners.slice()) {
            try {
                listener(next, prev);
            }
            catch (err) {
                // 单个监听器异常不阻断状态机(错误只进控制台,由 APM 采集)
                console.error('[state] 状态监听器异常', err);
            }
        }
        return true;
    }
    /** 订阅状态切换;返回取消函数,组件 destroy 时必须调用。 */
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            const i = this.listeners.indexOf(listener);
            if (i >= 0)
                this.listeners.splice(i, 1);
        };
    }
}
