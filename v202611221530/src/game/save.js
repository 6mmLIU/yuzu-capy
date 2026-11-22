/**
 * 存档结构与旧档补齐，对应原版 Game.lua 的 newSave / load。
 * 纯数据整理，不读写 localStorage；持久化在 platform 模块。
 */

export function nowSeconds() {
    return Math.floor(Date.now() / 1000);
}

/** 新档默认值。字段与规格、Game.lua 保持一致。 */
export function newSave(now = nowSeconds()) {
    return {
        oranges: 0,
        gems: 0,
        lv: { atk: 0, spd: 0, inc: 0, hp: 0 },
        stage: 1,
        best: 0,
        farm: false,
        cards: {},
        picks: 0,
        pals: {},
        basket: 0,
        last: now,
        auto: true,
        autoGo: true,
        sfx: true,
        music: true,
        ult: 0,
        sfxVol: 0.8,
        musicVol: 0.6,
        vibe: true,
        seenIntro: false,
        palAds: {},
        buffT: 0,
        rerolled: false,
        offer: null,
    };
}

function clamp01(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(1, number));
}

function intOr(value, fallback, min) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.floor(number));
}

function plainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

/**
 * 合并旧档并补齐缺失字段。
 * - 等级、卡牌、伙伴、广告进度缺失时补 0；
 * - 旧档只有 sfx/music 开关时换算成音量；
 * - 关数、最远关、时间、音量做范围保护。
 */
export function normalizeSave(raw, now = nowSeconds()) {
    const save = newSave(now);
    const source = plainObject(raw);
    if (source) {
        for (const key of Object.keys(source)) save[key] = source[key];
    }

    const lv = plainObject(save.lv) || {};
    save.lv = {
        atk: intOr(lv.atk, 0, 0),
        spd: intOr(lv.spd, 0, 0),
        inc: intOr(lv.inc, 0, 0),
        hp: intOr(lv.hp, 0, 0),
    };

    save.stage = intOr(save.stage, 1, 1);
    save.best = intOr(save.best, 0, 0);
    save.picks = intOr(save.picks, 0, 0);
    save.basket = Number.isFinite(Number(save.basket)) ? Math.max(0, Number(save.basket)) : 0;
    save.oranges = Number.isFinite(Number(save.oranges)) ? Math.max(0, Number(save.oranges)) : 0;
    save.gems = Number.isFinite(Number(save.gems)) ? Math.max(0, Number(save.gems)) : 0;
    save.buffT = Number.isFinite(Number(save.buffT)) ? Math.max(0, Number(save.buffT)) : 0;
    save.ult = Number.isFinite(Number(save.ult)) ? Math.max(0, Math.min(1, Number(save.ult))) : 0;
    save.last = Number.isFinite(Number(save.last)) ? Math.max(0, Math.floor(Number(save.last))) : now;

    save.cards = plainObject(save.cards) || {};
    save.pals = plainObject(save.pals) || {};
    save.palAds = plainObject(save.palAds) || {};
    save.offer = Array.isArray(save.offer) ? save.offer.slice() : null;

    const hadVolume = source ? source.sfxVol !== undefined || source.musicVol !== undefined : false;
    save.sfxVol = clamp01(save.sfxVol, 0.8);
    save.musicVol = clamp01(save.musicVol, 0.6);
    if (!hadVolume && source) {
        if (source.sfx === false) save.sfxVol = 0;
        if (source.music === false) save.musicVol = 0;
    }

    // 新版本只认音量，旧布尔开关保留为兼容字段，但始终视为开启。
    save.sfx = true;
    save.music = true;
    save.farm = Boolean(save.farm);
    save.auto = save.auto !== false;
    save.autoGo = save.autoGo !== false;
    save.vibe = save.vibe !== false;
    save.seenIntro = Boolean(save.seenIntro);
    save.rerolled = Boolean(save.rerolled);
    return save;
}
