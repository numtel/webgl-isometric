import OrthoView from './OrthoView.js';
import TMXMap from './TMXMap.js';

import { astar, Graph } from './astar.js';

async function loadGame(mapFile) {
  const map = new TMXMap;
  await map.load(mapFile);

  const blockingTiles = new Graph(map.tileMap(
    (layer) => layer.properties.blocking,
    (layer, x, y, tileGid, prev) => 0,
    1));

  const game = new OrthoView({
    fullPage: true,
    objects: map.allObjects(),
    dataValues: {
      // Override default
      TILE_SIZE: 32,
      // Custom values
      HUE_RATE: 300,
      PSYCHE_HUE: -1,
      WAVY: -1,
      FISH: -1,
      LENS: -1,
      FRAME_NUM: 0,
      BLACK_CIRCLE_X: 4,
      BLACK_CIRCLE_Y: 3,
      BLACK_CIRCLE_FRAME: -1,
      BLACK_CIRCLE_LEN: 90,
      BLACK_CIRCLE_RAD: 100,
      MAP_WIDTH: map.width,
      MAP_HEIGHT: map.height,
    },
    chunkMap: {
      map_uniforms: [
          'uniform sampler2D u_under_char;',
          'uniform sampler2D u_above_char;',
        ].join('\n'),
    },
    onFrame(delta) {
      if(game.FRAME_NUM > Math.pow(2, 32)) game.FRAME_NUM = 0;
      else game.FRAME_NUM++;
    },
    onTapOrClick(event, tilePos) {
      if(tilePos.x > 0 && tilePos.x < map.width
          && tilePos.y > 0 && tilePos.y < map.height) {
        // Move character
        const newPath = astar.search(blockingTiles,
          blockingTiles.grid[Math.round(game.character.y)][Math.round(game.character.x)],
          blockingTiles.grid[Math.floor(tilePos.y)][Math.floor(tilePos.x)]);
        if(newPath.length) game.character.curPath = newPath;
        if(game.character2) {
          game.character2.curPath = astar.search(blockingTiles,
            blockingTiles.grid[Math.round(game.character2.y)][Math.round(game.character2.x)],
            blockingTiles.grid[Math.floor(tilePos.y)][Math.floor(tilePos.x)]);
        }
      }
    },
  });

  // Prerendered under/over aggregate textures
  const underCharCanvas = map.draw((layer, index) =>
    !layer.properties.aboveChar && !layer.properties.hidden)
  game.createImageTexture('u_under_char', underCharCanvas);

  const aboveCharCanvas = map.draw((layer, index) =>
    layer.properties.aboveChar && !layer.properties.hidden)
  game.createImageTexture('u_above_char', aboveCharCanvas);

  const retval = { map, game };
  await game.init();
  game.center(game.character.x, game.character.y);

  // Character actions
  const triggers = {
    async msgBox({ text, triggerAnim }) {
      if(triggerAnim) {
        game[triggerAnim].tileXAnim = true;
        game[triggerAnim].onAnimEnd = () => {
          alert(text);
          game[triggerAnim].onAnimEnd = null;
          game[triggerAnim].tileXAnim = false;
        };
      } else alert(text);
    },
    async loadMap({ mapFile, setCharX, setCharY }) {
      const oldGame = retval.game;
      oldGame.BLACK_CIRCLE_X = oldGame.character.x;
      oldGame.BLACK_CIRCLE_Y = oldGame.character.y;
      oldGame.BLACK_CIRCLE_FRAME = game.FRAME_NUM;

      const newMount = await loadGame(mapFile);
      oldGame.stop();
      game.element.parentNode.removeChild(game.element);
      retval.game = newMount.game;
      retval.map = newMount.map;
      newMount.game.character.x = setCharX;
      newMount.game.character.y = setCharY;
      newMount.game.TILE_SIZE = oldGame.TILE_SIZE;
      newMount.game.center(setCharX, setCharY);
    },
  };

  game.character.onArrival = () => {
    for(let key of Object.keys(game.options.objects)) {
      if(game[key].trigger && (game[key].trigger in triggers)
          && game.character.x >= game[key].x
          && game.character.x <= game[key].x + game[key].width
          && game.character.y >= game[key].y
          && game.character.y <= game[key].y + game[key].height) {
        triggers[game[key].trigger](game[key]);
      }
    }
  };

  document.body.append(game.element);
  return retval;
}

window.mount = loadGame('inside.tmx');
