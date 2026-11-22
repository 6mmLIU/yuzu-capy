/**
 * 常驻 HUD：顶部橘子/宝石/关卡进度，底部四张强化卡和提示条。
 * 只读 BattleGame 的公开状态；购买通过真实按钮和同一业务入口完成。
 */
import { UiComponent } from "./componentBase.js";
import { L } from "../i18n.js";
import { applyUiId } from "./uiId.js";
import { formatNumber } from "../game/formulas.js";
import { imageUrl } from "../render/images.js";

const GREY = [205, 198, 184];

function mixColor(a, b, k) {
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`;
}

function setText(el, value) {
    if (!el) return;
    const text = String(value);
    if (el.textContent !== text) el.textContent = text;
}

export class OrchardHud extends UiComponent {
    constructor(options) {
        super("hud.root", {});
        this.game = options.game;
        this.data = options.data;
        this.images = options.images;
        this.events = options.events;
        this.cards = {};
        this.prev = {};
        this.holdTimer = 0;
        this.holding = null;
        this.toastTimers = [];
        this.pulseTimers = {};
        this.layout = null;
    }

    createElement() {
        const root = document.createElement("div");
        root.className = "hud-root";
        root.hidden = true;
        root.innerHTML = `
            <div class="hud-top">
                <div class="hud-capsule hud-capsule--orange">
                    <img class="hud-capsule__icon" data-role="orangeIcon" alt="">
                    <span class="hud-capsule__text" data-role="oranges">0</span>
                </div>
                <div class="hud-capsule hud-capsule--gem">
                    <img class="hud-capsule__icon" data-role="gemIcon" alt="">
                    <span class="hud-capsule__text" data-role="gems">0</span>
                </div>
                <div class="hud-progress" data-role="progress">
                    <div class="hud-progress__fill" data-role="progressFill"></div>
                    <span class="hud-progress__label" data-role="stage"></span>
                </div>
            </div>
            <div class="hud-upgrades" data-role="upgrades"></div>
            <div class="hud-walk" data-role="walk" hidden></div>
            <div class="hud-toasts" data-role="toasts"></div>
        `;
        this.refs = {
            orangeIcon: root.querySelector('[data-role="orangeIcon"]'),
            gemIcon: root.querySelector('[data-role="gemIcon"]'),
            oranges: applyUiId(root.querySelector('[data-role="oranges"]'), "hud.oranges"),
            gems: applyUiId(root.querySelector('[data-role="gems"]'), "hud.gems"),
            progress: applyUiId(root.querySelector('[data-role="progress"]'), "hud.progress"),
            progressFill: root.querySelector('[data-role="progressFill"]'),
            stage: applyUiId(root.querySelector('[data-role="stage"]'), "hud.stage"),
            upgrades: applyUiId(root.querySelector('[data-role="upgrades"]'), "hud.upgrades"),
            walk: applyUiId(root.querySelector('[data-role="walk"]'), "hud.walk"),
            toasts: applyUiId(root.querySelector('[data-role="toasts"]'), "hud.toasts"),
        };
        this.refs.orangeIcon.src = imageUrl("ico_orange");
        this.refs.gemIcon.src = imageUrl("ico_gem");
        this.buildCards();

        this.disposers.push(this.events.on("coin", () => this.pulse("oranges")));
        this.disposers.push(this.events.on("firstClear", (payload) => {
            this.pulse("gems");
            if (payload && payload.gems >= 10) this.showToast(L(`打败首领 +${payload.gems}`, `Boss defeated +${payload.gems}`), "ico_gem");
        }));
        this.disposers.push(this.events.on("retreat", (reason) => {
            this.showToast(reason === "time"
                ? L("时间到了，首领还没倒下。升级后再来！", "Time's up and the boss is still standing. Upgrade and try again!")
                : L("柚子豚累趴了，先回上一关攒橘子", "Yuzu Capy is worn out. Back a stage to farm oranges"));
        }));
        this.onWindowPointerUp = () => this.stopHold();
        window.addEventListener("pointerup", this.onWindowPointerUp);
        window.addEventListener("pointercancel", this.onWindowPointerUp);
        this.disposers.push(() => {
            window.removeEventListener("pointerup", this.onWindowPointerUp);
            window.removeEventListener("pointercancel", this.onWindowPointerUp);
        });
        return root;
    }

    buildCards() {
        const host = this.refs.upgrades;
        host.innerHTML = "";
        for (const upgrade of this.data.upgrades) {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "hud-card";
            applyUiId(card, `hud.upgrade.${upgrade.id}`);
            card.innerHTML = `
                <img class="hud-card__icon" alt="">
                <span class="hud-card__name"></span>
                <span class="hud-card__level"></span>
                <span class="hud-card__value"></span>
                <span class="hud-card__cost"><img class="hud-card__orange" alt=""><span class="hud-card__costText"></span></span>
            `;
            const icon = card.querySelector(".hud-card__icon");
            icon.src = imageUrl(upgrade.ico);
            const orange = card.querySelector(".hud-card__orange");
            orange.src = imageUrl("ico_orange");
            card.querySelector(".hud-card__name").textContent = upgrade.name;
            card.addEventListener("pointerdown", (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.startHold(upgrade.id, card);
            });
            card.addEventListener("contextmenu", (event) => event.preventDefault());
            this.cards[upgrade.id] = {
                el: card,
                icon,
                level: applyUiId(card.querySelector(".hud-card__level"), `hud.upgrade.${upgrade.id}.level`),
                value: applyUiId(card.querySelector(".hud-card__value"), `hud.upgrade.${upgrade.id}.value`),
                cost: applyUiId(card.querySelector(".hud-card__costText"), `hud.upgrade.${upgrade.id}.cost`),
                orange,
                cache: {},
            };
            host.appendChild(card);
        }
    }

    startHold(id, card) {
        this.stopHold();
        this.holding = { id, card };
        card.classList.add("is-pressing");
        let gap = 320;
        const first = this.game.buyUpgrade(id);
        if (!first.ok) {
            this.stopHold();
            return;
        }
        this.bumpCard(card);
        const tick = () => {
            if (!this.holding || this.holding.id !== id) return;
            const result = this.game.buyUpgrade(id);
            if (!result.ok) {
                this.stopHold();
                return;
            }
            this.bumpCard(card);
            gap = Math.max(45, gap * 0.82);
            this.holdTimer = window.setTimeout(tick, gap);
        };
        this.holdTimer = window.setTimeout(tick, gap);
    }

    bumpCard(card) {
        if (!card) return;
        if (card.__bumpEnd) {
            card.removeEventListener("animationend", card.__bumpEnd);
            card.__bumpEnd = null;
        }
        card.classList.remove("is-bump");
        void card.offsetWidth;
        card.classList.add("is-bump");
        const onEnd = (event) => {
            if (event.target !== card) return;
            card.classList.remove("is-bump");
            card.removeEventListener("animationend", onEnd);
            if (card.__bumpEnd === onEnd) card.__bumpEnd = null;
        };
        card.__bumpEnd = onEnd;
        card.addEventListener("animationend", onEnd);
    }

    stopHold() {
        if (this.holdTimer) {
            window.clearTimeout(this.holdTimer);
            this.holdTimer = 0;
        }
        if (this.holding && this.holding.card) this.holding.card.classList.remove("is-pressing");
        this.holding = null;
    }

    render() {
        /* HUD 由 sync() 按帧刷新，构造时没有额外内容。 */
    }

    sync() {
        if (!this.el) return;
        const hud = this.game.getHudState();
        setText(this.refs.oranges, formatNumber(hud.oranges));
        setText(this.refs.gems, formatNumber(hud.gems));
        const wide = this.refs.progress.clientWidth > 150;
        const label = hud.isBoss
            ? `${hud.bossName} ${Math.ceil(Math.max(0, hud.bossT))}${L("秒", "s")}`
            : `${wide ? `${hud.chapter} ` : ""}${hud.label}${hud.farm ? L(" · 修炼", " · Farming") : ""}`;
        setText(this.refs.stage, label);
        this.refs.progress.classList.toggle("is-boss", hud.isBoss);
        this.refs.progress.classList.toggle("is-hurry", hud.isBoss && hud.bossT <= 10);
        let ratio = hud.isBoss ? hud.bossRatio : (hud.need > 0 ? Math.min(1, hud.kills / hud.need) : 0);
        if (!hud.isBoss && hud.phase === "walk") ratio = 1;
        if (hud.phase === "down") ratio = 0;
        const width = `${(ratio * 100).toFixed(1)}%`;
        if (this.prev.progress !== width) {
            this.prev.progress = width;
            this.refs.progressFill.style.width = width;
            this.refs.progress.classList.toggle("is-full", ratio >= 0.999);
        }
        if (hud.phase === "walk") {
            const walking = this.game.state.walkDir < 0 ? L("先撤回去…", "Retreating…") : `${L("前往", "Heading to")} ${this.game.F.label(this.game.save.stage)}…`;
            setText(this.refs.walk, walking);
            this.refs.walk.hidden = false;
        } else {
            this.refs.walk.hidden = true;
        }
        for (const upgrade of this.data.upgrades) {
            this.syncCard(upgrade, hud);
        }
    }

    syncCard(upgrade, hud) {
        const info = this.game.getUpgradeInfo(upgrade.id);
        const card = this.cards[upgrade.id];
        if (!card || !info) return;
        const canAfford = !info.maxed && hud.oranges >= info.cost;
        const background = canAfford
            ? `rgb(${upgrade.color[0]},${upgrade.color[1]},${upgrade.color[2]})`
            : mixColor(upgrade.color, GREY, 0.55);
        const key = `${info.level}|${info.cost}|${info.value}|${background}|${info.maxed}|${canAfford}`;
        if (card.cache.key === key) return;
        card.cache.key = key;
        card.el.style.backgroundColor = background;
        card.el.classList.toggle("is-maxed", info.maxed);
        card.el.classList.toggle("is-poor", !canAfford);
        setText(card.level, `Lv.${info.level + 1}`);
        setText(card.value, info.value);
        card.cost.classList.toggle("is-poor", !info.maxed && !canAfford);
        if (info.maxed) {
            setText(card.cost, L("已满级", "MAX"));
            card.orange.style.visibility = "hidden";
        } else {
            const costText = formatNumber(info.cost);
            setText(card.cost, costText);
            card.cost.classList.toggle("is-long", costText.length >= 5);
            card.orange.style.visibility = "visible";
            card.orange.style.opacity = canAfford ? "1" : "0.6";
        }
    }

    setLayout(layout) {
        this.layout = layout;
        if (this.refs && this.refs.walk && layout) {
            this.refs.walk.style.top = `${layout.hero.y + 26}px`;
        }
    }

    show() {
        if (this.el) this.el.hidden = false;
    }

    hide() {
        if (this.el) this.el.hidden = true;
    }

    pulse(kind) {
        const target = kind === "gems" ? this.refs.gems.parentNode : this.refs.oranges.parentNode;
        if (!target) return;
        target.classList.remove("is-pulsing");
        // 重新触发动画
        void target.offsetWidth;
        target.classList.add("is-pulsing");
        if (this.pulseTimers[kind]) window.clearTimeout(this.pulseTimers[kind]);
        this.pulseTimers[kind] = window.setTimeout(() => {
            target.classList.remove("is-pulsing");
            this.pulseTimers[kind] = 0;
        }, 240);
    }

    showToast(text, iconId) {
        if (!this.refs || !this.refs.toasts) return;
        const toast = document.createElement("div");
        toast.className = "hud-toast";
        if (iconId) {
            const img = document.createElement("img");
            img.className = "hud-toast__icon";
            img.src = imageUrl(iconId);
            img.alt = "";
            toast.appendChild(img);
        }
        const span = document.createElement("span");
        span.textContent = text;
        toast.appendChild(span);
        this.refs.toasts.appendChild(toast);
        while (this.refs.toasts.children.length > 3) {
            this.refs.toasts.removeChild(this.refs.toasts.firstChild);
        }
        const timer = window.setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
            const index = this.toastTimers.indexOf(timer);
            if (index >= 0) this.toastTimers.splice(index, 1);
        }, 2700);
        this.toastTimers.push(timer);
    }

    destroy() {
        this.stopHold();
        for (const timer of this.toastTimers) window.clearTimeout(timer);
        this.toastTimers.length = 0;
        for (const key of Object.keys(this.pulseTimers)) {
            if (this.pulseTimers[key]) window.clearTimeout(this.pulseTimers[key]);
        }
        this.pulseTimers = {};
        super.destroy();
    }
}
