import OrthoView from './OrthoView.js';
import TMXMap from './TMXMap.js';

import { buildLayers } from './helpers.js';


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
      CHAR_X: 70.0,
      CHAR_Y: 15.0,
      CHAR_TILE_X: 0,
      CHAR_TILE_Y: 0,
      MAP_WIDTH: 100,
      MAP_HEIGHT: 100,
      TILESET0_COLUMNS: 64,
      TILESET0_ROWS: 64,
      TILESET1_COLUMNS: 4,
      TILESET1_ROWS: 4,
    },
    chunkMap: {
      map_uniforms: [
          'uniform sampler2D u_under_char;',
          'uniform sampler2D u_above_char;',
          'uniform sampler2D u_anim;',
        ].concat(map.tileSets.map((ts, index) => {
          return `uniform sampler2D u_texture${index};`;
        })).join('\n'),
    },
    onTapOrClick(event, tilePos) {
      if(activeCharAnim) {
        clearTimeout(activeCharAnim);
        activeCharAnim = null;
      }
      animateCharPos(tilePos);
    },
  });
  await game.init();

  let activeCharAnim;
  // thisDirection: corresponds with tileset graphic y (row) value for top tile
  function animateCharPos(finalTilePos, thisDirection=null) {
    const xDist = game.CHAR_X - finalTilePos.x;
    const yDist = game.CHAR_Y - finalTilePos.y;
    const dist = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
    const xUnit = dist > 1 ? xDist/dist : xDist;
    const yUnit = dist > 1 ? yDist/dist : yDist;
    const areWeThereYet =
      Math.abs(game.CHAR_X - finalTilePos.x) +
      Math.abs(game.CHAR_Y - finalTilePos.y) > 0.1;
    game.CHAR_X -= xUnit / 3;
    game.CHAR_Y -= yUnit / 3;
    game.ORIGIN_X += xUnit * game.TILE_SIZE / 3;
    game.ORIGIN_Y += yUnit * game.TILE_SIZE / 3;
    const thisAnimFrame = game.CHAR_TILE_X;
    game.CHAR_TILE_X = !areWeThereYet || thisAnimFrame === 3 ?  0 : thisAnimFrame + 1;
    const xUnitA = Math.abs(xUnit);
    const yUnitA = Math.abs(yUnit);
    if(thisDirection === null) {
      if(xUnitA > yUnitA && xUnit > 0) thisDirection = 3         // left
      else if(xUnitA > yUnitA && xUnit <= 0) thisDirection = 1   // right
      else if(xUnitA <= yUnitA && yUnit > 0) thisDirection = 2   // up
      else if(xUnitA <= yUnitA && yUnit <= 0) thisDirection = 0; // down
      game.CHAR_TILE_Y = thisDirection;
    }
    if(areWeThereYet) {
      activeCharAnim = setTimeout(() => {
        animateCharPos(finalTilePos, thisDirection);
      }, 100);
    }
  }

  // Aggregate all animated frames into a single layer
  let frameCount = 0;
  function animationLayer(init=false) {
    let animData = buildLayers(map, 1, (layer) => {
      const { frame, frame_max } = layer.properties;
      if(!frame || !frame_max || frame-1 !== frameCount % frame_max) return false;
      return true;
    });
    if(init) {
      game.createDataTexture('u_anim', 2, map.width, map.height, animData[0]);
    } else {
      game.updateDataTexture(2, map.width, map.height, animData[0]);
    }
    frameCount++;
    if(frameCount > game.options.maxFrameCount) frameCount = 0;
    setTimeout(animationLayer, 200);
  }
  animationLayer(true);

  // Prerendered under/over aggregates
  const underCharCanvas = map.draw((layer, index) =>
    !layer.properties.frame && !layer.properties.aboveChar)
  game.createImageTexture('u_under_char', 3, underCharCanvas);

  const aboveCharCanvas = map.draw((layer, index) =>
    !layer.properties.frame && layer.properties.aboveChar)
  game.createImageTexture('u_above_char', 4, aboveCharCanvas);

  // Tileset images from tmx file
  for(let i=0; i<map.tileSets.length; i++) {
    const tileSet = map.tileSets[i];
    game.createImageTexture('u_texture' + i, i+5, tileSet.image);
  }




  document.body.append(game.element);
})();

