/**
 * 存档持久化：按项目隔离写入 localStorage。
 * 读写规则复用 src/core/save.js 的 `pm:{projectId}:{key}` 命名。
 * 存档结构整理在 game/save.js，这里只做持久化。
 */
import { loadJson, removeSave, saveJson } from "../core/save.js";
import { newSave, normalizeSave, nowSeconds } from "../game/save.js";
import { clearCloudSave, flushCloudSaveNow, initCloudSave, queueCloudSave } from "./cloudSave.js";

export const SAVE_KEY = "yuzuSave";

/** 读取本地存档；没有存档或解析失败时返回新档。 */
export function readSave(rawFallback = null) {
    return normalizeSave(loadJson(SAVE_KEY, rawFallback));
}

/** 写入本地存档，并把 last 更新为当前时间；云端异步补同步。 */
export function writeSave(save) {
    if (!save || typeof save !== "object") return null;
    save.last = nowSeconds();
    saveJson(SAVE_KEY, save);
    queueCloudSave(save);
    return save;
}

/** 清空本地存档并返回一份新档；云端记录异步尽力删除。 */
export function clearSave() {
    removeSave(SAVE_KEY);
    clearCloudSave();
    return newSave();
}

export { flushCloudSaveNow, initCloudSave };
