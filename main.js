import OrthoView from './OrthoView.js';
import TMXMap from './TMXMap.js';

import { astar, Graph } from './astar.js';

(async function() {
  const map = window.map = new TMXMap;
  await map.load('zeldish.tmx');

  const game = window.game = new OrthoView({
    fullPage: true,
    dataValues: {
      // Override defaults
      ORIGIN_X: -820,
      ORIGIN_Y: -90,
      TILE_SIZE: 16,
      // Custom values
      CURSOR_SIZE: 20,
      CHAR_X: 70,
      CHAR_Y: 15,
      CHAR_TILE_X: 0,
      CHAR_TILE_Y: 0,
      CHAR_HALF_X: 0.5,
      CHAR_HALF_Y: 1,
      MAP_WIDTH: 100,
      MAP_HEIGHT: 100,
      TILESET_CHAR_COLUMNS: 4,
      TILESET_CHAR_ROWS: 4,
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
      moveCharacter(tilePos);
    },
  });
  await game.init();

  let activeCharAnim;
  const blockingTiles = map.tileMap((layer) => layer.properties.blocking);
  const blockingGraph = new Graph(blockingTiles);
  function moveCharacter(tilePos) {
    const path = interpolatePath(4,
      [{ x: game.CHAR_Y, y: game.CHAR_X }]
        .concat(astar.search(blockingGraph,
          blockingGraph.grid[Math.floor(game.CHAR_Y)][Math.floor(game.CHAR_X)],
          blockingGraph.grid[Math.floor(tilePos.y)][Math.floor(tilePos.x)])));

    if(path.length) {
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
          activeCharAnim = setTimeout(nextLoc, 50);
        }
        pathLoc++;
      }
      nextLoc();
    }
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
    setTimeout(animationLayer, 200);
  }
  animationLayer(true);

  // Prerendered under/over aggregates
  const underCharCanvas = map.draw((layer, index) =>
    !layer.properties.frame && !layer.properties.aboveChar)
  game.createImageTexture('u_under_char', 2, underCharCanvas);

  const aboveCharCanvas = map.draw((layer, index) =>
    !layer.properties.frame && layer.properties.aboveChar)
  game.createImageTexture('u_above_char', 3, aboveCharCanvas);

  // Character tileset image from tmx file
  for(let i=0; i<map.tileSets.length; i++) {
    const tileSet = map.tileSets[i];
    if(tileSet.name === 'character') {
      game.createImageTexture('u_char', 4, tileSet.image);
      break;
    }
  }

  document.body.append(game.element);
})();

