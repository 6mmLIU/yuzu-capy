/**
 * 资源 id 维度的统一加载入口：业务只引用 manifest id，扩展名变化由 injectPublicImage 处理。
 */
import { getAsset } from "./assetRegistry.js";
import { injectPublicImage } from "../ui/injectPublicImage.js";
let _assetsReadyResolve = null;
let _assetsReadyDone = false;
/** manifest 注册完成后 resolve；main.js 在 registerAssetsFromManifest 结束时调用 */
export const assetsReady = new Promise((resolve) => {
    _assetsReadyResolve = resolve;
});
export function markAssetsReady() {
    if (_assetsReadyDone)
        return;
    _assetsReadyDone = true;
    _assetsReadyResolve?.();
    _assetsReadyResolve = null;
}
/** 取运行时 URL（来自 registry）；path/扩展名变更对业务透明 */
export function assetUrl(assetId) {
    const asset = getAsset(assetId);
    if (!asset)
        return undefined;
    if (asset.kind === 'image' || asset.kind === 'atlas')
        return asset.src;
    return undefined;
}
/** DOM 挂载：getAsset(id) → injectPublicImage（自动 svg / 位图） */
export async function renderAssetInto(host, assetId, options) {
    await assetsReady;
    const asset = getAsset(assetId);
    if (!asset || (asset.kind !== 'image' && asset.kind !== 'atlas')) {
        return false;
    }
    try {
        await injectPublicImage(host, asset.src, options);
        return true;
    }
    catch {
        return false;
    }
}
