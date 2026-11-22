/**
 * 统一把 manifest / public 下的图片挂到 DOM：支持 SVG（内联）与 PNG/WebP/JPEG 等（<img>）。
 * 资源重绘可能把 `.svg` 换成 `.webp`/`.png`，业务须用本工具或 `getAsset` + 按扩展名分支，禁止写死仅 SVG 的 fetch+innerHTML。
 */
import { appendCacheBust } from "../utils/assetCacheBust.js";
import { manifestPathToUrl } from "./publicAsset.js";
export function inferPublicImageKind(pathOrUrl) {
    const base = (pathOrUrl || '').split(/[?#]/)[0] || '';
    return /\.svg$/i.test(base) ? 'svg' : 'raster';
}
function resolveFetchUrl(pathOrUrl) {
    if (/^(https?:|data:)/i.test(pathOrUrl))
        return pathOrUrl;
    return manifestPathToUrl(pathOrUrl);
}
/**
 * 将 public/manifest 路径对应的媒体注入 `host`：SVG 走 fetch+内联，位图走 `<img>`。
 */
export async function injectPublicImage(host, pathOrUrl, options) {
    const url = resolveFetchUrl(pathOrUrl);
    const kind = inferPublicImageKind(pathOrUrl);
    if (options?.clear !== false) {
        host.textContent = '';
    }
    if (kind === 'svg') {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok)
            throw new Error(`injectPublicImage: ${res.status} ${url}`);
        const markup = await res.text();
        host.innerHTML = markup;
        const svg = host.querySelector('svg');
        if (svg && options?.className)
            svg.setAttribute('class', options.className);
        if (svg && options?.alt) {
            svg.setAttribute('role', 'img');
            svg.setAttribute('aria-label', options.alt);
        }
        return;
    }
    const img = document.createElement('img');
    img.src = appendCacheBust(url);
    img.alt = options?.alt ?? '';
    img.decoding = 'async';
    if (options?.className)
        img.className = options.className;
    host.appendChild(img);
}
/**
 * @deprecated 语义已扩展为任意 manifest 图片，请改用 {@link injectPublicImage}。
 * 行为与 `injectPublicImage` 相同。
 */
export const injectPublicSvg = injectPublicImage;
