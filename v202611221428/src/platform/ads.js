/**
 * 激励视频入口。平台适配层把播放函数挂到 window.__YUZU_REWARD_AD__，
 * 只有明确返回完整看完时才发奖励；没有广告能力时直接失败，不模拟成功。
 */
export async function showRewardAd(place) {
    const provider = window.__YUZU_REWARD_AD__;
    if (typeof provider !== "function") return { ok: false, msg: "unavailable" };
    try {
        const result = await provider(place);
        if (result === true) return { ok: true };
        return { ok: Boolean(result && result.ok === true), msg: result && result.msg };
    } catch (error) {
        console.warn("[ad] 播放失败", error);
        return { ok: false, msg: "error" };
    }
}
