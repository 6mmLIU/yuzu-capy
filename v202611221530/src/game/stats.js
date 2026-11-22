/**
 * 主角属性与果篮收益，对应原版 Game.lua 的 recalc / basketRate / basketCap。
 * 纯计算，不依赖绘制和平台能力。
 */
import { L } from "../i18n.js";
import { createFormulas } from "./formulas.js";

export function cardLevel(save, id) {
    const cards = save && save.cards;
    const value = cards && typeof cards === "object" ? Number(cards[id]) : 0;
    return Number.isFinite(value) ? value : 0;
}

function levelOf(save, id) {
    const lv = save && save.lv;
    const value = lv && typeof lv === "object" ? Number(lv[id]) : 0;
    return Number.isFinite(value) ? value : 0;
}

/**
 * 根据存档等级、卡牌和柚子茶剩余时间算出当前属性。
 * buffT 大于 0 时攻击翻倍。
 */
export function recalcStats(data, save) {
    const atkLv = levelOf(save, "atk");
    const spdLv = levelOf(save, "spd");
    const incLv = levelOf(save, "inc");
    const hpLv = levelOf(save, "hp");
    const buffT = Number(save && save.buffT) || 0;
    const gain = cardLevel(save, "gain");
    const thick = cardLevel(save, "thick");
    const regen = cardLevel(save, "regen");
    const crit = cardLevel(save, "crit");
    const heavy = cardLevel(save, "heavy");
    const charge = cardLevel(save, "charge");

    return {
        atk: 6 * (1 + 0.6 * atkLv) * Math.pow(1.045, atkLv) * (buffT > 0 ? 2 : 1),
        aspd: Math.min(1.5 + 0.045 * spdLv, 6),
        inc: (1 + 0.12 * incLv) * Math.pow(1.03, incLv) * (1 + 0.2 * gain),
        hp: 100 * (1 + 0.3 * hpLv) * Math.pow(1.04, hpLv) * (1 + 0.25 * thick),
        regen: 0.01 + 0.015 * regen,
        crit: 0.05 + 0.07 * crit,
        critMul: 2 + 0.5 * heavy,
        chargeMul: 1 + 0.2 * charge,
    };
}

/** 果篮每秒收益：按历史最远关卡的基准橘子乘收成倍率。 */
export function basketRate(data, save, stats) {
    const F = createFormulas(data);
    const best = Math.max(Number(save && save.best) || 0, 1);
    const current = stats || recalcStats(data, save);
    return F.eGold(best) * current.inc * 0.35;
}

/** 果篮上限：收益速度 × 最多存储秒数。 */
export function basketCap(data, save, stats) {
    return basketRate(data, save, stats) * data.basketCapSec;
}

/** 强化卡上显示的价值文案，供后续 UI 直接复用。 */
export function upgradeDisplayValue(data, save, id, stats) {
    const ST = stats || recalcStats(data, save);
    const F = createFormulas(data);
    if (id === "atk") return F.fmt(ST.atk);
    if (id === "spd") return `${ST.aspd.toFixed(2)}${L("/秒", "/s")}`;
    if (id === "inc") return `×${ST.inc < 100 ? ST.inc.toFixed(2) : F.fmt(ST.inc)}`;
    return F.fmt(ST.hp);
}
