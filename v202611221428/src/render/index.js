/**
 * render 模块统一出口。
 * 当前只提供屏幕适配与战斗区布局；具体场景绘制在后续步骤接入。
 */
export { computeLayout, VIEWPORT } from "./layout.js";
export { OrchardRenderer } from "./orchardRenderer.js";
export { IMAGE_IDS, IMAGE_PATHS, createImageStore, imageUrl } from "./images.js";
