/**
 * Adsgram 激励视频适配（Telegram Mini App）。
 * 业务层只调用 window.__YUZU_REWARD_AD__(place)，只有完整看完才返回 { ok: true }。
 * 没配广告位、不在 Telegram 里、没有广告时返回 unavailable，不模拟成功。
 */
import { TELEGRAM_CONFIG } from "../config/telegram.js";
import { adsgramBlockId, isRewardAdEnabled } from "./adsConfig.js";

const SDK_URL = "https://sad.adsgram.ai/js/sad.min.js";
const REWARD_PLACES = new Set(["buff", "pal", "basket", "welcome", "reroll"]);
const SDK_TIMEOUT_MS = 8000;
const SHOW_TIMEOUT_MS = 150000;

let sdkPromise = null;
let controller = null;
let lastEvent = "";

function unavailable() {
    return { ok: false, msg: "unavailable" };
}

function loadSdk() {
    if (window.Adsgram) return Promise.resolve(window.Adsgram);
    if (!sdkPromise) {
        sdkPromise = new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = SDK_URL;
            script.async = true;
            const timer = window.setTimeout(() => resolve(null), SDK_TIMEOUT_MS);
            script.onload = () => {
                window.clearTimeout(timer);
                resolve(window.Adsgram || null);
            };
            script.onerror = () => {
                window.clearTimeout(timer);
                sdkPromise = null;
                resolve(null);
            };
            document.head.appendChild(script);
        });
    }
    return sdkPromise;
}

function getController(sdk) {
    if (controller) return controller;
    controller = sdk.init({ blockId: adsgramBlockId(), debug: TELEGRAM_CONFIG.adsgramDebug === true });
    if (controller && typeof controller.addEventListener === "function") {
        for (const name of ["onStart", "onSkip", "onReward", "onError", "onBannerNotFound", "onTooLongSession", "onNonStopShow"]) {
            controller.addEventListener(name, () => {
                lastEvent = name;
            });
        }
    }
    return controller;
}

function withTimeout(promise, ms, fallback) {
    return new Promise((resolve) => {
        const timer = window.setTimeout(() => resolve(fallback), ms);
        promise.then(
            (value) => {
                window.clearTimeout(timer);
                resolve({ resolved: true, value });
            },
            (value) => {
                window.clearTimeout(timer);
                resolve({ resolved: false, value });
            }
        );
    });
}

async function playRewardAd(place) {
    if (!REWARD_PLACES.has(place) || !isRewardAdEnabled()) return unavailable();
    if (window.__YUZU_AD_MOCK__) {
        const mode = window.__YUZU_AD_MOCK__;
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        return mode === "ok" ? { ok: true } : { ok: false, msg: mode };
    }
    const sdk = await loadSdk();
    if (!sdk || typeof sdk.init !== "function") return unavailable();
    const ctrl = getController(sdk);
    if (!ctrl || typeof ctrl.show !== "function") return unavailable();
    lastEvent = "";
    // Adsgram：完整看完才 resolve；中途关闭、出错、没有广告都会 reject。
    const outcome = await withTimeout(Promise.resolve().then(() => ctrl.show()), SHOW_TIMEOUT_MS, { resolved: false, value: null });
    const result = outcome.value || {};
    if (outcome.resolved && result.done !== false) return { ok: true };
    if (lastEvent === "onSkip" || (result && result.error === false && result.state === "playing")) {
        return { ok: false, msg: "closed" };
    }
    if (result && result.description) console.warn("[reward-ad]", result.description);
    return unavailable();
}

window.__YUZU_REWARD_AD__ = async (place) => {
    try {
        return await playRewardAd(place);
    } catch (error) {
        console.warn("[reward-ad] 适配异常", error && error.message ? error.message : error);
        return unavailable();
    }
};

/** 开局预加载 SDK，第一次点广告时少等一会儿。 */
export function preloadRewardAd() {
    if (isRewardAdEnabled() && !window.__YUZU_AD_MOCK__) void loadSdk();
}
