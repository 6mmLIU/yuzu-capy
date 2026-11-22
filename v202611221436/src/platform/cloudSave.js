/**
 * Telegram 云存档（WebApp.CloudStorage）。
 * 本地存档始终先读先写；云端只做异步同步，最多 20 秒写一次。
 * CloudStorage 单个值最多 4096 字符，存档按 3800 字符切块：
 *   先写 s0..sN，最后写 meta（块数、best、last），读的时候按 meta 拼回。
 * 换设备时采用更新的那份：云端 best 更高，或 best 相同但云端 last 晚 30 秒以上。
 */
import { normalizeSave } from "../game/save.js";
import { getCloudStorage } from "./telegram.js";

const META_KEY = "yuzu_meta";
const CHUNK_PREFIX = "yuzu_s";
const CHUNK_SIZE = 3800;
const MAX_CHUNKS = 20;
const SCHEMA_VERSION = 1;
const MIN_WRITE_INTERVAL_MS = 20000;
const NEWER_MARGIN_SEC = 30;

let state = null;

function cs(method, ...args) {
    const storage = getCloudStorage();
    if (!storage || typeof storage[method] !== "function") return Promise.reject(new Error("CloudStorage 不可用"));
    return new Promise((resolve, reject) => {
        try {
            storage[method](...args, (error, value) => {
                if (error) reject(error instanceof Error ? error : new Error(String(error)));
                else resolve(value);
            });
        } catch (error) {
            reject(error);
        }
    });
}

function logError(action, error) {
    console.warn(`[cloud-save] ${action}失败`, error && error.message ? error.message : error);
}

async function readCloud() {
    const metaRaw = await cs("getItem", META_KEY);
    if (!metaRaw) return null;
    const meta = JSON.parse(metaRaw);
    const count = Math.max(0, Math.min(MAX_CHUNKS, Number(meta.n) || 0));
    if (!count) return null;
    const keys = [];
    for (let i = 0; i < count; i += 1) keys.push(`${CHUNK_PREFIX}${i}`);
    const items = await cs("getItems", keys);
    let json = "";
    for (const key of keys) {
        const part = items && items[key];
        if (typeof part !== "string" || !part) return null;
        json += part;
    }
    const value = JSON.parse(json);
    const raw = value && typeof value === "object" && value.save ? value.save : value;
    return raw && typeof raw === "object" ? normalizeSave(raw) : null;
}

async function writeCloud(save) {
    const json = JSON.stringify({ schemaVersion: SCHEMA_VERSION, save });
    const parts = [];
    for (let i = 0; i < json.length; i += CHUNK_SIZE) parts.push(json.slice(i, i + CHUNK_SIZE));
    if (parts.length > MAX_CHUNKS) throw new Error("存档太大");
    for (let i = 0; i < parts.length; i += 1) {
        await cs("setItem", `${CHUNK_PREFIX}${i}`, parts[i]);
    }
    const meta = { n: parts.length, v: SCHEMA_VERSION, best: Number(save.best) || 0, last: Number(save.last) || 0 };
    await cs("setItem", META_KEY, JSON.stringify(meta));
}

async function deleteCloud() {
    const keys = [META_KEY];
    for (let i = 0; i < MAX_CHUNKS; i += 1) keys.push(`${CHUNK_PREFIX}${i}`);
    try {
        await cs("removeItems", keys);
    } catch (error) {
        logError("云端删除", error);
    }
}

async function flushCloudSave() {
    if (!state) return;
    state.timer = 0;
    if (!state.ready || state.cancelled) return;
    if (state.inFlight) {
        state.dirty = true;
        return;
    }
    state.inFlight = true;
    state.lastWriteAt = Date.now();
    state.dirty = false;
    try {
        const current = state.getSave ? state.getSave() : null;
        if (current) await writeCloud(JSON.parse(JSON.stringify(current)));
    } catch (error) {
        logError("云端写入", error);
    } finally {
        state.inFlight = false;
        if (state.dirty && !state.cancelled) {
            state.dirty = false;
            state.timer = window.setTimeout(
                flushCloudSave,
                Math.max(0, MIN_WRITE_INTERVAL_MS - (Date.now() - state.lastWriteAt))
            );
        }
    }
}

/** 合并短时间内的多次保存；最多 20 秒发一次。 */
export function queueCloudSave(save) {
    if (!state || !state.ready || state.cancelled || !save) return;
    if (state.inFlight) {
        state.dirty = true;
        return;
    }
    if (state.timer) return;
    const wait = Math.max(0, MIN_WRITE_INTERVAL_MS - (Date.now() - state.lastWriteAt));
    state.timer = window.setTimeout(flushCloudSave, wait);
}

/** 立刻写一次（切到后台/最小化时用），不等 20 秒节流。 */
export function flushCloudSaveNow() {
    if (!state || !state.ready || state.cancelled) return;
    if (state.timer) {
        window.clearTimeout(state.timer);
        state.timer = 0;
    }
    if (Date.now() - state.lastWriteAt < 3000) return;
    void flushCloudSave();
}

/** 清档时停止本次会话的云端同步，并尽力删除云端记录。 */
export function clearCloudSave() {
    if (!state) return;
    state.cancelled = true;
    if (state.timer) {
        window.clearTimeout(state.timer);
        state.timer = 0;
    }
    void deleteCloud();
}

function cloudIsNewer(cloud, local) {
    if (!local) return true;
    const cloudBest = Number(cloud.best) || 0;
    const localBest = Number(local.best) || 0;
    if (cloudBest !== localBest) return cloudBest > localBest;
    return (Number(cloud.last) || 0) > (Number(local.last) || 0) + NEWER_MARGIN_SEC;
}

async function loadCloudSave() {
    if (!getCloudStorage()) return false;
    let cloud = null;
    try {
        cloud = await readCloud();
    } catch (error) {
        logError("云端读取", error);
        return false;
    }
    state.ready = true;
    if (state.cancelled) {
        void deleteCloud();
        return true;
    }
    const local = state.getSave ? state.getSave() : null;
    if (cloud && cloudIsNewer(cloud, local) && state.adopt) {
        try {
            state.adopt(cloud);
            console.info("[cloud-save] 已采用云端存档");
        } catch (error) {
            logError("云端采用", error);
        }
    } else if (local) {
        queueCloudSave(local);
    }
    return true;
}

/**
 * 启动云存档。adopt(save) 负责把云端存档应用到当前游戏。
 * 不在 Telegram 里打开时直接返回 false，只用本地存档。
 */
export function initCloudSave(options = {}) {
    if (state) return state.readyPromise;
    state = {
        getSave: options.getSave || null,
        adopt: options.adopt || null,
        ready: false,
        cancelled: false,
        timer: 0,
        lastWriteAt: 0,
        inFlight: false,
        dirty: false,
        readyPromise: null,
    };
    state.readyPromise = loadCloudSave().catch((error) => {
        logError("初始化", error);
        return false;
    });
    return state.readyPromise;
}
