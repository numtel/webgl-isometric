import MovableObject from '../classes/MovableObject.js';
import OrthoView from '../classes/OrthoView.js';
import PathFind from '../classes/PathFind.js';
import TMXMap from '../classes/TMXMap.js';

async function loadGame(mapFile) {
  const map = new TMXMap(MovableObject);
  await map.load(mapFile);
  let character = map.findObj('character');

  const pathFinder = new PathFind(map.tileMap(
    (layer) => layer.properties.blocking,
    (layer, x, y, tileGid, prev) => 0,
    1));

  const game = new OrthoView({
    fullPage: true,
    fragmentShader: 'game/frag.glsl',
    dataValues: {
      // Override default
      TILE_SIZE: 32,
      // Custom values
      HUE_RATE: 300,
      PSYCHE_HUE: -1,
      WAVY: -1,
      FISH: -1,
      LENS: -1,
      FRAME_NUM: 0,
      BLACK_CIRCLE_X: 4,
      BLACK_CIRCLE_Y: 3,
      BLACK_CIRCLE_FRAME: -1,
      BLACK_CIRCLE_LEN: 90,
      BLACK_CIRCLE_RAD: 100,
      MAP_WIDTH: map.width,
      MAP_HEIGHT: map.height,
    },
    chunkMap: {
      map_uniforms: [
          'uniform sampler2D u_under_char;',
          'uniform sampler2D u_above_char;',
          'uniform sampler2D u_obj;',
        ].join('\n'),
    },
    onFrame(delta) {
      if(game.FRAME_NUM > Math.pow(2, 32)) game.FRAME_NUM = 0;
      else game.FRAME_NUM++;

      for(let grp of map.objects) for(let obj of grp.children) obj.onFrame(delta);
      objTexture.update(map.drawObjectMap(objFilter, objCanvas));
    },
    onTapOrClick(event, tilePos) {
      if(Math.floor(tilePos.x) === Math.floor(character.x)
          && Math.floor(tilePos.y) === Math.floor(character.y)) {
        character.trigger && triggers[character.trigger](character);
      } else if(tilePos.x > 0 && tilePos.x < map.width
          && tilePos.y > 0 && tilePos.y < map.height) {
        // Move character
        const newPath = pathFinder.search(character, tilePos);
        if(newPath.length) character.curPath = newPath;
      }
    },
  });

  // Prerendered under/over aggregate textures
  const underCharCanvas = map.draw((layer, index) =>
    !layer.properties.aboveChar && !layer.properties.hidden)
  game.createImageTexture('u_under_char', underCharCanvas);

  const aboveCharCanvas = map.draw((layer, index) =>
    layer.properties.aboveChar && !layer.properties.hidden)
  game.createImageTexture('u_above_char', aboveCharCanvas);

  const objFilter = (obj) => !obj.hidden;
  const objCanvas = map.drawObjectMap(objFilter);
  const objTexture = game.createImageTexture('u_obj', objCanvas);

  const retval = { map, game, character };
  await game.init();
  game.center(character.x, character.y);

  // Character actions
  const triggers = {
    async msgBox({ text, triggerAnim }) {
      if(triggerAnim) {
        const triggerObj = map.findObj(triggerAnim);
        if(triggerObj) {
          triggerObj.tileXAnim = true;
          triggerObj.onAnimEnd = () => {
            alert(text);
            triggerObj.onAnimEnd = null;
            triggerObj.tileXAnim = false;
          };
        }
      } else alert(text);
    },
    async loadMap({ mapFile, setCharX, setCharY }) {
      const oldGame = retval.game;
      oldGame.BLACK_CIRCLE_X = character.x;
      oldGame.BLACK_CIRCLE_Y = character.y;
      oldGame.BLACK_CIRCLE_FRAME = game.FRAME_NUM;

      const newMount = await loadGame(map.baseURL + mapFile);
      oldGame.stop();
      game.element.parentNode.removeChild(game.element);
      Object.assign(retval, newMount);
      newMount.character.x = setCharX;
      newMount.character.y = setCharY;
      newMount.game.TILE_SIZE = oldGame.TILE_SIZE;
      newMount.game.center(setCharX, setCharY);
    },
    setCharacterObj(target) {
      character.hidden = true;
      target.hidden = true;
      if(target.changeArtifact) {
        const artifact = map.findObj(target.changeArtifact);
        artifact.hidden = false;
        artifact.x = character.x;
        artifact.y = character.y - character.offsetY;
      }
      const oldCharacter = character;
      oldCharacter.onArrival = null;
      oldCharacter.curPath = null;
      character = map.findObj(target.characterObj);
      character.onArrival = arrivalHandler;
      character.hidden = false;
      character.x = oldCharacter.x;
      character.y = oldCharacter.y;
    },
  };

  const arrivalHandler = () => {
    for(let grp of map.objects) for(let obj of grp.children) {
      if(obj.hidden) continue;
      if(obj.trigger && (obj.trigger in triggers)
          && character.x >= obj.x
          && character.x < obj.x + obj.width
          && character.y >= obj.y - (obj.gid ? obj.height : 0)
          && character.y < obj.y + (obj.gid ? 0 : obj.height)) {
        triggers[obj.trigger](obj);
      }
    }
  };
  character.onArrival = arrivalHandler;

  document.body.append(game.element);
  return retval;
}

loadGame('maps/zeldish.tmx').then(mount => window.mount = mount)
