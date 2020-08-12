import OrthoView from './OrthoView.js';
import TMXMap from './TMXMap.js';


(async function() {
  const map = new TMXMap;
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
          'uniform sampler2D u_layer0;',
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

  // Tile data for the lowest 4 layers of TMX
  function lay0() {
    game.gl.pixelStorei(game.gl.UNPACK_ALIGNMENT, 1);
    const pixels = [];
    // TODO aggregate more than 4 layers into 4 layers of sprites per tile
    for(let l=0; l<4; l+=2) {
      for(let y=0; y<map.layers[l].height; y++) {
        for(let x=0; x<map.layers[l].width; x++){
          const tilegid = map.layers[l].data[x+(y*map.layers[l].width)];
          const columns = 64;
          if(tilegid === 0) {
            pixels.push(0,0,0,0);
          } else {
            pixels.push((tilegid-1) % columns, Math.floor((tilegid-1) / columns), 0, 255);
          }
        }
        for(let x=0; x<map.layers[l].width; x++){
          const tilegid = map.layers[l+1].data[x+(y*map.layers[l].width)];
          const columns = 64;
          if(tilegid === 0) {
            pixels.push(0,0,0,0);
          } else {
            pixels.push((tilegid-1) % columns, Math.floor((tilegid-1) / columns), 0, 255);
          }
        }
      }
    }
    game.createDataTexture(
      'u_layer0', 0,
      map.layers[0].width * 2, map.layers[0].height * 2,
      new Uint8Array(pixels)
    );
  }
  lay0();

  // Aggregate all animated frames into a single layer
  let frameCount = 0;
  let animData = new Uint8Array(map.width * map.height * 4);
  game.createDataTexture('u_anim', 1, map.width, map.height, animData);
  function animationLayer() {
    for(let l=0; l<map.layers.length; l++) {
      const { frame, frame_max } = map.layers[l].properties;
      if(!frame || !frame_max || frame-1 !== frameCount % frame_max) continue;
      for(let y=0; y<map.layers[l].height; y++) {
        for(let x=0; x<map.layers[l].width; x++){
          const pos = x+(y*map.layers[l].width);
          const tilegid = map.layers[l].data[pos];
          const columns = 64;
          if(tilegid !== 0) {
            animData[pos * 4] = (tilegid-1) % columns;
            animData[pos * 4 + 1] = Math.floor((tilegid-1) / columns);
            animData[pos * 4 + 2] = 0;
            animData[pos * 4 + 3] = 255;
          }
        }
      }
    }
    game.updateDataTexture(1, map.width, map.height, animData);
    frameCount++;
    if(frameCount > game.options.maxFrameCount) frameCount = 0;
    setTimeout(animationLayer, 200);
  }
  animationLayer();


  for(let i=0; i<map.tileSets.length; i++) {
    const tileSet = map.tileSets[i];
    game.createImageTexture('u_texture' + i, i+2, tileSet.image);
  }


  document.body.append(game.element);
})();

