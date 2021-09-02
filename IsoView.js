import DataChannel from './DataChannel.js';

export default class IsoView {
  constructor(options) {
    this.options = Object.assign({
      fullPage: false,
      extraUniforms: [],
      tileSizeMin: 10,
      maxFrameCount: Math.pow(2,32) - 1,
      fragmentShader: 'frag.glsl',
    }, options);

    this.element = document.createElement('canvas');
    if(this.options.fullPage) {
      this.element.style.width = '100vw';
      this.element.style.height = '100vh';
      this.element.style.display = 'fixed';
      this.element.style.top = 0;
      this.element.style.left = 0;
    }

    this.gl = null;
    this.program = null;
    this.uniforms = [
      new DataChannel(this, 'canvas_size', new Float32Array([
        this.element.width, this.element.height]), 2),
      new DataChannel(this, 'frame_num', new Float32Array([0])),
      // tile_size: x=width, y=height proportion to width
      new DataChannel(this, 'tile_size', new Float32Array([60, 0.5]), 2),
      // cursor_size: x=pos, y=pos, z=size
      new DataChannel(this, 'cursor', new Float32Array([0, 0, 20]), 3),
      new DataChannel(this, 'origin', new Float32Array([200, 100]), 2),
    ].concat(this.options.extraUniforms);
    // Uniforms by-name
    this.data = this.uniforms.reduce((obj, uniform) => {
      obj[uniform.name] = uniform; return obj; }, {});
  }
  async init() {
    this.gl = this.element.getContext('webgl');
    this.gl.clearColor(0, 0, 0, 1);

    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
    this.gl.shaderSource(vertexShader, `
      attribute vec2 pos;
      attribute vec2 uv;
      varying vec2 uv_pos;

      void main() {
        uv_pos = uv;
        gl_Position = vec4(pos, 0.0, 1.0);
      }
    `);
    this.gl.compileShader(vertexShader);

    if(!this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS))
      throw this.gl.getShaderInfoLog(vertexShader);

    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    this.gl.shaderSource(fragmentShader,
      await (await fetch(this.options.fragmentShader)).text());
    this.gl.compileShader(fragmentShader);

    if(!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS))
      throw this.gl.getShaderInfoLog(fragmentShader);

    this.program = this.gl.createProgram();
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    if(!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS))
      throw this.gl.getProgramInfoLog(this.program);

    this.gl.useProgram(this.program);

    // Construct simple 2D geometry
    // Vertex Positions, 2 triangles
    const positions = new Float32Array([
      -1,-1,0, -1,1,0, 1,1,0,
      1,-1,0, 1,1,0, -1,-1,0
    ]);
    const positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
    const positionLocation = this.gl.getAttribLocation(this.program, 'pos');
    this.gl.vertexAttribPointer(positionLocation, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(0);

    // Texture Positions
    const uvPosArray = new Float32Array([
      1,1, 1,0, 0,0,   0,1, 0,0, 1,1
    ]);
    const uvBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, uvBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, uvPosArray, this.gl.STATIC_DRAW);
    const uvLocation = this.gl.getAttribLocation(this.program, 'uv');
    this.gl.vertexAttribPointer(uvLocation, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(1);


    let touchStartPos = null;
    let touchStartCursor = null;
    const tpCache = [];
    let initPinchDistance = null;
    let initTileWidth = null;
    let initTileX = null;
    let initTileY = null;
    let initOg = null;
    let initTilePosX = null;
    let initTilePosY = null;
    this.element.addEventListener('mousedown', event => {
      event.preventDefault();
      touchStartPos = this.data.origin.clone();
      touchStartCursor = this.data.cursor.clone();
    }, false);
    this.element.addEventListener('mouseup', event => {
      touchStartPos = null;
    }, false);
    this.element.addEventListener('mouseout', event => {
      touchStartPos = null;
    }, false);
    this.element.addEventListener('mousemove', event => {
      this.data.cursor.x = event.layerX - event.target.offsetLeft;
      this.data.cursor.y = event.layerY - event.target.offsetTop;
      if(touchStartPos) {
        this.data.origin.x = touchStartPos.x + this.data.cursor.x - touchStartCursor.x;
        this.data.origin.y = touchStartPos.y + this.data.cursor.y - touchStartCursor.y;
      }
    }, false);
    this.element.addEventListener('wheel', event => {
      const rawX = event.layerX - event.target.offsetLeft - this.data.origin.x;
      const rawY = event.layerY - event.target.offsetTop - this.data.origin.y;
      const beforeTileX = -(rawX * this.data.tile_size.y - rawY) / this.data.tile_size.x;
      const beforeTileY = -(-rawX * this.data.tile_size.y - rawY) / this.data.tile_size.x;

      // Zoom
      this.data.tile_size.x *= event.deltaY > 0 ? 1.2 : 0.8;
      if(this.data.tile_size.x < this.options.tileSizeMin) {
        this.data.tile_size.x = this.options.tileSizeMin;
      }

      const tilePosX = this.data.tile_size.x * (beforeTileY - beforeTileX);
      const tilePosY = this.data.tile_size.x * this.data.tile_size.y * (beforeTileY + beforeTileX);

      // Maintain centering
      this.data.origin.x -= tilePosX - rawX;
      this.data.origin.y -= tilePosY - rawY;
    }, false);
    this.element.addEventListener('touchstart', event => {
      event.preventDefault();
      this.data.cursor.x = event.changedTouches[0].pageX - event.target.offsetLeft;
      this.data.cursor.y = event.changedTouches[0].pageY - event.target.offsetTop;

      touchStartPos = this.data.origin.clone();
      touchStartCursor = this.data.cursor.clone();
      if (event.targetTouches.length == 2) {
        for (let i=0; i < event.targetTouches.length; i++) {
          tpCache.push(event.targetTouches[i]);
        }
        initPinchDistance = pointDistance(tpCache[0], tpCache[1]);
        initTileWidth = this.data.tile_size.x;

        // For centering
        initOg = this.data.origin.clone();
        const initRawX = (tpCache[0].clientX + tpCache[1].clientX)/2  - this.data.origin.x;
        const initRawY = (tpCache[0].clientY + tpCache[1].clientX)/2 - this.data.origin.y;
        this.data.cursor.x = initRawX + initOg.x;
        this.data.cursor.y = initRawY + initOg.y;

        initTileX = -(initRawX * this.data.tile_size.y - initRawY) / this.data.tile_size.x;
        initTileY = -(-initRawX * this.data.tile_size.y - initRawY) / this.data.tile_size.x;
        initTilePosX = this.data.tile_size.x * (initTileY - initTileX);
        initTilePosY = this.data.tile_size.x * this.data.tile_size.y * (initTileY + initTileX);
      }
    }, false);
    this.element.addEventListener('touchmove', event => {
      event.preventDefault();
      if(event.changedTouches.length === 2 && event.targetTouches.length === 2) {

        let point1 = null, point2 = null;
        for (let i=0; i < tpCache.length; i++) {
          if (tpCache[i].identifier == event.targetTouches[0].identifier) point1 = i;
          if (tpCache[i].identifier == event.targetTouches[1].identifier) point2 = i;
        }
        const currentPinchDistance = pointDistance(event.targetTouches[0], event.targetTouches[1]);
        const pinchDiff = 1 + ((currentPinchDistance - initPinchDistance) / initPinchDistance);
        this.data.tile_size.x = initTileWidth * pinchDiff;
        if(this.data.tile_size.x < this.options.tileSizeMin) {
          this.data.tile_size.x = this.options.tileSizeMin;
        }

        // Maintain centering
        const tilePosX = this.data.tile_size.x * (initTileY - initTileX);
        const tilePosY = this.data.tile_size.x * this.data.tile_size.y * (initTileY + initTileX);
        this.data.origin.x = initOg.x + initTilePosX - tilePosX;
        this.data.origin.y = initOg.y + initTilePosY - tilePosY;

      } else if(event.changedTouches.length === 1 && tpCache.length === 0) {

        this.data.cursor.x = event.changedTouches[0].pageX - event.target.offsetLeft;
        this.data.cursor.y = event.changedTouches[0].pageY - event.target.offsetTop;
        this.data.origin.x = touchStartPos.x + this.data.cursor.x - touchStartCursor.x;
        this.data.origin.y = touchStartPos.y + this.data.cursor.y - touchStartCursor.y;

      }
    }, false);
    this.element.addEventListener('touchend', event => {
      if(event.targetTouches.length === 0) {
        tpCache.splice(0, tpCache.length);
      }
    }, false);

    if(this.options.fullPage) {
      const resize = () => {
        this.data.canvas_size.x = this.element.width = window.innerWidth;
        this.data.canvas_size.y = this.element.height = window.innerHeight;
        this.gl.viewport(0, 0, this.element.width, this.element.height);
      }
      window.addEventListener('resize', resize, false);
      resize();
    }


    const draw = (delta) => {
      this.data.frame_num.x = delta || 0;
      for(let uniform of this.uniforms) uniform.update();
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
      window.requestAnimationFrame(draw);
    }
    draw();
  }
}

function pointDistance(point1, point2) {
  return Math.sqrt(
    Math.pow(point1.clientX - point2.clientX, 2) +
    Math.pow(point1.clientY - point2.clientY, 2));
}
