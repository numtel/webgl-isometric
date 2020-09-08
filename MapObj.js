export default class MapObj {
  constructor(parent, params, index) {
    Object.assign(this, params);
    this.parent = parent;
    this.index = index;
    this.curPath = null;
    this.onArrival = null;
    this.onAnimEnd = null;
    this.lastFrameDelta = 0;
    if(this.gid) {
      this.texture = `u_obj_${this.tileset.imgSource.replace(/[^a-zA-Z0-9]/g, '_')}`;
      if(!(this.texture in this.parent.textures))
        this.parent.createImageTexture(this.texture, this.tileset.image);

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
  }
  onFrame(delta) {
    if(this.isRect) return;
    if(this.curPath) {
      if(this.curPath.length === 0){
        this.curPath = null;
        this.tileX = this.tileXIdle;
        this.onArrival && this.onArrival();
        return;
      }
      const next = this.curPath[0];
      const xDiff = this.x - next.y;
      const yDiff = this.y - next.x;
      const distToNext = Math.sqrt(Math.pow(xDiff, 2) + Math.pow(yDiff, 2));
      if(distToNext < this.speed) {
        this.curPath.shift();
        this.x -= xDiff;
        this.y -= yDiff;
      } else {
        this.x -= xDiff * (1/distToNext) * this.speed;
        this.y -= yDiff * (1/distToNext) * this.speed;

        if(delta - this.lastFrameDelta > this.tileXTime) {
          this.tileX = this.tileX === this.tileXMax ? this.tileXMin : this.tileX + 1;
          this.lastFrameDelta = delta;
        }

        if(Math.abs(xDiff) > Math.abs(yDiff)) {
          if(xDiff > 0) this.tileY = this.tileYLeft;
          else this.tileY = this.tileYRight;
        } else {
          if(yDiff > 0) this.tileY = this.tileYUp;
          else this.tileY = this.tileYDown;
        }
      }
    }
    if(this.tileXAnim) {
      if(delta - this.lastFrameDelta > this.tileXTime) {
        if(this.tileXMax === this.tileX) {
          this.onAnimEnd && this.onAnimEnd();
        }
        this.tileX = this.tileX === this.tileXMax ?
          this.tileXAnimStage2Frame || this.tileXMin : this.tileX + 1;
        this.lastFrameDelta = delta;
      }
    }
  }
  chunk() {
    if(!this.gid) return '';
    const off = { x: this.offsetX.toFixed(3), y: this.offsetY.toFixed(3) };
    // TODO zIndex by object y values?
    return `
      if(tile_real.x >= OBJ${this.index}_X + ${off.x} &&
         tile_real.x <=  OBJ${this.index}_X + ${off.x} + ${this.width.toFixed(3)} &&
         tile_real.y >= OBJ${this.index}_Y + ${off.y} - ${this.height.toFixed(3)} &&
         tile_real.y <=  OBJ${this.index}_Y + ${off.y}) {
        vec2 objPos = vec2(
          (tile_real.x - OBJ${this.index}_X - ${off.x}) / ${this.width.toFixed(3)},
          (tile_real.y - OBJ${this.index}_Y - ${off.y} + ${this.height.toFixed(3)}) / ${this.height.toFixed(3)}
        );
        comp = blend(comp, texture2D(${this.texture}, vec2(
          (OBJ${this.index}_TILEX + objPos.x) / ${this.tileset.columns.toFixed(3)},
          (OBJ${this.index}_TILEY + objPos.y) / ${(this.tileset.image.height / this.tileset.tileHeight).toFixed(3)}
        )));
      }
    `;
  }
}
