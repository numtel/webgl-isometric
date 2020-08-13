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

vec2 calc_cursor_tile() {
  vec2 cursor_raw = vec2(CURSOR_X - ORIGIN_X, CURSOR_Y - ORIGIN_Y);
  return vec2(
    cursor_raw.x / TILE_SIZE,
    cursor_raw.y / TILE_SIZE
  );
}

vec2 calc_tile(vec2 px) {
  vec2 tile_raw = px - vec2(ORIGIN_X, ORIGIN_Y);
  return vec2(
    tile_raw.x / TILE_SIZE,
    tile_raw.y / TILE_SIZE
  );
}

void main() {
  vec2 px = screen_px();
  vec2 tile_real = calc_tile(px);
  vec2 cursor_tile = calc_cursor_tile();

  vec3 comp = vec3(0., 0.2, 0.);

  if(tile_real.x >= 0. && tile_real.y >= 0. && tile_real.x <= 99. && tile_real.y <= 99.) {
    // Below character layers
    vec4 under_char = texture2D(u_under_char, vec2(
      tile_real.x / MAP_WIDTH,
      tile_real.y / MAP_HEIGHT
    )).rgba;
    if(under_char.a > 0.5) {
      comp.rgb = under_char.rgb;
    }

    // Below character animation layers
    vec4 layer_anim = texture2D(u_anim, vec2(
      tile_real.x / MAP_WIDTH,
      tile_real.y / MAP_HEIGHT
    )).rgba;
    if(layer_anim.a > 0.5) {
      comp.rgb = layer_anim.rgb;
    }
    // Draw character
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
    // Above character layers
    vec4 above_char = texture2D(u_above_char, vec2(
      tile_real.x / MAP_WIDTH,
      tile_real.y / MAP_HEIGHT
    )).rgba;
    if(above_char.a > 0.5) {
      comp.rgb = above_char.rgb;
    }

  }

  if(floor(tile_real) == floor(cursor_tile)) {
    comp.g = 1.;
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
