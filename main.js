import OrthoView from './OrthoView.js';
import TMXMap from './TMXMap.js';

import { astar, Graph } from './astar.js';

async function loadGame(mapFile) {
  const map = new TMXMap;
  await map.load(mapFile);

  const charTileSet = map.tileSets.find(ts => ts.name === 'character');;

  const game = new OrthoView({
    fullPage: true,
    dataValues: {
      // Override default
      TILE_SIZE: 32,
      // Custom values
      CHAR_X: map.properties.initCharX,
      CHAR_Y: map.properties.initCharY,
      CHAR_TILE_X: 0,
      CHAR_TILE_Y: 0,
      CHAR_HALF_X: 0.5,
      CHAR_HALF_Y: 1,
      BLACK_CIRCLE_X: 4,
      BLACK_CIRCLE_Y: 3,
      BLACK_CIRCLE_RAD: 0,
      MAP_WIDTH: map.width,
      MAP_HEIGHT: map.height,
      TILESET_CHAR_COLUMNS: charTileSet.columns,
      TILESET_CHAR_ROWS: charTileSet.image.height / charTileSet.tileHeight,
    },
    chunkMap: {
      map_uniforms: [
          'uniform sampler2D u_under_char;',
          'uniform sampler2D u_above_char;',
          'uniform sampler2D u_anim;',
          'uniform sampler2D u_anim_above;',
          'uniform sampler2D u_char;',
        ].join('\n'),
    },
    onTapOrClick(event, tilePos) {
      if(activeCharAnim) {
        clearTimeout(activeCharAnim);
        activeCharAnim = null;
      }
      if(tilePos.x > 0 && tilePos.x < map.width
          && tilePos.y > 0 && tilePos.y < map.height) moveCharacter(tilePos);
    },
  });
  const retval = { map, game };
  game.stopped = false;
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
      oldGame.BLACK_CIRCLE_RAD = 0;
      function growCircle() {
        oldGame.BLACK_CIRCLE_RAD++;
        if(oldGame.BLACK_CIRCLE_RAD < 100) {
          if(oldGame.stopped) return;
          setTimeout(growCircle, 20);
        }
      }
      growCircle();

      const newMount = await loadGame(mapFile);
      oldGame.stopped = true;
      game.element.parentNode.removeChild(game.element);
      retval.game = newMount.game;
      retval.map = newMount.map;
      newMount.game.CHAR_X = setCharX;
      newMount.game.CHAR_Y = setCharY;
      newMount.game.TILE_SIZE = oldGame.TILE_SIZE;
      newMount.game.center(setCharX, setCharY);
    },
  };

  let activeCharAnim;
  const blockingTiles = map.tileMap(
    (layer) => layer.properties.blocking,
    (layer, x, y, tileGid, prev) => 0,
    1);
  const triggerTiles = map.tileMap(
    (layer) => !!layer.properties.trigger,
    (layer, x, y, tileGid, prev) => layer.properties);
  const blockingGraph = new Graph(blockingTiles);
  function moveCharacter(tilePos) {
    const path = interpolatePath(4,
      [{ x: game.CHAR_Y, y: game.CHAR_X }]
        .concat(astar.search(blockingGraph,
          blockingGraph.grid[Math.floor(game.CHAR_Y)][Math.floor(game.CHAR_X)],
          blockingGraph.grid[Math.floor(tilePos.y)][Math.floor(tilePos.x)])));

    let pathLoc = 0;
    function nextLoc() {
      // astar algorithm has x,y switched
      if(pathLoc < path.length) {
        game.CHAR_X = path[pathLoc].y;
        game.CHAR_Y = path[pathLoc].x;
        game.CHAR_TILE_Y = path[pathLoc].direction;
        game.CHAR_TILE_X =
          !(pathLoc !== path.length - 1) || game.CHAR_TILE_X === 3
            ? 0
            : game.CHAR_TILE_X + 1;
        if(game.stopped) return;
        activeCharAnim = setTimeout(nextLoc, 50);
      } else if(path.length > 1) {
        const props = triggerTiles
          && triggerTiles[path[path.length-1].x][path[path.length-1].y];
        if(props && props.trigger && (props.trigger in triggers))
          triggers[props.trigger](props);
      }
      pathLoc++;
    }
    nextLoc();
  }

  function interpolatePath(splitCount, path) {
    const out = [];
    let direction = 0;
    for(let i=0; i<path.length - 1; i++){
      const x1 = path[i].x;
      const y1 = path[i].y;
      const x2 = path[i+1].x;
      const y2 = path[i+1].y;

      if(x1 < x2) direction = 0; // down
      else if(x1 > x2) direction = 2; // up
      else if(y1 < y2) direction = 1; // right
      else direction = 3; // left

      out.push({
        x: path[i].x,
        y: path[i].y,
        direction
      });

      for(let j=0; j<splitCount; j++) {
        out.push({
          x: (x2-x1)*((j+1)/(splitCount+1)) + x1,
          y: (y2-y1)*((j+1)/(splitCount+1)) + y1,
          direction,
        });
      }
    }
    out.push({
        x: path[path.length-1].x,
        y: path[path.length-1].y,
        direction, // up
      });
    return out;
  }

  // Aggregate all animated frames into a single layer
  let frameCount = 0;
  const animFilterBelow = (layer) => {
    const { frame, frame_max, aboveChar } = layer.properties;
    if(aboveChar || !frame || !frame_max || frame-1 !== frameCount % frame_max) return false;
    return true;
  };
  const animCanvasBelow = map.draw(animFilterBelow);
  game.createImageTexture('u_anim', 0, animCanvasBelow);
  const animFilterAbove = (layer) => {
    const { frame, frame_max, aboveChar } = layer.properties;
    if(!aboveChar || !frame || !frame_max || frame-1 !== frameCount % frame_max) return false;
    return true;
  };
  const animCanvasAbove = map.draw(animFilterAbove);
  game.createImageTexture('u_anim_above', 1, animCanvasAbove);
  function animationLayer(init=false) {
    map.draw(animFilterBelow, animCanvasBelow);
    game.updateImageTexture(0, animCanvasBelow);
    map.draw(animFilterAbove, animCanvasAbove);
    game.updateImageTexture(1, animCanvasAbove);
    frameCount++;
    if(frameCount > Math.pow(2,32) - 1) frameCount = 0;
    if(game.stopped) return;
    setTimeout(animationLayer, 200);
  }
  animationLayer(true);

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
