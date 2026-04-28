import { App } from "./app";

const canvas = document.getElementById("game") as HTMLCanvasElement;

// iframe内でキーボードイベントを受け取るためのフォーカス対応
// itch.ioのiframe埋め込みでは window.focus() を明示しないと keydown が届かない
window.focus();
canvas.addEventListener("click", () => window.focus());

const app = new App(canvas);
app.start();

// Dev-only debug hook for Playwright tests / devtools snooping.
if (__DEV__) {
  (window as unknown as { __app: App }).__app = app;
}

