/**
 * 配乐与音效（Web Audio 版）。
 * Telegram 的 iPhone 端不允许网页改 <audio>.volume，所以统一走 AudioContext + 增益节点，
 * 音量滑块在所有手机上都生效。音量按平方换算，高频音效限频；浏览器要求先有一次触碰才能出声。
 * 配乐优先用 OGG，解不开（旧 iPhone）时换 M4A。
 */
import { publicAsset } from "../ui/publicAsset.js";

const SFX_FILES = {
    shoot: "audio/sfx_shoot.wav",
    hit: "audio/sfx_hit.wav",
    pop: "audio/sfx_pop.wav",
    coin: "audio/sfx_coin.wav",
    hurt: "audio/sfx_hurt.wav",
    block: "audio/sfx_block.wav",
    boom: "audio/sfx_boom.wav",
    card: "audio/sfx_card.wav",
    buy: "audio/sfx_buy.wav",
    click: "audio/sfx_click.wav",
    deny: "audio/sfx_deny.wav",
    warn: "audio/sfx_warn.wav",
    boss: "audio/sfx_boss.wav",
};

const SFX_GAP = {
    shoot: 0.07,
    hit: 0.06,
    coin: 0.055,
    pop: 0.04,
    hurt: 0.12,
    block: 0.08,
    boom: 0.09,
};

const BGM_FILES = ["audio/bgm.ogg", "audio/bgm.m4a"];
const SFX_MAX = 0.25;
const MUSIC_MAX = 0.45;
const VOICES_PER_SFX = 2;
const UNLOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"];

function decode(ctx, arrayBuffer) {
    return new Promise((resolve, reject) => {
        try {
            const result = ctx.decodeAudioData(arrayBuffer, resolve, reject);
            if (result && typeof result.then === "function") result.then(resolve, reject);
        } catch (error) {
            reject(error);
        }
    });
}

async function loadBuffer(ctx, path) {
    const response = await fetch(publicAsset(path));
    if (!response.ok) throw new Error(`HTTP ${response.status} ${path}`);
    return decode(ctx, await response.arrayBuffer());
}

export class GameAudio {
    constructor(options) {
        this.save = options.save;
        this.ctx = null;
        this.musicNode = null;
        this.sfxNode = null;
        this.bgmBuffer = null;
        this.bgmSource = null;
        this.bgmStartedAt = 0;
        this.bgmOffset = 0;
        this.buffers = {};
        this.active = {};
        this.lastPlay = {};
        this.suspended = false;
        this.background = false;
        this.disposed = false;
        this.onVisibility = () => this.syncContext();
        this.onUnlock = () => this.unlock();
        this.init();
    }

    init() {
        const Ctx = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
        if (!Ctx) return;
        try {
            this.ctx = new Ctx();
        } catch (error) {
            this.ctx = null;
            return;
        }
        this.musicNode = this.ctx.createGain();
        this.sfxNode = this.ctx.createGain();
        this.musicNode.connect(this.ctx.destination);
        this.sfxNode.connect(this.ctx.destination);
        this.musicNode.gain.value = this.musicGain();
        this.sfxNode.gain.value = this.sfxGain();
        for (const name of UNLOCK_EVENTS) window.addEventListener(name, this.onUnlock, { passive: true });
        document.addEventListener("visibilitychange", this.onVisibility);
        void this.loadAll();
    }

    async loadAll() {
        const ctx = this.ctx;
        for (const path of BGM_FILES) {
            try {
                this.bgmBuffer = await loadBuffer(ctx, path);
                break;
            } catch (error) {
                console.warn("[audio] 配乐解码失败，换下一个格式", path);
            }
        }
        if (this.disposed) return;
        this.syncMusic();
        await Promise.all(Object.keys(SFX_FILES).map(async (name) => {
            try {
                this.buffers[name] = await loadBuffer(ctx, SFX_FILES[name]);
            } catch (error) {
                /* 单个音效失败不影响游戏 */
            }
        }));
    }

    unlock() {
        if (!this.ctx || this.disposed) return;
        if (this.ctx.state === "running") {
            for (const name of UNLOCK_EVENTS) window.removeEventListener(name, this.onUnlock);
            return;
        }
        this.syncContext();
    }

    /** 前台、没在播广告时让 AudioContext 运行，否则暂停整个声音输出。 */
    syncContext() {
        if (!this.ctx || this.disposed) return;
        const shouldRun = !document.hidden && !this.suspended && !this.background;
        try {
            if (shouldRun && this.ctx.state !== "running") {
                const promise = this.ctx.resume();
                if (promise && promise.then) promise.then(() => this.syncMusic(), () => {});
            } else if (!shouldRun && this.ctx.state === "running") {
                void this.ctx.suspend();
            }
        } catch (error) {
            /* ignore */
        }
        this.syncMusic();
    }

    sfxGain() {
        const volume = Number(this.save && this.save.sfxVol);
        const v = Number.isFinite(volume) ? volume : 0.8;
        return SFX_MAX * v * v;
    }

    musicGain() {
        const volume = Number(this.save && this.save.musicVol);
        const v = Number.isFinite(volume) ? volume : 0.6;
        return MUSIC_MAX * v * v;
    }

    startBgm() {
        if (this.bgmSource || !this.bgmBuffer) return;
        const source = this.ctx.createBufferSource();
        source.buffer = this.bgmBuffer;
        source.loop = true;
        source.connect(this.musicNode);
        const offset = this.bgmOffset % this.bgmBuffer.duration;
        source.start(0, offset);
        this.bgmStartedAt = this.ctx.currentTime - offset;
        this.bgmSource = source;
    }

    stopBgm() {
        if (!this.bgmSource) return;
        if (this.bgmBuffer) this.bgmOffset = (this.ctx.currentTime - this.bgmStartedAt) % this.bgmBuffer.duration;
        try {
            this.bgmSource.stop();
        } catch (error) {
            /* ignore */
        }
        this.bgmSource.disconnect();
        this.bgmSource = null;
    }

    syncMusic() {
        if (!this.ctx || this.disposed) return;
        const gain = this.musicGain();
        this.musicNode.gain.value = gain;
        this.sfxNode.gain.value = this.sfxGain();
        if (gain <= 0) this.stopBgm();
        else this.startBgm();
    }

    setSuspended(value) {
        this.suspended = Boolean(value);
        this.syncContext();
    }

    /** Telegram 小程序被最小化时静音，恢复时继续。 */
    setBackground(value) {
        this.background = Boolean(value);
        this.syncContext();
    }

    playSfx(name) {
        if (!this.ctx || this.disposed || this.suspended || this.ctx.state !== "running") return;
        const buffer = this.buffers[name];
        if (!buffer) return;
        const gain = this.sfxGain();
        if (gain <= 0) return;
        const now = this.ctx.currentTime;
        const gap = SFX_GAP[name] || 0;
        if (now - (this.lastPlay[name] === undefined ? -9 : this.lastPlay[name]) < gap) return;
        this.lastPlay[name] = now;
        this.sfxNode.gain.value = gain;
        const list = this.active[name] || (this.active[name] = []);
        while (list.length >= VOICES_PER_SFX) {
            const old = list.shift();
            try {
                old.stop();
            } catch (error) {
                /* ignore */
            }
        }
        try {
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.sfxNode);
            source.onended = () => {
                const index = list.indexOf(source);
                if (index >= 0) list.splice(index, 1);
                source.disconnect();
            };
            source.start(0);
            list.push(source);
        } catch (error) {
            /* 音频失败不影响战斗 */
        }
    }

    dispose() {
        this.disposed = true;
        for (const name of UNLOCK_EVENTS) window.removeEventListener(name, this.onUnlock);
        document.removeEventListener("visibilitychange", this.onVisibility);
        this.stopBgm();
        if (this.ctx) void this.ctx.close();
        this.ctx = null;
    }
}
