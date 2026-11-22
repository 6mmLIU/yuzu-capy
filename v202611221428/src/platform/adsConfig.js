/**
 * 是否开放看广告按钮。单独成文件，玩法层只依赖这一个判断。
 * 本地预览可以用 window.__YUZU_AD_MOCK__（开发服务器的 ?ad=ok|closed|unavailable）强制打开。
 */
import { TELEGRAM_CONFIG } from "../config/telegram.js";
import { inTelegram } from "./telegram.js";

export function adsgramBlockId() {
    return String(TELEGRAM_CONFIG.adsgramBlockId || "").trim();
}

/** 用 t.me/YuzuCapyBot/play?startapp=addebug 打开时进入广告联调：播测试广告，并跳过“过第 3 关才出现”的限制。 */
export function adDebugMode() {
    try {
        const tg = window.Telegram && window.Telegram.WebApp;
        return Boolean(tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param === "addebug");
    } catch (error) {
        return false;
    }
}

export function isRewardAdEnabled() {
    if (typeof window === "undefined") return false;
    if (window.__YUZU_AD_MOCK__) return true;
    return Boolean(adsgramBlockId()) && inTelegram();
}
