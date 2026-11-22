export class EventBus {
    constructor() {
        Object.defineProperty(this, "handlers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    on(event, handler) {
        const list = this.handlers.get(event) || [];
        list.push(handler);
        this.handlers.set(event, list);
        return () => this.off(event, handler);
    }
    once(event, handler) {
        const off = this.on(event, (payload) => {
            off();
            handler(payload);
        });
        return off;
    }
    off(event, handler) {
        const list = this.handlers.get(event);
        if (!list)
            return;
        const i = list.indexOf(handler);
        if (i >= 0)
            list.splice(i, 1);
    }
    emit(event, payload) {
        const list = this.handlers.get(event);
        if (!list || list.length === 0)
            return;
        for (const handler of list.slice()) {
            try {
                handler(payload);
            }
            catch (err) {
                // 单个 handler 异常不阻断其他订阅者;错误进控制台由 APM 采集
                console.error(`[events] 处理 ${event} 时异常`, err);
            }
        }
    }
    clear() {
        this.handlers.clear();
    }
}
