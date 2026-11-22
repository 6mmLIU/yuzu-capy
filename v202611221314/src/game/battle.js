/**
 * 战斗、成长和离线收益的纯逻辑，按原版 Game.lua 移植。
 * 不依赖绘制和平台能力；随机调用顺序也与原版保持一致，便于做对照测试。
 */
import { L } from "../i18n.js";
import { isRewardAdEnabled } from "../platform/adsConfig.js";
import { createFormulas, formatNumber } from "./formulas.js";
import { basketCap, basketRate, cardLevel, recalcStats, upgradeDisplayValue } from "./stats.js";
import { nowSeconds } from "./save.js";

const HOP_LAND = 0.28;
export const MAX_STEP = 1 / 30;
export const JOY_RADIUS = 52;
const JOY_AIM_RANGE = 340;
const MANUAL_BAND = 215;

function hypot(x, y) {
    return Math.sqrt(x * x + y * y);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/** 敌人的跳跃节奏：返回空中高度、跳步进度、位移倍率和蠕动标记。 */
export function hopState(enemy) {
    const hop = enemy.def.hop;
    if (!hop) return { air: 0, k: 0, move: 1, ooze: false };
    const p = (enemy.t / hop[0]) % 1;
    if (enemy.def.ooze) {
        return {
            air: 0,
            k: Math.sin(p * Math.PI * 2),
            move: 1 + 0.9 * Math.cos(p * Math.PI * 2),
            ooze: true,
        };
    }
    if (p < HOP_LAND) return { air: 0, k: p / HOP_LAND, move: 0.12, ooze: false };
    const a = (p - HOP_LAND) / (1 - HOP_LAND);
    return {
        air: Math.sin(a * Math.PI),
        k: a,
        move: (1 - HOP_LAND * 0.12) / (1 - HOP_LAND),
        ooze: false,
    };
}

export class BattleGame {
    constructor(options) {
        this.data = options.data;
        this.save = options.save;
        this.events = options.events || null;
        this.onSave = options.onSave || null;
        this.random = options.random || Math.random;
        this.now = options.now || nowSeconds;
        this.F = createFormulas(this.data);
        this.stats = recalcStats(this.data, this.save);
        this.state = {
            W: 390,
            H: 780,
            top: 60,
            bottom: 620,
            ax: 195,
            ay: 330,
            safeTop: 0,
            safeBottom: 0,
            hx: 0,
            hy: this.F.roadY(0),
            cam: { x: 0, y: this.F.roadY(0) },
            palPos: {},
            enemies: [],
            shots: [],
            eshots: [],
            coins: [],
            fx: [],
            texts: [],
            quakes: [],
            hero: {
                hp: this.stats.hp,
                cd: 0,
                flash: 0,
                sq: 0,
                face: 1,
                slow: 0,
                moving: false,
                recoil: 0,
                spd: 0,
                dist: 0,
                dx: 1,
                dy: 0,
                aim: 0,
                pull: 0,
                snap: 0,
                happy: 0,
                ouch: 0,
            },
            target: null,
            kills: 0,
            need: 12,
            spawnCd: 0,
            phase: "idle",
            phaseT: 0,
            boss: null,
            bossT: 0,
            bossSpawnT: 0,
            shake: 0,
            ultAutoT: 0,
            ultQueue: [],
            palCd: {},
            palAtk: {},
            time: 0,
            walkDir: 1,
            loops: 0,
            paused: false,
            started: false,
            joy: { on: false, bx: 0, by: 0, kx: 0, ky: 0, dx: 0, dy: 0, mag: 0, t: 0 },
        };
    }

    get S() {
        return this.save;
    }

    get ST() {
        return this.stats;
    }

    get R() {
        return this.state;
    }

    emit(type, data) {
        if (this.events) this.events.emit(type, data);
    }

    card(id) {
        return cardLevel(this.save, id);
    }

    setViewport(layout) {
        if (!layout) return;
        const R = this.state;
        R.W = layout.view.width;
        R.H = layout.view.height;
        R.top = layout.battle.top;
        R.bottom = layout.battle.bottom;
        R.ax = layout.view.width * 0.5;
        R.ay = layout.hero.y;
        R.safeTop = layout.safeTop;
        R.safeBottom = layout.safeBottom;
    }

    recalc() {
        this.stats = recalcStats(this.data, this.save);
        if (this.state.hero.hp > this.stats.hp) this.state.hero.hp = this.stats.hp;
    }

    basketRate() {
        return basketRate(this.data, this.save, this.stats);
    }

    basketCap() {
        return basketCap(this.data, this.save, this.stats);
    }

    adsOpen() {
        // Telegram 版：只有配置了 Adsgram 广告位、且在 Telegram 里打开时才出现看广告按钮。
        return isRewardAdEnabled() && this.save.best >= 3;
    }

    start() {
        const R = this.state;
        this.recalc();
        R.hx = 0;
        R.hy = this.F.roadY(0);
        R.cam.x = R.hx;
        R.cam.y = R.hy;
        R.palPos = {};
        R.coins = [];
        R.fx = [];
        R.texts = [];
        R.quakes = [];
        R.time = 0;
        R.hero.spd = 0;
        R.hero.dist = 0;
        R.started = true;
        this.startStage();
    }

    /** 清档后在同一个存档对象上重开，界面和音频持有的引用不用替换。 */
    replaceSave(next) {
        for (const key of Object.keys(this.save)) delete this.save[key];
        Object.assign(this.save, next);
        this.start();
        this.saveNow();
    }

    startStage() {
        const S = this.save;
        const R = this.state;
        const n = S.stage;
        R.enemies = [];
        R.shots = [];
        R.eshots = [];
        R.ultQueue = [];
        R.kills = 0;
        R.need = this.F.isBoss(n) ? 1 : this.F.need(n);
        R.spawnCd = 0.6;
        R.target = null;
        R.boss = null;
        R.phase = "fight";
        R.hero.hp = this.stats.hp;
        R.hero.slow = 0;
        if (this.F.isBoss(n)) {
            R.bossT = this.data.bossTimeSec;
            R.bossSpawnT = 1.3;
            this.emit("bossWarn", this.F.chapDef(n).boss);
        }
        this.emit("stage", n);
    }

    makeEnemy(type, x, y, boss) {
        const R = this.state;
        const n = this.save.stage;
        const def = boss ? this.data.bosses[type] : this.data.enemies[type];
        const hp = this.F.eHP(n) * def.hp;
        const enemy = {
            type,
            def,
            boss: Boolean(boss),
            x,
            y,
            hp,
            max: hp,
            spd: def.spd,
            dmg: this.F.eDmg(n) * def.dmg,
            gold: this.F.eGold(n) * def.gold,
            size: def.size,
            r: def.size * 0.36,
            t: this.random() * 10,
            born: 0,
            atkCd: 0.6,
            state: "move",
            stateT: 0,
            flash: 0,
            sq: 0,
            slow: 0,
            slowAmt: 0,
            poison: 0,
            poisonDps: 0,
            pt: 0,
            shield: def.shield || 0,
            lunge: 0,
            face: -1,
            skillCd: 4,
            dead: false,
            wob: this.random() * 6.28,
            z: def.fly ? 26 : 0,
            kvx: 0,
            kvy: 0,
            charged: false,
        };
        R.enemies.push(enemy);
        return enemy;
    }

    spawnPack(limit) {
        const R = this.state;
        const pool = this.F.chapDef(this.save.stage).pool;
        const size = Math.max(1, Math.min(limit, 1 + Math.floor(this.random() * 3)));
        const ahead = this.random() < 0.8 ? 1 : -1;
        const side = this.random() < 0.5 ? -1 : 1;
        const bx = R.hx + ahead * (R.W * 0.5 + 34 + this.random() * 50);
        for (let i = 0; i < size; i += 1) {
            const type = pool[Math.floor(this.random() * pool.length)];
            const x = bx + ahead * i * 30 + (this.random() - 0.5) * 20;
            this.makeEnemy(type, x, this.F.roadY(x) + side * (120 + this.random() * 80), false);
        }
        return size;
    }

    clearField() {
        const R = this.state;
        for (const enemy of R.enemies) this.poof(enemy.x, enemy.y, enemy.size);
        R.enemies = [];
        R.shots = [];
        R.eshots = [];
    }

    beginWalk(dir) {
        const R = this.state;
        R.phase = "walk";
        R.phaseT = 0;
        R.target = null;
        R.walkDir = dir || 1;
        this.clearField();
        this.emit("walk", this.save.stage);
        this.saveNow();
    }

    challenge() {
        const R = this.state;
        const S = this.save;
        if (!S.farm || R.phase !== "fight") return false;
        S.farm = false;
        S.stage += 1;
        R.loops = 0;
        this.beginWalk(1);
        return true;
    }

    stageClear() {
        const R = this.state;
        const S = this.save;
        const n = S.stage;
        if (S.farm) {
            R.kills = 0;
            R.loops += 1;
            if (S.autoGo && R.loops >= 2) this.challenge();
            return;
        }
        if (n > S.best) {
            S.best = n;
            S.picks += 1;
            const gems = this.F.isBoss(n) ? 10 : 1;
            S.gems += gems;
            this.emit("firstClear", { n, gems });
        }
        if (this.F.isBoss(n)) this.emit("chapterClear", n);
        S.stage = n + 1;
        this.beginWalk(1);
    }

    retreat(reason) {
        const R = this.state;
        const S = this.save;
        if (R.phase === "down") return;
        R.phase = "down";
        R.phaseT = 0;
        R.target = null;
        this.clearField();
        R.boss = null;
        if (S.stage > 1) S.stage -= 1;
        S.farm = true;
        R.loops = 0;
        this.emit("retreat", reason);
    }

    hurtEnemy(enemy, dmg, crit, source) {
        if (enemy.dead) return;
        const R = this.state;
        const S = this.save;
        if (enemy.shield > 0 && source !== "dot") {
            enemy.shield -= 1;
            enemy.flash = 0.1;
            enemy.sq = 0.5;
            this.addText(enemy.x, enemy.y - enemy.size, enemy.shield > 0 ? L("挡", "Block") : L("破盾!", "Shield broken!"), "block");
            if (enemy.shield === 0) {
                R.fx.push({
                    kind: "lid",
                    x: enemy.x,
                    y: enemy.y - enemy.size * 0.5,
                    vx: -70 + this.random() * 140,
                    vy: -190,
                    t: 0,
                    life: 0.8,
                    rot: 0,
                });
            }
            this.emit("sfx", "block");
            return;
        }
        enemy.hp -= dmg;
        if (source !== "dot") {
            enemy.flash = 0.1;
            enemy.sq = 1;
            if (!enemy.boss && enemy.state !== "dash") {
                const dx = enemy.x - R.hx;
                const dy = enemy.y - R.hy;
                const d = hypot(dx, dy) || 1;
                const k = crit ? 170 : 100;
                enemy.kvx = (dx / d) * k;
                enemy.kvy = (dy / d) * k;
            }
        }
        this.addText(
            enemy.x,
            enemy.y - enemy.size * (enemy.boss ? 0.8 : 1) - enemy.z,
            formatNumber(dmg) + (crit ? "!" : ""),
            crit ? "crit" : (source === "dot" ? "dot" : "dmg")
        );
        if (enemy.boss) S.ult = Math.min(1, S.ult + 0.004 * this.stats.chargeMul);
        if (enemy.hp <= 0) this.killEnemy(enemy);
    }

    killEnemy(enemy) {
        const R = this.state;
        const S = this.save;
        enemy.dead = true;
        this.poof(enemy.x, enemy.y, enemy.size);
        this.quake(enemy.x, enemy.y, enemy.boss ? 160 : 50);
        const total = enemy.gold * this.stats.inc;
        const count = enemy.boss ? 16 : 3 + Math.floor(this.random() * 3);
        for (let i = 0; i < count; i += 1) {
            const a = this.random() * 6.28;
            const sp = (enemy.boss ? 90 : 50) + this.random() * 80;
            R.coins.push({
                x: enemy.x,
                y: enemy.y - enemy.z,
                z: 14,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp * 0.6,
                vz: 170 + this.random() * 120,
                val: total / count,
                t: 0,
                rot: this.random() * 6.28,
            });
        }
        this.addText(enemy.x, enemy.y - enemy.size * 0.55 - enemy.z, "+" + formatNumber(total), "gold");
        this.emit("sfx", enemy.boss ? "boss" : "pop");
        if (enemy.def.split) {
            for (let i = 0; i < enemy.def.split; i += 1) {
                const child = this.makeEnemy(
                    "slimelet",
                    enemy.x + (i > 0 ? 16 : -16),
                    enemy.y + (this.random() - 0.5) * 14,
                    false
                );
                child.born = 0.15;
            }
        }
        if (enemy.type !== "slimelet" || enemy.boss) {
            R.kills += 1;
            S.ult = Math.min(1, S.ult + (1 / 22) * this.stats.chargeMul);
        }
        if (enemy.boss) {
            R.boss = null;
            R.shake = 10;
        }
        R.hero.happy = enemy.boss ? 1.6 : 0.45;
        if (R.target === enemy) R.target = null;
    }

    explode(x, y, radius, dmg, source) {
        const R = this.state;
        R.fx.push({ kind: "ring", x, y, t: 0, life: 0.35, r: radius });
        this.quake(x, y, radius);
        const list = R.enemies;
        const length = list.length;
        for (let i = 0; i < length; i += 1) {
            const enemy = list[i];
            if (enemy.dead) continue;
            const dx = enemy.x - x;
            const dy = enemy.y - enemy.z - y;
            const rr = radius + enemy.r;
            if (dx * dx + dy * dy < rr * rr) this.hurtEnemy(enemy, dmg, false, source);
        }
    }

    hurtHero(dmg) {
        const R = this.state;
        if (R.phase !== "fight") return;
        const h = R.hero;
        h.hp -= dmg;
        h.flash = 0.14;
        h.sq = 1;
        h.ouch = 0.35;
        R.shake = Math.max(R.shake, 4);
        this.addText(R.hx, R.hy - 72, "-" + formatNumber(dmg), "hurt");
        this.emit("sfx", "hurt");
        if (h.hp <= 0) {
            h.hp = 0;
            this.retreat("down");
        }
    }

    pickTarget() {
        const R = this.state;
        let best = null;
        let bestDistance = 1e18;
        for (const enemy of R.enemies) {
            if (enemy.dead || enemy.born > 0) continue;
            const d = (enemy.x - R.hx) ** 2 + (enemy.y - R.hy) ** 2;
            if (d < bestDistance) {
                bestDistance = d;
                best = enemy;
            }
        }
        return best;
    }

    /** 优先打摇杆方向左右 60 度内最近的敌人，并保留一点目标粘性。 */
    pickTargetToward(jx, jy) {
        const R = this.state;
        const current = R.target;
        let best = null;
        let bestScore = 1e18;
        let currentScore = null;
        for (const enemy of R.enemies) {
            if (enemy.dead || enemy.born > 0) continue;
            const dx = enemy.x - R.hx;
            const dy = enemy.y - R.hy;
            const d = hypot(dx, dy);
            if (d >= JOY_AIM_RANGE + 60) continue;
            const c = d > 0 ? (dx * jx + dy * jy) / d : 1;
            const score = d * (c >= 0.5 ? 1 : 3.2 - 1.4 * c);
            if (score < bestScore) {
                bestScore = score;
                best = enemy;
            }
            if (enemy === current) currentScore = score;
        }
        if (current && currentScore !== null && best !== current && bestScore > currentScore * 0.8) return current;
        return best || this.pickTarget();
    }

    fireAt(tx, ty) {
        const R = this.state;
        const ST = this.stats;
        const a0 = Math.atan2(ty - (R.hy - 30), tx - R.hx);
        const ox = R.hx + Math.cos(a0) * 21;
        const oy = R.hy - 30 + Math.sin(a0) * 21;
        const base = Math.atan2(ty - oy, tx - ox);
        const make = (angle, mul, small) => {
            const crit = this.random() < ST.crit;
            R.shots.push({
                x: ox,
                y: oy,
                vx: Math.cos(angle) * 700,
                vy: Math.sin(angle) * 700,
                dmg: ST.atk * mul * (crit ? ST.critMul : 1),
                crit,
                owner: "hero",
                spr: "i_yuzu",
                size: small ? 13 : 19,
                pierce: this.card("pierce"),
                bounce: this.card("ricochet"),
                hit: [],
                life: 1.4,
                rot: this.random() * 6.28,
                spin: 14,
            });
        };
        make(base, 1, false);
        for (let i = 0; i < this.card("split"); i += 1) {
            const k = Math.floor(i / 2) + 1;
            const sign = i % 2 === 1 ? -1 : 1;
            make(base + sign * k * 0.2, 0.4, true);
        }
        const hero = R.hero;
        hero.sq = 0.6;
        hero.recoil = 1;
        hero.snap = 1;
        hero.pull = 0;
        R.fx.push({
            kind: "lines",
            x: ox + Math.cos(base) * 14,
            y: oy + Math.sin(base) * 14,
            t: 0,
            life: 0.12,
            r: 20,
            n: 5,
            ang: base,
            arc: 1.5,
        });
        this.emit("sfx", "shoot");
    }

    onShotHit(shot, enemy) {
        const R = this.state;
        const ST = this.stats;
        this.hurtEnemy(enemy, shot.dmg, shot.crit, shot.owner);
        const big = shot.crit ? 1.5 : 1;
        R.fx.push({ kind: "glow", x: shot.x, y: shot.y, t: 0, life: 0.14, r: 34 * big });
        R.fx.push({ kind: "spark", x: shot.x, y: shot.y, t: 0, life: 0.2, r: 15 * big, rot: this.random() * 3 });
        R.fx.push({
            kind: "lines",
            x: shot.x,
            y: shot.y,
            t: 0,
            life: 0.16,
            r: 30 * big,
            n: shot.crit ? 9 : 6,
            ang: 0,
            arc: 6.28,
        });
        if (shot.owner === "hero") {
            for (let i = 0; i < (shot.crit ? 6 : 3); i += 1) {
                const a = this.random() * 6.28;
                const sp = 70 + this.random() * 110;
                R.fx.push({
                    kind: "drop",
                    x: shot.x,
                    y: shot.y,
                    vx: Math.cos(a) * sp,
                    vy: Math.sin(a) * sp - 60,
                    t: 0,
                    life: 0.3 + this.random() * 0.15,
                    r: 2.5 + this.random() * 2,
                });
            }
        }
        if (shot.crit) R.shake = Math.max(R.shake, 3.5);
        this.emit("sfx", "hit");
        if (shot.aoe) this.explode(shot.x, shot.y, shot.aoe, shot.dmg * 0.8, "pal");
        if (shot.slowAmt && !enemy.dead) {
            enemy.slow = 2;
            enemy.slowAmt = Math.max(enemy.slowAmt, shot.slowAmt);
        }
        if (shot.owner === "hero") {
            const boom = this.card("boom");
            const frost = this.card("frost");
            const poison = this.card("poison");
            if (boom > 0 && this.random() < boom * 0.07) {
                this.explode(shot.x, shot.y, 62, shot.dmg * 0.8, "boom");
                R.shake = Math.max(R.shake, 3);
            }
            if (frost > 0 && !enemy.dead) {
                enemy.slow = 2;
                enemy.slowAmt = Math.max(enemy.slowAmt, 0.1 + frost * 0.08);
            }
            if (poison > 0 && !enemy.dead) {
                enemy.poison = 4;
                enemy.poisonDps = ST.atk * poison * 0.12;
            }
        }
        shot.hit.push(enemy);
        if (shot.bounce > 0) {
            let next = null;
            let nextDistance = 190 * 190;
            for (const other of R.enemies) {
                if (other.dead || shot.hit.includes(other)) continue;
                const d = (other.x - shot.x) ** 2 + (other.y - other.z - shot.y) ** 2;
                if (d < nextDistance) {
                    nextDistance = d;
                    next = other;
                }
            }
            if (next) {
                const a = Math.atan2(next.y - next.z - next.size * 0.4 - shot.y, next.x - shot.x);
                shot.vx = Math.cos(a) * 700;
                shot.vy = Math.sin(a) * 700;
                shot.bounce -= 1;
                shot.dmg *= 0.7;
                shot.life = 0.8;
                return;
            }
        }
        if (shot.pierce > 0) {
            shot.pierce -= 1;
            return;
        }
        shot.life = 0;
    }

    castUlt(manual) {
        const R = this.state;
        const S = this.save;
        if (S.ult < 1 || R.phase !== "fight") return false;
        const alive = R.enemies.filter((enemy) => !enemy.dead);
        if (alive.length === 0) return false;
        S.ult = 0;
        R.ultAutoT = 0;
        for (let i = 0; i < 8; i += 1) {
            const enemy = alive[Math.floor(this.random() * alive.length)];
            R.ultQueue.push({
                delay: i * 0.11,
                x: enemy.x + (this.random() - 0.5) * 40,
                y: enemy.y - enemy.z + (this.random() - 0.5) * 30,
                fall: 0,
                dmg: this.stats.atk * 8,
                started: false,
                done: false,
            });
        }
        this.emit("ult", manual);
        return true;
    }

    palPounce(pal, level) {
        const R = this.state;
        const pos = R.palPos[pal.id];
        if (!pos || pos.pounce) return false;
        let target = null;
        let bestDistance = pal.pounce * pal.pounce;
        for (const enemy of R.enemies) {
            if (enemy.dead || enemy.born > 0 || enemy.def.fly) continue;
            const d = (enemy.x - pos.x) ** 2 + (enemy.y - pos.y) ** 2;
            if (d < bestDistance && hypot(enemy.x - R.hx, enemy.y - R.hy) < 300) {
                bestDistance = d;
                target = enemy;
            }
        }
        if (!target) return false;
        const distance = Math.sqrt(bestDistance);
        pos.pounce = {
            t: 0,
            dur: 0.2 + distance * 0.0011,
            fx: pos.x,
            fy: pos.y,
            e: target,
            gx: target.x,
            gy: target.y,
            amp: 14 + distance * 0.09,
            dmg: this.stats.atk * pal.mul * (1 + 0.5 * (level - 1)),
        };
        pos.face = target.x >= pos.x ? 1 : -1;
        this.emit("sfx", "shoot");
        return true;
    }

    updatePounce(pos, dt) {
        const R = this.state;
        const q = pos.pounce;
        const enemy = q.e;
        q.t += dt;
        if (!enemy.dead) {
            q.gx = enemy.x - pos.face * (enemy.r * 0.5);
            q.gy = enemy.y + 2;
        }
        const k = Math.min(1, q.t / q.dur);
        pos.x = q.fx + (q.gx - q.fx) * k;
        pos.y = q.fy + (q.gy - q.fy) * k;
        pos.h = Math.sin(k * Math.PI) * q.amp;
        pos.spd = 0;
        pos.moving = false;
        if (k < 1) return;
        pos.pounce = null;
        pos.h = 0;
        pos.land = 1;
        pos.rest = 0.35;
        pos.tx = pos.x;
        pos.ty = pos.y;
        if (!enemy.dead) {
            this.hurtEnemy(enemy, q.dmg, false, "pal");
            if (!enemy.dead && !enemy.boss) {
                enemy.slow = 0.7;
                enemy.slowAmt = 0.92;
            }
            R.fx.push({ kind: "spark", x: enemy.x, y: enemy.y - enemy.size * 0.5, t: 0, life: 0.22, r: 20, rot: this.random() * 3 });
            R.fx.push({ kind: "lines", x: enemy.x, y: enemy.y - enemy.size * 0.5, t: 0, life: 0.18, r: 34, n: 7, ang: 0, arc: 6.28 });
            R.shake = Math.max(R.shake, 2.5);
            this.emit("sfx", "hit");
        }
    }

    palShoot(pal, level) {
        if (pal.pounce) return this.palPounce(pal, level);
        const R = this.state;
        const alive = R.enemies.filter((enemy) => !enemy.dead && enemy.born <= 0 && hypot(enemy.x - R.hx, enemy.y - R.hy) < 340);
        if (alive.length === 0) return false;
        const pos = R.palPos[pal.id] || { x: R.hx + pal.off[0], y: R.hy + pal.off[1] };
        const px = pos.x;
        const py = pos.y - pal.size * 0.6;
        let target = alive[0];
        for (let i = 1; i < alive.length; i += 1) {
            const enemy = alive[i];
            if (pal.id === "owl") {
                if (enemy.hp > target.hp) target = enemy;
            } else if ((enemy.x - px) ** 2 + (enemy.y - py) ** 2 < (target.x - px) ** 2 + (target.y - py) ** 2) {
                target = enemy;
            }
        }
        const a = Math.atan2(target.y - target.z - target.size * 0.4 - py, target.x - px);
        const shot = {
            x: px,
            y: py,
            vx: Math.cos(a) * 480,
            vy: Math.sin(a) * 480,
            dmg: this.stats.atk * pal.mul * (1 + 0.5 * (level - 1)),
            crit: false,
            owner: "pal",
            pierce: 0,
            bounce: 0,
            hit: [],
            life: 1.4,
            rot: a,
            spin: 0,
            size: 12,
            spr: "quack",
        };
        if (pal.id === "duck") shot.size = 10;
        if (pal.id === "owl") {
            shot.spr = "i_feather";
            shot.pierce = 99;
            shot.size = 22;
            shot.vx *= 1.4;
            shot.vy *= 1.4;
        }
        if (pal.id === "monkey") {
            shot.spr = "i_snowball";
            shot.aoe = 58;
            shot.slowAmt = 0.3;
            shot.size = 18;
            shot.spin = 8;
        }
        R.shots.push(shot);
        R.palAtk[pal.id] = 0.22;
        if (R.palPos[pal.id]) R.palPos[pal.id].face = target.x >= px ? 1 : -1;
        return true;
    }

    followHero(dt) {
        const R = this.state;
        const S = this.save;
        const k = Math.min(1, dt * 4.5);
        R.cam.x += (R.hx - R.cam.x) * k;
        R.cam.y += (R.hy - R.cam.y) * k;
        const hvx = R.hero.dx * R.hero.spd;
        const hvy = R.hero.dy * R.hero.spd;
        for (const pal of this.data.pals) {
            if (!S.pals[pal.id]) continue;
            let pos = R.palPos[pal.id];
            if (!pos) {
                pos = {
                    x: R.hx + pal.off[0],
                    y: R.hy + pal.off[1],
                    tx: R.hx + pal.off[0],
                    ty: R.hy + pal.off[1],
                    spd: 0,
                    dist: 0,
                    rest: 1,
                    face: 1,
                    moving: false,
                    land: 0,
                    h: 0,
                    ux: 1,
                    uy: 0,
                    pounce: null,
                };
                R.palPos[pal.id] = pos;
            }
            pos.land = Math.max(0, pos.land - dt * 7);
            if (pos.pounce) {
                this.updatePounce(pos, dt);
                continue;
            }
            const fromHero = hypot(R.hx - pos.x, R.hy - pos.y);
            if (fromHero > 460) {
                pos.x = R.hx + pal.off[0];
                pos.y = R.hy + pal.off[1];
                pos.tx = pos.x;
                pos.ty = pos.y;
                pos.spd = 0;
                continue;
            }
            pos.rest -= dt;
            if (pos.rest <= 0 || hypot(R.hx - pos.tx, R.hy - pos.ty) > pal.leash) {
                const a = this.random() * 6.283;
                const radius = pal.roam[0] + this.random() * (pal.roam[1] - pal.roam[0]);
                pos.tx = R.hx + hvx * 0.7 + Math.cos(a) * radius;
                pos.ty = R.hy + hvy * 0.7 + Math.sin(a) * radius * 0.72;
                const roadY = this.F.roadY(pos.tx);
                pos.ty = Math.max(roadY - 105, Math.min(roadY + 105, pos.ty));
                pos.rest = pal.rest[0] + this.random() * (pal.rest[1] - pal.rest[0]);
            }
            const dx = pos.tx - pos.x;
            const dy = pos.ty - pos.y;
            const d = hypot(dx, dy);
            const want = d < 5 ? 0 : Math.min(pal.run, 24 + d * 2.4 + (fromHero > pal.leash ? 60 : 0));
            pos.spd += (want - pos.spd) * Math.min(1, dt * 7);
            if (d > 0.5 && pos.spd > 1) {
                const move = Math.min(d, pos.spd * dt);
                pos.x += (dx / d) * move;
                pos.y += (dy / d) * move;
                pos.dist += move;
                pos.ux = dx / d;
                pos.uy = dy / d;
            }
            pos.moving = pos.spd > 8;
            if (pos.moving && Math.abs(dx) > 3) pos.face = dx > 0 ? 1 : -1;
            else if (!pos.moving && R.target && !R.target.dead) pos.face = R.target.x >= pos.x ? 1 : -1;
        }
    }

    bossSkill(enemy) {
        const R = this.state;
        enemy.sq = 1;
        const skill = enemy.def.skill;
        if (skill === "summon") {
            for (let i = 0; i < 2; i += 1) {
                const child = this.makeEnemy("boar", enemy.x - 20, enemy.y + (i > 0 ? 60 : -60), false);
                child.born = 0.3;
                child.gold *= 0.3;
            }
            this.addText(enemy.x, enemy.y - enemy.size, L("小的们上!", "Get 'em, kids!"), "block");
        } else {
            const count = skill === "snow" ? 5 : 3;
            const spread = skill === "snow" ? 0.32 : 0.28;
            const base = Math.atan2(R.hy - 40 - (enemy.y - enemy.size * 0.5), R.hx - enemy.x);
            for (let i = 0; i < count; i += 1) {
                const a = base + (i - (count - 1) / 2) * spread;
                R.eshots.push({
                    x: enemy.x,
                    y: enemy.y - enemy.size * 0.5,
                    vx: Math.cos(a) * 190,
                    vy: Math.sin(a) * 190,
                    dmg: enemy.dmg * 0.7,
                    spr: skill === "snow" ? "i_snowball" : "i_bucket",
                    size: skill === "snow" ? 20 : 26,
                    rot: 0,
                    life: 4,
                    freeze: skill === "snow",
                });
            }
        }
        this.emit("sfx", "block");
    }

    updateEnemies(dt) {
        const R = this.state;
        const hx = R.hx;
        const hy = R.hy;
        const list = R.enemies;
        const length = list.length;
        for (let i = 0; i < length; i += 1) {
            const enemy = list[i];
            if (enemy.dead) continue;
            enemy.t += dt;
            enemy.flash = Math.max(0, enemy.flash - dt);
            enemy.sq = Math.max(0, enemy.sq - dt * 7);
            enemy.lunge = Math.max(0, enemy.lunge - dt * 4);
            if (enemy.born > 0) {
                enemy.born -= dt;
                continue;
            }
            if (enemy.kvx !== 0 || enemy.kvy !== 0) {
                enemy.x += enemy.kvx * dt;
                enemy.y += enemy.kvy * dt;
                const damp = Math.exp(-13 * dt);
                enemy.kvx *= damp;
                enemy.kvy *= damp;
                if (Math.abs(enemy.kvx) + Math.abs(enemy.kvy) < 4) {
                    enemy.kvx = 0;
                    enemy.kvy = 0;
                }
            }
            if (enemy.poison > 0) {
                enemy.poison -= dt;
                enemy.pt += dt;
                if (enemy.pt >= 0.5) {
                    enemy.pt = 0;
                    this.hurtEnemy(enemy, enemy.poisonDps * 0.5, false, "dot");
                    if (enemy.dead) continue;
                }
            }
            let spd = enemy.spd;
            if (enemy.slow > 0) {
                enemy.slow -= dt;
                spd *= 1 - enemy.slowAmt;
                if (enemy.slow <= 0) enemy.slowAmt = 0;
            }
            const dx = hx - enemy.x;
            const dy = hy - enemy.y;
            const d = hypot(dx, dy) || 1;
            enemy.face = dx >= 0 ? 1 : -1;
            const def = enemy.def;
            const stop = def.ranged || 28 + enemy.r;

            if (def.charge && !enemy.boss) {
                if (enemy.state === "move" && d < 210 && !enemy.charged) {
                    enemy.state = "wind";
                    enemy.stateT = 0.55;
                    enemy.charged = true;
                }
                if (enemy.state === "wind") {
                    enemy.stateT -= dt;
                    if (enemy.stateT <= 0) enemy.state = "dash";
                    continue;
                }
                if (enemy.state === "dash") {
                    spd = 270 * (enemy.slow > 0 ? 1 - enemy.slowAmt : 1);
                    if (d <= stop) {
                        enemy.state = "move";
                        this.hurtHero(enemy.dmg);
                        enemy.atkCd = 1.3;
                        enemy.lunge = 1;
                    }
                }
            }

            if (d > stop) {
                let mx = dx / d;
                let my = dy / d;
                if (def.fly) {
                    const w = Math.sin(enemy.t * 4 + enemy.wob) * 0.7;
                    const nx = mx - my * w;
                    const ny = my + mx * w;
                    mx = nx;
                    my = ny;
                }
                let move = 1;
                if (enemy.state !== "dash" && !def.fly) move = hopState(enemy).move;
                enemy.x += mx * spd * move * dt;
                enemy.y += my * spd * move * dt;
            } else {
                enemy.atkCd -= dt;
                if (enemy.atkCd <= 0) {
                    if (def.ranged) {
                        R.eshots.push({
                            x: enemy.x,
                            y: enemy.y - enemy.size * 0.6,
                            vx: (dx / d) * 210,
                            vy: ((dy - 30) / d) * 210,
                            dmg: enemy.dmg,
                            spr: def.shot,
                            size: 16,
                            rot: 0,
                            life: 3,
                        });
                        enemy.atkCd = 2.2;
                        enemy.sq = 0.7;
                    } else {
                        this.hurtHero(enemy.dmg);
                        enemy.atkCd = enemy.boss ? 1.6 : 1.25;
                        enemy.lunge = 1;
                    }
                }
            }

            if (enemy.boss) {
                enemy.skillCd -= dt;
                if (enemy.skillCd <= 0) {
                    this.bossSkill(enemy);
                    enemy.skillCd = 5.5;
                }
            }
        }

        const all = R.enemies;
        for (let i = 0; i < all.length; i += 1) {
            for (let j = i + 1; j < all.length; j += 1) {
                const a = all[i];
                const b = all[j];
                if (a.dead || b.dead || Boolean(a.def.fly) !== Boolean(b.def.fly)) continue;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const d = hypot(dx, dy) || 0.01;
                const min = (a.r + b.r) * 0.95;
                if (d < min) {
                    const push = (min - d) * Math.min(0.5, dt * 11);
                    const ux = dx / d;
                    const uy = dy / d;
                    if (!a.boss) {
                        a.x -= ux * push;
                        a.y -= uy * push;
                    }
                    if (!b.boss) {
                        b.x += ux * push;
                        b.y += uy * push;
                    }
                }
            }
        }
    }

    updateShots(dt) {
        const R = this.state;
        for (const shot of R.shots) {
            shot.x += shot.vx * dt;
            shot.y += shot.vy * dt;
            shot.life -= dt;
            shot.rot += shot.spin * dt;
            if (Math.abs(shot.x - R.hx) > R.W || Math.abs(shot.y - R.hy) > R.H) shot.life = 0;
            const list = R.enemies;
            const length = list.length;
            for (let i = 0; i < length; i += 1) {
                const enemy = list[i];
                if (enemy.dead || enemy.born > 0 || shot.hit.includes(enemy)) continue;
                const dx = enemy.x - shot.x;
                const dy = enemy.y - enemy.z - enemy.size * 0.4 - shot.y;
                const rr = enemy.r + shot.size * 0.5;
                if (dx * dx + dy * dy < rr * rr) {
                    this.onShotHit(shot, enemy);
                    if (shot.life <= 0) break;
                }
            }
        }
        R.shots = R.shots.filter((shot) => shot.life > 0);

        for (const shot of R.eshots) {
            shot.x += shot.vx * dt;
            shot.y += shot.vy * dt;
            shot.life -= dt;
            shot.rot += 6 * dt;
            const dx = R.hx - shot.x;
            const dy = R.hy - 30 - shot.y;
            if (dx * dx + dy * dy < 26 * 26) {
                shot.life = 0;
                this.hurtHero(shot.dmg);
                if (shot.freeze) {
                    R.hero.slow = 2;
                    this.addText(R.hx, R.hy - 86, L("冻住了", "Frozen"), "block");
                }
                R.fx.push({ kind: "spark", x: shot.x, y: shot.y, t: 0, life: 0.2, r: 14, rot: 0 });
            }
        }
        R.eshots = R.eshots.filter((shot) => shot.life > 0 && Math.abs(shot.x - R.hx) < R.W);
    }

    updateCoins(dt) {
        const R = this.state;
        const S = this.save;
        let got = 0;
        for (const coin of R.coins) {
            coin.t += dt;
            if (coin.t < 0.55) {
                coin.x += coin.vx * dt;
                coin.y += coin.vy * dt;
                coin.z += coin.vz * dt;
                coin.vz -= 900 * dt;
                if (coin.z < 0) {
                    coin.z = 0;
                    coin.vz *= -0.45;
                    coin.vx *= 0.6;
                    coin.vy *= 0.6;
                }
            } else {
                const dx = R.hx - coin.x;
                const dy = R.hy - 24 - coin.y;
                const d = hypot(dx, dy) || 1;
                const sp = 260 + (coin.t - 0.55) * 900;
                coin.x += (dx / d) * sp * dt;
                coin.y += (dy / d) * sp * dt;
                coin.z *= 0.9;
                if (d < 22) {
                    coin.done = true;
                    S.oranges += coin.val;
                    got += coin.val;
                }
            }
        }
        if (got > 0) {
            this.emit("coin", got);
            R.coins = R.coins.filter((coin) => !coin.done);
        }
        while (R.coins.length > 140) S.oranges += R.coins.shift().val;
    }

    updateFx(dt) {
        const R = this.state;
        for (const fx of R.fx) {
            fx.t += dt;
            if (fx.kind === "puff") {
                fx.x += fx.vx * dt;
                fx.y += fx.vy * dt;
                fx.vx *= 0.9;
                fx.vy *= 0.9;
            } else if (fx.kind === "drop") {
                fx.x += fx.vx * dt;
                fx.y += fx.vy * dt;
                fx.vy += 520 * dt;
            } else if (fx.kind === "lid") {
                fx.x += fx.vx * dt;
                fx.y += fx.vy * dt;
                fx.vy += 600 * dt;
                fx.rot += 9 * dt;
            }
        }
        R.fx = R.fx.filter((fx) => fx.t < fx.life);
        for (const text of R.texts) {
            text.t += dt;
            text.y += text.vy * dt;
            text.x += text.vx * dt;
            text.vy *= 0.94;
            text.vx *= 0.94;
        }
        R.texts = R.texts.filter((text) => text.t < 0.85);
    }

    updateManual(dt) {
        const R = this.state;
        const J = R.joy;
        const h = R.hero;
        let mx = J.dx;
        let my = J.dy;
        const off = R.hy - this.F.roadY(R.hx);
        if ((off > MANUAL_BAND && my > 0) || (off < -MANUAL_BAND && my < 0)) my = 0;
        const mv = hypot(mx, my);
        h.moving = mv > 0.08;
        h.spd += (124 * Math.min(1, J.mag) * mv - h.spd) * Math.min(1, dt * 9);
        if (h.moving) {
            mx /= mv;
            my /= mv;
            R.hx += mx * h.spd * dt;
            R.hy += my * h.spd * dt;
            h.dist += h.spd * dt;
            h.dx = mx;
            h.dy = my;
        }
        R.target = this.pickTargetToward(J.dx, J.dy);
        const t = R.target;
        let fired = false;
        if (t) {
            const dx = t.x - R.hx;
            const dy = t.y - R.hy;
            if (hypot(dx, dy) < JOY_AIM_RANGE) {
                h.face = dx >= 0 ? 1 : -1;
                fired = true;
                if (h.cd <= 0) {
                    this.fireAt(t.x, t.y - t.z - t.size * 0.4);
                    h.cd = 1 / this.stats.aspd;
                }
            }
        }
        if (!fired) {
            if (Math.abs(J.dx) > 0.2) h.face = J.dx > 0 ? 1 : -1;
            if (h.cd < 0) h.cd = 0;
        }
    }

    update(dt) {
        const R = this.state;
        if (!R.started || dt <= 0) return;
        const S = this.save;
        let ST = this.stats;
        const h = R.hero;
        R.time += dt;
        if (R.joy.on) R.joy.t += dt;

        h.flash = Math.max(0, h.flash - dt);
        h.sq = Math.max(0, h.sq - dt * 6);
        h.recoil = Math.max(0, h.recoil - dt * 9);
        h.snap = Math.max(0, h.snap - dt * 7);
        h.happy = Math.max(0, h.happy - dt);
        h.ouch = Math.max(0, h.ouch - dt);

        const aimTarget = R.target && !R.target.dead && R.phase === "fight" ? R.target : null;
        const want = aimTarget
            ? Math.atan2(aimTarget.y - aimTarget.z - aimTarget.size * 0.4 - (R.hy - 30), aimTarget.x - R.hx)
            : (h.face > 0 ? -0.45 : Math.PI + 0.45);
        const aimDelta = want - h.aim;
        h.aim += Math.atan2(Math.sin(aimDelta), Math.cos(aimDelta)) * Math.min(1, dt * 16);
        const pullWant = aimTarget ? Math.min(1, Math.max(0, 1 - h.cd * ST.aspd)) : 0.15;
        h.pull += (pullWant - h.pull) * Math.min(1, dt * 18);

        h.slow = Math.max(0, h.slow - dt);
        R.shake = Math.max(0, R.shake - dt * 30);
        S.basket = Math.min(this.basketCap(), S.basket + this.basketRate() * dt);
        if (S.buffT > 0) {
            S.buffT -= dt;
            if (S.buffT <= 0) {
                S.buffT = 0;
                this.recalc();
                ST = this.stats;
                this.emit("buffEnd");
            }
        }

        this.updateFx(dt);
        this.updateCoins(dt);
        this.followHero(dt);

        if (R.phase === "walk") {
            R.phaseT += dt;
            h.face = R.walkDir;
            h.moving = true;
            h.spd += (150 - h.spd) * Math.min(1, dt * 6);
            h.dist += h.spd * dt;
            let mx = R.walkDir;
            let my = clamp((this.F.roadY(R.hx) - R.hy) / 36, -1.6, 1.6);
            const length = hypot(mx, my);
            mx /= length;
            my /= length;
            h.dx = mx;
            h.dy = my;
            R.hx += mx * h.spd * dt;
            R.hy += my * h.spd * dt;
            if (R.phaseT >= 1.7) this.startStage();
            return;
        }

        if (R.phase === "down") {
            R.phaseT += dt;
            h.moving = false;
            h.spd = 0;
            if (R.phaseT >= 1.6) this.beginWalk(-1);
            return;
        }

        const n = S.stage;
        if (this.F.isBoss(n)) {
            if (R.bossSpawnT > 0) {
                R.bossSpawnT -= dt;
                if (R.bossSpawnT <= 0) {
                    R.boss = this.makeEnemy(this.F.chapDef(n).boss, R.hx + R.W * 0.5 + 80, R.hy - 10, true);
                    this.emit("bossIn", R.boss.def.name);
                }
            } else if (R.boss) {
                R.bossT -= dt;
                if (R.bossT <= 0) {
                    this.retreat("time");
                    return;
                }
            }
        } else {
            R.spawnCd -= dt;
            const cap = 3 + this.F.sub(n);
            let nonBaby = 0;
            for (const enemy of R.enemies) if (enemy.type !== "slimelet") nonBaby += 1;
            const left = S.farm ? 99 : R.need - R.kills - nonBaby;
            const room = Math.min(cap - R.enemies.length, left);
            if (R.spawnCd <= 0 && room > 0) {
                const count = this.spawnPack(room);
                R.spawnCd = (1.25 - 0.1 * this.F.sub(n)) * (0.75 + this.random() * 0.5) * count;
            }
        }

        h.hp = Math.min(ST.hp, h.hp + ST.hp * ST.regen * dt);

        if (!R.target || R.target.dead) R.target = this.pickTarget();
        h.cd -= dt * (h.slow > 0 ? 0.5 : 1);

        const t = R.target;
        if (R.joy.on && R.joy.mag > 0.15) {
            this.updateManual(dt);
        } else if (t) {
            const dx = t.x - R.hx;
            const dy = t.y - R.hy;
            const d = hypot(dx, dy) || 1;
            h.face = dx >= 0 ? 1 : -1;
            if (d > 172) h.moving = true;
            else if (d < 138) h.moving = false;
            h.spd += ((h.moving ? 82 : 0) - h.spd) * Math.min(1, dt * 7);
            let mx = dx / d;
            let my = dy / d;
            const off = R.hy - this.F.roadY(R.hx);
            if ((off > 84 && my > 0) || (off < -84 && my < 0)) {
                my = 0;
                const ax = Math.abs(mx) || 1;
                mx = (mx / ax) * Math.min(1, Math.abs(mx) + 0.35);
            }
            R.hx += mx * h.spd * dt;
            R.hy += my * h.spd * dt;
            h.dist += hypot(mx, my) * h.spd * dt;
            if (mx !== 0 || my !== 0) {
                const length = hypot(mx, my);
                h.dx = mx / length;
                h.dy = my / length;
            }
            if (h.cd <= 0 && d < 340) {
                this.fireAt(t.x, t.y - t.z - t.size * 0.4);
                h.cd = 1 / ST.aspd;
            } else if (h.cd < 0) {
                h.cd = 0;
            }
        } else {
            h.moving = true;
            h.face = 1;
            const off = this.F.roadY(R.hx) - R.hy;
            const far = Math.abs(off) > 30;
            h.spd += ((far ? 96 : 46) - h.spd) * Math.min(1, dt * 5);
            let mx = 1;
            let my = clamp(off / 36, -1.6, 1.6);
            const length = hypot(mx, my);
            mx /= length;
            my /= length;
            R.hx += mx * h.spd * dt;
            R.hy += my * h.spd * dt;
            h.dist += h.spd * dt;
            h.dx = mx;
            h.dy = my;
            if (h.cd < 0) h.cd = 0;
        }

        for (const pal of this.data.pals) {
            const level = S.pals[pal.id] || 0;
            if (level <= 0) continue;
            R.palAtk[pal.id] = Math.max(0, (R.palAtk[pal.id] || 0) - dt);
            R.palCd[pal.id] = (R.palCd[pal.id] === undefined ? pal.cd : R.palCd[pal.id]) - dt;
            if (R.palCd[pal.id] <= 0) R.palCd[pal.id] = this.palShoot(pal, level) ? pal.cd : 0.2;
        }

        if (S.ult >= 1 && S.auto) {
            R.ultAutoT += dt;
            if (R.ultAutoT > 2.5) this.castUlt(false);
        }
        for (const drop of R.ultQueue) {
            drop.delay -= dt;
            if (drop.delay <= 0) {
                drop.started = true;
                drop.fall += dt / 0.42;
            }
            if (drop.fall >= 1 && !drop.done) {
                drop.done = true;
                this.explode(drop.x, drop.y, 78, drop.dmg, "ult");
                R.shake = Math.max(R.shake, 7);
                this.poof(drop.x, drop.y + 10, 70);
                this.emit("sfx", "boom");
            }
        }
        R.ultQueue = R.ultQueue.filter((drop) => !drop.done);

        this.updateEnemies(dt);
        this.updateShots(dt);

        R.enemies = R.enemies.filter((enemy) => !enemy.dead);
        if (R.phase === "fight" && R.kills >= R.need) this.stageClear();
    }

    /** 手指按下战斗区时放出摇杆；坐标是游戏画面的逻辑坐标。 */
    joystickStart(x, y) {
        const R = this.state;
        if (!R.started || R.paused || y <= R.top || y >= R.bottom) return false;
        Object.assign(R.joy, { on: true, bx: x, by: y, kx: x, ky: y, dx: 0, dy: 0, mag: 0, t: 0 });
        return true;
    }

    joystickMove(x, y) {
        const J = this.state.joy;
        if (!J.on) return;
        let dx = x - J.bx;
        let dy = y - J.by;
        let d = hypot(dx, dy);
        if (d > JOY_RADIUS) {
            J.bx += (dx / d) * (d - JOY_RADIUS);
            J.by += (dy / d) * (d - JOY_RADIUS);
            dx = x - J.bx;
            dy = y - J.by;
            d = JOY_RADIUS;
        }
        J.kx = x;
        J.ky = y;
        J.mag = d / JOY_RADIUS;
        if (d > 0.001) {
            J.dx = dx / d;
            J.dy = dy / d;
        }
    }

    joystickEnd() {
        const J = this.state.joy;
        J.on = false;
        J.mag = 0;
    }

    buyUpgrade(id) {
        const S = this.save;
        const upgrade = this.data.upgrades.find((item) => item.id === id);
        if (!upgrade) return { ok: false, reason: "unknown" };
        const level = Number(S.lv[id]) || 0;
        if (upgrade.max !== undefined && level >= upgrade.max) {
            this.emit("sfx", "deny");
            return { ok: false, reason: "max", level, cost: 0 };
        }
        const cost = this.F.cost(upgrade, level);
        if (S.oranges < cost) {
            this.emit("sfx", "deny");
            return { ok: false, reason: "poor", level, cost };
        }
        S.oranges -= cost;
        S.lv[id] = level + 1;
        const ratio = this.stats.hp > 0 ? this.state.hero.hp / this.stats.hp : 1;
        this.recalc();
        if (id === "hp") this.state.hero.hp = this.stats.hp * ratio;
        this.emit("sfx", "buy");
        return { ok: true, level: S.lv[id], cost };
    }

    drawCards() {
        const pool = this.data.cards.filter((card) => this.card(card.id) < this.data.cardMax);
        const out = [];
        while (out.length < 3 && pool.length > 0) {
            out.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0].id);
        }
        return out;
    }

    takeCard(id) {
        const S = this.save;
        if (S.picks <= 0) return false;
        S.picks -= 1;
        S.cards[id] = this.card(id) + 1;
        S.offer = null;
        S.rerolled = false;
        const ratio = this.state.hero.hp / this.stats.hp;
        this.recalc();
        this.state.hero.hp = this.stats.hp * ratio;
        this.saveNow();
        return true;
    }

    buyPal(id) {
        const S = this.save;
        const pal = this.data.pals.find((item) => item.id === id);
        const level = S.pals[id] || 0;
        if (!pal || level >= this.data.palMax) return false;
        const cost = pal.cost[level];
        if (S.gems < cost) return false;
        S.gems -= cost;
        S.pals[id] = level + 1;
        this.saveNow();
        return true;
    }

    collectBasket(mult) {
        const S = this.save;
        const value = S.basket * (mult || 1);
        if (value < 1) return 0;
        S.basket = 0;
        S.oranges += value;
        this.saveNow();
        return value;
    }

    adPalProgress(id) {
        const S = this.save;
        S.palAds[id] = (S.palAds[id] || 0) + 1;
        const unlocked = S.palAds[id] >= this.data.adPalNeed[id] && !S.pals[id];
        if (unlocked) S.pals[id] = 1;
        this.saveNow();
        return unlocked;
    }

    startBuff() {
        this.save.buffT = this.data.buffSec;
        this.recalc();
        this.saveNow();
    }

    rerollCards() {
        this.save.offer = null;
        this.save.rerolled = true;
        this.saveNow();
    }

    offlineGain(lastSeconds) {
        const S = this.save;
        const now = this.now();
        const last = Number.isFinite(Number(lastSeconds)) ? Number(lastSeconds) : Number(S.last);
        const sec = Math.max(0, now - (Number.isFinite(last) ? last : now));
        if (sec < 60 || S.best < 1) return null;
        const add = Math.min(this.basketCap() - S.basket, this.basketRate() * Math.min(sec, this.data.basketCapSec));
        S.basket += Math.max(0, add);
        return { sec, total: S.basket };
    }

    addText(x, y, text, kind) {
        const R = this.state;
        R.texts.push({
            x: x + (this.random() - 0.5) * 16,
            y,
            str: text,
            kind,
            t: 0,
            vy: -46 - this.random() * 14,
            vx: (this.random() - 0.5) * 20,
        });
        if (R.texts.length > 60) R.texts.shift();
    }

    poof(x, y, size) {
        const R = this.state;
        for (let i = 0; i < 5; i += 1) {
            const a = this.random() * 6.28;
            const sp = 20 + this.random() * 50;
            R.fx.push({
                kind: "puff",
                x,
                y: y - size * 0.3,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp * 0.6 - 15,
                t: 0,
                life: 0.45 + this.random() * 0.2,
                r: size * (0.12 + this.random() * 0.1),
            });
        }
    }

    quake(x, y, r) {
        const R = this.state;
        if (R.quakes.length < 12) R.quakes.push({ x, y, r });
    }

    saveNow() {
        if (this.onSave) this.onSave(this.save);
    }

    getUpgradeInfo(id) {
        const upgrade = this.data.upgrades.find((item) => item.id === id);
        if (!upgrade) return null;
        const level = Number(this.save.lv[id]) || 0;
        const maxed = upgrade.max !== undefined && level >= upgrade.max;
        return {
            id,
            name: upgrade.name,
            ico: upgrade.ico,
            color: upgrade.color,
            level,
            max: upgrade.max,
            maxed,
            cost: maxed ? 0 : this.F.cost(upgrade, level),
            value: upgradeDisplayValue(this.data, this.save, id, this.stats),
        };
    }

    getHudState() {
        const S = this.save;
        const R = this.state;
        const isBoss = this.F.isBoss(S.stage);
        const chapter = this.F.chapDef(S.stage);
        return {
            stage: S.stage,
            label: this.F.label(S.stage),
            chapter: chapter.name,
            isBoss,
            bossName: isBoss ? this.data.bosses[chapter.boss].name : "",
            bossT: R.bossT,
            bossRatio: R.boss ? Math.max(0, R.boss.hp / R.boss.max) : (R.bossSpawnT > 0 ? 1 : 0),
            farm: Boolean(S.farm),
            phase: R.phase,
            kills: R.kills,
            need: R.need,
            oranges: S.oranges,
            gems: S.gems,
            heroHp: R.hero.hp,
            maxHp: this.stats.hp,
            stats: this.stats,
        };
    }

    getSelfTestState() {
        const hud = this.getHudState();
        return {
            ready: Boolean(this.state.started),
            stage: hud.stage,
            label: hud.label,
            phase: hud.phase,
            kills: hud.kills,
            need: hud.need,
            oranges: hud.oranges,
            gems: hud.gems,
            heroHp: hud.heroHp,
            maxHp: hud.maxHp,
            enemyCount: this.state.enemies.length,
            atkLevel: this.save.lv.atk,
            spdLevel: this.save.lv.spd,
            incLevel: this.save.lv.inc,
            hpLevel: this.save.lv.hp,
            atkCost: this.getUpgradeInfo("atk").cost,
            spdCost: this.getUpgradeInfo("spd").cost,
            incCost: this.getUpgradeInfo("inc").cost,
            hpCost: this.getUpgradeInfo("hp").cost,
        };
    }

    waitForStarted() {
        if (this.state.started) return Promise.resolve(true);
        return new Promise((resolve) => {
            const startedAt = Date.now();
            const check = () => {
                if (this.state.started) resolve(true);
                else if (Date.now() - startedAt > 8000) resolve(false);
                else setTimeout(check, 100);
            };
            check();
        });
    }

    waitForFight() {
        return new Promise((resolve) => {
            const startedAt = Date.now();
            const check = () => {
                if (this.state.started && this.state.phase === "fight") resolve(true);
                else if (Date.now() - startedAt > 8000) resolve(false);
                else setTimeout(check, 100);
            };
            check();
        });
    }

    /** 开发自测夹具：准备 30 个橘子，用于验证按住连续升级。 */
    async prepareUpgradeReady() {
        const ok = await this.waitForStarted();
        if (!ok) return false;
        this.save.oranges = 30;
        this.emit("fixture", "upgrade");
        return true;
    }

    /** 开发自测夹具：把当前普通关推进到只差一次击杀。 */
    async prepareNearClear() {
        const ok = await this.waitForFight();
        if (!ok) return false;
        const R = this.state;
        R.enemies = [];
        R.shots = [];
        R.kills = Math.max(0, R.need - 1);
        R.spawnCd = 5;
        R.hero.cd = 0;
        const enemy = this.makeEnemy("mushroom", R.hx + 110, R.hy, false);
        if (enemy) {
            enemy.born = 0;
            enemy.hp = 1;
            enemy.max = 1;
            enemy.atkCd = 5;
            R.target = enemy;
        }
        this.emit("fixture", "nearClear");
        return Boolean(enemy);
    }
}
