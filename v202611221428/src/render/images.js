/**
 * 图片加载与扩展名解析。
 * 资源清单（public/data/asset_manifest.json）已经记录了每张图当前的实际格式，
 * 代码只按基础名取图，平台把 png 转成 webp 时不需要改业务。
 */
import { publicAsset } from "../ui/publicAsset.js";
import { assetUrl } from "../utils/renderAsset.js";

/** 基础名 → 兜底路径（清单不可用时仍能按当前磁盘文件取图）。 */
export const IMAGE_PATHS = {
    hero_idle: "images/hero_idle.webp",
    hero_cheer: "images/hero_cheer.webp",
    h_body: "images/h_body.webp",
    h_head: "images/h_head.webp",
    h_torso: "images/h_torso.webp",
    h_yuzu: "images/h_yuzu.png",
    h_sling: "images/h_sling.png",
    h_foot: "images/h_foot.png",
    h_paw: "images/h_paw.png",
    e_mushroom: "images/e_mushroom.webp",
    e_boar: "images/e_boar.webp",
    e_turtle: "images/e_turtle.webp",
    e_slime: "images/e_slime.webp",
    e_squirrel: "images/e_squirrel.webp",
    e_crow: "images/e_crow.webp",
    b_boar: "images/b_boar.webp",
    b_frog: "images/b_frog.webp",
    b_yeti: "images/b_yeti.webp",
    p_duck: "images/p_duck.png",
    p_duck_atk: "images/p_duck_atk.png",
    p_cat: "images/p_cat.webp",
    p_cat_atk: "images/p_cat_atk.webp",
    p_owl: "images/p_owl.png",
    p_owl_atk: "images/p_owl_atk.webp",
    p_monkey: "images/p_monkey.webp",
    p_monkey_atk: "images/p_monkey_atk.webp",
    p_cat_walk: "images/p_cat_walk.webp",
    p_monkey_walk: "images/p_monkey_walk.webp",
    p_owl_walk: "images/p_owl_walk.webp",
    s_otree1: "images/s_otree1.webp",
    s_otree2: "images/s_otree2.png",
    s_crate: "images/s_crate.png",
    s_fence: "images/s_fence.png",
    s_bamboo1: "images/s_bamboo1.webp",
    s_bamboo2: "images/s_bamboo2.png",
    s_boulder: "images/s_boulder.png",
    s_lantern: "images/s_lantern.png",
    s_pine1: "images/s_pine1.png",
    s_pine2: "images/s_pine2.png",
    s_snowrock: "images/s_snowrock.png",
    s_snowman: "images/s_snowman.png",
    ico_orange: "images/ico_orange.png",
    ico_stack: "images/ico_stack.png",
    ico_gem: "images/ico_gem.png",
    ico_atk: "images/ico_atk.png",
    ico_spd: "images/ico_spd.png",
    ico_inc: "images/ico_inc.png",
    ico_heart: "images/ico_heart.png",
    ico_spring: "images/ico_spring.png",
    ico_ricochet: "images/ico_ricochet.png",
    ico_split: "images/ico_split.png",
    ico_pierce: "images/ico_pierce.png",
    ico_crit: "images/ico_crit.png",
    ico_boom: "images/ico_boom.png",
    ico_ice: "images/ico_ice.png",
    ico_poison: "images/ico_poison.png",
    ico_energy: "images/ico_energy.png",
    i_yuzu: "images/i_yuzu.png",
    i_acorn: "images/i_acorn.png",
    i_snowball: "images/i_snowball.png",
    i_feather: "images/i_feather.png",
    i_bigyuzu: "images/i_bigyuzu.png",
    i_bucket: "images/i_bucket.png",
    i_basket: "images/i_basket.png",
    i_grass: "images/i_grass.png",
    i_pebbles: "images/i_pebbles.png",
};

export const IMAGE_IDS = Object.keys(IMAGE_PATHS);

/** 优先用清单注册的 URL；清单缺失时回退到当前磁盘路径。 */
export function imageUrl(id) {
    return assetUrl(id) || publicAsset(IMAGE_PATHS[id]);
}

export function createImageStore() {
    const loaded = new Map();
    const store = {
        total: 0,
        loaded: 0,
        loadAll(ids, onProgress) {
            const list = ids || IMAGE_IDS;
            store.total = list.length;
            store.loaded = 0;
            if (onProgress) onProgress(0);
            return Promise.all(list.map((id) => loadOne(id, (progress) => {
                store.loaded += 1;
                if (onProgress) onProgress(progress);
            })));
        },
        get(id) {
            return loaded.get(id) || null;
        },
        has(id) {
            return loaded.has(id);
        },
        ar(id) {
            const img = loaded.get(id);
            if (!img || !img.naturalHeight) return 1;
            return img.naturalWidth / img.naturalHeight;
        },
        url: imageUrl,
    };

    function loadOne(id, done) {
        return new Promise((resolve) => {
            let settled = false;
            const image = new Image();
            const finish = (ok) => {
                if (settled) return;
                settled = true;
                if (ok && image.naturalWidth > 0) loaded.set(id, image);
                else console.warn("[image] 加载失败", id);
                done(store.total ? store.loaded / store.total : 0);
                resolve(ok);
            };
            image.onload = () => finish(true);
            image.onerror = () => finish(false);
            image.src = imageUrl(id);
            if (image.complete) {
                // 缓存命中时 onload 可能已经错过。
                if (image.naturalWidth > 0) finish(true);
            }
        });
    }

    return store;
}
