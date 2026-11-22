/**
 * 存档封装(架构骨架固定件)。
 *
 * 统一实现平台存储命名约定 `pm:{projectId}:{key}`,业务代码禁止直接
 * 调 localStorage 拼 key(跨项目污染 + 调试面板无法识别)。
 */
import { getProjectId } from "../runtime/projectId.js";
function buildStorageKey(key) {
    return `pm:${getProjectId()}:${key}`;
}
/** 写 JSON 存档;key 用小驼峰,如 highScore、stageProgress。 */
export function saveJson(key, data) {
    try {
        localStorage.setItem(buildStorageKey(key), JSON.stringify(data));
    }
    catch {
        // 隐私模式/存储满时静默失败,游戏继续可玩(存档非致命)
    }
}
/** 读 JSON 存档;解析失败返回 fallback,不抛给玩家。 */
export function loadJson(key, fallback) {
    try {
        const raw = localStorage.getItem(buildStorageKey(key));
        if (!raw)
            return fallback;
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
export function removeSave(key) {
    try {
        localStorage.removeItem(buildStorageKey(key));
    }
    catch {
        /* 同上,静默 */
    }
}
