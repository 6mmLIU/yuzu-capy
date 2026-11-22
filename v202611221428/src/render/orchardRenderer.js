/**
 * 战场 Canvas 渲染：三章场景、主角部件、敌人首领、伙伴、弹道与特效。
 * 只读 BattleGame 的状态；不参与玩法结算。
 */
import { applyUiId } from "../ui/uiId.js";
import { computeLayout } from "./layout.js";
import { hopState, JOY_RADIUS } from "../game/battle.js";
import { rng } from "../game/formulas.js";

const TILE = 320;
const CELL = 84;
const STEP = 20;
const HERO_K = 0.78;
const RIG = { TH: 50, HH: 46, neckX: 2, neckY: 0.74, headAy: 0.84, eyeX: -1, eyeY: 18, yuzuY: 0.62, yuzuX: 0 };
const LEG_COL = [181, 124, 77];
const FUR_COL = [217, 156, 98];
const INK = [74, 53, 36];
const PINK = [246, 169, 164];
const TEXT_STYLE = {
    dmg: { color: [255, 255, 255], size: 16 },
    crit: { color: [255, 216, 61], size: 24 },
    gold: { color: [255, 176, 46], size: 16 },
    hurt: { color: [255, 138, 122], size: 17 },
    block: { color: [232, 226, 210], size: 14 },
    dot: { color: [201, 236, 122], size: 12 },
};

function rgb(color, alpha) {
    return `rgba(${color[0]},${color[1]},${color[2]},${alpha === undefined ? 1 : alpha})`;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function readCssPx(name) {
    try {
        const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
        return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (error) {
        return 0;
    }
}

export class OrchardRenderer {
    constructor(options) {
        this.images = options.images;
        this.data = options.data;
        this.onLayout = options.onLayout || null;
        this.canvas = null;
        this.ctx = null;
        this.cssWidth = 0;
        this.cssHeight = 0;
        this.dpr = 1;
        this.layout = null;
        this.frameCount = 0;
        this.tiles = new Map();
        this.cells = new Map();
        this.cellCount = 0;
        this.gust = { x: -1e9, id: 0, next: 2 };
        this.lastT = null;
        this.chapter = null;
        this.tinted = new Map();
    }

    init(host) {
        const canvas = document.createElement("canvas");
        canvas.className = "game-canvas";
        applyUiId(canvas, "game.canvas");
        host.appendChild(canvas);
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
    }

    resize(width, height) {
        if (!this.canvas || !this.ctx) return;
        const cssWidth = Math.max(1, width);
        const cssHeight = Math.max(1, height);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.cssWidth = cssWidth;
        this.cssHeight = cssHeight;
        this.dpr = dpr;
        const backingWidth = Math.max(1, Math.round(cssWidth * dpr));
        const backingHeight = Math.max(1, Math.round(cssHeight * dpr));
        if (this.canvas.width !== backingWidth) this.canvas.width = backingWidth;
        if (this.canvas.height !== backingHeight) this.canvas.height = backingHeight;
        this.canvas.style.width = `${cssWidth}px`;
        this.canvas.style.height = `${cssHeight}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const safeTop = readCssPx("--pm-safe-top");
        const safeBottom = readCssPx("--pm-safe-bottom");
        this.layout = computeLayout({
            physWidth: cssWidth * dpr,
            physHeight: cssHeight * dpr,
            dpr,
            safeTopPx: safeTop * dpr,
            safeBottomPx: safeBottom * dpr,
        });
        if (this.onLayout) this.onLayout(this.layout);
    }

    dispose() {
        if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
        this.canvas = null;
        this.ctx = null;
    }

    render(game, deltaMs) {
        if (!this.ctx || !this.layout || !game || !game.state) return;
        this.frameCount += 1;
        this.lastGame = game;
        const ctx = this.ctx;
        const R = game.state;
        const S = game.save;
        const F = game.F;
        const ST = game.stats;
        const layout = this.layout;
        const view = layout.view;
        const t = R.time;
        const fdt = Math.min(0.05, Math.max(0, t - (this.lastT === null ? t : this.lastT)));
        this.lastT = t;

        const pendingChapter = Math.max(0, Math.min(this.data.chapters.length - 1, F.chapIndex(S.stage) - 1));
        let fade = 0;
        if (this.chapter === null || R.phase === "fight") this.chapter = pendingChapter;
        if (R.phase === "walk" && pendingChapter !== this.chapter) {
            fade = Math.max(0, 1 - Math.abs(R.phaseT - 0.85) / 0.55);
            if (R.phaseT >= 0.85) this.chapter = pendingChapter;
        }
        const chapterIndex = this.chapter;
        const chapter = this.data.chapters[chapterIndex];

        ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
        ctx.fillStyle = layout.sideColor;
        ctx.fillRect(0, 0, layout.logical.width, layout.logical.height);
        ctx.save();
        ctx.beginPath();
        ctx.rect(view.x, 0, view.width, view.height);
        ctx.clip();
        ctx.fillStyle = rgb(chapter.ground);
        ctx.fillRect(view.x, 0, view.width, view.height);

        if (t > this.gust.next) {
            this.gust.id += 1;
            this.gust.x = R.cam.x - R.ax - 140;
            this.gust.next = t + 3 + Math.random() * 3;
        }
        this.gust.x += 560 * fdt;

        const shakeX = R.shake > 0 ? (Math.random() - 0.5) * R.shake : 0;
        const shakeY = R.shake > 0 ? (Math.random() - 0.5) * R.shake : 0;
        const ox = view.x + layout.hero.x - R.cam.x + shakeX;
        const oy = layout.hero.y - R.cam.y + shakeY;
        const left = view.x - ox;
        const right = view.x + view.width - ox;
        const top = -oy;
        const bottom = view.height - oy;

        ctx.save();
        ctx.translate(ox, oy);

        this.drawGround(chapterIndex, chapter, left, right, top, bottom);
        this.drawRoad(chapter, left, right);

        const target = R.target && !R.target.dead && R.phase === "fight" ? R.target : null;
        if (target) this.drawTargetRing(target, t);

        const list = [];
        for (let cx = Math.floor((left - 110) / CELL); cx <= Math.floor((right + 110) / CELL); cx += 1) {
            for (let cy = Math.floor((top - 30) / CELL); cy <= Math.floor((bottom + 190) / CELL); cy += 1) {
                const prop = this.cellProp(chapterIndex, cx, cy);
                if (prop) list.push({ y: prop.flat ? prop.y - 1000 : prop.y, kind: 0, item: prop });
            }
        }
        for (const enemy of R.enemies) list.push({ y: enemy.y, kind: 1, item: enemy });
        for (const coin of R.coins) list.push({ y: coin.y, kind: 2, item: coin });
        list.push({ y: R.hy, kind: 3, item: null });
        for (const pal of this.data.pals) {
            if (S.pals[pal.id] && R.palPos[pal.id]) list.push({ y: R.palPos[pal.id].y, kind: 4, item: pal });
        }
        list.sort((a, b) => a.y - b.y);

        for (const entry of list) {
            if (entry.kind === 0) this.drawProp(entry.item, t, fdt);
            else if (entry.kind === 1) this.drawEnemy(entry.item, t);
            else if (entry.kind === 2) this.drawCoin(entry.item);
            else if (entry.kind === 3) this.drawHero(t, R, S, ST);
            else this.drawPal(entry.item, t, R);
        }

        this.drawShots(R);
        this.drawFx(R);
        this.drawUlt(R);
        if (target) this.drawTargetArrow(target, t);
        this.drawTexts(R);
        ctx.restore();

        if (fade > 0) {
            ctx.fillStyle = rgb([255, 250, 236], fade);
            ctx.fillRect(view.x, 0, view.width, view.height);
        }
        if (R.joy.on) this.drawJoystick(R.joy, view.x);
        ctx.restore();
        R.quakes.length = 0;
    }

    /** 屏幕坐标转换成游戏画面的逻辑坐标。 */
    screenToView(clientX, clientY) {
        if (!this.canvas || !this.layout) return null;
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) / this.layout.scale - this.layout.view.x,
            y: (clientY - rect.top) / this.layout.scale,
        };
    }

    drawJoystick(joy, viewX) {
        const ctx = this.ctx;
        const k = Math.min(1, joy.t / 0.1);
        const knob = JOY_RADIUS * 0.44;
        const circle = (x, y, radius) => {
            ctx.beginPath();
            ctx.arc(viewX + x, y, radius, 0, Math.PI * 2);
        };
        ctx.save();
        ctx.lineWidth = 3;
        circle(joy.bx, joy.by, JOY_RADIUS * (0.8 + 0.2 * k));
        ctx.fillStyle = rgb([255, 255, 255], (70 / 255) * k);
        ctx.fill();
        ctx.strokeStyle = rgb(INK, (150 / 255) * k);
        ctx.stroke();
        circle(joy.kx, joy.ky + 3, knob);
        ctx.fillStyle = rgb(INK, (80 / 255) * k);
        ctx.fill();
        circle(joy.kx, joy.ky, knob);
        ctx.fillStyle = rgb([255, 248, 225], (235 / 255) * k);
        ctx.fill();
        ctx.strokeStyle = rgb(INK, k);
        ctx.stroke();
        ctx.restore();
    }

    drawGround(chapterIndex, chapter, left, right, top, bottom) {
        const ctx = this.ctx;
        const tile = this.tileDef(chapterIndex);
        ctx.lineCap = "round";
        for (let ix = Math.floor((left - 110) / TILE); ix <= Math.floor((right + 110) / TILE); ix += 1) {
            for (let iy = Math.floor((top - 60) / TILE); iy <= Math.floor((bottom + 60) / TILE); iy += 1) {
                const bx = ix * TILE;
                const by = iy * TILE;
                for (const blot of tile.blots) {
                    ctx.beginPath();
                    ctx.ellipse(bx + blot.x, by + blot.y, blot.rx, blot.ry, 0, 0, Math.PI * 2);
                    ctx.fillStyle = rgb(chapter.blot);
                    ctx.fill();
                }
                ctx.beginPath();
                for (const mark of tile.marks) {
                    const x = bx + mark.x;
                    const y = by + mark.y;
                    if (mark.grass) {
                        ctx.moveTo(x - 3, y);
                        ctx.lineTo(x - 1, y - 7);
                        ctx.moveTo(x + 1, y);
                        ctx.lineTo(x + 2, y - 9);
                        ctx.moveTo(x + 5, y);
                        ctx.lineTo(x + 7, y - 6);
                    } else {
                        ctx.moveTo(x - mark.w, y);
                        ctx.quadraticCurveTo(x, y - 4, x + mark.w, y);
                    }
                }
                ctx.lineWidth = 2.2;
                ctx.strokeStyle = rgb(chapter.line);
                ctx.stroke();
            }
        }
    }

    drawRoad(chapter, left, right) {
        const ctx = this.ctx;
        ctx.lineJoin = "round";
        for (let pass = 1; pass <= 2; pass += 1) {
            ctx.beginPath();
            let first = true;
            let x = left - 160;
            while (x <= right + 160) {
                const y = Math.sin(x / 330) * 115 + Math.sin(x / 137 + 1.3) * 34;
                if (first) {
                    ctx.moveTo(x, y);
                    first = false;
                } else {
                    ctx.lineTo(x, y);
                }
                x += 32;
            }
            ctx.lineWidth = pass === 1 ? 252 : 236;
            ctx.strokeStyle = rgb(pass === 1 ? chapter.edge : chapter.path);
            ctx.stroke();
        }
    }

    tileDef(chapterIndex) {
        const cached = this.tiles.get(chapterIndex);
        if (cached) return cached;
        const random = rng(chapterIndex * 101 + 7);
        const tile = { blots: [], marks: [] };
        for (let i = 0; i < 4; i += 1) {
            tile.blots.push({
                x: random() * TILE,
                y: random() * TILE,
                rx: 50 + random() * 50,
                ry: 22 + random() * 20,
            });
        }
        for (let i = 0; i < 16; i += 1) {
            tile.marks.push({
                x: random() * TILE,
                y: random() * TILE,
                w: 5 + random() * 6,
                grass: random() < 0.55,
            });
        }
        this.tiles.set(chapterIndex, tile);
        return tile;
    }

    cellProp(chapterIndex, cx, cy) {
        const key = `${chapterIndex}:${cx}:${cy}`;
        if (this.cells.has(key)) return this.cells.get(key);
        let seed = (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ Math.imul(chapterIndex, 83492791)) >>> 0;
        seed += 1;
        const random = rng(seed);
        const chapter = this.data.chapters[chapterIndex];
        const x = (cx + 0.5 + (random() - 0.5) * 0.7) * CELL;
        const y = (cy + 0.5 + (random() - 0.5) * 0.7) * CELL;
        const d = Math.abs(y - (Math.sin(x / 330) * 115 + Math.sin(x / 137 + 1.3) * 34));
        const edge = 150 + random() * 34;
        let prop = null;
        if (d > edge) {
            if (random() < 0.86) {
                prop = {
                    spr: chapter.big[random() < 0.62 ? 0 : 1],
                    x,
                    y,
                    h: 122 + random() * 44,
                    flip: random() < 0.5,
                    ph: random() * 6.28,
                    a: 1,
                    big: true,
                };
            }
        } else if (d > 108 && random() < 0.2) {
            prop = {
                spr: chapter.small[Math.floor(random() * chapter.small.length)],
                x,
                y,
                h: 44 + random() * 14,
                flip: random() < 0.5,
                ph: 0,
                a: 1,
                big: false,
            };
        } else if (random() < 0.16) {
            prop = {
                spr: random() < 0.6 ? "i_grass" : "i_pebbles",
                x,
                y,
                h: 15 + random() * 8,
                flip: random() < 0.5,
                flat: true,
            };
        }
        if (prop && !prop.flat) {
            prop.ang = 0;
            prop.av = 0;
            prop.sq = 0;
            prop.sv = 0;
            prop.cool = 0;
            prop.qcool = 0;
            prop.gid = this.gust.id;
        }
        this.cellCount += 1;
        if (this.cellCount > 4000) {
            this.cells.clear();
            this.cellCount = 0;
        }
        this.cells.set(key, prop);
        return prop;
    }

    drawProp(prop, time, fdt) {
        if (prop.flat) {
            this.sprite(prop.spr, prop.x, prop.y, prop.h, { flip: prop.flip });
            return;
        }
        const R = this.gameState();
        const big = prop.big;
        const reach = prop.h * (big ? 0.27 : 0.5);
        prop.cool -= fdt;
        if (prop.cool <= 0) {
            let hit = null;
            const touch = (x, y) => Math.abs(x - prop.x) < reach && y > prop.y - prop.h * 0.22 && y < prop.y + prop.h * 0.2;
            if (touch(R.hx, R.hy) && R.hero.spd > 12) hit = R.hx;
            else {
                for (const enemy of R.enemies) {
                    if (!enemy.def.fly && touch(enemy.x, enemy.y)) {
                        hit = enemy.x;
                        break;
                    }
                }
            }
            if (hit !== null) {
                prop.av += (hit < prop.x ? 1 : -1) * (big ? 3.2 : 4.5);
                prop.sv -= big ? 1.6 : 2.4;
                prop.cool = 0.45;
            }
        }
        prop.qcool -= fdt;
        if (prop.qcool <= 0) {
            for (const quake of R.quakes) {
                const dx = prop.x - quake.x;
                const dy = prop.y - prop.h * 0.4 - quake.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const radius = quake.r + 150;
                if (distance < radius) {
                    const k = 1 - distance / radius;
                    prop.av += (prop.x < quake.x ? -1 : 1) * 6 * k;
                    prop.sv -= 3 * k;
                    prop.qcool = 0.22;
                    break;
                }
            }
        }
        if (prop.gid !== this.gust.id && this.gust.x > prop.x + prop.y * 0.25) {
            prop.gid = this.gust.id;
            prop.av += big ? 2.6 : 1.5;
            prop.sv -= big ? 1.3 : 0.8;
        }
        prop.av = clamp(prop.av, -9, 9);
        prop.sv = clamp(prop.sv, -6, 6);
        prop.av += (-150 * prop.ang - 8 * prop.av) * fdt;
        prop.ang += prop.av * fdt;
        prop.sv += (-210 * prop.sq - 10 * prop.sv) * fdt;
        prop.sq += prop.sv * fdt;
        prop.ang = clamp(prop.ang, -0.42, 0.42);
        prop.sq = clamp(prop.sq, -0.24, 0.24);
        const breath = Math.sin(time * 2.3 + prop.ph) * (big ? 0.032 : 0.018);
        const shear = clamp(prop.ang, -0.4, 0.4) + (big ? Math.sin(time * 1.3 + prop.ph) * 0.04 : 0);
        const cover = big && prop.y > R.hy && Math.abs(prop.x - R.hx) < prop.h * 0.34 && prop.y - prop.h < R.hy - 14;
        prop.a += ((cover ? 0.38 : 1) - prop.a) * 0.18;
        this.shadow(prop.x, prop.y - 2, prop.h * 0.3 * (1 - prop.sq * 0.5), 0.16 * prop.a);
        this.sprite(prop.spr, prop.x, prop.y, prop.h, {
            flip: prop.flip,
            shear,
            sy: 1 + prop.sq + breath,
            sx: 1 - (prop.sq + breath) * 0.7,
            a: prop.a < 0.99 ? prop.a : 1,
        });
    }

    gameState() {
        return this.lastGame ? this.lastGame.state : null;
    }

    drawHero(time, R, S, ST) {
        const h = R.hero;
        const x = R.hx;
        const y = R.hy;
        const f = h.face < 0 ? -1 : 1;
        const down = R.phase === "down";
        const amt = down ? 0 : Math.min(1, h.spd / 32);
        const ph = h.dist / (STEP * HERO_K);
        const step = Math.sin((ph % 1) * Math.PI);
        const side = Math.sin(ph * Math.PI);
        const breath = Math.sin(time * 3) * 0.022 * (1 - amt);
        const rc = h.recoil * h.recoil;
        const elev = down ? 0 : Math.atan2(Math.sin(h.aim), Math.abs(Math.cos(h.aim)));
        let bob = -step * 2.6 * amt - (h.happy > 0 ? Math.abs(Math.sin(h.happy * 14)) * 3 : 0);
        let rot = f * 0.05 * amt + side * 0.035 * amt - f * 0.13 * rc + f * elev * 0.17;
        const sq = h.sq > 0 ? 0.05 * h.sq : 0;
        let sx = 1 - breath * 0.6 + 0.05 * rc + sq + elev * 0.03;
        let sy = 1 + breath - 0.05 * rc - sq - elev * 0.05;
        const bx = -f * 4 * rc;
        if (down) {
            sy = 0.76;
            sx = 1.14;
            rot = Math.sin(time * 9) * 0.04;
            bob = 0;
        }
        const flash = h.flash > 0 ? 0.6 : 0;
        const tint = h.slow > 0 ? [160, 210, 255] : null;
        const ctx = this.ctx;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(HERO_K, HERO_K);
        ctx.translate(-x, -y);
        this.shadow(x, y, 33 - step * 2 * amt);

        const by = y - 5 + bob;
        const leg = (bxo, byo, c) => {
            const pose = this.footPose(c, amt);
            const fxp = x + bxo * f + h.dx * pose.offset;
            const fyp = y + byo + h.dy * pose.offset * 0.45 - pose.lift;
            const hx0 = x + bx + bxo * f * 0.75;
            const hy0 = by - 13;
            this.line(hx0, hy0, fxp, fyp - 9, 13, INK);
            this.line(hx0, hy0, fxp, fyp - 9, 7.5, LEG_COL);
            this.sprite("h_foot", fxp, fyp, 17, { flip: f < 0, rot: -f * pose.lift * 0.05, flash, tint });
        };
        leg(-10, 0, ph / 2);
        leg(9, 1, ph / 2 + 0.5);

        this.sprite("h_torso", x + bx, by, RIG.TH, { flip: f < 0, sx, sy, rot, flash, tint });
        const neckLength = RIG.TH * sy * RIG.neckY;
        const nX = x + bx + Math.sin(rot) * neckLength + f * RIG.neckX * Math.cos(rot);
        const nY = by - Math.cos(rot) * neckLength + f * RIG.neckX * Math.sin(rot);
        const hr = rot * 0.5 + f * elev * 0.44 - f * 0.12 * rc + side * 0.03 * amt + (h.happy > 0 ? Math.sin(h.happy * 14) * 0.06 : 0);
        this.sprite("h_head", nX, nY, RIG.HH, {
            ay: RIG.headAy,
            flip: f < 0,
            rot: hr,
            sx: 1 + 0.03 * rc,
            sy: 1 - 0.03 * rc,
            flash,
            tint,
        });
        ctx.save();
        ctx.translate(nX, nY);
        ctx.rotate(hr);
        ctx.translate(f * RIG.eyeX, -RIG.eyeY);
        this.drawEye(h, time, f, elev);
        ctx.restore();

        const topLength = RIG.HH * RIG.yuzuY;
        const topX = nX + Math.sin(hr) * topLength + f * RIG.yuzuX * Math.cos(hr);
        const topY = nY - Math.cos(hr) * topLength + f * RIG.yuzuX * Math.sin(hr);
        const yuzuRot = hr + Math.sin(ph * Math.PI - 0.9) * 0.09 * amt + Math.sin(time * 2.2) * 0.03 - f * 0.16 * rc;
        this.sprite("h_yuzu", topX, topY, 27, { flip: f < 0, rot: yuzuRot });

        if (down) {
            for (let i = 0; i < 3; i += 1) {
                const a = time * 4 + i * 2.09;
                this.star(x + Math.cos(a) * 26, y - 84 + Math.sin(a) * 7, 6, [255, 211, 77], 0);
            }
            ctx.restore();
            return;
        }

        const a = h.aim - f * 0.28 * rc;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const sxp = x + bx + ca * 6 + f * 10 * Math.abs(sa);
        const syp = nY + 8;
        const forkX = sxp + ca * (20 - 5 * rc);
        const forkY = syp + sa * (20 - 5 * rc);
        const pull = h.snap > 0 ? -7 * h.snap : 5 + 17 * h.pull;
        const px = forkX - ca * pull + sa * 3;
        const py = forkY - sa * pull - ca * 3 - 4;
        const nx = -sa;
        const ny = ca;
        const up = ca < 0 ? 1 : -1;
        for (let pass = 1; pass <= 2; pass += 1) {
            for (const k of [-7, 7]) {
                const tx = forkX + nx * up * 15 + ca * k;
                const ty = forkY + ny * up * 15 + sa * k;
                this.line(tx, ty, px, py, pass === 1 ? 5.5 : 2.6, pass === 1 ? INK : PINK);
            }
        }
        if (h.snap <= 0 && h.pull > 0.25) this.sprite("i_yuzu", px, py, 13, { ay: 0.5 });
        this.sprite("h_paw", px - ca * 4, py + 2, 18, { ay: 0.5, rot: a, flash, tint });
        const sling = this.images.get("h_sling");
        if (sling) {
            ctx.save();
            ctx.translate(forkX, forkY);
            ctx.rotate(a);
            if (ca < 0) ctx.scale(1, -1);
            const w = 32 * (sling.naturalWidth / sling.naturalHeight || 1);
            ctx.drawImage(sling, -w / 2, -21, w, 32);
            ctx.restore();
        }
        this.sprite("h_paw", forkX + nx * -up * 7, forkY + ny * -up * 7, 18, { ay: 0.5, rot: a, flash, tint });
        ctx.restore();

        if (R.phase === "fight" && h.hp < ST.hp * 0.995) {
            const ratio = Math.max(0, h.hp / ST.hp);
            this.bar(x - 29, y + 12, 58, 7, ratio, ratio > 0.35 ? [143, 224, 106] : [255, 122, 102]);
        }
    }

    footPose(c, amt) {
        const p = c % 1;
        if (p < 0.5) return { offset: (STEP / 2 - p * 2 * STEP) * amt, lift: 0 };
        const k = (p - 0.5) * 2;
        const e = k * k * (3 - 2 * k);
        return { offset: (-STEP / 2 + e * STEP) * amt, lift: Math.sin(k * Math.PI) * 5.5 * amt };
    }

    drawEye(h, time, f, elev) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.arc(0, 0, 4.2, 0, Math.PI * 2);
        ctx.fillStyle = rgb(FUR_COL);
        ctx.fill();
        const blink = ((time * 0.37 + Math.sin(time * 0.9) * 0.2) % 1) < 0.035;
        const ey = clamp(elev * 1.3, -1.2, 1.2);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = rgb(INK);
        if (h.ouch > 0) {
            ctx.beginPath();
            ctx.moveTo(-2.4 * f, -2.4);
            ctx.lineTo(1.8 * f, 0);
            ctx.lineTo(-2.4 * f, 2.4);
            ctx.stroke();
        } else if (h.happy > 0) {
            ctx.beginPath();
            ctx.arc(0, 1.6, 2.8, Math.PI * 1.12, Math.PI * 1.88, false);
            ctx.stroke();
        } else if (h.snap > 0.25 || blink) {
            ctx.beginPath();
            ctx.moveTo(-2.6, 0.4);
            ctx.lineTo(2.6, 0.4);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.arc(f * 0.6, ey, 2.2, 0, Math.PI * 2);
            ctx.fillStyle = rgb(INK);
            ctx.fill();
            if (this.lastGame && this.lastGame.state.target && h.pull > 0.2) {
                ctx.beginPath();
                ctx.moveTo(-3.4 * f, -4.6 + ey);
                ctx.lineTo(2.6 * f, -3 + ey);
                ctx.stroke();
            }
        }
    }

    drawEnemy(enemy, time) {
        const born = enemy.born > 0 ? 0.35 + 0.65 * (1 - Math.min(1, enemy.born / 0.3)) : 1;
        let sx = born;
        let sy = born;
        let ox = 0;
        let oy = 0;
        const hop = hopState(enemy);
        const amp = enemy.def.hop ? enemy.def.hop[1] : 0;
        let lean = 0;
        let air = 0;
        if (enemy.def.fly) {
            lean = Math.sin(enemy.t * 5 + 1) * 0.08;
            sy *= 1 + Math.sin(enemy.t * 10) * 0.05;
        } else if (hop.ooze) {
            sx *= 1 + 0.13 * hop.k;
            sy *= 1 - 0.11 * hop.k;
        } else if (hop.air > 0) {
            air = hop.air;
            oy -= air * amp;
            sy *= 1 + 0.08 * air;
            sx *= 1 - 0.06 * air;
            lean = enemy.face * (0.5 - hop.k) * 0.2;
        } else {
            const q = Math.sin(hop.k * Math.PI);
            sy *= 1 - 0.14 * q;
            sx *= 1 + 0.11 * q;
        }
        if (enemy.sq > 0) {
            sx *= 1 + 0.16 * enemy.sq;
            sy *= 1 - 0.16 * enemy.sq;
        }
        if (enemy.state === "wind") {
            ox += (Math.random() - 0.5) * 3;
            sx *= 1.1;
            sy *= 0.9;
        }
        if (enemy.lunge > 0 && this.lastGame) {
            const R = this.lastGame.state;
            const dx = R.hx - enemy.x;
            const dy = R.hy - enemy.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            ox += (dx / d) * enemy.lunge * 9;
            oy += (dy / d) * enemy.lunge * 9;
        }
        this.shadow(enemy.x, enemy.y, enemy.r * (enemy.def.fly ? 0.7 : 0.95 - air * 0.22) * born, enemy.def.fly ? 0.1 : 0.16);
        let tint = null;
        if (enemy.slow > 0) tint = [160, 210, 255];
        else if (enemy.poison > 0) tint = [190, 235, 130];
        this.sprite(enemy.def.spr, enemy.x + ox, enemy.y - enemy.z + oy + (enemy.def.fly ? Math.sin(enemy.t * 5) * 4 : 0), enemy.size, {
            flip: enemy.face > 0,
            sx,
            sy,
            rot: lean,
            tint,
            flash: enemy.flash > 0 ? 0.55 : 0,
        });
        if (enemy.state === "wind") this.text("!", enemy.x, enemy.y - enemy.size - 6, 22, [255, 211, 77], 1, "c");
        if (!enemy.boss && (enemy.hp < enemy.max || enemy.shield > 0) && enemy.born <= 0) {
            const w = Math.max(30, enemy.size * 0.62);
            const bx = enemy.x - w / 2;
            const by = enemy.y - enemy.z - enemy.size - 9;
            if (enemy.hp < enemy.max) {
                this.bar(bx, by, w, 5, Math.max(0, enemy.hp / enemy.max), [143, 224, 106]);
            }
            for (let i = 0; i < enemy.shield; i += 1) {
                const ctx = this.ctx;
                ctx.beginPath();
                ctx.arc(enemy.x - (enemy.shield - 1) * 5 + i * 10, by - 8, 3.6, 0, Math.PI * 2);
                ctx.fillStyle = rgb([217, 168, 102]);
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = rgb(INK);
                ctx.stroke();
            }
        }
    }

    drawCoin(coin) {
        this.shadow(coin.x, coin.y, 6, 0.12);
        this.sprite("ico_orange", coin.x, coin.y - coin.z, 18, {
            ay: 0.9,
            rot: Math.sin(coin.rot + coin.t * 9) * 0.4,
        });
    }

    drawShots(R) {
        const ctx = this.ctx;
        for (const shot of R.shots) {
            const speed = Math.sqrt(shot.vx * shot.vx + shot.vy * shot.vy) || 1;
            const ux = shot.vx / speed;
            const uy = shot.vy / speed;
            const hero = shot.owner === "hero";
            const length = hero ? 46 : 20;
            const width = shot.size * (hero ? 0.46 : 0.34);
            if (hero) {
                this.triangleTail(shot.x - ux * length, shot.y - uy * length, shot.x, shot.y, width, rgb(shot.crit ? [255, 138, 60] : [255, 174, 66]));
            }
            this.triangleTail(
                shot.x - ux * length * 0.72,
                shot.y - uy * length * 0.72,
                shot.x,
                shot.y,
                width * 0.55,
                rgb([255, 247, 214])
            );
            if (shot.spr === "quack") {
                ctx.save();
                ctx.translate(shot.x, shot.y);
                ctx.rotate(Math.atan2(shot.vy, shot.vx));
                ctx.lineCap = "round";
                for (let pass = 1; pass <= 2; pass += 1) {
                    ctx.beginPath();
                    ctx.arc(-6, 0, 8, -0.9, 0.9);
                    ctx.lineWidth = pass === 1 ? 5 : 2.4;
                    ctx.strokeStyle = pass === 1 ? rgb(INK) : rgb([255, 241, 168]);
                    ctx.stroke();
                }
                ctx.restore();
            } else {
                this.sprite(shot.spr, shot.x, shot.y, shot.size, { ay: 0.5, rot: shot.rot });
            }
        }
        for (const shot of R.eshots) {
            this.shadow(shot.x, shot.y + 34, shot.size * 0.4, 0.1);
            this.sprite(shot.spr, shot.x, shot.y, shot.size, { ay: 0.5, rot: shot.rot });
        }
    }

    drawUlt(R) {
        for (const drop of R.ultQueue) {
            if (!drop.started) continue;
            const k = Math.min(1, drop.fall);
            this.shadow(drop.x, drop.y + 6, 12 + 26 * k, 0.1 + 0.14 * k);
            this.sprite("i_bigyuzu", drop.x, drop.y - (1 - k * k) * 420, 62, { ay: 0.6, rot: k * 2.4, sy: 1 + (1 - k) * 0.12 });
        }
    }

    drawPal(pal, time, R) {
        const pos = R.palPos[pal.id];
        const k = Math.max(0, (R.palAtk[pal.id] || 0) / 0.22);
        const flip = pos.face < 0 ? -1 : 1;
        if (pos.pounce || pos.land > 0) {
            const air = pos.pounce ? pos.h / pos.pounce.amp : 0;
            const land = pos.pounce ? 0 : Math.sin(Math.min(1, pos.land) * Math.PI);
            this.shadow(pos.x, pos.y, pal.size * (0.36 - air * 0.1));
            this.sprite(pal.atkSpr, pos.x, pos.y - (pos.h || 0), pal.size * 1.04, {
                flip: flip < 0,
                rot: flip * (pos.pounce ? 0.22 - 0.25 * (pos.pounce.t / pos.pounce.dur) : 0),
                sy: 1 + air * 0.1 - land * 0.16,
                sx: 1 - air * 0.06 + land * 0.12,
            });
            return;
        }
        const amt = Math.min(1, pos.spd / 30);
        const walking = Boolean(pal.walk) && amt > 0.35;
        const poseName = walking ? pal.walk[0] : (k > 0 && pal.cd > 1 ? pal.atkSpr : pal.spr);
        const size = walking ? pal.size * pal.walk[1] : pal.size;
        this.shadow(pos.x, pos.y, pal.size * 0.36);
        const img = this.images.get(poseName);
        if (!img) return;
        const stepLength = pal.size * 0.32;
        const ph = pos.dist / stepLength;
        const frac = ph % 1;
        const sideSign = Math.floor(ph) % 2 === 1 ? 1 : -1;
        const stance = 0.74;
        let foot = 0;
        let lift = 0;
        if (frac < stance) {
            foot = 0.5 - frac / stance;
        } else {
            const q = (frac - stance) / (1 - stance);
            foot = -0.5 + q * q * (3 - 2 * q);
            lift = Math.sin(q * Math.PI) * 2.4 * amt;
        }
        const travel = stepLength * 0.85 * amt;
        const ux = pos.ux || 0;
        const uy = pos.uy || 0;
        const plant = Math.cos(frac * Math.PI * 2);
        const bob = amt > 0.1 ? 0 : Math.sin(time * 3.4 + pal.off[0]) * 0.03;
        const sy = 1 + bob + k * 0.12 - 0.06 * amt * plant;
        const sx = 1 - bob - k * 0.06 + 0.045 * amt * plant;
        const rock = Math.sin(frac * Math.PI) * 0.06 * amt * sideSign + ux * 0.05 * amt;
        const h = size;
        const w = h * (img.naturalWidth / img.naturalHeight || 1);
        const split = walking ? 0.7 : 0.64;
        const lower = h * (1 - split);
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(pos.x, pos.y - Math.max(0, -plant) * 1.2 * amt);
        ctx.rotate(rock);
        ctx.scale(flip * sx, sy);
        const seam = split + 0.6 / h;
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight * seam, -w / 2, -h, w, h * seam);
        const offX = flip * ux * foot * travel;
        const offY = uy * foot * travel * 0.4 - lift;
        ctx.translate(0, -lower);
        ctx.transform(1, 0, offX / lower, (lower + offY) / lower, 0, 0);
        ctx.drawImage(img, 0, img.naturalHeight * split, img.naturalWidth, img.naturalHeight * (1 - split), -w / 2, 0, w, lower);
        ctx.restore();
    }

    triangleTail(x0, y0, x1, y1, width, color) {
        const ctx = this.ctx;
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1 - uy * width, y1 + ux * width);
        ctx.lineTo(x1 + uy * width, y1 - ux * width);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }

    drawFx(R) {
        const ctx = this.ctx;
        for (const fx of R.fx) {
            const k = fx.t / fx.life;
            if (fx.kind === "glow") {
                const radius = fx.r * (0.6 + 0.6 * k);
                const gradient = ctx.createRadialGradient(fx.x, fx.y, 0, fx.x, fx.y, radius);
                gradient.addColorStop(0, `rgba(255,240,170,${Math.floor(190 * (1 - k)) / 255})`);
                gradient.addColorStop(1, "rgba(255,210,100,0)");
                ctx.beginPath();
                ctx.arc(fx.x, fx.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();
            } else if (fx.kind === "lines") {
                ctx.beginPath();
                for (let i = 0; i < fx.n; i += 1) {
                    let angle;
                    if (fx.arc > 6) angle = fx.ang + (i / fx.n) * 6.283 + (i % 2) * 0.2;
                    else angle = fx.ang + (i / (fx.n - 1) - 0.5) * fx.arc;
                    const r0 = fx.r * (0.35 + 0.65 * k);
                    const r1 = fx.r * (0.75 + 0.6 * k) + (i % 3) * 3;
                    ctx.moveTo(fx.x + Math.cos(angle) * r0, fx.y + Math.sin(angle) * r0);
                    ctx.lineTo(fx.x + Math.cos(angle) * r1, fx.y + Math.sin(angle) * r1);
                }
                ctx.lineCap = "round";
                ctx.lineWidth = 3 * (1 - k) + 0.6;
                ctx.strokeStyle = "#fff";
                ctx.stroke();
            } else if (fx.kind === "drop") {
                ctx.beginPath();
                ctx.arc(fx.x, fx.y, fx.r * (1 - k * 0.6), 0, Math.PI * 2);
                ctx.fillStyle = rgb([255, 201, 74]);
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = rgb(INK);
                ctx.stroke();
            } else if (fx.kind === "spark") {
                this.star(fx.x, fx.y, fx.r * (0.5 + 0.7 * Math.sin(k * Math.PI)), [255, 251, 230], fx.rot + k);
            } else if (fx.kind === "puff") {
                ctx.beginPath();
                ctx.arc(fx.x, fx.y, fx.r * (1 - k * 0.5), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,255,255,${Math.floor(255 * (1 - k * k)) / 255})`;
                ctx.fill();
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = `rgba(74,53,36,${Math.floor(255 * (1 - k * k)) / 255})`;
                ctx.stroke();
            } else if (fx.kind === "ring") {
                const radius = fx.r * (0.35 + 0.65 * (1 - (1 - k) * (1 - k)));
                const alpha = Math.floor(255 * (1 - k)) / 255;
                for (let pass = 1; pass <= 2; pass += 1) {
                    ctx.beginPath();
                    ctx.ellipse(fx.x, fx.y, radius, radius * 0.62, 0, 0, Math.PI * 2);
                    ctx.lineWidth = pass === 1 ? 7 : 3.5;
                    ctx.strokeStyle = pass === 1 ? `rgba(74,53,36,${alpha})` : `rgba(255,226,122,${alpha})`;
                    ctx.stroke();
                }
            } else if (fx.kind === "lid") {
                ctx.save();
                ctx.translate(fx.x, fx.y);
                ctx.rotate(fx.rot || 0);
                ctx.beginPath();
                ctx.ellipse(0, 0, 13, 5, 0, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(217,168,102,${Math.floor(255 * (1 - k * k)) / 255})`;
                ctx.fill();
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = `rgba(74,53,36,${Math.floor(255 * (1 - k * k)) / 255})`;
                ctx.stroke();
                ctx.restore();
            }
        }
    }

    drawTexts(R) {
        for (const text of R.texts) {
            const style = TEXT_STYLE[text.kind] || TEXT_STYLE.dmg;
            const pop = 1 + 0.7 * Math.max(0, 1 - text.t / 0.1);
            const alpha = text.t > 0.5 ? Math.max(0, 1 - (text.t - 0.5) / 0.35) : 1;
            this.text(text.str, text.x, text.y, style.size * pop, style.color, alpha, "c");
        }
    }

    drawTargetRing(target, time) {
        const ctx = this.ctx;
        const radius = target.r + 14;
        ctx.lineCap = "round";
        for (let pass = 1; pass <= 2; pass += 1) {
            ctx.beginPath();
            for (let i = 0; i < 8; i += 1) {
                const a0 = time * 1.8 + i * Math.PI / 4;
                const a1 = a0 + 0.42;
                ctx.ellipse(target.x, target.y, radius, radius * 0.42, 0, a0, a1);
            }
            ctx.lineWidth = pass === 1 ? 6 : 3;
            ctx.strokeStyle = pass === 1 ? rgb(INK) : "#fff";
            ctx.stroke();
        }
    }

    drawTargetArrow(target, time) {
        const ctx = this.ctx;
        const by = target.y - target.z - target.size - 13 + Math.sin(time * 7) * 3;
        ctx.beginPath();
        ctx.moveTo(target.x - 8, by - 9);
        ctx.lineTo(target.x + 8, by - 9);
        ctx.lineTo(target.x, by + 2);
        ctx.closePath();
        ctx.lineJoin = "round";
        ctx.lineWidth = 4;
        ctx.strokeStyle = rgb(INK);
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.fill();
    }

    sprite(name, x, y, height, options) {
        const img = this.images.get(name);
        if (!img) return;
        const opts = options || {};
        const width = height * (img.naturalWidth / img.naturalHeight || 1);
        const ay = opts.ay === undefined ? 1 : opts.ay;
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(x, y);
        if (opts.rot) ctx.rotate(opts.rot);
        if (opts.shear) ctx.transform(1, 0, Math.tan(opts.shear), 1, 0, 0);
        ctx.scale((opts.flip ? -1 : 1) * (opts.sx === undefined ? 1 : opts.sx), opts.sy === undefined ? 1 : opts.sy);
        const alpha = opts.a === undefined ? 1 : opts.a;
        ctx.globalAlpha = alpha;
        const source = opts.tint ? this.tintedImage(name, img, opts.tint) : img;
        ctx.drawImage(source, -width / 2, -height * ay, width, height);
        if (opts.flash && opts.flash > 0) {
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = opts.flash;
            ctx.drawImage(img, -width / 2, -height * ay, width, height);
        }
        ctx.restore();
    }

    tintedImage(name, img, color) {
        const key = `${name}:${color.join(",")}`;
        const cached = this.tinted.get(key);
        if (cached) return cached;
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = rgb(color);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(img, 0, 0);
        this.tinted.set(key, canvas);
        return canvas;
    }

    shadow(x, y, radius, alpha) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * 0.36, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(60,70,40,${(alpha === undefined ? 0.16 : alpha)})`;
        ctx.fill();
    }

    line(x0, y0, x1, y1, width, color) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineCap = "round";
        ctx.lineWidth = width;
        ctx.strokeStyle = rgb(color);
        ctx.stroke();
    }

    bar(x, y, width, height, ratio, color) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
        ctx.fillStyle = rgb(INK);
        ctx.fill();
        if (ratio > 0.02) {
            ctx.beginPath();
            ctx.ellipse(x + (width * ratio) / 2, y + height / 2, (width * ratio) / 2, height / 2, 0, 0, Math.PI * 2);
            ctx.fillStyle = rgb(color);
            ctx.fill();
        }
    }

    star(x, y, radius, color, rotation) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation || 0);
        ctx.beginPath();
        for (let i = 0; i < 8; i += 1) {
            const angle = i * Math.PI / 4;
            const r = i % 2 === 1 ? radius * 0.38 : radius;
            if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
            else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.lineJoin = "round";
        ctx.lineWidth = 3;
        ctx.strokeStyle = rgb(INK);
        ctx.stroke();
        ctx.fillStyle = rgb(color);
        ctx.fill();
        ctx.restore();
    }

    text(str, x, y, size, color, alpha, align) {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = `800 ${size}px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif`;
        ctx.textAlign = align === "l" ? "left" : align === "r" ? "right" : "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(2.4, size * 0.17);
        ctx.strokeStyle = rgb(INK);
        ctx.strokeText(str, x, y);
        ctx.fillStyle = rgb(color);
        ctx.fillText(str, x, y);
        ctx.restore();
    }
}
