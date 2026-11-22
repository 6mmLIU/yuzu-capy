/**
 * data 模块统一出口。
 * 业务代码只从这里取静态数据，不直接访问 JSON 文件。
 */
export {
    GAME_DATA_URL,
    findById,
    freezeGameData,
    getGameData,
    isGameDataReady,
    loadGameData,
    setGameData,
    validateGameData,
} from "./gameData.js";
