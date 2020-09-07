import OrthoView from './OrthoView.js';
import TMXMap from './TMXMap.js';

import { astar, Graph } from './astar.js';

async function loadGame(mapFile) {
  const map = new TMXMap;
  await map.load(mapFile);

  let curCharPath = null;
  let charSpeed = 0.1;

  const game = new OrthoView({
    fullPage: true,
    objects: {
      character: {
        x: map.properties.initCharX,
        y: map.properties.initCharY,
        texture: 'u_char',
        tileset: map.tileSets.find(ts => ts.name === 'character'),
        tileX: 0,
        tileY: 0,
        offsetY: -1,
        offsetX: 0,
        width: 1,
        height: 2,
      },
    },
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
          'uniform sampler2D u_anim_below;',
          'uniform sampler2D u_anim_above;',
          'uniform sampler2D u_char;',
        ].join('\n'),
    },
    onFrame(delta) {
      if(game.FRAME_NUM > Math.pow(2, 32)) game.FRAME_NUM = 0;
      else game.FRAME_NUM++;

      if(game.FRAME_NUM % 7 === 0) animationLayer();

      if(curCharPath) {
        if(curCharPath.length === 0){
          curCharPath = null;
          game.character.tileX = 0;
          const props = triggerTiles &&
            triggerTiles[Math.round(game.character.y)][Math.round(game.character.x)];
          if(props && props.trigger && (props.trigger in triggers))
            triggers[props.trigger](props);
          return;
        }
        const next = curCharPath[0];
        const xDiff = game.character.x - next.y;
        const yDiff = game.character.y - next.x;
        const distToNext = Math.sqrt(Math.pow(xDiff, 2) + Math.pow(yDiff, 2));
        if(distToNext < charSpeed) {
          curCharPath.shift();
          game.character.x -= xDiff;
          game.character.y -= yDiff;
        } else {
          game.character.x -= xDiff * (1/distToNext) * charSpeed;
          game.character.y -= yDiff * (1/distToNext) * charSpeed;

          if(game.FRAME_NUM % 9 === 0) {
            game.character.tileX = game.character.tileX === 3 ? 0 : game.character.tileX + 1;
          }

          if(Math.abs(xDiff) > Math.abs(yDiff)) {
            if(xDiff > 0) game.character.tileY = 3;
            else game.character.tileY = 1;
          } else {
            if(yDiff > 0) game.character.tileY = 2;
            else game.character.tileY = 0;
          }
        }
      }
    },
    onTapOrClick(event, tilePos) {
      if(tilePos.x > 0 && tilePos.x < map.width
          && tilePos.y > 0 && tilePos.y < map.height) {
        // Move character
        curCharPath = astar.search(blockingGraph,
          blockingGraph.grid[Math.round(game.character.y)][Math.round(game.character.x)],
          blockingGraph.grid[Math.floor(tilePos.y)][Math.floor(tilePos.x)]);
      }
    },
  });
  const retval = { map, game };
  await game.init();
  game.center(game.character.x, game.character.y);

  const triggers = {
    msgBox({ text }) {
      alert(text);
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
  game.createImageTexture('u_char', 4, game.character.tileset.image);

  document.body.append(game.element);

  return retval;
}

window.mount = loadGame('inside.tmx');
