import OrthoView from './OrthoView.js';
import TMXMap from './TMXMap.js';

import { astar, Graph } from './astar.js';

async function loadGame(mapFile) {
  const map = new TMXMap;
  await map.load(mapFile);

  const charTileSet = map.tileSets.find(ts => ts.name === 'character');;

  let curCharPath = null;

  const game = new OrthoView({
    fullPage: true,
    dataValues: {
      // Override default
      TILE_SIZE: 32,
      // Custom values
      FRAME_NUM: 0,
      CHAR_X: map.properties.initCharX,
      CHAR_Y: map.properties.initCharY,
      CHAR_MOVE_X: 0,
      CHAR_MOVE_Y: 0,
      CHAR_MOVE_FRAME: -1,
      CHAR_MOVE_LEN: 10,
      CHAR_TILE_X: 0,
      CHAR_TILE_Y: 0,
      CHAR_HALF_X: 0.5,
      CHAR_HALF_Y: 1,
      BLACK_CIRCLE_X: 4,
      BLACK_CIRCLE_Y: 3,
      BLACK_CIRCLE_FRAME: -1,
      BLACK_CIRCLE_LEN: 90,
      BLACK_CIRCLE_RAD: 100,
      MAP_WIDTH: map.width,
      MAP_HEIGHT: map.height,
      TILESET_CHAR_COLUMNS: charTileSet.columns,
      TILESET_CHAR_ROWS: charTileSet.image.height / charTileSet.tileHeight,
    },
    chunkMap: {
      map_uniforms: [
          'uniform sampler2D u_under_char;',
          'uniform sampler2D u_above_char;',
          'uniform sampler2D u_anim_below;',
          'uniform sampler2D u_anim_above;',
          'uniform sampler2D u_char;',
        ].join('\n'),
    },
    onFrame() {
      if(game.FRAME_NUM > Math.pow(2, 32)) game.FRAME_NUM = 0;
      else game.FRAME_NUM++;

      if(game.FRAME_NUM % 7 === 0) animationLayer();

      if(curCharPath && game.CHAR_MOVE_FRAME + game.CHAR_MOVE_LEN <= game.FRAME_NUM) {
        if(game.CHAR_MOVE_FRAME >= 0) {
          game.CHAR_X = game.CHAR_MOVE_X;
          game.CHAR_Y = game.CHAR_MOVE_Y;
        }
        if(curCharPath.length === 0) {
          curCharPath = null;
          game.CHAR_TILE_X = 0;
          game.CHAR_MOVE_FRAME = -1;
          const props = triggerTiles && triggerTiles[game.CHAR_Y][game.CHAR_X];
          if(props && props.trigger && (props.trigger in triggers))
            triggers[props.trigger](props);
          return;
        }
        const next = curCharPath.shift();
        game.CHAR_MOVE_X = next.y;
        game.CHAR_MOVE_Y = next.x;
        game.CHAR_MOVE_FRAME = game.FRAME_NUM;
        game.CHAR_TILE_X = game.CHAR_TILE_X === 3 ? 0 : game.CHAR_TILE_X + 1;
        if(game.CHAR_X < game.CHAR_MOVE_X) game.CHAR_TILE_Y = 1; // right
        else if(game.CHAR_X > game.CHAR_MOVE_X) game.CHAR_TILE_Y = 3; // left
        else if(game.CHAR_Y < game.CHAR_MOVE_Y) game.CHAR_TILE_Y = 0; // down
        else game.CHAR_TILE_Y = 2; // up
      }
    },
    onTapOrClick(event, tilePos) {
      if(tilePos.x > 0 && tilePos.x < map.width
          && tilePos.y > 0 && tilePos.y < map.height) {
        // Move character
        curCharPath = astar.search(blockingGraph,
              blockingGraph.grid[Math.floor(game.CHAR_Y)][Math.floor(game.CHAR_X)],
              blockingGraph.grid[Math.floor(tilePos.y)][Math.floor(tilePos.x)]);
      }
    },
  });
  const retval = { map, game };
  await game.init();
  game.center(game.CHAR_X, game.CHAR_Y);

  const triggers = {
    msgBox({ text }) {
      alert(text);
    },
    async loadMap({ mapFile, setCharX, setCharY }) {
      const oldGame = retval.game;
      oldGame.BLACK_CIRCLE_X = oldGame.CHAR_X;
      oldGame.BLACK_CIRCLE_Y = oldGame.CHAR_Y;
      oldGame.BLACK_CIRCLE_FRAME = game.FRAME_NUM;

      const newMount = await loadGame(mapFile);
      oldGame.stop();
      game.element.parentNode.removeChild(game.element);
      retval.game = newMount.game;
      retval.map = newMount.map;
      newMount.game.CHAR_X = setCharX;
      newMount.game.CHAR_Y = setCharY;
      newMount.game.TILE_SIZE = oldGame.TILE_SIZE;
      newMount.game.center(setCharX, setCharY);
    },
  };

  const blockingGraph = new Graph(map.tileMap(
    (layer) => layer.properties.blocking,
    (layer, x, y, tileGid, prev) => 0,
    1));
  const triggerTiles = map.tileMap(
    (layer) => !!layer.properties.trigger,
    (layer, x, y, tileGid, prev) => layer.properties);

  // Aggregate all animated frames into a single layer
  let animFrameCount = 0;
  const animFilterBelow = ({ properties:{ frame, frame_max, aboveChar } }) =>
    !(aboveChar || !frame || !frame_max || frame-1 !== animFrameCount % frame_max);
  const animCanvasBelow = map.draw(animFilterBelow);
  game.createImageTexture('u_anim_below', 0, animCanvasBelow);

  const animFilterAbove = ({ properties:{ frame, frame_max, aboveChar } }) =>
    !(!aboveChar || !frame || !frame_max || frame-1 !== animFrameCount % frame_max);
  const animCanvasAbove = map.draw(animFilterAbove);
  game.createImageTexture('u_anim_above', 1, animCanvasAbove);

  function animationLayer() {
    map.draw(animFilterBelow, animCanvasBelow);
    game.updateImageTexture(0, animCanvasBelow);

    map.draw(animFilterAbove, animCanvasAbove);
    game.updateImageTexture(1, animCanvasAbove);

    animFrameCount++;
    if(animFrameCount > Math.pow(2,32) - 1) animFrameCount = 0;
  }

  // Prerendered under/over aggregates
  const underCharCanvas = map.draw((layer, index) =>
    !layer.properties.frame
    && !layer.properties.aboveChar
    && !layer.properties.trigger)
  game.createImageTexture('u_under_char', 2, underCharCanvas);

  const aboveCharCanvas = map.draw((layer, index) =>
    !layer.properties.frame
    && layer.properties.aboveChar
    && !layer.properties.trigger)
  game.createImageTexture('u_above_char', 3, aboveCharCanvas);

  // Character tileset image from tmx file
  game.createImageTexture('u_char', 4, charTileSet.image);

  document.body.append(game.element);

  return retval;
}

window.mount = loadGame('inside.tmx');
