/**
 * 游戏静态数据入口。
 *
 * 唯一数据源是仓库根目录的 `data/game-data.json`（由原版 Data.lua 导出）。
 * 这里只负责读取、校验和冻结，不在代码里复制或改写任何数值。
 * 逻辑层通过 `getGameData()` 取只读数据；数值公式在 src/game/formulas.js。
 */

/** 数据文件位置，相对当前模块解析，预览与打包都能定位。 */
import { IS_ZH } from "../i18n.js";
import { applyEnglish } from "./en.js";

export const GAME_DATA_URL = new URL("../../data/game-data.json", import.meta.url);

const REQUIRED_ARRAYS = ["chapters", "upgrades", "cards", "pals"];
const REQUIRED_OBJECTS = ["enemies", "bosses"];

let loadedData = null;
let loadingPromise = null;

function assert(condition, message) {
    if (!condition) throw new Error(`game-data 校验失败：${message}`);
}

/** 就地递归冻结，避免运行期误改配置数值。 */
export function freezeGameData(value, seen) {
    if (value === null || typeof value !== "object") return value;
    const visited = seen || new Set();
    if (visited.has(value)) return value;
    visited.add(value);
    for (const key of Object.keys(value)) freezeGameData(value[key], visited);
    return Object.freeze(value);
}

/** 校验数据的基本结构；字段缺失时给出明确错误，而不是静默兜底。 */
export function validateGameData(raw) {
    assert(raw && typeof raw === "object" && !Array.isArray(raw), "顶层必须是对象");
    for (const key of REQUIRED_ARRAYS) {
        assert(Array.isArray(raw[key]) && raw[key].length > 0, `${key} 必须是非空数组`);
    }
    for (const key of REQUIRED_OBJECTS) {
        assert(raw[key] && typeof raw[key] === "object", `${key} 必须是对象`);
    }
    for (const chapter of raw.chapters) {
        assert(chapter && typeof chapter.id === "string", "章节缺少 id");
        assert(Array.isArray(chapter.pool) && chapter.pool.length > 0, `章节 ${chapter.id} 缺少敌人池`);
        assert(typeof chapter.boss === "string" && raw.bosses[chapter.boss], `章节 ${chapter.id} 的首领不存在`);
    }
    for (const upgrade of raw.upgrades) {
        assert(upgrade && typeof upgrade.id === "string", "强化项缺少 id");
        assert(Number.isFinite(upgrade.base) && Number.isFinite(upgrade.grow), `强化项 ${upgrade.id} 的价格参数无效`);
    }
    assert(Number.isFinite(raw.basketCapSec), "basketCapSec 必须是数字");
    assert(Number.isFinite(raw.buffSec), "buffSec 必须是数字");
    assert(Number.isFinite(raw.bossTimeSec), "bossTimeSec 必须是数字");
    return raw;
}

/** 注入已解析的数据（Node 自检或平台预加载用）。英文界面先换上英文名字和说明。 */
export function setGameData(raw) {
    if (!IS_ZH) applyEnglish(raw);
    loadedData = freezeGameData(validateGameData(raw));
    loadingPromise = Promise.resolve(loadedData);
    return loadedData;
}

/** 同步读取已加载数据；未加载时抛出可定位的错误。 */
export function getGameData() {
    if (!loadedData) throw new Error("game-data 尚未加载，请先 await loadGameData() 或调用 setGameData()");
    return loadedData;
}

export function isGameDataReady() {
    return loadedData !== null;
}

/** 异步读取数据文件并缓存；失败会清空缓存，允许下次重试。 */
export function loadGameData(url = GAME_DATA_URL) {
    if (loadedData) return Promise.resolve(loadedData);
    if (!loadingPromise) {
        loadingPromise = fetch(url, { cache: "no-store" })
            .then((response) => {
                if (!response.ok) throw new Error(`game-data 请求失败：HTTP ${response.status}`);
                return response.json();
            })
            .then((raw) => setGameData(raw))
            .catch((error) => {
                loadingPromise = null;
                throw error;
            });
    }
    return loadingPromise;
}

/** 只读查询小工具：按 id 找数组项。 */
export function findById(list, id) {
    if (!Array.isArray(list)) return null;
    for (const item of list) {
        if (item && item.id === id) return item;
    }
    return null;
}
