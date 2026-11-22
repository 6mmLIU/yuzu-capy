/** 构建/预览 cache bust：同路径覆盖替换后避免读到旧 manifest 或位图 */
export function pmBuildCacheToken() {
    try {
        if (typeof window.__PM_BUILD_ID__ === 'string' && window.__PM_BUILD_ID__) {
            return window.__PM_BUILD_ID__;
        }
    }
    catch {
        /* ignore */
    }
    return String(Date.now());
}
export function appendCacheBust(url, token) {
    const base = (url || '').trim();
    if (!base || /^(data:|blob:)/i.test(base))
        return base;
    const v = token ?? pmBuildCacheToken();
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}v=${encodeURIComponent(v)}`;
}
