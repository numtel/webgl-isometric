varying vec2 uv_pos;
#include <map_uniforms>

vec3 blend(vec3 bottom, vec4 top) {
  return (bottom * (1.-top.a)) + (top.rgb * top.a);
}

void main() {
  vec2 px = vec2((1. - uv_pos.x) * CANVAS_WIDTH, uv_pos.y * CANVAS_HEIGHT);
  vec2 tile_real = (px - vec2(ORIGIN_X, ORIGIN_Y)) / TILE_SIZE;
  vec2 cursor_tile = vec2(CURSOR_TILE_X, CURSOR_TILE_Y);

  vec3 comp = vec3(0., 0.2, 0.);

  if(tile_real.x >= 0.
    && tile_real.y >= 0.
    && tile_real.x < MAP_WIDTH
    && tile_real.y < MAP_HEIGHT
  ) {
    vec2 layer_pos = vec2(
      tile_real.x / MAP_WIDTH,
      tile_real.y / MAP_HEIGHT
    );

    // Below character layers
    comp = blend(comp, texture2D(u_under_char, layer_pos).rgba);

    // Below character animation layers
    comp = blend(comp, texture2D(u_anim_below, layer_pos).rgba);

    // Cursor highlight
    if(floor(tile_real) == floor(cursor_tile)) {
      comp.g = 1.;
    }

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
    comp = blend(comp, texture2D(u_above_char, layer_pos).rgba);

    // Above character animation layers
    comp = blend(comp, texture2D(u_anim_above, layer_pos).rgba);

  }

  // Expanding black circle show when exiting map
  if(BLACK_CIRCLE_FRAME >= 0.) {
    float circleProgress =
      ((FRAME_NUM - BLACK_CIRCLE_FRAME) / BLACK_CIRCLE_LEN)
        * BLACK_CIRCLE_RAD;
    vec2 blackCircleOff = vec2(
      BLACK_CIRCLE_X - tile_real.x,
      BLACK_CIRCLE_Y - tile_real.y
    );
    float blackCircleDist = circleProgress * circleProgress -
      (blackCircleOff.x * blackCircleOff.x + blackCircleOff.y * blackCircleOff.y);
    if(blackCircleDist > 0.) {
      comp.rgb = vec3(0.,0.,0.);
    }
  }

  gl_FragColor = vec4(comp, 1.);
}
