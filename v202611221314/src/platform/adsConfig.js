/**
 * 是否开放看广告按钮。单独成文件，玩法层只依赖这一个判断。
 * 本地预览可以用 window.__YUZU_AD_MOCK__（开发服务器的 ?ad=ok|closed|unavailable）强制打开。
 */
import { TELEGRAM_CONFIG } from "../config/telegram.js";
import { inTelegram } from "./telegram.js";

export function adsgramBlockId() {
    return String(TELEGRAM_CONFIG.adsgramBlockId || "").trim();
}

export function isRewardAdEnabled() {
    if (typeof window === "undefined") return false;
    if (window.__YUZU_AD_MOCK__) return true;
    return Boolean(adsgramBlockId()) && inTelegram();
}
