/**
 * game 模块：纯逻辑，不依赖绘制、DOM 或平台接口。
 * - formulas：关卡/价格/数字缩写
 * - stats：主角属性与果篮收益
 * - save：存档结构与旧档补齐
 */
export {
    chapterIndex,
    chapterThemeIndex,
    createFormulas,
    enemyBaseDmg,
    enemyBaseGold,
    enemyBaseHp,
    formatDuration,
    formatNumber,
    isBossStage,
    killsNeeded,
    roadY,
    rng,
    stageLabel,
    subStage,
    upgradeCost,
} from "./formulas.js";

export {
    basketCap,
    basketRate,
    cardLevel,
    recalcStats,
    upgradeDisplayValue,
} from "./stats.js";

export { newSave, normalizeSave, nowSeconds } from "./save.js";
export { BattleGame, hopState, JOY_RADIUS } from "./battle.js";
