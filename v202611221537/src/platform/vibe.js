/**
 * 震动反馈。Telegram 里用 HapticFeedback（iPhone 也能震），其他环境退回 navigator.vibrate。
 * 战斗震动只在玩家刚碰过屏幕时触发，挂机时手机不会一直震。
 */
import { telegramHaptic } from "./telegram.js";

const GAP = { light: 0.11, medium: 0.22, heavy: 0.3 };
const DURATION = { light: 10, medium: 20, heavy: 35 };

export function createVibe(save) {
    const lastAt = {};
    let lastTouch = -99;
    const now = () => performance.now() / 1000;
    return {
        touched() {
            lastTouch = now();
        },
        play(kind, combat) {
            if (!save || save.vibe === false) return;
            const time = now();
            if (combat && time - lastTouch > 2.5) return;
            if (time - (lastAt[kind] === undefined ? -9 : lastAt[kind]) < (GAP[kind] || 0.2)) return;
            lastAt[kind] = time;
            try {
                if (telegramHaptic(kind)) return;
                if (navigator.vibrate) navigator.vibrate(DURATION[kind] || 15);
            } catch (error) {
                /* 震动失败不影响游戏 */
            }
        },
    };
}
