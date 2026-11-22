/**
 * 统一资源注册：业务按 id 取资源，首轮可用 svg，后续可换 PNG 不改键名。
 * 详见平台资源管线规范（manifest、atlas、首轮占位）
 */
const registry = new Map();
const usedAssets = new Set();
export function registerAsset(key, source) {
    registry.set(key, source);
}
export function getAsset(key) {
    const asset = registry.get(key);
    if (asset)
        usedAssets.add(key);
    return asset;
}
export function clearAssets() {
    registry.clear();
    usedAssets.clear();
}
export function markAssetUsed(key) {
    if (registry.has(key))
        usedAssets.add(key);
}
export function listUsedAssets() {
    return Array.from(usedAssets);
}
export function listRegisteredAssets() {
    return Array.from(registry.entries()).map(([id, source]) => ({
        id,
        source,
        used: usedAssets.has(id),
    }));
}
export function getAtlasFrameStyle(key) {
    const source = registry.get(key);
    if (!source || source.kind !== 'atlas')
        return undefined;
    const { x, y, w, h } = source.frame;
    return {
        backgroundImage: `url(${source.src})`,
        backgroundPosition: `-${x}px -${y}px`,
        backgroundSize: '1024px 1024px',
        width: `${w}px`,
        height: `${h}px`,
    };
}
