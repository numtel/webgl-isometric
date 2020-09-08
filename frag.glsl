varying vec2 uv_pos;
#include <map_uniforms>
#include <object_textures>
const float PI = 3.1415926535897;

// from: http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  c = vec3(c.x, clamp(c.yz, 0.0, 1.0));
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 blend(vec3 bottom, vec4 top) {
  if(PSYCHE_HUE > 0.) {
    vec3 in_hsv = rgb2hsv(top.rgb);
    in_hsv.x = mod((FRAME_NUM - PSYCHE_HUE), HUE_RATE) / HUE_RATE;
    top.rgb = hsv2rgb(in_hsv);
  }
  return mix(bottom, top.rgb, top.a);
}

void main() {
  vec3 comp = vec3(0., 0., 0.);
  vec2 uv = uv_pos.xy;
  if(LENS > 0.) {
    float aperture = 178.0;
    float apertureHalf = 0.5 * aperture * (PI / 180.0);
    float maxFactor = sin(apertureHalf);

    vec2 xy = 2.0 * uv_pos.xy - 1.0;
    float d = length(xy);
    if (d < (2.0-maxFactor))
    {
      d = length(xy * maxFactor);
      float z = sqrt(1.0 - d * d);
      float r = atan(d, z) / PI;
      float phi = atan(xy.y, xy.x);

      uv.x = r * cos(phi) + 0.5;
      uv.y = r * sin(phi) + 0.5;
    }
    else
    {
      gl_FragColor =  vec4(0.,0.,0.,1.);
      return;
    }
  }

  vec2 px = vec2((1. - uv.x) * CANVAS_WIDTH, uv.y * CANVAS_HEIGHT);
  vec2 tile_real = (px - vec2(ORIGIN_X, ORIGIN_Y)) / TILE_SIZE;
  if(WAVY > 0.) {
    tile_real.x += uv_pos.y * 5. * cos(mod((FRAME_NUM - WAVY) / 50., PI*2.));
    tile_real.y += uv_pos.x * 5. * sin(mod((FRAME_NUM - WAVY) / 50., PI*2.));
  }
  if(FISH > 0.) {
    tile_real.y += cos(tile_real.x + FRAME_NUM / 20.) * 1. * abs(mod(FRAME_NUM,30.)/30. - 0.5);
    tile_real.x += cos(tile_real.y + FRAME_NUM / 30.) * 1. * abs(mod(FRAME_NUM,40.)/40. - 0.5);

  }
  vec2 cursor_tile = vec2(CURSOR_TILE_X, CURSOR_TILE_Y);

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
    comp = blend(comp, texture2D(u_under_char, layer_pos));

    // Below character animation layers
    comp = blend(comp, texture2D(u_anim_below, layer_pos));

    // Cursor highlight
    if(floor(tile_real) == floor(cursor_tile)) {
      comp.g = 1.;
    }

    #include <draw_objects>
    // Above character layers
    comp = blend(comp, texture2D(u_above_char, layer_pos));

    // Above character animation layers
    comp = blend(comp, texture2D(u_anim_above, layer_pos));

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
