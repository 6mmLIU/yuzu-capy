/**
 * 屏幕适配与战斗区布局（纯计算，不创建画布）。
 * 对应原版 main.lua 的 layout()：
 * - 竖屏始终铺满宽度，逻辑宽按 360~440 设计；
 * - 横屏/电脑按高度缩放，只显示中间最多 440 宽的一列，两侧留给底色；
 * - 战斗区从顶部安全区 +52 到底部强化卡上方。
 */

export const VIEWPORT = Object.freeze({
    designWidth: 390,
    designHeight: 780,
    minWidth: 360,
    maxWidth: 440,
    minHeight: 700,
    maxHeight: 900,
    sideColor: "#3a2c20",
    topInset: 52,
    upgradeBarHeight: 112,
    upgradeBarGap: 8,
    heroFocusX: 0.5,
    heroFocusY: 0.55,
});

/**
 * @param {object} input
 * @param {number} input.physWidth 画布物理宽（像素）
 * @param {number} input.physHeight 画布物理高（像素）
 * @param {number} [input.dpr] 设备像素比，默认 1
 * @param {number} [input.safeTopPx] 顶部安全区（物理像素）
 * @param {number} [input.safeBottomPx] 底部安全区（物理像素）
 * @returns {object} 逻辑坐标下的画面、安全区、战斗区与主角焦点
 */
export function computeLayout(input) {
    const physWidth = Math.max(1, Number(input.physWidth) || 1);
    const physHeight = Math.max(1, Number(input.physHeight) || 1);
    const baseDpr = Number(input.dpr) > 0 ? Number(input.dpr) : 1;
    const rawWidth = physWidth / baseDpr;
    const rawHeight = physHeight / baseDpr;

    // 竖屏优先铺满宽度；横屏/桌面按高度适配，避免画面过宽。
    const scale = rawWidth <= rawHeight * 0.75
        ? rawWidth / Math.max(VIEWPORT.minWidth, Math.min(rawWidth, VIEWPORT.maxWidth))
        : rawHeight / Math.max(VIEWPORT.minHeight, Math.min(rawHeight, VIEWPORT.maxHeight));

    const dpr = baseDpr * scale;
    const logWidth = physWidth / dpr;
    const logHeight = physHeight / dpr;
    const viewWidth = Math.min(logWidth, VIEWPORT.maxWidth);
    const viewX = (logWidth - viewWidth) / 2;

    const safeTop = Math.max(0, (Number(input.safeTopPx) || 0) / dpr);
    const safeBottom = Math.max(0, (Number(input.safeBottomPx) || 0) / dpr);

    const battleTop = VIEWPORT.topInset + safeTop;
    const battleBottom = logHeight - VIEWPORT.upgradeBarHeight - VIEWPORT.upgradeBarGap - safeBottom;
    const battleHeight = Math.max(0, battleBottom - battleTop);

    return {
        scale,
        dpr,
        physical: { width: physWidth, height: physHeight },
        logical: { width: logWidth, height: logHeight },
        view: { x: viewX, y: 0, width: viewWidth, height: logHeight },
        sideWidth: viewX,
        sideColor: VIEWPORT.sideColor,
        safeTop,
        safeBottom,
        battle: { top: battleTop, bottom: battleBottom, height: battleHeight },
        hero: {
            x: viewWidth * VIEWPORT.heroFocusX,
            y: battleTop + battleHeight * VIEWPORT.heroFocusY,
        },
    };
}
