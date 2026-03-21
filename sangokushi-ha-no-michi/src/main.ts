import { Game } from './game';
import { loadImages } from './renderer';

// アセットのインポート
import guanYuPortrait from './assets/portraits/guan_yu_portrait.png';
import zhangFeiPortrait from './assets/portraits/zhang_fei_portrait.png';
import zhaoYunPortrait from './assets/portraits/zhao_yun_portrait.png';
import zhugeLiangPortrait from './assets/portraits/zhuge_liang_portrait.png';
import caoCaoPortrait from './assets/portraits/cao_cao_portrait.png';
import luBuPortrait from './assets/portraits/lu_bu_portrait.png';
import liuBeiPortrait from './assets/portraits/liu_bei_portrait.png';
import zhangJiaoPortrait from './assets/portraits/zhang_jiao_portrait.png';
import dongZhuoPortrait from './assets/portraits/dong_zhuo_portrait.png';
import battleBackground from './assets/backgrounds/battle_background2.jpg';
import mapBackground from './assets/backgrounds/map_background.jpg';
import titleBackground from './assets/backgrounds/title_background.jpg';

const IMAGE_PATHS: Record<string, string> = {
  guan_yu_portrait: guanYuPortrait,
  zhang_fei_portrait: zhangFeiPortrait,
  zhao_yun_portrait: zhaoYunPortrait,
  zhuge_liang_portrait: zhugeLiangPortrait,
  cao_cao_portrait: caoCaoPortrait,
  lu_bu_portrait: luBuPortrait,
  liu_bei_portrait: liuBeiPortrait,
  zhang_jiao_portrait: zhangJiaoPortrait,
  dong_zhuo_portrait: dongZhuoPortrait,
  battle_background: battleBackground,
  map_background: mapBackground,
  title_background: titleBackground,
};

async function main() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;

  // 画面サイズ初期設定
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // スマホでタッチ操作がブラウザスクロールに奪われるのを防止
  canvas.style.touchAction = 'none';

  // 画像を先に読み込む
  await loadImages(IMAGE_PATHS);

  const game = new Game(canvas);
  (window as unknown as Record<string, unknown>).__game = game;
  game.start();
}

main();
