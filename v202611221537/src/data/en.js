/**
 * 英文文案覆盖层：只替换名字和说明，不改任何数值。
 * 技能卡说明从中文原文里取出数字再套英文句子，数值始终跟随 game-data.json。
 */

const CHAPTERS = { orchard: "Orange Orchard", spring: "Bamboo Springs", snow: "Snowy Cedars" };
// 顶部进度条要同时放下首领名和倒计时，名字保持 9 个字符以内。
const BOSSES = { boar: "Boar King", frog: "Frog Boss", yeti: "Snow Yeti" };
const ENEMIES = {
    boar: "Charging Hog",
    crow: "Thief Crow",
    mushroom: "Mushling",
    slime: "Mud Blob",
    slimelet: "Mudlet",
    squirrel: "Acorn Squirrel",
    turtle: "Pot-Lid Turtle",
};
// 强化卡宽度有限，英文名字用一个词。
const UPGRADES = { atk: "Power", spd: "Speed", inc: "Harvest", hp: "Health" };
const PALS = {
    duck: ["Straw-Hat Duck", "Quack-quack rapid fire at the nearest enemy"],
    cat: ["Scarf Kitty", "Pounces with a paw swipe that can stun"],
    owl: ["Sleepy Owl", "Feather sniper: hits the toughest enemy and always pierces"],
    monkey: ["Snowball Monkey", "Snowball splash that slows enemies"],
};

const plural = (n, word) => `${n} ${word}${Number(n) === 1 ? "" : "s"}`;
const CARDS = {
    split: ["Scatter Shot", (n) => `Fires ${plural(n[0], "extra mini yuzu")}, ${n[1]}% damage each`],
    ricochet: ["Bouncy Yuzu", (n) => `Bounces to nearby enemies ${plural(n[0], "time")} after a hit, ${n[1]}% damage each`],
    pierce: ["Piercing Yuzu", (n) => `Yuzus pass through ${plural(n[0], "enemy").replace("enemys", "enemies")}`],
    crit: ["Weak Spot", (n) => `Crit chance +${n[0]}%`],
    heavy: ["Full Draw", (n) => `Crit damage +${n[0]}%`],
    boom: ["Boom Chestnut", (n) => `${n[0]}% chance to explode on hit, hurting enemies nearby`],
    frost: ["Iced Yuzu", (n) => `Hits slow enemies by ${n[0]}% for ${n[1]} s`],
    poison: ["Sour Bite", (n) => `Hits deal ${n[0]}% of attack per second for ${n[1]} s`],
    gain: ["Bumper Crop", (n) => `Oranges earned +${n[0]}%`],
    thick: ["Thick Hide", (n) => `Max HP +${n[0]}%`],
    regen: ["Hot Spring", (n) => `Regenerate ${n[0]}% HP per second`],
    charge: ["Full of Pep", (n) => `Yuzu Rain charges ${n[0]}% faster`],
};

function numbers(text) {
    return (String(text).match(/\d+(?:\.\d+)?/g) || []);
}

/** 把英文名字和说明写进一份未冻结的原始数据。 */
export function applyEnglish(raw) {
    for (const chapter of raw.chapters || []) {
        if (CHAPTERS[chapter.id]) chapter.name = CHAPTERS[chapter.id];
    }
    for (const [id, name] of Object.entries(BOSSES)) {
        if (raw.bosses && raw.bosses[id]) raw.bosses[id].name = name;
    }
    for (const [id, name] of Object.entries(ENEMIES)) {
        if (raw.enemies && raw.enemies[id]) raw.enemies[id].name = name;
    }
    for (const upgrade of raw.upgrades || []) {
        if (UPGRADES[upgrade.id]) upgrade.name = UPGRADES[upgrade.id];
    }
    for (const pal of raw.pals || []) {
        const en = PALS[pal.id];
        if (en) {
            pal.name = en[0];
            pal.desc = en[1];
        }
    }
    for (const card of raw.cards || []) {
        const en = CARDS[card.id];
        if (!en) continue;
        card.name = en[0];
        if (Array.isArray(card.descByLevel)) {
            card.descByLevel = card.descByLevel.map((zh) => en[1](numbers(zh)));
        }
    }
    return raw;
}
