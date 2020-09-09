export default class MovableObject {
  constructor(raw) {
    Object.assign(this, {
      // Some default values
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      offsetX: 0,
      offsetY: 0,
      gid: null,
      tileset: null,
      speed: null,
      tileXAnim: false,
      tileXIdle: null,
      tileXMax: null,
      tileXMin: null,
      tileXTime: null,
      tileYDown: null,
      tileYLeft: null,
      tileYRight: null,
      tileYUp: null,
      trigger: null,
    }, raw, {
      // Do not allow map file to override these
      curPath: null,
      onArrival: null,
      onAnimEnd: null,
      lastFrameDelta: 0,
    });
  }
  onFrame(delta) {
    if(!this.gid) return;
    if(this.curPath) {
      if(this.curPath.length === 0){
        this.curPath = null;
        this.tileX = this.tileXIdle;
        this.onArrival && this.onArrival();
        return;
      }
      const next = this.curPath[0];
      const xDiff = this.x - next.x;
      const yDiff = this.y - next.y;
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
}
