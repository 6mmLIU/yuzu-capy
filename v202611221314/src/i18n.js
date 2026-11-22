/**
 * 中英双语。语言按以下顺序决定：
 *   1) 网址参数 ?lang=zh|en（测试用）；
 *   2) 玩家在设置里手动选过的语言；
 *   3) Telegram 账号的 language_code（zh 开头 → 中文）；
 *   4) 浏览器语言。
 * 其余情况一律英文。Node 自检环境下默认中文，保持原有数值文案。
 */
const LANG_KEY = "yuzuTg:lang";

function detect() {
    if (typeof window === "undefined") return "zh";
    try {
        const query = new URLSearchParams(window.location.search).get("lang");
        if (query === "zh" || query === "en") return query;
    } catch (error) {
        /* ignore */
    }
    try {
        const saved = window.localStorage.getItem(LANG_KEY);
        if (saved === "zh" || saved === "en") return saved;
    } catch (error) {
        /* ignore */
    }
    let code = "";
    try {
        const tg = window.Telegram && window.Telegram.WebApp;
        const user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
        code = (user && user.language_code) || "";
    } catch (error) {
        /* ignore */
    }
    if (!code && typeof navigator !== "undefined") code = navigator.language || "";
    return /^zh/i.test(code) ? "zh" : "en";
}

export const LANG = detect();
export const IS_ZH = LANG === "zh";

/** 按当前语言二选一：L("中文", "English") */
export function L(zh, en) {
    return IS_ZH ? zh : en;
}

/** 切换语言：记住选择并重新加载页面（界面文字在挂载时生成）。 */
export function switchLang(next, beforeReload) {
    try {
        window.localStorage.setItem(LANG_KEY, next);
    } catch (error) {
        /* ignore */
    }
    if (typeof beforeReload === "function") beforeReload();
    const url = new URL(window.location.href);
    url.searchParams.delete("lang");
    window.location.replace(url.toString());
}

if (typeof document !== "undefined") {
    document.documentElement.lang = IS_ZH ? "zh-CN" : "en";
}
