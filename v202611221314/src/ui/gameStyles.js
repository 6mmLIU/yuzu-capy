/** 面板、弹窗和战场按钮的样式。首屏就要显示，所以由入口尽早写入。 */
const CSS = `
.hud-top { right: 54px; }
.hud-capsule { position: relative; justify-content: flex-end; box-sizing: border-box; font-size: 13px; }
.hud-capsule--orange { width: 84px; min-width: 84px; flex: 0 0 84px; padding: 0 7px 0 24px; }
.hud-capsule--gem { width: 62px; min-width: 62px; margin-left: 13px; flex: 0 0 62px; padding: 0 5px 0 21px; }
.hud-capsule__icon { position: absolute; left: -3px; top: -3px; width: 30px; height: 30px; margin: 0; }
.hud-capsule--gem .hud-capsule__icon { width: 26px; height: 26px; top: -1px; left: -2px; }
.hud-progress { min-width: 0; }
.hud-toasts { z-index: 40; }
.hud-card__costText { transform: translate(calc(-50% + 9px), -50%); }
.hud-card.is-maxed .hud-card__costText { transform: translate(-50%, -50%); }
.hud-card__costText.is-long { font-size: 12px; }
.hud-card.is-bump { animation: hud-card-bump 0.22s ease-out; }
@keyframes hud-card-bump { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }
.hud-progress.is-boss .hud-progress__fill, .hud-progress.is-boss.is-full .hud-progress__fill { background: rgb(255,179,166); }
.hud-progress.is-hurry { animation: hud-hurry 0.8s ease-in-out infinite; }
.hud-progress.is-hurry .hud-progress__label { color: #e5484d; }
@keyframes hud-hurry { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
.boot-advice { position: absolute; left: 24px; right: 24px; bottom: calc(var(--pm-safe-bottom) + 24px); color: #5f4a35; font-size: 11px; line-height: 1.55; text-align: center; }
.boot-advice b { display: block; margin-bottom: 2px; font-size: 12px; }
.ui-root { position: absolute; inset: 0; z-index: 30; pointer-events: none; color: var(--ink); font-weight: 800; }
.ui-root button { font: inherit; color: inherit; cursor: pointer; pointer-events: auto; -webkit-tap-highlight-color: transparent; }
.ui-root button:active { transform: scale(.94); }
.ui-outline { color: #fff; text-shadow: 0 1px 0 var(--ink), 1px 0 0 var(--ink), -1px 0 0 var(--ink), 0 -1px 0 var(--ink), 1px 1px 0 var(--ink), -1px 1px 0 var(--ink), 1px -1px 0 var(--ink), -1px -1px 0 var(--ink), 0 2px 0 var(--ink); }
.ui-gear { position: absolute; top: calc(var(--pm-safe-top) + 8px); right: 12px; width: 34px; height: 34px; padding: 0; border: 3px solid var(--ink); border-radius: 50%; background: #fffdf6; box-shadow: 0 3px 0 rgba(74,53,36,.35); }
.ui-gear::before { content: ""; position: absolute; left: 7px; top: 7px; width: 14px; height: 14px; border: 4px dotted var(--ink); border-radius: 50%; box-sizing: border-box; }
.ui-gear::after { content: ""; position: absolute; left: 11px; top: 11px; width: 6px; height: 6px; border-radius: 50%; background: var(--ink); }
.ui-float { position: absolute; inset: 0; pointer-events: none; }
.ui-round { position: absolute; width: 50px; height: 50px; padding: 0; border: 3px solid var(--ink); border-radius: 50%; box-shadow: 0 4px 0 rgba(74,53,36,.35); display: flex; align-items: center; justify-content: center; }
.ui-round img { width: 32px; height: 32px; object-fit: contain; }
.ui-round > span { position: absolute; left: -10px; right: -10px; top: 46px; font-size: 12px; line-height: 16px; text-align: center; }
.ui-side-cards { right: 8px; bottom: calc(var(--pm-safe-bottom) + 274px); background: var(--butter); }
.ui-side-pals { right: 8px; bottom: calc(var(--pm-safe-bottom) + 208px); background: var(--sky); }
.ui-side-camp { right: 8px; bottom: calc(var(--pm-safe-bottom) + 142px); background: var(--mint); }
.ui-badge { position: absolute; right: -8px; top: -9px; min-width: 22px; height: 22px; border: 2.5px solid var(--ink); border-radius: 11px; background: var(--red); color: #fff; font-size: 12px; line-height: 17px; text-align: center; animation: ui-bob .8s ease-in-out infinite; }
.ui-badge.is-dot { min-width: 13px; width: 13px; height: 13px; right: -3px; top: -5px; }
.ui-ult { left: 10px; bottom: calc(var(--pm-safe-bottom) + 146px); width: 66px; height: 66px; background: #fffdf6; }
.ui-ult.is-ready { background: var(--butter); animation: ui-pulse .7s ease-in-out infinite; }
.ui-ult::before { content: ""; position: absolute; inset: 2px; border-radius: 50%; background: conic-gradient(var(--orange) calc(var(--ult) * 1turn), transparent 0); -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px)); mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 5px)); }
.ui-ult img { width: 42px; height: 42px; opacity: .45; position: relative; }
.ui-ult.is-ready img { opacity: 1; }
.ui-ult > span { top: 63px; }
.ui-buff-time { position: absolute; left: 10px; bottom: calc(var(--pm-safe-bottom) + 222px); width: 92px; height: 24px; border: 3px solid var(--ink); border-radius: 12px; background: var(--orange); box-sizing: border-box; font-size: 12px; line-height: 18px; text-align: center; box-shadow: 0 2px 0 rgba(74,53,36,.35); }
.ui-pill { position: absolute; right: -12px; width: 118px; height: 44px; padding: 0 22px 0 8px; border: 3px solid var(--ink); border-radius: 22px; font-size: 15px; box-shadow: 0 4px 0 rgba(74,53,36,.35); }
.ui-pill-go { bottom: calc(var(--pm-safe-bottom) + 334px); background: var(--orange); animation: ui-nudge 1.2s ease-in-out infinite; }
.ui-pill-buff { bottom: calc(var(--pm-safe-bottom) + 388px); background: var(--butter); }
.ui-mark { display: inline-block; width: 0; height: 0; margin-right: 5px; border-left: 9px solid var(--ink); border-top: 6px solid transparent; border-bottom: 6px solid transparent; vertical-align: -1px; }
.ui-scrim { position: absolute; inset: 0; pointer-events: none; }
.ui-scrim.is-open { pointer-events: auto; }
.ui-panel { position: absolute; left: 0; right: 0; bottom: 0; height: calc(372px + var(--pm-safe-bottom)); border-top: 3px solid var(--ink); border-radius: 20px 20px 0 0; background: var(--paper); box-shadow: 0 -4px 0 rgba(74,53,36,.18); box-sizing: border-box; transform: translateY(102%); transition: transform .24s cubic-bezier(.2,.8,.2,1); pointer-events: auto; }
.ui-scrim.is-open .ui-panel { transform: translateY(0); }
.ui-tabs { position: absolute; left: 10px; right: 48px; top: 8px; display: flex; gap: 7px; }
.ui-tab { flex: 1; height: 40px; border: 3px solid var(--ink); border-radius: 14px; background: var(--paper2); color: var(--muted); font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 4px; }
.ui-tab.is-on { background: var(--butter); color: var(--ink); box-shadow: 0 3px 0 rgba(74,53,36,.35); }
.ui-tab img { width: 24px; height: 24px; object-fit: contain; opacity: .6; }
.ui-tab.is-on img { opacity: 1; }
.ui-close { position: absolute; right: 8px; top: 9px; width: 38px; height: 38px; padding: 0; border: 3px solid var(--ink); border-radius: 50%; background: var(--coral); font-size: 22px; line-height: 28px; }
.ui-page { position: absolute; left: 10px; right: 10px; top: 58px; height: 302px; }
.ui-cardgrid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
.ui-cardcell { position: relative; aspect-ratio: 1 / 1.12; padding: 0; border: 3px solid var(--ink); border-radius: 12px; background: var(--paper2); box-shadow: 0 2px 0 rgba(74,53,36,.3); }
.ui-cardcell.has-level { background: #fffdf6; }
.ui-cardcell.is-selected { background: var(--butter); transform: translateY(-3px); }
.ui-cardcell img { position: absolute; left: 19%; top: 11%; width: 62%; height: 58%; object-fit: contain; opacity: .28; }
.ui-cardcell.has-level img { opacity: 1; }
.ui-pips { display: flex; gap: 2px; justify-content: center; }
.ui-pips i { width: 6px; height: 6px; border: 1.5px solid var(--ink); border-radius: 50%; background: #ddd2b8; box-sizing: border-box; }
.ui-pips i.is-on { background: var(--orange); }
.ui-cardcell .ui-pips { position: absolute; left: 0; right: 0; bottom: 3px; gap: 1px; }
.ui-cardcell .ui-pips i { width: 5px; height: 5px; border-width: 1px; }
.ui-info { position: absolute; left: 0; right: 0; top: 122px; bottom: 46px; border: 2px solid var(--ink); border-radius: 12px; background: #fffdf6; padding: 10px; box-sizing: border-box; font-size: 13px; line-height: 1.35; color: var(--muted); }
.ui-info.no-action { bottom: 0; }
.ui-info b { display: block; margin-bottom: 4px; font-size: 14px; color: var(--ink); }
.ui-btn { height: 38px; border: 3px solid var(--ink); border-radius: 15px; background: var(--green); font-size: 14px; box-shadow: 0 3px 0 rgba(74,53,36,.35); padding: 0 8px; white-space: nowrap; }
.ui-btn.is-yellow { background: var(--butter); }
.ui-btn.is-muted { background: var(--paper2); }
.ui-btn.is-gem { background: var(--gem); }
.ui-btn.is-red { background: var(--red); color: #fff; }
.ui-btn img { width: 18px; height: 18px; object-fit: contain; vertical-align: -4px; margin-right: 2px; }
.ui-pick-action { position: absolute; left: 50%; bottom: 0; width: 140px; margin-left: -70px; }
.ui-pals { display: grid; grid-template-rows: repeat(4, 1fr); gap: 6px; height: 100%; }
.ui-pal { position: relative; border: 3px solid var(--ink); border-radius: 16px; background: #fffdf6; box-shadow: 0 2px 0 rgba(74,53,36,.3); min-height: 0; }
.ui-palicon { position: absolute; left: 7px; top: 50%; width: 48px; height: 48px; margin-top: -24px; border: 3px solid var(--ink); border-radius: 50%; background: var(--paper2); box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
.ui-pal.has-level .ui-palicon { background: var(--sky); }
.ui-palicon img { width: 38px; height: 38px; object-fit: contain; opacity: .3; }
.ui-pal.has-level .ui-palicon img { opacity: 1; }
.ui-palname { position: absolute; left: 62px; top: 13px; font-size: 14px; display: flex; align-items: center; gap: 8px; }
.ui-paldesc { position: absolute; left: 62px; right: 106px; top: 35px; font-size: 11px; line-height: 1.2; color: var(--muted); }
.ui-palacts { position: absolute; right: 7px; top: 50%; width: 96px; transform: translateY(-50%); display: flex; flex-direction: column; gap: 3px; }
.ui-palacts .ui-btn { width: 100%; height: 28px; padding: 0 2px; border-radius: 11px; font-size: 12px; box-shadow: none; }
.ui-camp { display: flex; gap: 8px; height: 100%; }
.ui-spring { position: relative; flex: 0 0 55%; overflow: hidden; border: 3px solid var(--ink); border-radius: 16px; background: rgb(214,239,180); }
.ui-water { position: absolute; left: 6%; right: 6%; top: 32%; height: 60%; border: 3px solid var(--ink); border-radius: 50%; background: rgb(169,227,236); box-sizing: border-box; }
.ui-soak { position: absolute; left: 0; right: 0; top: 0; height: calc(62% + 4px); overflow: hidden; pointer-events: none; }
.ui-soak img { position: absolute; width: auto; object-fit: contain; animation: ui-soak 1.8s ease-in-out infinite; }
.ui-steam { position: absolute; z-index: 1; width: 10px; height: 10px; border-radius: 50%; background: #fff; top: 44%; animation: ui-steam 3s linear infinite; }
.ui-basket { position: relative; flex: 1; border: 3px solid var(--ink); border-radius: 16px; background: #fffdf6; text-align: center; padding: 8px; box-sizing: border-box; }
.ui-basket > img { display: block; width: 52px; height: 58px; object-fit: contain; margin: 2px auto 0; }
.ui-basket strong { display: block; margin-top: 6px; font-size: 20px; }
.ui-meter { height: 9px; margin: 8px 2px; border: 2px solid var(--ink); border-radius: 7px; background: #fff; overflow: hidden; }
.ui-meter i { display: block; height: 100%; width: 0; background: var(--orange); }
.ui-basket p { margin: 0; font-size: 11px; line-height: 1.35; color: var(--muted); white-space: pre-line; }
.ui-collect { position: absolute; left: 8px; right: 8px; bottom: 8px; display: flex; gap: 6px; }
.ui-collect .ui-btn { flex: 1; min-width: 0; height: 34px; padding: 0 2px; font-size: 13px; }
.ui-banner { position: absolute; left: 11%; right: 11%; top: 30%; height: 64px; border: 3px solid var(--ink); border-radius: 20px; background: var(--green); box-shadow: 0 5px 0 rgba(74,53,36,.35); text-align: center; animation: ui-banner 2.1s both; }
.ui-banner.is-warn { background: var(--red); }
.ui-banner b { display: block; margin-top: 7px; font-size: 23px; line-height: 28px; }
.ui-banner span { display: block; color: #fff; font-size: 13px; line-height: 18px; }
.ui-mask { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding-bottom: 8%; box-sizing: border-box; background: rgba(74,53,36,.38); pointer-events: auto; }
.ui-mask[hidden], .ui-admask[hidden] { display: none; }
.ui-dialog { position: relative; width: min(calc(100% - 28px), 360px); border: 3px solid var(--ink); border-radius: 24px; outline: 3px solid #fff; outline-offset: -8px; background: var(--paper); box-shadow: 0 7px 0 rgba(74,53,36,.35); box-sizing: border-box; padding: 34px 16px 16px; animation: ui-dialog .22s ease-out; }
.ui-dialog.is-small { width: min(calc(100% - 40px), 330px); }
.ui-dialog.is-settings { width: min(calc(100% - 40px), 320px); }
.ui-title { position: absolute; left: 50%; top: -22px; min-width: 56%; height: 44px; padding: 0 24px; border: 3px solid var(--ink); border-radius: 13px; background: var(--green); box-sizing: border-box; box-shadow: 0 4px 0 rgba(74,53,36,.35); transform: translateX(-50%); font-size: 20px; line-height: 38px; text-align: center; white-space: nowrap; }
.ui-sub { margin: 0 0 8px; color: var(--muted); font-size: 13px; line-height: 1.35; text-align: center; white-space: pre-line; }
.ui-picks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.ui-pick { position: relative; height: 164px; padding: 8px 5px 4px; border: 3px solid var(--ink); border-radius: 16px; background: #fff3ee; box-shadow: 0 4px 0 rgba(74,53,36,.35); }
.ui-pick:nth-child(2) { background: #f0f9ff; }
.ui-pick:nth-child(3) { background: #f1fbf0; }
.ui-pick img { display: block; width: 52px; height: 52px; object-fit: contain; margin: 0 auto 4px; }
.ui-pick b { display: block; font-size: 14px; line-height: 18px; }
.ui-pick .ui-pips { margin: 4px 0; }
.ui-pick small { display: block; color: var(--muted); font-size: 11px; line-height: 1.25; }
.ui-new { position: absolute; left: -7px; top: -9px; padding: 0 5px; border: 2px solid var(--ink); border-radius: 9px; background: var(--red); color: #fff; font-size: 11px; line-height: 14px; }
.ui-actions { display: flex; justify-content: center; gap: 10px; margin-top: 14px; }
.ui-actions .ui-btn { flex: 0 1 150px; min-width: 0; }
.ui-settings-info { margin-top: 10px; text-align: center; }
.ui-age-tip { color: #a9825b; font-size: 12px; line-height: 1.4; }
.ui-health-toggle { display: block; height: 30px; margin: 6px auto 0; padding: 0 10px; border-radius: 12px; font-size: 12px; box-shadow: none; }
.ui-health-text { margin: 8px -10px 0; color: var(--muted); font-size: 9px; line-height: 1.45; text-align: center; overflow-wrap: break-word; }
.ui-health-text[hidden] { display: none; }
@media (min-width: 360px) { .ui-health-text { font-size: 10px; } }
.ui-gain { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 58px; font-size: 28px; }
.ui-gain img { width: 46px; height: 46px; object-fit: contain; }
.ui-hero-cheer { position: absolute; right: -8px; top: -58px; width: 70px; height: 70px; object-fit: contain; transform: rotate(7deg); }
.ui-row { position: relative; min-height: 42px; margin-bottom: 6px; border: 2px solid var(--ink); border-radius: 12px; background: #fffdf6; display: flex; align-items: center; justify-content: space-between; padding: 0 6px 0 12px; box-sizing: border-box; font-size: 15px; }
.ui-row .ui-btn { min-width: 62px; height: 32px; border-radius: 12px; }
.ui-volume { display: block; padding: 7px 10px; }
.ui-volume-head { display: flex; justify-content: space-between; font-size: 15px; margin-bottom: 4px; }
.ui-volume-line { display: flex; align-items: center; gap: 8px; }
.ui-volume-line button { width: 26px; height: 24px; padding: 0; border: 3px solid var(--ink); border-radius: 9px; background: var(--paper2); line-height: 14px; }
.ui-volume input { flex: 1; min-width: 0; accent-color: var(--orange); pointer-events: auto; }
.ui-admask { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(74,53,36,.6); pointer-events: auto; font-size: 18px; }
@keyframes ui-bob { 50% { transform: translateY(-2px); } }
@keyframes ui-pulse { 50% { transform: scale(1.035); } }
@keyframes ui-nudge { 50% { transform: translateX(-3px); } }
@keyframes ui-soak { 50% { transform: translateY(-2px); } }
@keyframes ui-steam { from { transform: translateY(0) scale(.7); opacity: .8; } to { transform: translateY(-46px) scale(1.2); opacity: 0; } }
@keyframes ui-dialog { from { transform: scale(.72); opacity: .4; } to { transform: scale(1); opacity: 1; } }
@keyframes ui-banner { 0% { transform: translateX(-120%); } 14%, 80% { transform: translateX(0); } 100% { transform: translateX(125%); } }
`;

export function installGameStyles() {
    if (document.getElementById("yuzu-game-styles")) return;
    document.documentElement.style.setProperty("--butter", "#ffe28c");
    document.documentElement.style.setProperty("--sky", "#a8dcf6");
    document.documentElement.style.setProperty("--mint", "#9fe8cc");
    document.documentElement.style.setProperty("--coral", "#ffb7a6");
    const style = document.createElement("style");
    style.id = "yuzu-game-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
}
