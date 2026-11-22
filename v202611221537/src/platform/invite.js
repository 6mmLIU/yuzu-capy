/**
 * 邀请好友（不需要服务器）。
 * - 邀请链接：https://t.me/YuzuCapyBot/play?startapp=r<邀请人 Telegram ID>
 * - 好友通过链接第一次打开：给好友见面礼（存档 refGift 记录，只给一次）。
 * - 分享的人：每天第一次分享得一次奖励（存档 shareDay 记录日期）。
 *   Telegram 的云存储是每个玩家各自一份，没有服务器就无法知道好友是否真的打开了，
 *   所以分享奖励按“分享了”发，而不是按“好友来了”发。
 */
import { TELEGRAM_CONFIG } from "../config/telegram.js";
import { getWebApp, inTelegram, versionAtLeast } from "./telegram.js";

const REF_PREFIX = "r";

function selfId() {
    const tg = getWebApp();
    const user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    return user && user.id ? String(user.id) : "";
}

/** 本次打开带来的邀请人 ID；不是邀请链接、或者是自己的链接时返回 null。 */
export function readReferrer() {
    const tg = getWebApp();
    const param = tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param;
    if (typeof param !== "string" || !param.startsWith(REF_PREFIX)) return null;
    const id = param.slice(REF_PREFIX.length);
    if (!/^\d{3,20}$/.test(id) || id === selfId()) return null;
    return id;
}

export function inviteLink() {
    const id = selfId();
    const base = TELEGRAM_CONFIG.miniAppLink;
    return id ? `${base}?startapp=${REF_PREFIX}${id}` : base;
}

/** 本地日期 YYYY-MM-DD，用来判断“今天分享过没有”。 */
export function todayKey(date = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function shareRewardAvailable(save) {
    return Boolean(save) && save.shareDay !== todayKey();
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * 打开分享面板。返回 "telegram" | "native" | "copied" | ""（失败）。
 * Telegram 里用 t.me/share/url 打开“选择聊天”面板；普通浏览器退回系统分享或复制链接。
 * onShared 在确定能分享时调用：Telegram 里在打开面板之前调用，
 * 因为部分客户端（如 Mac 版）打开面板时会关掉小程序，之后的代码可能来不及执行。
 */
export async function shareInvite(text, onShared) {
    const done = (how) => {
        if (how && typeof onShared === "function") onShared(how);
        return how;
    };
    const link = inviteLink();
    const tg = getWebApp();
    if (tg && inTelegram() && versionAtLeast("6.1") && typeof tg.openTelegramLink === "function") {
        const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
        done("telegram");
        try {
            tg.openTelegramLink(url);
            return "telegram";
        } catch (error) {
            /* 退回下面的方式 */
        }
    }
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
            await navigator.share({ text, url: link });
            return done("native");
        } catch (error) {
            if (error && error.name === "AbortError") return "";
        }
    }
    return done((await copyText(`${text} ${link}`)) ? "copied" : "");
}
