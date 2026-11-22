// 入口：写好项目配置后再启动游戏，失败时把原因打在控制台。
window.__PM_PROJECT_CONFIGS__ = Object.create(null);
window.__PM_PROJECT_CONFIGS__["src/runtime/project-meta.json"] = { projectId: "yuzu-capy-telegram" };
import("./main.js").catch(function (error) {
    console.error(error);
});
