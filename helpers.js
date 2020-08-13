

export function buildLayers(map, count, filterFun) {
  const outLayers = new Array(count);
  // Initialize output layers
  for(let i=0; i<count; i++) {
    outLayers[i] = new Uint8Array(map.width * map.height * 4);
  }
  for(let l=0; l<map.layers.length; l++) {
    const layer = map.layers[l];
    if(filterFun(layer, l)) {
      for(let y=0; y<layer.height; y++) {
        for(let x=0; x<layer.width; x++){
          const pos = x+(y*layer.width);
          const tilegid = layer.data[pos];
          // TODO allow more than one tile sheet
          const columns = map.tileSets[0].columns;
          if(tilegid !== 0) {
            for(let i=0; i<count; i++) {
              if(outLayers[i][pos * 4 + 3] !== 0) {
                continue;
              }
              outLayers[i][pos * 4] = (tilegid-1) % columns;
              outLayers[i][pos * 4 + 1] = Math.floor((tilegid-1) / columns);
              outLayers[i][pos * 4 + 2] = 0;
              outLayers[i][pos * 4 + 3] = 255;
              break;
            }
          }
        }
      }
    }
  }
  return outLayers;
}

