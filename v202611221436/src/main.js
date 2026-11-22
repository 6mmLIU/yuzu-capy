import { L } from "./i18n.js";
import { initTelegram, telegramReady } from "./platform/telegram.js";
import { preloadRewardAd } from "./platform/rewardAd.js";
import { EventBus } from "./core/eventBus.js";
import { GameApp } from "./core/gameApp.js";
import { applyUiId } from "./ui/uiId.js";
import { loadGameData } from "./data/gameData.js";
import { BattleGame } from "./game/battle.js";
import { OrchardRenderer } from "./render/orchardRenderer.js";
import { createImageStore, IMAGE_IDS } from "./render/images.js";
import { OrchardHud } from "./ui/orchardHud.js";
import { JoystickInput } from "./ui/joystickInput.js";
import { GameUi } from "./ui/gameUi.js";
import { installGameStyles } from "./ui/gameStyles.js";
import { GameAudio } from "./platform/audio.js";
import { flushCloudSaveNow, initCloudSave, readSave, writeSave } from "./platform/saveStore.js";
import { showRewardAd } from "./platform/ads.js";
import { createVibe } from "./platform/vibe.js";

const gameName = L("柚子豚出击", "Yuzu Capy Strike");
document.title = gameName;

// Telegram 外壳越早初始化越好：全屏、关掉下拉关闭手势、安全区。
let onTelegramActive = null;
initTelegram({ onActive: (active) => onTelegramActive && onTelegramActive(active) });

function createBootView() {
    const el = document.createElement("div");
    el.className = "boot-overlay";
    el.innerHTML = `
        <div class="boot-title">${L("柚子豚正在赶来...", "Yuzu Capy is on the way...")}</div>
        <div class="boot-bar"><div class="boot-fill"></div></div>
        <div class="boot-hint">${L("正在准备果园", "Getting the orchard ready")}</div>
    `;
    const fill = el.querySelector(".boot-fill");
    return {
        el,
        setProgress(progress) {
            const value = Math.max(6, Math.min(100, Math.round(progress * 100)));
            fill.style.width = `${value}%`;
        },
        remove() {
            if (el.parentNode) el.parentNode.removeChild(el);
        },
    };
}

function fatalMessage(error) {
    if (!error) return L("未知错误", "Unknown error");
    const message = error.message ? String(error.message) : String(error);
    return message.length > 160 ? `${message.slice(0, 160)}…` : message;
}

async function boot() {
    installGameStyles();
    const appRoot = document.getElementById("app");
    if (!appRoot) throw new Error("#app not found");
    appRoot.innerHTML = "";
    const shell = document.createElement("div");
    shell.className = "game-shell";
    applyUiId(shell, "game.root");
    const column = document.createElement("div");
    column.className = "game-column";
    applyUiId(column, "game.column");
    shell.appendChild(column);
    appRoot.appendChild(shell);
    const bootView = createBootView();
    shell.appendChild(bootView.el);
    telegramReady();
    preloadRewardAd();

    const data = await loadGameData();

    const images = createImageStore();
    let timedOut = false;
    const loadPromise = images.loadAll(IMAGE_IDS, (progress) => bootView.setProgress(progress));
    await Promise.race([
        loadPromise,
        new Promise((resolve) => {
            window.setTimeout(() => {
                timedOut = true;
                resolve();
            }, 25000);
        }),
    ]);

    const save = readSave();
    const gameEvents = new EventBus();
    const game = new BattleGame({
        data,
        save,
        events: gameEvents,
        onSave: writeSave,
    });
    const hud = new OrchardHud({ game, data, images, events: gameEvents });
    hud.mount(column);
    const renderer = new OrchardRenderer({
        data,
        images,
        onLayout(layout) {
            game.setViewport(layout);
            hud.setLayout(layout);
            column.style.left = `${layout.view.x * layout.scale}px`;
            column.style.right = "auto";
            column.style.bottom = "auto";
            column.style.margin = "0";
            column.style.maxWidth = "none";
            column.style.width = `${layout.view.width}px`;
            column.style.height = `${layout.view.height}px`;
            column.style.transform = `scale(${layout.scale})`;
            column.style.transformOrigin = "0 0";
        },
    });
    const audio = new GameAudio({ save });
    const vibe = createVibe(save);
    const COMBAT_VIBE = { hit: "light", pop: "light", block: "light", hurt: "medium", boom: "heavy", boss: "heavy" };
    gameEvents.on("sfx", (name) => {
        audio.playSfx(name);
        if (COMBAT_VIBE[name]) vibe.play(COMBAT_VIBE[name], true);
    });
    gameEvents.on("coin", () => audio.playSfx("coin"));
    const ui = new GameUi({ game, data, events: gameEvents, audio, vibe, hud, showRewardAd });
    ui.mount(column);
    void initCloudSave({
        getSave: () => game.save,
        adopt(next) {
            game.replaceSave(next);
            hud.sync();
            ui.sync();
        },
    });
    window.addEventListener("pointerdown", () => vibe.touched(), { passive: true });
    window.addEventListener("pointermove", (event) => {
        if (event.buttons || event.pointerType === "touch") vibe.touched();
    }, { passive: true });
    if (window.__YUZU_DEV__) window.__YUZU_GAME__ = { game, ui, hud, audio };

    const app = new GameApp({ host: shell, initialWorld: game, renderer });
    let saveTimer = 0;
    app.addSystem({
        id: "orchard",
        init() {
            saveTimer = 0;
        },
        update(deltaMs) {
            const dt = Math.min(0.05, Math.max(0, deltaMs / 1000));
            let left = game.state.paused ? 0 : dt;
            while (left > 0) {
                const step = Math.min(left, 1 / 30);
                game.update(step);
                left -= step;
            }
            hud.sync();
            ui.sync();
            saveTimer += dt;
            if (saveTimer >= 5) {
                saveTimer = 0;
                game.saveNow();
            }
        },
        teardown() {},
    });

    await app.start();
    new JoystickInput({ host: shell, game, renderer, onStart: () => vibe.play("light") }).mount();
    game.start();
    app.state.setState("playing");
    hud.sync();
    bootView.remove();
    hud.show();

    if (timedOut) hud.showToast(L("图片还在路上，会陆续出现", "Some pictures are still loading"));
    const firstGain = game.offlineGain();
    if (firstGain) {
        ui.showWelcome(firstGain);
    } else if (!save.seenIntro) {
        save.seenIntro = true;
        hud.showToast(L("放着就会自己打；按住屏幕拖动可以自己走位", "It fights on its own. Drag on the screen to move"));
        game.saveNow();
    }

    let awayAt = null;
    const saveOnHide = () => {
        if (document.hidden) {
            game.saveNow();
            awayAt = game.now();
        } else if (awayAt !== null) {
            const gain = game.offlineGain(awayAt);
            awayAt = null;
            game.saveNow();
            if (gain) ui.showWelcome(gain);
        }
    };
    document.addEventListener("visibilitychange", saveOnHide);
    window.addEventListener("pagehide", () => {
        game.saveNow();
        flushCloudSaveNow();
    });
    // Telegram 小程序被最小化：存档、立刻同步云端、静音；恢复时继续出声。
    onTelegramActive = (active) => {
        if (!active) {
            game.saveNow();
            flushCloudSaveNow();
        }
        audio.setBackground(!active);
    };
}

boot().catch((error) => {
    console.error("[game] boot failed", error);
    const overlay = document.createElement("div");
    overlay.className = "boot-overlay";
    overlay.innerHTML = `
        <div class="boot-title">${L("柚子豚没能出门", "Yuzu Capy couldn't get going")}</div>
        <div class="boot-error">${fatalMessage(error)}</div>
        <div class="boot-hint">${L("请关掉重新打开再试一次", "Please close and reopen the game")}</div>
    `;
    const appRoot = document.getElementById("app");
    if (appRoot) appRoot.appendChild(overlay);
});
