varying vec2 uv_pos;
#include <map_uniforms>

vec2 screen_px() {
  return vec2((1. - uv_pos.x) * CANVAS_WIDTH, uv_pos.y * CANVAS_HEIGHT);
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

vec3 blend(vec3 bottom, vec4 top) {
  bottom.r = (bottom.r * (1.-top.a)) + (top.r * top.a);
  bottom.g = (bottom.g * (1.-top.a)) + (top.g * top.a);
  bottom.b = (bottom.b * (1.-top.a)) + (top.b * top.a);
  return bottom;
}

void main() {
  vec2 px = screen_px();
  vec2 tile_real = calc_tile(px);
  vec2 cursor_tile = calc_cursor_tile();

  vec3 comp = vec3(0., 0.2, 0.);

  if(tile_real.x >= 0. && tile_real.y >= 0. && tile_real.x < MAP_WIDTH && tile_real.y < MAP_HEIGHT) {
    vec2 layer_pos = vec2(
      tile_real.x / MAP_WIDTH,
      tile_real.y / MAP_HEIGHT
    );

    // Below character layers
    vec4 under_char = texture2D(u_under_char, layer_pos).rgba;
    comp = blend(comp, under_char);

    // Below character animation layers
    vec4 layer_anim = texture2D(u_anim, layer_pos).rgba;
    comp = blend(comp, layer_anim);

    // Draw character
    float moveProgress;
    if(CHAR_MOVE_FRAME >= 0.) {
      moveProgress = ((FRAME_NUM - CHAR_MOVE_FRAME) / CHAR_MOVE_LEN);
    } else {
      moveProgress = 0.;
    }
    vec2 charPos = vec2(
      CHAR_X + ((CHAR_MOVE_X - CHAR_X) * moveProgress),
      CHAR_Y + ((CHAR_MOVE_Y - CHAR_Y) * moveProgress)
    );
    if((abs(tile_real.x - charPos.x - CHAR_HALF_X) < CHAR_HALF_X)
        && (abs(tile_real.y - charPos.y) < CHAR_HALF_Y)) {

      vec2 tileset_coord = vec2(
        tile_real.x - charPos.x,
        tile_real.y - charPos.y + CHAR_HALF_Y
      );

      vec4 char = texture2D(u_char, vec2(
        ((tileset_coord.x/CHAR_HALF_X/2.)+CHAR_TILE_X)/TILESET_CHAR_COLUMNS,
        ((tileset_coord.y/CHAR_HALF_Y/2.)+CHAR_TILE_Y)/TILESET_CHAR_ROWS
      )).rgba;

      comp = blend(comp, char);
    }
    // Above character layers
    vec4 above_char = texture2D(u_above_char, layer_pos).rgba;
    comp = blend(comp, above_char);

    // Above character animation layers
    vec4 layer_anim_above = texture2D(u_anim_above, layer_pos).rgba;
    comp = blend(comp, layer_anim_above);

  }

  if(floor(tile_real) == floor(cursor_tile)) {
    comp.g = 1.;
  }

  float circleProgress;
  if(BLACK_CIRCLE_FRAME >= 0.) {
    circleProgress = ((FRAME_NUM - BLACK_CIRCLE_FRAME) / BLACK_CIRCLE_LEN) * BLACK_CIRCLE_RAD;
  } else {
    circleProgress = 0.;
  }
  vec2 blackCircleOff = vec2(
    BLACK_CIRCLE_X - tile_real.x,
    BLACK_CIRCLE_Y - tile_real.y
  );
  float blackCircleDist = circleProgress * circleProgress -
    (blackCircleOff.x * blackCircleOff.x + blackCircleOff.y * blackCircleOff.y);
  if(blackCircleDist > 0.) {
    comp.rgb = vec3(0.,0.,0.);
  }

  gl_FragColor = vec4(comp, 1.);
}
