/**
 * 项目 ID 运行时注入。
 *
 * 以「副作用导入」方式在入口最早期把项目 ID 写到 `window.__PROJECT_ID__`，
 * 使 dist 真实跑起来后，浏览器里可直接读取到当前游戏对应的项目 ID
 * （例如排查问题、上报、对外集成时定位是哪一个项目实例）。
 *
 * 取值优先级：
 *   1) 平台预注入的 `window.__PROJECT_ID__`（已有值则尊重，不覆盖）；
 *   2) 构建时写入的 `src/runtime/project-meta.json` 的 `projectId`（创建项目时由平台填入真实 ID）。
 */
import projectConfig from "./project-meta.js";
/** 读取构建期写入的项目 ID（模板默认为空字符串）。 */
function resolveProjectId() {
    try {
        const injected = window.__PROJECT_ID__;
        if (injected)
            return String(injected);
    }
    catch {
        /* 取不到注入值时静默回退到配置文件 */
    }
    const fromConfig = projectConfig?.projectId;
    return fromConfig ? String(fromConfig) : '';
}
const PROJECT_ID = resolveProjectId();
try {
    ;
    window.__PROJECT_ID__ = PROJECT_ID;
}
catch {
    /* 极端环境下 window 不可写时静默忽略，绝不影响游戏运行 */
}
/** 获取当前项目 ID（无则返回空字符串）。 */
export function getProjectId() {
    return PROJECT_ID;
}
