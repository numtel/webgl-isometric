export default class TMXMap {
  constructor() {
    this.el = null;
    this.width = null;
    this.height = null;
    this.tileWidth = null;
    this.tileHeight = null;
    this.tileSets = [];
    this.layers = [];
    this.objectGroups = [];
    this.loaded = false;
  }
  async load(filename) {
    const parser = new DOMParser;
    const response = await fetch(filename);
    const text = await response.text();
    const parsed = parser.parseFromString(text, 'text/xml');
    const mapEl = this.el = parsed.documentElement;

    if(mapEl.getAttribute('orientation') !== 'orthogonal')
      throw new Error('only_orientation_orthogonal');
    if(mapEl.getAttribute('renderorder') !== 'right-down')
      throw new Error('only_renderorder_right-down');
    if(mapEl.getAttribute('infinite') !== '0')
      throw new Error('no_infinite_map');

    this.width = parseInt(mapEl.getAttribute('width'), 10);
    this.height = parseInt(mapEl.getAttribute('height'), 10);
    this.tileWidth = parseInt(mapEl.getAttribute('tilewidth'), 10);
    this.tileHeight = parseInt(mapEl.getAttribute('tileheight'), 10);
    this.properties = new TMXProperties(mapEl);

    mapEl.childNodes.forEach(el => {
      switch(el.nodeName) {
        case 'tileset':
          this.tileSets.push(new TMXTileSet(this, el));
          break;
        case 'layer':
          this.layers.push(new TMXLayer(this, el));
          break;
        case 'objectgroup':
          this.objectGroups.push(new TMXObjectGroup(this, el));
          break;
        case '#text':
        case 'properties':
          // noop
          break;
        default:
          throw new Error('element_unsupported:' + el.nodeName);
      }
    });

    await Promise.all(this.tileSets.map(tileSet => tileSet.load()));
    this.loaded = true;
  }
  allObjects() {
    const out = {};
    for(let objGrp of this.objectGroups) {
      Object.assign(out, objGrp.children);
    }
    return out;
  }
  getTileSet(tileGid) {
    for(let i=0; i<this.tileSets.length; i++) {
      const tileSet = this.tileSets[i];
      if(tileGid >= tileSet.firstgid && tileGid < tileSet.lastgid)
        return tileSet;
    }
  }
  draw(layerFilterFun, canvas) {
    // TODO support layer tinting
    if(!this.loaded) throw new Error('load_required');

    if(!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = this.width * this.tileHeight;
      canvas.height = this.height * this.tileHeight;
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for(let i=0; i<this.layers.length; i++) {
      if(layerFilterFun && !layerFilterFun(this.layers[i], i)) continue;
      for(let y=0; y<this.height; y++) {
        for(let x=0; x<this.width; x++) {
          const tileNum = (y * this.height) + x;
          const tileGid = this.layers[i].data[tileNum];
          if(tileGid === 0) continue;
          const tileSet = this.getTileSet(tileGid);
          const tileSetIndex = tileGid - tileSet.firstgid;
          const tileX = tileSetIndex % tileSet.columns;
          const tileY = Math.floor(tileSetIndex / tileSet.columns);
          ctx.drawImage(
            tileSet.image,
            tileX * tileSet.tileWidth,
            tileY * tileSet.tileHeight,
            tileSet.tileWidth,
            tileSet.tileHeight,
            x * this.tileWidth,
            y * this.tileHeight,
            this.tileWidth,
            this.tileHeight);
        }
      }
    }
    return canvas;
  }
  tileMap(layerFilterFun, foundGidFun, defaultValue) {
    const out = new Array(this.height);
    let foundAny = false;
    for(let i=0; i<this.layers.length; i++) {
      if(layerFilterFun && !layerFilterFun(this.layers[i], i)) continue;
      foundAny = true;
      for(let y=0; y<this.height; y++) {
        if(out[y] === undefined) out[y] = new Array(this.width);
        for(let x=0; x<this.width; x++) {
          const tileNum = (y * this.height) + x;
          const tileGid = this.layers[i].data[tileNum];
          if(out[y][x] === undefined) out[y][x] = defaultValue;
          if(tileGid === 0) continue;
          out[y][x] = foundGidFun(this.layers[i], x, y, tileGid, out[y][x]);
        }
      }
    }
    if(!foundAny) return null;
    return out;
  }
}

class TMXObjectGroup {
  constructor(parent, el) {
    this.parent = parent;
    this.el = el;
    this.name = el.getAttribute('name');
    this.properties = new TMXProperties(el);
    this.children = {};
    el.childNodes.forEach(child => {
      if(child.nodeName !== 'object') return;
      const obj = {};
      const gidValue = child.getAttribute('gid')
      if(gidValue) {
        const gid = parseInt(gidValue, 10);
        const tileset = this.parent.getTileSet(gid);
        const tileSetIndex = gid - tileset.firstgid;
        Object.assign(obj, {
          gid,
          tileset,
          tileX: tileSetIndex % tileset.columns,
          tileY: Math.floor(tileSetIndex / tileset.columns),
          offsetY: 0,
          offsetX: 0,
        });
      } else {
        obj.isRect = true;
      }
      this.children[child.getAttribute('name')] = {
        ...obj,
        width: parseInt(child.getAttribute('width'), 10) / parent.tileWidth,
        height: parseInt(child.getAttribute('height'), 10) / parent.tileHeight,
        x: parseFloat(child.getAttribute('x')) / parent.tileWidth,
        y: parseFloat(child.getAttribute('y')) / parent.tileHeight,
        ...(new TMXProperties(child)),
      };
    });
  }
}

class TMXTileSet {
  constructor(parent, el) {
    this.parent = parent;
    this.el = el;
    this.image = null;
    this.name = el.getAttribute('name');
    this.firstgid = parseInt(el.getAttribute('firstgid'), 10);
    this.tileWidth = parseInt(el.getAttribute('tilewidth'), 10);
    this.tileHeight = parseInt(el.getAttribute('tileheight'), 10);
    this.tileCount = parseInt(el.getAttribute('tilecount'), 10);
    this.columns = parseInt(el.getAttribute('columns'), 10);
    this.lastgid = this.firstgid + this.tileCount;
    this.imgSource = el.querySelector('image').getAttribute('source');
  }
  load() {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.src = this.imgSource;
      image.addEventListener('load', () => {
        this.image = image;
        resolve(image);
      });
      image.addEventListener('error', () => {
        reject();
      });
    });
  }
}

class TMXLayer {
  constructor(parent, el) {
    this.parent = parent;
    this.width = parseInt(el.getAttribute('width'), 10);
    this.height = parseInt(el.getAttribute('height'), 10);

    this.properties = new TMXProperties(el);

    // TODO: support layers that don't fill the map
    if(this.width !== parent.width || this.height !== parent.height)
      throw new Error('layer_size_mismatch');

    const dataEl = el.querySelector('data[encoding="csv"]');
    this.name = el.getAttribute('name');
    this.data = dataEl.innerHTML.trim().split(',').map(x => parseInt(x, 10));
  }
}

class TMXProperties {
  constructor(el) {
    el.childNodes.forEach(child => {
      if(child.nodeName !== 'properties') return;
      child.childNodes.forEach(prop => {
        if(prop.nodeName !== 'property') return;
        const type = prop.getAttribute('type');
        const value = prop.getAttribute('value');
        const name = prop.getAttribute('name');
        switch(type) {
          case 'bool':
            this[name] = value === 'true';
            break;
          case 'int':
            this[name] = parseInt(value, 10);
            break;
          case 'float':
            this[name] = parseFloat(value);
            break;
          default:
            this[name] = value;
        }
      });
    });
  }
}
