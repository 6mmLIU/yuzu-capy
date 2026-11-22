/**
 * Telegram 版平台配置。
 *
 * adsgramBlockId：在 https://partner.adsgram.ai 创建 Reward 类型广告位后复制的 Block ID（纯数字字符串，如 "12345"）。
 *   留空时游戏里不显示任何看广告按钮。
 * adsgramDebug：true 时 Adsgram 只播测试广告、不计收益，用来联调；正式上线前改回 false。
 *   不改代码也能联调：用 https://t.me/YuzuCapyBot/play?startapp=addebug 打开，只对这次打开生效。
 */
export const TELEGRAM_CONFIG = Object.freeze({
    adsgramBlockId: "61312",
    // Adsgram 测试平台“Yuzu Capy Strike (test)”上的广告位：不用审核、不计收益，只在 ?startapp=addebug 时使用。
    adsgramTestBlockId: "61314",
    adsgramDebug: false,
    // 邀请好友：小程序直达链接、好友见面礼和每天第一次分享的奖励（宝石）。
    miniAppLink: "https://t.me/YuzuCapyBot/play",
    inviteGiftGems: 20,
    shareRewardGems: 10,
});
