varying vec2 uv_pos;
#include <map_uniforms>

vec2 screen_px() {
  return vec2((1. - uv_pos.x) * CANVAS_WIDTH, uv_pos.y * CANVAS_HEIGHT);
}

bool is_origin(vec2 px, float dist) {
  return abs(px.x - ORIGIN_X) < dist && abs(px.y - ORIGIN_Y) < dist;
}

bool is_cursor(vec2 px) {
  return abs(px.x - CURSOR_X) < CURSOR_SIZE && abs(px.y - CURSOR_Y) < CURSOR_SIZE;
}

vec4 calc_px_tile(vec2 px) {
  vec2 raw = px - vec2(ORIGIN_X, ORIGIN_Y);
  return vec4(
    floor(raw.x / TILE_SIZE),
    floor(raw.y / TILE_SIZE),
    mod(raw.x, TILE_SIZE),
    mod(raw.y, TILE_SIZE)
  );
}

vec4 calc_cursor_tile() {
  vec2 cursor_raw = vec2(CURSOR_X - ORIGIN_X, CURSOR_Y - ORIGIN_Y);
  return vec4(
    floor(cursor_raw.x / TILE_SIZE),
    floor(cursor_raw.y / TILE_SIZE),
    mod(cursor_raw.x, TILE_SIZE),
    mod(cursor_raw.y, TILE_SIZE)
  );
}

vec4 drawLayer(vec4 tile, vec2 dimensionMultiplier, vec2 quadOffset, sampler2D texture) {
  vec4 tileset_coord = texture2D(texture, vec2(
    ((tile.x+0.01) / (MAP_WIDTH * dimensionMultiplier.x)) + quadOffset.x,
    ((tile.y+0.01) / (MAP_WIDTH * dimensionMultiplier.y)) + quadOffset.y
  )).rgba;

  if(tileset_coord.a > 0.5) {
    return texture2D(u_texture0, vec2(
      ((tile.z/TILE_SIZE)+(tileset_coord.x*255.))/TILESET0_COLUMNS,
      ((tile.w/TILE_SIZE)+(tileset_coord.y*255.))/TILESET0_ROWS
    )).rgba;
  }
}

void main() {
  vec2 px = screen_px();
  vec4 tile = calc_px_tile(px);
  vec4 cursor_tile = calc_cursor_tile();

  vec3 comp = vec3(0., 0.2, 0.);

  if(tile.x >= 0. && tile.y >= 0. && tile.x <= 99. && tile.y <= 99.) {
    vec4 layer0 = drawLayer(tile, vec2(2.,2.), vec2(0.,0.), u_layer0);
    if(layer0.a > 0.5) {
      comp.rgb = layer0.rgb;
    }
    vec4 layer1 = drawLayer(tile, vec2(2.,2.), vec2(0.5,0.), u_layer0);
    if(layer1.a > 0.5) {
      comp.rgb = layer1.rgb;
    }
    vec4 layer2 = drawLayer(tile, vec2(2.,2.), vec2(0.,0.5), u_layer0);
    if(layer2.a > 0.5) {
      comp.rgb = layer2.rgb;
    }
    vec4 layer3 = drawLayer(tile, vec2(2.,2.), vec2(0.5,0.5), u_layer0);
    if(layer3.a > 0.5) {
      comp.rgb = layer3.rgb;
    }
    vec4 layer_anim = drawLayer(tile, vec2(1.,1.), vec2(0.,0.), u_anim);
    if(layer_anim.a > 0.5) {
      comp.rgb = layer_anim.rgb;
    }

  }
  if(tile.x == cursor_tile.x && tile.y == cursor_tile.y) {
    comp.g = 1.;
  }

  // Draw character
  vec2 tile_real = vec2(
    tile.x + (tile.z / TILE_SIZE),
    tile.y + (tile.w / TILE_SIZE)
  );
  const vec2 CHAR_HALFSIZE=vec2(0.5,1.);
  if((abs(tile_real.x - CHAR_X) < CHAR_HALFSIZE.x)
      && (abs(tile_real.y - CHAR_Y) < CHAR_HALFSIZE.y)) {

    vec2 tileset_coord = vec2(
      tile_real.x - CHAR_X + CHAR_HALFSIZE.x,
      tile_real.y - CHAR_Y + CHAR_HALFSIZE.y
    );

    vec4 char = texture2D(u_texture1, vec2(
      ((tileset_coord.x/CHAR_HALFSIZE.x/2.)+CHAR_TILE_X)/TILESET1_COLUMNS,
      ((tileset_coord.y/CHAR_HALFSIZE.y/2.)+CHAR_TILE_Y)/TILESET1_ROWS
    )).rgba;

    if(char.a > 0.5) {
      comp.rgb = char.rgb;
    }
  }

  if(is_cursor(px)) {
    comp.r = 1.;
  }
  if(is_origin(px, 3.)) {
    comp.b = 1.;
    comp.r = 1.;
  }

  gl_FragColor = vec4(comp, 1.);
}
