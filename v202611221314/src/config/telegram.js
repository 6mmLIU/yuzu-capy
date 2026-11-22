/**
 * Telegram 版平台配置。
 *
 * adsgramBlockId：在 https://partner.adsgram.ai 创建 Reward 类型广告位后复制的 Block ID（纯数字字符串，如 "12345"）。
 *   留空时游戏里不显示任何看广告按钮。
 * adsgramDebug：true 时 Adsgram 只播测试广告、不计收益，用来联调；正式上线前改回 false。
 */
export const TELEGRAM_CONFIG = Object.freeze({
    adsgramBlockId: "",
    adsgramDebug: false,
});
