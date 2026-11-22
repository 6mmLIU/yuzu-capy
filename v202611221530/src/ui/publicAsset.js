/**
 * 将 manifest / 磁盘上的 `public/...` 路径转为 Vite 预览与 dist 下的合法 URL。
 * 规则见平台资源管线规范（asset pipeline）。
 */
import { appendCacheBust } from "../utils/assetCacheBust.js";
function viteBase() {
    const raw = import.meta.env?.BASE_URL || new URL('../../',import.meta.url).pathname || '/';
    return raw.endsWith('/') ? raw : `${raw}/`;
}
function normalizeToUrlPath(input) {
    let p = (input || '').trim().replace(/\\/g, '/');
    if (!p)
        return '';
    if (p.startsWith('public/'))
        p = p.slice('public/'.length);
    if (p.startsWith('/'))
        p = p.slice(1);
    return p;
}
/** manifest slot 的 `path`（常带 `public/`）→ 运行时 URL */
export function manifestPathToUrl(manifestPath, opts) {
    const rel = normalizeToUrlPath(manifestPath);
    const url = rel ? `${viteBase()}${rel}` : viteBase();
    if (opts?.cacheBust) {
        return appendCacheBust(url);
    }
    return url;
}
/** 已相对于 `public/` 根的路径（可带或不带 `public/` 前缀）→ 运行时 URL */
export function publicAsset(pathUnderPublic) {
    return manifestPathToUrl(pathUnderPublic);
}
