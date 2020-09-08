import OrthoView from './OrthoView.js';
import TMXMap from './TMXMap.js';

import { astar, Graph } from './astar.js';

async function loadGame(mapFile) {
  const map = new TMXMap;
  await map.load(mapFile);

  const game = new OrthoView({
    fullPage: true,
    objects: {
      ...map.allObjects(),
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
        ].join('\n'),
    },
    onFrame(delta) {
      if(game.FRAME_NUM > Math.pow(2, 32)) game.FRAME_NUM = 0;
      else game.FRAME_NUM++;

      if(game.FRAME_NUM % 7 === 0) animationLayer();

    },
    onTapOrClick(event, tilePos) {
      if(tilePos.x > 0 && tilePos.x < map.width
          && tilePos.y > 0 && tilePos.y < map.height) {
        // Move character
        game.character.curPath = astar.search(blockingGraph,
          blockingGraph.grid[Math.round(game.character.y)][Math.round(game.character.x)],
          blockingGraph.grid[Math.floor(tilePos.y)][Math.floor(tilePos.x)]);
        if(game.character2) {
          game.character2.curPath = astar.search(blockingGraph,
            blockingGraph.grid[Math.round(game.character2.y)][Math.round(game.character2.x)],
            blockingGraph.grid[Math.floor(tilePos.y)][Math.floor(tilePos.x)]);
        }
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
  game.character.onArrival = () => {
    const props = triggerTiles &&
      triggerTiles[Math.round(game.character.y)][Math.round(game.character.x)];
    if(props && props.trigger && (props.trigger in triggers))
      triggers[props.trigger](props);
  };

  // Aggregate all animated frames into a single layer
  let animFrameCount = 0;
  const animFilterBelow = ({ properties:{ frame, frame_max, aboveChar } }) =>
    !(aboveChar || !frame || !frame_max || frame-1 !== animFrameCount % frame_max);
  const animCanvasBelow = map.draw(animFilterBelow);
  const animBelowTexture = game.createImageTexture('u_anim_below', animCanvasBelow);

  const animFilterAbove = ({ properties:{ frame, frame_max, aboveChar } }) =>
    !(!aboveChar || !frame || !frame_max || frame-1 !== animFrameCount % frame_max);
  const animCanvasAbove = map.draw(animFilterAbove);
  const animAboveTexture = game.createImageTexture('u_anim_above', animCanvasAbove);

  function animationLayer() {
    map.draw(animFilterBelow, animCanvasBelow);
    animBelowTexture.update(animCanvasBelow);

    map.draw(animFilterAbove, animCanvasAbove);
    animAboveTexture.update(animCanvasAbove);

    animFrameCount++;
    if(animFrameCount > Math.pow(2,32) - 1) animFrameCount = 0;
  }

  // Prerendered under/over aggregates
  const underCharCanvas = map.draw((layer, index) =>
    !layer.properties.frame
    && !layer.properties.aboveChar
    && !layer.properties.trigger)
  game.createImageTexture('u_under_char', underCharCanvas);

  const aboveCharCanvas = map.draw((layer, index) =>
    !layer.properties.frame
    && layer.properties.aboveChar
    && !layer.properties.trigger)
  game.createImageTexture('u_above_char', aboveCharCanvas);

  document.body.append(game.element);

  return retval;
}

window.mount = loadGame('inside.tmx');
