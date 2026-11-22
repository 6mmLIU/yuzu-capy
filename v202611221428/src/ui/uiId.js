/**
 * uiId:UI 元素稳定标识(架构骨架固定件,UI 精确定位机制核心)。
 *
 * 规则(平台架构骨架):
 * - 每个玩家可见/可交互的 UI 元素必须有全局唯一 uiId,格式 `屏幕.元素`
 *   小驼峰,如 `menu.startBtn`、`hud.scoreText`、`result.replayBtn`。
 * - 动态列表项在同一 uiId 上追加序号:`shop.itemCard.0`。
 * - uiId 一经使用不得随意改名(平台按它定位源码);删元素时同步删注册。
 * - 通过 applyUiId() 写入 data-ui-id,禁止手写 setAttribute 散落各处。
 */
const liveIds = new Map();
/** 给元素打上稳定标识;重复 id 仅告警(内部诊断),不影响玩家。 */
export function applyUiId(el, uiId) {
    const existing = liveIds.get(uiId);
    if (existing && existing !== el && existing.isConnected) {
        console.warn(`[uiId] 重复的 uiId "${uiId}",同屏应保证唯一(列表项请加序号)`);
    }
    el.setAttribute('data-ui-id', uiId);
    liveIds.set(uiId, el);
    return el;
}
/** 按 uiId 查找当前挂载的元素(调试/桥接用)。 */
export function findByUiId(uiId) {
    const el = liveIds.get(uiId);
    if (el && el.isConnected)
        return el;
    const queried = document.querySelector(`[data-ui-id="${uiId}"]`);
    return queried instanceof HTMLElement ? queried : null;
}
/** 列出当前存活的全部 uiId(平台编辑桥/诊断用)。 */
export function listLiveUiIds() {
    const ids = [];
    liveIds.forEach((el, id) => {
        if (el.isConnected)
            ids.push(id);
    });
    return ids;
}
