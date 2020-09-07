export default class MapObj {
  constructor(parent, params, index) {
    Object.assign(this, params);
    this.parent = parent;
    this.index = index;

    // Some params are shared with the GPU
    Object.entries({
      x: `OBJ${this.index}_X`,
      y: `OBJ${this.index}_Y`,
      tileX: `OBJ${this.index}_TILEX`,
      tileY: `OBJ${this.index}_TILEY`,
    }).forEach(prop => {
      parent.options.dataValues[prop[1]] = this[prop[0]];
      Object.defineProperty(this, prop[0], {
        get() {
          return parent[prop[1]];
        },
        set(value) {
          parent[prop[1]] = value;
        }
      })
    });
  }
  chunk() {
    return `
      if(tile_real.x >= OBJ${this.index}_X + ${this.offsetX.toFixed(3)} &&
         tile_real.x <=  OBJ${this.index}_X + ${this.offsetX.toFixed(3)} + ${this.width.toFixed(3)} &&
         tile_real.y >= OBJ${this.index}_Y + ${this.offsetY.toFixed(3)} &&
         tile_real.y <=  OBJ${this.index}_Y + ${this.offsetY.toFixed(3)} + ${this.height.toFixed(3)}) {
        vec2 objPos = vec2(
          (tile_real.x - OBJ${this.index}_X - ${this.offsetX.toFixed(3)}) / ${this.width.toFixed(3)},
          (tile_real.y - OBJ${this.index}_Y - ${this.offsetY.toFixed(3)}) / ${this.height.toFixed(3)}
        );
        comp = blend(comp, texture2D(${this.texture}, vec2(
          (OBJ${this.index}_TILEX + objPos.x) / ${this.tileset.columns.toFixed(3)},
          (OBJ${this.index}_TILEY + objPos.y) / ${(this.tileset.image.height / this.tileset.tileHeight).toFixed(3)}
        )));
      }
    `;
  }
}
