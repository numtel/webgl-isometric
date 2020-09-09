const STOPPED = Symbol();

export default class OrthoView {
  constructor(options) {
    this.options = Object.assign({
      fullPage: false,
      dataValues: {}, // floats
      chunkMap: {},
      tileSizeMin: 3,
      fragmentShader: 'frag.glsl',
      onTapOrClick: null,
      onFrame: null,
    }, options);

    this[STOPPED] = false;
    this.nextTextureSlot = 0;
    this.textures = {};
    this.readyForTextures = false;
    this.element = document.createElement('canvas');
    this.gl = this.element.getContext('webgl');
    this.program = this.gl.createProgram();

    if(this.options.fullPage) {
      this.element.style.width = '100vw';
      this.element.style.height = '100vh';
      this.element.style.display = 'fixed';
      this.element.style.top = 0;
      this.element.style.left = 0;
    }

    const dataValues = Object.entries(Object.assign({
      CANVAS_WIDTH: this.element.width,
      CANVAS_HEIGHT: this.element.height,
      ORIGIN_X: 0,
      ORIGIN_Y: 0,
      TILE_SIZE: 60,
      TILE_SIZE_Y: 0.5, // legacy? height proportional to width in isometric
      CURSOR_X: 0,
      CURSOR_Y: 0,
      CURSOR_TILE_X: 0,
      CURSOR_TILE_Y: 0,
    }, this.options.dataValues));

    this.dataLocation = null;
    this.DATA_UNIFORM_NAME = '_data';
    const dataValuesArray = this.dataValues = new Float32Array(dataValues.length);
    const dataValuesChunks = [ `uniform float _data[${dataValuesArray.length}];` ];
    for(let i=0; i<dataValues.length;i++) {
      const val = dataValues[i];
      // Set initial value
      dataValuesArray[i] = val[1];
      // Easy access from shader
      dataValuesChunks.push(`#define ${val[0]} _data[${i}]`);
      // Easy access on this object
      Object.defineProperty(this, val[0], {
        get() {
          return dataValuesArray[i];
        },
        set(value) {
          dataValuesArray[i] = value;
        }
      })
    }
    this.dataValuesChunk = dataValuesChunks.join('\n') + '\n';
  }
  async init() {
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
    const fragmentShaderText = `
      precision highp float;
      precision highp int;
    ` + this.dataValuesChunk
      + replaceChunks(
      await (await fetch(this.options.fragmentShader)).text(), this.options.chunkMap);
    this.gl.shaderSource(fragmentShader, fragmentShaderText);
    this.gl.compileShader(fragmentShader);

    if(!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS)) {
      console.log(
        fragmentShaderText
          .split('\n')
          .map((line, index) => (index+1) + ': ' + line)
          .join('\n')
      );
      throw this.gl.getShaderInfoLog(fragmentShader);
    }

    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    if(!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS))
      throw this.gl.getProgramInfoLog(this.program);

    this.gl.useProgram(this.program);
    this.readyForTextures = true;
    for(let texture of Object.values(this.textures)) {
      texture.init();
    }

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

    this.dataLocation = this.gl.getUniformLocation(this.program, this.DATA_UNIFORM_NAME);
    this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);


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
      touchStartPos = { x: this.ORIGIN_X, y: this.ORIGIN_Y };
      touchStartCursor = { x: this.CURSOR_X, y: this.CURSOR_Y };
    }, false);
    this.element.addEventListener('mouseup', event => {
      if(typeof this.options.onTapOrClick === 'function') {
        this.options.onTapOrClick(event, {
          x: (event.layerX - event.target.offsetLeft - this.ORIGIN_X) / this.TILE_SIZE,
          y: (event.layerY - event.target.offsetTop - this.ORIGIN_Y) / this.TILE_SIZE,
        });
      }
      touchStartPos = null;
    }, false);
    this.element.addEventListener('mouseout', event => {
      touchStartPos = null;
    }, false);
    this.element.addEventListener('mousemove', event => {
      this.CURSOR_X = event.layerX - event.target.offsetLeft;
      this.CURSOR_Y = event.layerY - event.target.offsetTop;
      this.updateCursorTile();
      if(touchStartPos) {
        this.ORIGIN_X = touchStartPos.x + this.CURSOR_X - touchStartCursor.x;
        this.ORIGIN_Y = touchStartPos.y + this.CURSOR_Y - touchStartCursor.y;
      }
    }, false);
    this.element.addEventListener('wheel', event => {
      const rawX = event.layerX - event.target.offsetLeft - this.ORIGIN_X;
      const rawY = event.layerY - event.target.offsetTop - this.ORIGIN_Y;
      const beforeTileX = -(rawX * this.TILE_SIZE_Y - rawY) / this.TILE_SIZE;
      const beforeTileY = -(-rawX * this.TILE_SIZE_Y - rawY) / this.TILE_SIZE;

      // Zoom
      this.TILE_SIZE *= event.deltaY > 0 ? 1.2 : 0.8;
      if(this.TILE_SIZE < this.options.tileSizeMin) {
        this.TILE_SIZE = this.options.tileSizeMin;
      }

      const tilePosX = this.TILE_SIZE * (beforeTileY - beforeTileX);
      const tilePosY = this.TILE_SIZE * this.TILE_SIZE_Y * (beforeTileY + beforeTileX);

      // Maintain centering
      this.ORIGIN_X -= tilePosX - rawX;
      this.ORIGIN_Y -= tilePosY - rawY;
    }, false);
    this.element.addEventListener('touchstart', event => {
      event.preventDefault();
      this.CURSOR_X = event.changedTouches[0].pageX - event.target.offsetLeft;
      this.CURSOR_Y = event.changedTouches[0].pageY - event.target.offsetTop;
      this.updateCursorTile();

      touchStartPos = { x: this.ORIGIN_X, y: this.ORIGIN_Y };
      touchStartCursor = { x: this.CURSOR_X, y: this.CURSOR_Y };
      if (event.targetTouches.length === 2) {
        for (let i=0; i < event.targetTouches.length; i++) {
          tpCache.push(event.targetTouches[i]);
        }
        initPinchDistance = pointDistance(tpCache[0], tpCache[1]);
        initTileWidth = this.TILE_SIZE;

        // For centering
        initOg = { x: this.ORIGIN_X, y: this.ORIGIN_Y };
        const initRawX = (tpCache[0].clientX + tpCache[1].clientX)/2  - this.ORIGIN_X;
        const initRawY = (tpCache[0].clientY + tpCache[1].clientX)/2 - this.ORIGIN_Y;
        this.CURSOR_X = initRawX + initOg.x;
        this.CURSOR_Y = initRawY + initOg.y;
        this.updateCursorTile();

        initTileX = -(initRawX * this.TILE_SIZE_Y - initRawY) / this.TILE_SIZE;
        initTileY = -(-initRawX * this.TILE_SIZE_Y - initRawY) / this.TILE_SIZE;
        initTilePosX = this.TILE_SIZE * (initTileY - initTileX);
        initTilePosY = this.TILE_SIZE * this.TILE_SIZE_Y * (initTileY + initTileX);
      } else if (event.targetTouches.length === 1) {
        if(typeof this.options.onTapOrClick === 'function') {
          this.options.onTapOrClick(event, {
            x: (event.targetTouches[0].clientX - event.target.offsetLeft - this.ORIGIN_X) / this.TILE_SIZE,
            y: (event.targetTouches[0].clientY - event.target.offsetTop - this.ORIGIN_Y) / this.TILE_SIZE,
          });
        }
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
        this.TILE_SIZE = initTileWidth * pinchDiff;
        if(this.TILE_SIZE < this.options.tileSizeMin) {
          this.TILE_SIZE = this.options.tileSizeMin;
        }

        // Maintain centering
        const tilePosX = this.TILE_SIZE * (initTileY - initTileX);
        const tilePosY = this.TILE_SIZE * this.TILE_SIZE_Y * (initTileY + initTileX);
        this.ORIGIN_X = initOg.x + initTilePosX - tilePosX;
        this.ORIGIN_Y = initOg.y + initTilePosY - tilePosY;

      } else if(event.changedTouches.length === 1 && tpCache.length === 0) {

        this.CURSOR_X = event.changedTouches[0].pageX - event.target.offsetLeft;
        this.CURSOR_Y = event.changedTouches[0].pageY - event.target.offsetTop;
        this.updateCursorTile();
        this.ORIGIN_X = touchStartPos.x + this.CURSOR_X - touchStartCursor.x;
        this.ORIGIN_Y = touchStartPos.y + this.CURSOR_Y - touchStartCursor.y;

      }
    }, false);
    this.element.addEventListener('touchend', event => {
      if(event.targetTouches.length === 0) {
        tpCache.splice(0, tpCache.length);
      }
    }, false);

    if(this.options.fullPage) {
      const resize = () => {
        this.CANVAS_WIDTH = this.element.width = window.innerWidth;
        this.CANVAS_HEIGHT = this.element.height = window.innerHeight;
        this.gl.viewport(0, 0, this.element.width, this.element.height);
      }
      window.addEventListener('resize', resize, false);
      resize();
    }

    const draw = (delta) => {
      if(this[STOPPED] === true) return;
      this.options.onFrame && this.options.onFrame(delta);
      this.gl.uniform1fv(this.dataLocation, this.dataValues);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
      window.requestAnimationFrame(draw);
    }
    draw(0);
  }
  stop() {
    this[STOPPED] = true;
  }
  updateCursorTile() {
    this.CURSOR_TILE_X = (this.CURSOR_X - this.ORIGIN_X) / this.TILE_SIZE;
    this.CURSOR_TILE_Y = (this.CURSOR_Y - this.ORIGIN_Y) / this.TILE_SIZE;
  }
  _createTexture(name, slot) {
    const loc = this.gl.getUniformLocation(this.program, name);
    this.gl.uniform1i(loc, slot);
    const texture = this.gl.createTexture();
    this.gl.activeTexture(this.gl.TEXTURE0 + slot);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
  }
  createDataTexture(name, width, height, pixels) {
    // Missing typescript?
    if(!(pixels instanceof Uint8Array)) throw new Error('Uint8Array_pixels_only');
    return this.textures[name] =
      new DataTexture(this, this.nextTextureSlot++, name, width, height, pixels);
  }
  createImageTexture(name, image) {
    return this.textures[name] =
      new ImageTexture(this, this.nextTextureSlot++, name, image);
  }
  center(tileX, tileY) {
    this.ORIGIN_X = (-tileX * this.TILE_SIZE) + this.CANVAS_WIDTH / 2;
    this.ORIGIN_Y = (-tileY * this.TILE_SIZE) + this.CANVAS_HEIGHT / 2;
  }
}

class ImageTexture {
  constructor(parent, slot, name, image) {
    this.parent = parent;
    this.slot = slot;
    this.name = name;
    this.image = image;
    this.init();
  }
  init() {
    if(!this.parent.readyForTextures) return;
    this.parent._createTexture(this.name, this.slot);
    this.parent.gl.texImage2D(
      this.parent.gl.TEXTURE_2D, 0, this.parent.gl.RGBA,
      this.parent.gl.RGBA, this.parent.gl.UNSIGNED_BYTE, this.image);
  }
  update(image) {
    this.parent.gl.activeTexture(this.parent.gl.TEXTURE0 + this.slot);
    this.parent.gl.texImage2D(this.parent.gl.TEXTURE_2D, 0,
      this.parent.gl.RGBA, this.parent.gl.RGBA,this.parent.gl.UNSIGNED_BYTE, image);
  }
}

class DataTexture {
  constructor(parent, slot, name, width, height, pixels) {
    this.parent = parent;
    this.slot = slot;
    this.width = width;
    this.height = height;
    this.pixels = pixels;
    this.init();
  }
  init() {
    if(!this.parent.readyForTextures) return;
    this.parent._createTexture(this.name, this.slot);
    this.parent.gl.texImage2D(
      this.parent.gl.TEXTURE_2D,
      0,
      this.parent.gl.RGBA, this.width, this.height, 0,
      this.parent.gl.RGBA, this.parent.gl.UNSIGNED_BYTE,
      this.pixels
    );
  }
  update(width, height, pixels) {
    this.parent.gl.activeTexture(this.parent.gl.TEXTURE0 + this.slot);
    this.parent.gl.texImage2D(
      this.parent.gl.TEXTURE_2D,
      0,
      this.parent.gl.RGBA, width, height, 0,
      this.parent.gl.RGBA, this.parent.gl.UNSIGNED_BYTE,
      pixels
    );
  }
}

function pointDistance(point1, point2) {
  return Math.sqrt(
    Math.pow(point1.clientX - point2.clientX, 2) +
    Math.pow(point1.clientY - point2.clientY, 2));
}

function replaceChunks(glsl, chunkMap) {
  return glsl.replace(/#include <([a-zA-Z0-9_-]+)>/gi, (match, p1) => chunkMap[p1]);
}
