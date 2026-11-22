/**
 * 纯数值公式，对应原版 Data.lua 的 F 表与数字格式化。
 * 这里不引用任何绘制、DOM、平台接口，可以在浏览器、Node 自检里直接运行。
 */

import { IS_ZH } from "../i18n.js";

const UNITS = ["", "万", "亿", "兆", "京", "垓"];
const UNITS_EN = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc"];

/** 章节序号从 1 开始，返回从 0 开始的章下标。 */
export function chapterIndex(n) {
    return Math.floor((n - 1) / 5);
}

/** 小关序号 1~5。 */
export function subStage(n) {
    return ((n - 1) % 5) + 1;
}

/** 每 5 关一个首领关。 */
export function isBossStage(n) {
    return n % 5 === 0;
}

/** 主题按 3 章循环。 */
export function chapterThemeIndex(n, chapterCount) {
    return (chapterIndex(n) % chapterCount) + 1;
}

/** 关卡标签，例如 1-1、2-5。 */
export function stageLabel(n) {
    return `${chapterIndex(n) + 1}-${subStage(n)}`;
}

/** 关卡基础敌人血量（未乘敌人倍率）。 */
export function enemyBaseHp(n) {
    return 10 * Math.pow(1.42, n - 1);
}

/** 关卡基础敌人伤害（未乘敌人倍率）。 */
export function enemyBaseDmg(n) {
    return 3 * Math.pow(1.27, n - 1);
}

/** 关卡基础橘子收益（未乘敌人倍率）。 */
export function enemyBaseGold(n) {
    return 4 * Math.pow(1.36, n - 1);
}

/** 普通关击杀需求；首领关由 stageInfo 统一返回 1。 */
export function killsNeeded(n) {
    return 10 + 2 * subStage(n);
}

/** 强化价格：ceil(base * grow^level)。 */
export function upgradeCost(upgrade, level) {
    return Math.ceil(upgrade.base * Math.pow(upgrade.grow, level));
}

/** 小路中心线。 */
export function roadY(x) {
    return Math.sin(x / 330) * 115 + Math.sin(x / 137 + 1.3) * 34;
}

/** 可复现随机数，用于场景树和地面笔触的布置。 */
export function rng(seed) {
    let s = Math.floor(seed) % 2147483647;
    if (s <= 0) s += 2147483646;
    return function next() {
        s = (s * 48271) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

/**
 * 数字缩写：0~9999 直接显示，之后按 万/亿/兆/京/垓 递进。
 * 与 Data.lua 的 D.fmt 保持一致。
 */
export function formatNumber(n) {
    if (Number.isNaN(n) || !Number.isFinite(n)) return "∞";
    if (!IS_ZH) return formatNumberEn(n);
    if (n < 10000) {
        if (n < 100 && n % 1 !== 0) return n.toFixed(1);
        return String(Math.floor(n));
    }
    const i = Math.floor(Math.log10(n) / 4 + 1e-9);
    if (i >= UNITS.length) return n.toExponential(2).replace("e+", "e");
    const v = n / Math.pow(10, i * 4);
    const text = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return text + UNITS[i];
}

/** 英文按千进位：1.25K、3.40M。 */
function formatNumberEn(n) {
    if (n < 1000) {
        if (n < 100 && n % 1 !== 0) return n.toFixed(1);
        return String(Math.floor(n));
    }
    const i = Math.floor(Math.log10(n) / 3 + 1e-9);
    if (i >= UNITS_EN.length) return n.toExponential(2).replace("e+", "e");
    const v = n / Math.pow(10, i * 3);
    const text = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return text + UNITS_EN[i];
}

/** 时长文案：x 小时 y 分 / x 分钟 / x 秒。 */
export function formatDuration(seconds) {
    const sec = Math.floor(seconds);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (!IS_ZH) {
        if (h > 0) return `${h} h ${m} min`;
        if (m > 0) return `${m} min`;
        return `${sec} s`;
    }
    if (h > 0) return `${h} 小时 ${m} 分`;
    if (m > 0) return `${m} 分钟`;
    return `${sec} 秒`;
}

/**
 * 用一份 game-data 创建关卡公式集合。
 * 公式系数来自规格与 Data.lua，章节、强化项等可变数据全部从 data 读取。
 */
export function createFormulas(data) {
    const chapters = data.chapters;
    const chapterCount = chapters.length;

    function chapDef(n) {
        return chapters[chapterThemeIndex(n, chapterCount) - 1];
    }

    function stageInfo(n) {
        const boss = isBossStage(n);
        return {
            n,
            chapter: chapDef(n).name,
            chapterId: chapDef(n).id,
            chapterIndex: chapterIndex(n) + 1,
            chapterThemeIndex: chapterThemeIndex(n, chapterCount),
            isBoss: boss,
            killsNeeded: boss ? 1 : killsNeeded(n),
            label: stageLabel(n),
            enemyHp: enemyBaseHp(n),
            enemyDmg: enemyBaseDmg(n),
            enemyGold: enemyBaseGold(n),
        };
    }

    function cost(upgrade, level) {
        return upgradeCost(upgrade, level);
    }

    function costById(id, level) {
        const upgrade = data.upgrades.find((item) => item.id === id);
        if (!upgrade) throw new Error(`未知强化项：${id}`);
        return upgradeCost(upgrade, level);
    }

    return {
        chapters,
        chapterCount,
        chap: chapterIndex,
        sub: subStage,
        isBoss: isBossStage,
        chapIndex: (n) => chapterThemeIndex(n, chapterCount),
        chapDef,
        label: stageLabel,
        eHP: enemyBaseHp,
        eDmg: enemyBaseDmg,
        eGold: enemyBaseGold,
        need: killsNeeded,
        stageInfo,
        cost,
        costById,
        roadY,
        fmt: formatNumber,
        fmtTime: formatDuration,
    };
}
