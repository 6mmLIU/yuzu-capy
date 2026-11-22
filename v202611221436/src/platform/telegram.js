/**
 * Telegram Mini App 外壳：全屏、关闭下拉手势、安全区、颜色和前后台切换。
 * 在普通浏览器里打开时这些调用全部跳过，游戏照常运行。
 */

const BG = "#3a2c20";

export function getWebApp() {
    const tg = typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp;
    return tg || null;
}

/** 真正在 Telegram 客户端里打开（有 initData）。 */
export function inTelegram() {
    const tg = getWebApp();
    return Boolean(tg && tg.initData);
}

export function versionAtLeast(version) {
    const tg = getWebApp();
    try {
        return Boolean(tg && typeof tg.isVersionAtLeast === "function" && tg.isVersionAtLeast(version));
    } catch (error) {
        return false;
    }
}

function call(name, ...args) {
    const tg = getWebApp();
    if (!tg || typeof tg[name] !== "function") return undefined;
    try {
        return tg[name](...args);
    } catch (error) {
        console.warn(`[tg] ${name} 失败`, error && error.message ? error.message : error);
        return undefined;
    }
}

function insetSum(a, b, side) {
    const x = a && Number(a[side]);
    const y = b && Number(b[side]);
    return (Number.isFinite(x) ? x : 0) + (Number.isFinite(y) ? y : 0);
}

/** 把 Telegram 给的安全区写成 --pm-safe-*，HUD 和画布布局都读这组变量。 */
function applySafeArea() {
    const tg = getWebApp();
    if (!tg) return;
    const root = document.documentElement;
    const safe = tg.safeAreaInset || null;
    const content = tg.contentSafeAreaInset || null;
    for (const side of ["top", "bottom", "left", "right"]) {
        root.style.setProperty(`--pm-safe-${side}`, `${insetSum(safe, content, side)}px`);
    }
    // 画布布局在 resize 时重新读取安全区。
    window.dispatchEvent(new Event("resize"));
}

let inited = false;

/**
 * 启动时调用一次。onActive(bool) 在小程序被最小化/恢复时回调（Bot API 8.0+）。
 */
export function initTelegram(options = {}) {
    if (inited) return;
    inited = true;
    const tg = getWebApp();
    if (!tg) return;
    call("expand");
    if (versionAtLeast("7.7")) call("disableVerticalSwipes");
    if (versionAtLeast("6.1")) {
        call("setHeaderColor", BG);
        call("setBackgroundColor", BG);
    }
    if (versionAtLeast("7.10")) call("setBottomBarColor", BG);
    const mobile = tg.platform === "android" || tg.platform === "ios";
    if (mobile && versionAtLeast("8.0")) {
        call("requestFullscreen");
        call("lockOrientation");
    }
    if (typeof tg.onEvent === "function") {
        for (const name of ["safeAreaChanged", "contentSafeAreaChanged", "fullscreenChanged", "viewportChanged"]) {
            tg.onEvent(name, applySafeArea);
        }
        if (typeof options.onActive === "function") {
            tg.onEvent("activated", () => options.onActive(true));
            tg.onEvent("deactivated", () => options.onActive(false));
        }
    }
    applySafeArea();
}

/** 告诉 Telegram 页面已可见，收起它的加载占位。 */
export function telegramReady() {
    call("ready");
}

/** 触感反馈：light / medium / heavy。返回 true 表示已由 Telegram 处理。 */
export function telegramHaptic(kind) {
    const tg = getWebApp();
    if (!tg || !tg.HapticFeedback || !versionAtLeast("6.1")) return false;
    try {
        tg.HapticFeedback.impactOccurred(kind === "heavy" || kind === "medium" ? kind : "light");
        return true;
    } catch (error) {
        return false;
    }
}

/** Telegram 云存储（每个玩家、每个机器人一份；单值最多 4096 字符）。 */
export function getCloudStorage() {
    const tg = getWebApp();
    if (!tg || !tg.CloudStorage || !inTelegram() || !versionAtLeast("6.9")) return null;
    return tg.CloudStorage;
}
