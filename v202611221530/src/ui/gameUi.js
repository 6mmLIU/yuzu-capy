/**
 * 战场按钮、上拉面板和弹窗，对应原版 UI.lua。
 * 所有奖励都走 BattleGame 的业务入口，这里只负责展示和交互。
 */
import { formatDuration, formatNumber } from "../game/formulas.js";
import { newSave } from "../game/save.js";
import { imageUrl } from "../render/images.js";
import { clearSave } from "../platform/saveStore.js";
import { applyUiId } from "./uiId.js";
import { IS_ZH, L, switchLang } from "../i18n.js";
import { TELEGRAM_CONFIG } from "../config/telegram.js";
import { shareInvite, shareRewardAvailable, todayKey } from "../platform/invite.js";

const TABS = [["cards", L("技能", "Skills"), "ico_crit"], ["pals", L("伙伴", "Pals"), "p_duck"], ["camp", L("营地", "Camp"), "i_basket"]];
const VERSION = "1.0.0";

function setText(el, value) {
    const text = String(value);
    if (el && el.textContent !== text) el.textContent = text;
}

function setHidden(el, hidden) {
    if (el && el.hidden !== hidden) el.hidden = hidden;
}

function pips(level, max) {
    let html = '<span class="ui-pips">';
    for (let i = 1; i <= max; i += 1) html += `<i class="${i <= level ? "is-on" : ""}"></i>`;
    return `${html}</span>`;
}

export class GameUi {
    constructor(options) {
        this.game = options.game;
        this.data = options.data;
        this.events = options.events;
        this.audio = options.audio;
        this.vibe = options.vibe;
        this.hud = options.hud;
        this.showRewardAd = options.showRewardAd;
        this.tab = "cards";
        this.panelOpen = false;
        this.selCard = null;
        this.dialog = null;
        this.resetArmed = false;
        this.resetTimer = 0;
        this.healthOpen = false;
        this.panelKey = "";
        this.dialogKey = "";
        this.adBusy = false;
        this.bannerTimer = 0;
        this.disposers = [];
    }

    mount(parent) {
        const root = document.createElement("div");
        root.className = "ui-root";
        applyUiId(root, "ui.root");
        root.innerHTML = `
            <button class="ui-gear" type="button" data-act="settings" aria-label="${L("设置", "Settings")}"></button>
            <div class="ui-float">
                <div class="ui-buff-time ui-outline" data-ref="buffTime" hidden></div>
                <button class="ui-round ui-ult" type="button" data-act="ult" data-ref="ult" aria-label="${L("柚子雨", "Yuzu Rain")}">
                    <img alt="" src="${imageUrl("i_bigyuzu")}"><span class="ui-outline">${L("柚子雨", "Yuzu Rain")}</span>
                </button>
                <button class="ui-round ui-side-cards" type="button" data-act="side:cards" data-ref="sideCards" aria-label="${L("技能", "Skills")}">
                    <img alt="" src="${imageUrl("ico_crit")}"><span class="ui-outline">${L("技能", "Skills")}</span><em class="ui-badge" hidden></em>
                </button>
                <button class="ui-round ui-side-pals" type="button" data-act="side:pals" data-ref="sidePals" aria-label="${L("伙伴", "Pals")}">
                    <img alt="" src="${imageUrl("p_duck")}"><span class="ui-outline">${L("伙伴", "Pals")}</span><em class="ui-badge is-dot" hidden></em>
                </button>
                <button class="ui-round ui-side-camp" type="button" data-act="side:camp" data-ref="sideCamp" aria-label="${L("营地", "Camp")}">
                    <img alt="" src="${imageUrl("i_basket")}"><span class="ui-outline">${L("营地", "Camp")}</span><em class="ui-badge is-dot" hidden></em>
                </button>
                <button class="ui-round ui-side-invite" type="button" data-act="invite" data-ref="sideInvite" aria-label="${L("邀请好友", "Invite friends")}">
                    <img alt="" src="${imageUrl("hero_cheer")}"><span class="ui-outline">${L("邀请", "Invite")}</span><em class="ui-badge is-dot" hidden></em>
                </button>
                <button class="ui-pill ui-pill-go ui-outline" type="button" data-act="challenge" data-ref="go" hidden></button>
                <button class="ui-pill ui-pill-buff" type="button" data-act="buff" data-ref="buff" hidden><i class="ui-mark"></i><span class="ui-outline">${L("攻击×2", "ATK ×2")}</span></button>
            </div>
            <div class="ui-scrim" data-ref="scrim" data-act="closePanelOutside"><section class="ui-panel" data-ref="panel"></section></div>
            <div data-ref="banner"></div>
            <div class="ui-mask" data-ref="mask" hidden></div>
            <div class="ui-admask ui-outline" data-ref="adMask" hidden>${L("广告播放中…", "Ad playing…")}</div>
        `;
        parent.appendChild(root);
        this.root = root;
        this.refs = {};
        root.querySelectorAll("[data-ref]").forEach((el) => {
            this.refs[el.dataset.ref] = el;
        });
        for (const [name, id] of [["ult", "ui.ult"], ["sideCards", "ui.side.cards"], ["sidePals", "ui.side.pals"], ["sideCamp", "ui.side.camp"], ["sideInvite", "ui.side.invite"], ["go", "ui.challenge"], ["buff", "ui.buff"]]) {
            applyUiId(this.refs[name], id);
        }
        root.addEventListener("click", (event) => this.onClick(event));
        root.addEventListener("input", (event) => this.onInput(event));
        root.addEventListener("pointerdown", (event) => {
            if (event.target.closest("button")) this.vibe.play("light");
        });
        this.disposers.push(this.events.on("bossWarn", (key) => {
            this.vibe.play("heavy", true);
            this.showBanner(L("首领来袭！", "Boss incoming!"), L(`${this.data.bosses[key].name} · ${this.data.bossTimeSec} 秒内打败它`, `${this.data.bosses[key].name} · beat it in ${this.data.bossTimeSec}s`), true);
            this.audio.playSfx("warn");
        }));
        this.disposers.push(this.events.on("chapterClear", (stage) => {
            this.showBanner(L(`${this.game.F.chapDef(stage).name} 通关！`, `${this.game.F.chapDef(stage).name} cleared!`), L(`下一站：${this.game.F.chapDef(stage + 1).name}`, `Next stop: ${this.game.F.chapDef(stage + 1).name}`));
        }));
        this.disposers.push(this.events.on("buffEnd", () => this.hud.showToast(L("柚子茶的效果结束了", "The yuzu tea wore off"))));
    }

    sfx(name) {
        this.audio.playSfx(name);
    }

    showBanner(title, sub, warn) {
        const host = this.refs.banner;
        host.innerHTML = `<div class="ui-banner ${warn ? "is-warn" : ""}"><b class="ui-outline">${title}</b><span>${sub}</span></div>`;
        window.clearTimeout(this.bannerTimer);
        this.bannerTimer = window.setTimeout(() => {
            host.innerHTML = "";
        }, 2100);
    }

    watchAd(place, onReward) {
        if (this.adBusy) return;
        const R = this.game.state;
        this.adBusy = true;
        R.paused = true;
        this.game.joystickEnd();
        this.audio.setSuspended(true);
        setHidden(this.refs.adMask, false);
        Promise.resolve(this.showRewardAd(place)).catch(() => ({ ok: false, msg: "error" })).then((result) => {
            this.adBusy = false;
            R.paused = false;
            this.audio.setSuspended(false);
            setHidden(this.refs.adMask, true);
            if (result && result.ok) onReward();
            else if (result && result.msg === "closed") this.hud.showToast(L("要看完整段视频才有奖励哦", "Watch the whole video to get the reward"));
            else this.hud.showToast(L("广告暂时不可用，稍后再试", "No ad available right now, try again later"));
        });
    }

    openPick() {
        const S = this.game.save;
        if (S.picks <= 0) return;
        if (!Array.isArray(S.offer) || S.offer.length === 0) S.offer = this.game.drawCards();
        if (S.offer.length === 0) {
            S.picks = 0;
            this.hud.showToast(L("技能卡已经全部满级啦", "All skill cards are maxed out"));
            return;
        }
        this.dialog = { kind: "pick" };
        this.dialogKey = "";
        this.panelOpen = false;
    }

    showWelcome(gain) {
        this.dialog = { kind: "welcome", sec: gain.sec };
        this.dialogKey = "";
    }

    collect(mult) {
        const value = this.game.collectBasket(mult);
        if (value > 0) {
            this.sfx("coin");
            this.hud.pulse("oranges");
            this.hud.showToast(L(`${mult > 1 ? "双倍收下" : "收下"} ${formatNumber(value)} 个橘子`, `${mult > 1 ? "Doubled! " : ""}+${formatNumber(value)} oranges`), "ico_orange");
        } else {
            this.sfx("deny");
        }
        return value;
    }

    takeWelcome(mult) {
        const value = this.game.collectBasket(mult);
        this.sfx("coin");
        this.hud.pulse("oranges");
        this.hud.showToast(L(`收下 ${formatNumber(value)} 个橘子`, `+${formatNumber(value)} oranges`), "ico_orange");
        this.dialog = null;
    }

    setVolume(key, value) {
        const S = this.game.save;
        const next = Math.round(Math.max(0, Math.min(1, value)) * 20) / 20;
        if (next === S[key]) return;
        S[key] = next;
        if (key === "musicVol") this.audio.syncMusic();
        else this.sfx("pop");
        this.syncVolumes();
    }

    onInput(event) {
        const key = event.target.dataset.volume;
        if (key) this.setVolume(key, Number(event.target.value));
    }

    onClick(event) {
        if (event.target === this.refs.scrim) {
            this.panelOpen = false;
            return;
        }
        const button = event.target.closest("button[data-act]");
        if (!button || !this.root.contains(button) || this.adBusy) return;
        this.handleAction(button.dataset.act);
    }

    handleAction(action) {
        const game = this.game;
        const S = game.save;
        const [name, id] = action.split(":");
        if (name === "settings") {
            this.sfx("click");
            this.clearResetTimer();
            this.resetArmed = false;
            this.healthOpen = false;
            this.dialog = { kind: "settings" };
            this.dialogKey = "";
        } else if (name === "ult") {
            if (!game.castUlt(true)) this.sfx("deny");
        } else if (name === "side") {
            this.sfx("click");
            if (id === "cards" && S.picks > 0) this.openPick();
            else {
                this.tab = id;
                this.panelOpen = true;
            }
        } else if (name === "tab") {
            this.sfx("click");
            this.tab = id;
        } else if (name === "closePanel") {
            this.sfx("click");
            this.panelOpen = false;
        } else if (name === "challenge") {
            this.sfx("click");
            game.challenge();
        } else if (name === "buff") {
            this.sfx("click");
            this.watchAd("buff", () => {
                game.startBuff();
                this.sfx("card");
                this.hud.showToast(L("喝了柚子茶：攻击×2，持续 3 分钟", "Yuzu tea: ATK ×2 for 3 minutes"));
            });
        } else if (name === "cardInfo") {
            this.sfx("click");
            this.selCard = id;
        } else if (name === "openPick") {
            this.sfx("click");
            this.openPick();
        } else if (name === "pick") {
            game.takeCard(id);
            this.sfx("card");
            this.selCard = id;
            this.dialog = null;
            if (S.picks > 0) this.openPick();
        } else if (name === "pickLater") {
            this.sfx("click");
            this.dialog = null;
        } else if (name === "reroll") {
            this.sfx("click");
            this.watchAd("reroll", () => {
                game.rerollCards();
                this.openPick();
            });
        } else if (name === "palBuy") {
            const pal = this.data.pals.find((item) => item.id === id);
            const level = S.pals[id] || 0;
            if (game.buyPal(id)) {
                this.sfx("card");
                this.hud.showToast(level > 0 ? L("伙伴升级了", "Pal leveled up") : L(`${pal.name} 来帮忙了！`, `${pal.name} joined you!`));
            } else {
                this.sfx("deny");
                this.hud.showToast(L("宝石不够，打败首领能拿到更多", "Not enough gems. Beat bosses to get more"), "ico_gem");
            }
        } else if (name === "palAd") {
            const pal = this.data.pals.find((item) => item.id === id);
            this.sfx("click");
            this.watchAd("pal", () => {
                if (game.adPalProgress(id)) {
                    this.sfx("card");
                    this.hud.showToast(L(`${pal.name} 来帮忙了！`, `${pal.name} joined you!`));
                } else {
                    this.sfx("buy");
                    this.hud.showToast(L("再看一次就能邀请到了", "One more video to invite them"));
                }
            });
        } else if (name === "collect") {
            this.collect(1);
        } else if (name === "collectAd") {
            this.sfx("click");
            this.watchAd("basket", () => this.collect(2));
        } else if (name === "welcome") {
            this.takeWelcome(1);
        } else if (name === "welcomeAd") {
            this.sfx("click");
            this.watchAd("welcome", () => this.takeWelcome(2));
        } else if (name === "volumeStep") {
            const [key, step] = id.split("|");
            this.setVolume(key, (S[key] || 0) + Number(step));
        } else if (name === "toggle") {
            if (id === "vibe") {
                S.vibe = S.vibe === false;
                this.vibe.play("medium");
            } else {
                S[id] = !S[id];
            }
            this.sfx("click");
        } else if (name === "reset") {
            if (!this.resetArmed) {
                this.clearResetTimer();
                this.resetArmed = true;
                this.resetTimer = window.setTimeout(() => {
                    this.resetTimer = 0;
                    this.resetArmed = false;
                    if (this.dialog && this.dialog.kind === "settings") this.dialogKey = "";
                }, 3000);
                return;
            }
            this.clearResetTimer();
            this.resetArmed = false;
            this.dialog = null;
            clearSave();
            game.replaceSave(newSave());
            this.audio.syncMusic();
        } else if (name === "invite") {
            this.sfx("click");
            this.panelOpen = false;
            this.dialog = { kind: "invite" };
            this.dialogKey = "";
        } else if (name === "shareInvite") {
            this.sfx("click");
            void this.shareToFriends();
        } else if (name === "lang") {
            this.sfx("click");
            game.saveNow();
            switchLang(IS_ZH ? "en" : "zh");
        } else if (name === "closeDialog") {
            this.sfx("click");
            this.clearResetTimer();
            this.healthOpen = false;
            this.dialog = null;
            game.saveNow();
        }
    }

    /** 打开分享面板；每天第一次分享给宝石奖励。 */
    async shareToFriends() {
        const S = this.game.save;
        const gift = TELEGRAM_CONFIG.inviteGiftGems;
        const reward = TELEGRAM_CONFIG.shareRewardGems;
        const text = L(
            `我在玩《柚子豚出击》：水豚拿弹弓打怪，手机放一边也在变强！从这个链接进来送你 ${gift} 宝石～`,
            `I'm playing Yuzu Capy Strike: a capybara with a slingshot fights for you, even while your phone rests. Join through this link and get ${gift} free gems!`
        );
        const how = await shareInvite(text);
        if (!how) {
            this.hud.showToast(L("没能打开分享，请稍后再试", "Couldn't open sharing, please try again"));
            return;
        }
        this.dialog = null;
        if (how === "copied") this.hud.showToast(L("邀请链接已复制，发给好友吧", "Invite link copied, send it to a friend"));
        if (shareRewardAvailable(S)) {
            S.shareDay = todayKey();
            S.gems += reward;
            this.sfx("coin");
            this.hud.pulse("gems");
            this.hud.showToast(L(`分享奖励 +${reward} 宝石（每天一次）`, `Share reward +${reward} gems (once a day)`), "ico_gem");
            this.game.saveNow();
        }
    }

    clearResetTimer() {
        if (!this.resetTimer) return;
        window.clearTimeout(this.resetTimer);
        this.resetTimer = 0;
    }

    sync() {
        const game = this.game;
        const S = game.save;
        const R = game.state;
        const refs = this.refs;
        refs.ult.style.setProperty("--ult", String(Math.min(1, S.ult)));
        refs.ult.classList.toggle("is-ready", S.ult >= 1);
        setHidden(refs.buffTime, !(S.buffT > 0));
        if (S.buffT > 0) setText(refs.buffTime, `${L("攻击×2", "ATK×2")} ${Math.floor(S.buffT / 60)}:${String(Math.floor(S.buffT % 60)).padStart(2, "0")}`);

        const cardBadge = refs.sideCards.querySelector(".ui-badge");
        setHidden(cardBadge, S.picks <= 0);
        if (S.picks > 0) setText(cardBadge, S.picks);
        const palCan = this.data.pals.some((pal) => {
            const level = S.pals[pal.id] || 0;
            return level < this.data.palMax && S.gems >= pal.cost[level];
        });
        setHidden(refs.sidePals.querySelector(".ui-badge"), !palCan);
        const cap = game.basketCap();
        setHidden(refs.sideCamp.querySelector(".ui-badge"), !(cap > 0 && S.basket / cap >= 0.5));
        setHidden(refs.sideInvite.querySelector(".ui-badge"), !shareRewardAvailable(S));

        const farming = S.farm && R.phase === "fight";
        setHidden(refs.go, !farming);
        if (farming) setText(refs.go, game.F.isBoss(S.stage + 1) ? L("挑战首领", "Fight Boss") : `${L("前进", "Go")} ${game.F.label(S.stage + 1)}`);
        setHidden(refs.buff, !(farming && game.adsOpen() && S.buffT <= 0));

        refs.scrim.classList.toggle("is-open", this.panelOpen);
        this.syncPanel();
        this.syncDialog();
    }

    syncPanel() {
        const game = this.game;
        const S = game.save;
        const cap = game.basketCap();
        const ratio = cap > 0 ? Math.min(1, S.basket / cap) : 0;
        const key = JSON.stringify([
            this.tab, this.selCard, S.picks, S.cards, S.pals, S.palAds,
            this.data.pals.map((pal) => S.gems >= pal.cost[Math.min(S.pals[pal.id] || 0, this.data.palMax - 1)]),
            game.adsOpen(), ratio >= 0.3, S.basket >= 1, ratio >= 0.999,
        ]);
        if (key !== this.panelKey) {
            this.panelKey = key;
            this.refs.panel.innerHTML = this.panelHtml();
        }
        if (this.tab === "camp") {
            const panel = this.refs.panel;
            setText(panel.querySelector("[data-live=basket]"), formatNumber(S.basket));
            const meter = panel.querySelector("[data-live=meter]");
            if (meter) meter.style.width = `${(ratio * 100).toFixed(1)}%`;
            setText(panel.querySelector("[data-live=rate]"), ratio >= 0.999 ? L("果篮满了，快收下吧", "Basket is full, collect it!") : L(`每秒 +${formatNumber(game.basketRate())}\n最多攒 2 小时`, `+${formatNumber(game.basketRate())} per second\nHolds up to 2 hours`));
        }
    }

    panelHtml() {
        const tabs = TABS.map(([id, label, icon]) => `<button class="ui-tab ${this.tab === id ? "is-on" : ""}" type="button" data-act="tab:${id}"><img alt="" src="${imageUrl(icon)}">${label}</button>`).join("");
        const page = this.tab === "cards" ? this.cardsHtml() : this.tab === "pals" ? this.palsHtml() : this.campHtml();
        return `<div class="ui-tabs">${tabs}</div><button class="ui-close" type="button" data-act="closePanel" aria-label="${L("关闭", "Close")}">×</button><div class="ui-page">${page}</div>`;
    }

    cardsHtml() {
        const game = this.game;
        const S = game.save;
        const grid = this.data.cards.map((card) => {
            const level = game.card(card.id);
            return `<button class="ui-cardcell ${level > 0 ? "has-level" : ""} ${this.selCard === card.id ? "is-selected" : ""}" type="button" data-act="cardInfo:${card.id}" aria-label="${card.name}"><img alt="" src="${imageUrl(card.ico)}">${pips(level, this.data.cardMax)}</button>`;
        }).join("");
        const selected = this.data.cards.find((card) => card.id === this.selCard);
        let info;
        if (selected) {
            const level = game.card(selected.id);
            info = `<b>${selected.name}${L("  ", " · ")}${level > 0 ? `Lv.${level}` : L("未获得", "Not owned")}</b>${selected.descByLevel[Math.max(1, level) - 1]}`;
        } else {
            info = S.picks > 0
                ? L(`有 ${S.picks} 张技能卡可以选。不选也没关系，会一直给你留着。`, `You have ${S.picks} skill card${S.picks > 1 ? "s" : ""} to pick. No rush, they will wait for you.`)
                : L("每通过一个新关卡，就能选一张技能卡。点上面的图标看效果。", "Clear a new stage to pick a skill card. Tap an icon above to see what it does.");
        }
        const action = S.picks > 0 ? `<button class="ui-btn ui-pick-action ui-outline" type="button" data-act="openPick">${L("选技能卡", "Pick a card")}</button>` : "";
        return `<div class="ui-cardgrid">${grid}</div><div class="ui-info ${S.picks > 0 ? "" : "no-action"}">${info}</div>${action}`;
    }

    palsHtml() {
        const game = this.game;
        const S = game.save;
        const rows = this.data.pals.map((pal) => {
            const level = S.pals[pal.id] || 0;
            const maxed = level >= this.data.palMax;
            let actions;
            if (maxed) {
                actions = `<button class="ui-btn is-muted" type="button" disabled>${L("已满级", "Maxed")}</button>`;
            } else {
                const cost = pal.cost[level];
                const can = S.gems >= cost;
                actions = "";
                if (level === 0 && game.adsOpen()) {
                    const need = this.data.adPalNeed[pal.id];
                    const got = Math.min(need, S.palAds[pal.id] || 0);
                    actions += `<button class="ui-btn is-yellow" type="button" data-act="palAd:${pal.id}"><i class="ui-mark"></i>${need > 1 ? `${L("免费邀请", "Free")} ${got}/${need}` : L("免费邀请", "Free invite")}</button>`;
                }
                actions += `<button class="ui-btn ${can ? "is-gem" : "is-muted"}" type="button" data-act="palBuy:${pal.id}"><img alt="" src="${imageUrl("ico_gem")}">${cost} ${level > 0 ? L("升级", "Upgrade") : L("邀请", "Invite")}</button>`;
            }
            return `<article class="ui-pal ${level > 0 ? "has-level" : ""}"><span class="ui-palicon"><img alt="" src="${imageUrl(pal.spr)}"></span><div class="ui-palname">${pal.name}${level > 0 ? pips(level, this.data.palMax) : ""}</div><div class="ui-paldesc">${pal.desc}</div><div class="ui-palacts">${actions}</div></article>`;
        }).join("");
        return `<div class="ui-pals">${rows}</div>`;
    }

    campHtml() {
        const game = this.game;
        const S = game.save;
        const cap = game.basketCap();
        const ratio = cap > 0 ? Math.min(1, S.basket / cap) : 0;
        const bathers = [["hero_cheer", 88]].concat(this.data.pals.filter((pal) => S.pals[pal.id]).map((pal) => [pal.spr, 56]));
        const springWidth = Math.max(180, (this.game.state.W - 20) * 0.55);
        const spacing = Math.min(46, (springWidth - 50) / bathers.length);
        const soak = bathers.map(([sprite, size], index) => {
            const offset = (index + 1 - (bathers.length + 1) / 2) * spacing;
            return `<img alt="" src="${imageUrl(sprite)}" style="height:${size}px;left:calc(50% + ${offset.toFixed(1)}px);bottom:${(4 - size * 0.42).toFixed(1)}px;margin-left:${(-size * 0.45).toFixed(1)}px;animation-delay:${(-index * 0.45).toFixed(2)}s">`;
        }).join("");
        const canCollect = S.basket >= 1;
        const buttons = game.adsOpen() && ratio >= 0.3
            ? `<button class="ui-btn ui-outline ${canCollect ? "" : "is-muted"}" type="button" data-act="collect">${L("收下", "Collect")}</button><button class="ui-btn is-yellow" type="button" data-act="collectAd"><i class="ui-mark"></i>${L("双倍", "×2")}</button>`
            : `<button class="ui-btn ui-outline ${canCollect ? "" : "is-muted"}" type="button" data-act="collect">${L("收下橘子", "Collect oranges")}</button>`;
        return `<div class="ui-camp"><div class="ui-spring"><i class="ui-steam" style="left:25%"></i><i class="ui-steam" style="left:50%;animation-delay:-1s"></i><i class="ui-steam" style="left:75%;animation-delay:-2s"></i><div class="ui-water"></div><div class="ui-soak">${soak}</div></div><div class="ui-basket"><img alt="" src="${imageUrl("i_basket")}"><strong class="ui-outline" data-live="basket"></strong><div class="ui-meter"><i data-live="meter"></i></div><p data-live="rate"></p><div class="ui-collect">${buttons}</div></div></div>`;
    }

    syncDialog() {
        const mask = this.refs.mask;
        const dialog = this.dialog;
        if (!dialog) {
            setHidden(mask, true);
            this.dialogKey = "";
            this.healthOpen = false;
            return;
        }
        setHidden(mask, false);
        const S = this.game.save;
        let key = dialog.kind;
        if (dialog.kind === "pick") key += JSON.stringify([S.offer, S.picks, S.rerolled, this.game.adsOpen()]);
        if (dialog.kind === "welcome") key += `${dialog.sec}|${formatNumber(S.basket)}|${this.game.adsOpen()}`;
        if (dialog.kind === "invite") key += String(shareRewardAvailable(S));
        if (dialog.kind === "settings") key += JSON.stringify([S.vibe, S.auto, S.autoGo, this.resetArmed]);
        if (key === this.dialogKey) return;
        const first = !this.dialogKey || this.dialogKey[0] !== key[0];
        this.dialogKey = key;
        mask.innerHTML = dialog.kind === "pick" ? this.pickHtml()
            : dialog.kind === "welcome" ? this.welcomeHtml()
                : dialog.kind === "invite" ? this.inviteHtml()
                    : this.settingsHtml();
        if (!first) {
            const box = mask.querySelector(".ui-dialog");
            if (box) box.style.animation = "none";
        }
        if (dialog.kind === "settings") this.syncVolumes();
    }

    pickHtml() {
        const game = this.game;
        const S = game.save;
        const cards = (S.offer || []).map((id) => {
            const card = this.data.cards.find((item) => item.id === id);
            const level = game.card(id);
            return `<button class="ui-pick" type="button" data-act="pick:${id}">${level === 0 ? `<span class="ui-new">${L("新", "NEW")}</span>` : ""}<img alt="" src="${imageUrl(card.ico)}"><b>${card.name}</b>${pips(level + 1, this.data.cardMax)}<small>${card.descByLevel[level]}</small></button>`;
        }).join("");
        const reroll = game.adsOpen() && !S.rerolled ? `<button class="ui-btn is-yellow" type="button" data-act="reroll"><i class="ui-mark"></i>${L("换一批", "Reroll")}</button>` : "";
        return `<div class="ui-dialog"><div class="ui-title ui-outline">${L("选一张技能卡", "Pick a skill card")}</div><p class="ui-sub">${L(`还能选 ${S.picks} 张 · 效果永久保留`, `${S.picks} left to pick · effects are permanent`)}</p><div class="ui-picks">${cards}</div><div class="ui-actions"><button class="ui-btn is-muted" type="button" data-act="pickLater">${L("以后再选", "Later")}</button>${reroll}</div></div>`;
    }

    welcomeHtml() {
        const S = this.game.save;
        const ad = this.game.adsOpen() ? `<button class="ui-btn is-yellow" type="button" data-act="welcomeAd"><i class="ui-mark"></i>${L("双倍收下", "Collect ×2")}</button>` : "";
        const basketLine = S.basket >= this.game.basketCap()
            ? L("果篮装满啦，常回来收橘子吧", "The basket filled up. Come back often to collect!")
            : L("柚子豚把橘子都装进了果篮", "Yuzu Capy put the oranges in the basket");
        return `<div class="ui-dialog is-small"><div class="ui-title ui-outline">${L("欢迎回来", "Welcome back")}</div><img class="ui-hero-cheer" alt="" src="${imageUrl("hero_cheer")}"><p class="ui-sub">${L("你离开了", "You were away for")} ${formatDuration(this.dialog.sec)}\n${basketLine}</p><div class="ui-gain"><img alt="" src="${imageUrl("ico_stack")}"><strong class="ui-outline">+${formatNumber(S.basket)}</strong></div><div class="ui-actions"><button class="ui-btn ui-outline" type="button" data-act="welcome">${this.game.adsOpen() ? L("收下", "Collect") : L("全部收下", "Collect all")}</button>${ad}</div></div>`;
    }

    inviteHtml() {
        const S = this.game.save;
        const gift = TELEGRAM_CONFIG.inviteGiftGems;
        const reward = TELEGRAM_CONFIG.shareRewardGems;
        const rewardLine = shareRewardAvailable(S)
            ? L(`今天第一次分享，你也得 ${reward} 宝石`, `Share today and you get ${reward} gems too`)
            : L("今天的分享奖励已经领过了，明天再来", "You got today's share reward, come back tomorrow");
        return `<div class="ui-dialog is-small"><div class="ui-title ui-outline">${L("邀请好友", "Invite friends")}</div><img class="ui-hero-cheer" alt="" src="${imageUrl("hero_cheer")}"><p class="ui-sub">${L(`好友从你的链接进来，能拿 ${gift} 宝石见面礼`, `Friends who join through your link get ${gift} gems`)}\n${rewardLine}</p>${shareRewardAvailable(S) ? `<div class="ui-gain"><img alt="" src="${imageUrl("ico_gem")}"><strong class="ui-outline">+${reward}</strong></div>` : ""}<div class="ui-actions"><button class="ui-btn is-muted" type="button" data-act="closeDialog">${L("以后再说", "Later")}</button><button class="ui-btn ui-outline" type="button" data-act="shareInvite">${L("分享给好友", "Share")}</button></div></div>`;
    }

    settingsHtml() {
        const S = this.game.save;
        const volume = (key, label) => `<div class="ui-row ui-volume"><div class="ui-volume-head"><span>${label}</span><span data-volume-label="${key}"></span></div><div class="ui-volume-line"><button type="button" data-act="volumeStep:${key}|-0.05" aria-label="${label} ${L("减小", "down")}">−</button><input type="range" min="0" max="1" step="0.05" data-volume="${key}" aria-label="${label}"><button type="button" data-act="volumeStep:${key}|0.05" aria-label="${label} ${L("增大", "up")}">+</button></div></div>`;
        const toggle = (id, label, on) => `<div class="ui-row"><span>${label}</span><button class="ui-btn ${on ? "ui-outline" : "is-muted"}" type="button" data-act="toggle:${id}">${on ? L("开", "On") : L("关", "Off")}</button></div>`;
        const langRow = `<div class="ui-row"><span>${L("语言", "Language")}</span><button class="ui-btn ui-outline" type="button" data-act="lang">${IS_ZH ? "中文" : "English"}</button></div>`;
        return `<div class="ui-dialog is-settings"><div class="ui-title ui-outline">${L("设置", "Settings")}</div>${volume("musicVol", L("配乐音量", "Music"))}${volume("sfxVol", L("音效音量", "Sound effects"))}${toggle("vibe", L("震动", "Vibration"), S.vibe !== false)}${toggle("auto", L("自动放柚子雨", "Auto Yuzu Rain"), S.auto)}${toggle("autoGo", L("撤退后自动再挑战", "Auto-retry after retreat"), S.autoGo)}${langRow}<div class="ui-row"><span>${L("重新开始", "Start over")}</span><button class="ui-btn ${this.resetArmed ? "is-red" : "is-muted"}" type="button" data-act="reset">${this.resetArmed ? L("确定清空？", "Tap to confirm") : L("清空存档", "Erase save")}</button></div><div class="ui-settings-info"><div class="ui-age-tip">${L("版本", "Version")} ${VERSION}</div></div><div class="ui-actions"><button class="ui-btn ui-outline" type="button" data-act="closeDialog">${L("好了", "Done")}</button></div></div>`;
    }

    syncVolumes() {
        const S = this.game.save;
        for (const key of ["musicVol", "sfxVol"]) {
            const input = this.refs.mask.querySelector(`[data-volume="${key}"]`);
            const label = this.refs.mask.querySelector(`[data-volume-label="${key}"]`);
            if (input) input.value = String(S[key]);
            if (label) setText(label, S[key] <= 0 ? L("关", "Off") : `${Math.round(S[key] * 100)}%`);
        }
    }

    dispose() {
        window.clearTimeout(this.bannerTimer);
        this.clearResetTimer();
        for (const dispose of this.disposers) dispose();
        this.disposers = [];
        if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    }
}
