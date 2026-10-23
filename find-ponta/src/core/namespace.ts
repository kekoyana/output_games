import { setStorageNamespace } from "./storage";

// i18n / sfx / bgm はモジュール評価時に保存値を読む。ES モジュールは import の評価が先に済むため、
// main.ts でこのファイルを最初に import して、他モジュールの評価より前に名前空間を確定させる。
setStorageNamespace("find-ponta");
