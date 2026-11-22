/**
 * platform 模块统一出口。
 * 平台相关能力（存档、音效、震动、广告）从这里接入。
 * 游戏代码只从这里使用存档、音效、震动和广告能力。
 */
export { SAVE_KEY, clearSave, flushCloudSaveNow, initCloudSave, readSave, writeSave } from "./saveStore.js";
export { GameAudio } from "./audio.js";
export { showRewardAd } from "./ads.js";
export { createVibe } from "./vibe.js";
