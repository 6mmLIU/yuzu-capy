export class Store {
    constructor(initial) {
        Object.defineProperty(this, "state", {
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
        this.state = initial;
    }
    /** 只读快照:adapters/ui 层用这个读数,不要留引用后偷偷改。 */
    get() {
        return this.state;
    }
    /**
     * 唯一写入口(仅 systems 层调用)。
     * mutator 直接原地修改 draft(小游戏无需 immutable 开销),改完统一通知。
     */
    mutate(mutator) {
        mutator(this.state);
        for (const listener of this.listeners.slice()) {
            try {
                listener(this.state);
            }
            catch (err) {
                console.error('[store] 订阅者异常', err);
            }
        }
    }
    /** 订阅状态变化(UI 刷新读数用);返回取消函数,destroy 时必须调用。 */
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            const i = this.listeners.indexOf(listener);
            if (i >= 0)
                this.listeners.splice(i, 1);
        };
    }
}
