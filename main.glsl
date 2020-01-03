// TODO #import <isoview>
#ifdef GL_ES
precision mediump float;
precision mediump int;
#endif

varying vec2 uv_pos;
uniform vec2 canvas_size;
uniform float frame_num;
uniform vec2 tile_size;
uniform vec3 cursor;
uniform vec2 origin;

uniform sampler2D u_texture;

vec2 screen_px() {
  return vec2((1. - uv_pos.x) * canvas_size.x, uv_pos.y * canvas_size.y);
}

bool is_origin(vec2 px, float dist) {
  return abs(px.x - origin.x) < dist && abs(px.y - origin.y) < dist;
}

bool is_cursor(vec2 px) {
  return abs(px.x - cursor.x) < cursor.z && abs(px.y - cursor.y) < cursor.z;
}

vec4 calc_px_tile(vec2 px) {
  vec2 raw = px - origin;
  return vec4(
    floor(-(raw.x * tile_size.y - raw.y) / tile_size.x),
    floor(-(-raw.x * tile_size.y - raw.y) / tile_size.x),
    mod(raw.x * tile_size.y - raw.y, tile_size.x),
    mod(-raw.x * tile_size.y - raw.y, tile_size.x)
  );
}

vec4 calc_cursor_tile() {
  vec2 cursor_raw = vec2(cursor) - origin;
  return vec4(
    floor(-(cursor_raw.x * tile_size.y - cursor_raw.y) / tile_size.x),
    floor(-(-cursor_raw.x * tile_size.y - cursor_raw.y) / tile_size.x),
    mod(cursor_raw.x * tile_size.y - cursor_raw.y, tile_size.x),
    mod(-cursor_raw.x * tile_size.y - cursor_raw.y, tile_size.x)
  );
}

vec3 draw(vec2 px, vec4 tile, vec4 cursor_tile) {
  float tile_border_width = max(1., min(3., tile_size.x * 0.05));
  vec3 comp = vec3(0., 0.2, 0.);

  if(is_cursor(px)) {
    comp.r = 1.;
  }
  if(is_origin(px, 3.)) {
    comp.b = 1.;
    comp.r = 1.;
  }

  if(tile.x >= 0.) {
    comp.g = max(0.5, comp.g);
  }
  if(tile.y >= 0.) {
    comp.r = max(0.5, comp.r);
  }
  if(tile.x >= 0. && tile.y >= 0.) {
    // TODO not yet aligned
    comp.rgb = texture2D(u_texture, vec2(tile.z/tile_size.x, tile.w/tile_size.x)).rgb;
    // How to align the image?
//     comp.rg = vec2(
//       tile.z/tile_size.x,
//       tile.w/tile_size.x);

//     comp.rg = vec2(
//       0.5 + (tile.z + tile.w)/tile_size.x/2.,
//       (tile.z + tile.w)/tile_size.x/2.
//     );

//     comp.rgb = texture2D(u_texture, vec2(
//       0.5 + (tile.z + tile.w)/tile_size.x/2.,
//       (tile.z + tile.w)/tile_size.x/2.
//     )).rgb;
  }
  if(tile.x == cursor_tile.x && tile.y == cursor_tile.y) {
    comp.g = 1.;
  }

  if(tile.z < tile_border_width && tile.z > -1. * tile_border_width) {
    comp.g = max(0.8, comp.g);
  }
  if(tile.w < tile_border_width && tile.w > -1. * tile_border_width) {
    comp.r = max(0.8, comp.r);
  }

  return comp;
}

void main() {
  vec2 px = screen_px();
  vec4 tile = calc_px_tile(px);
  vec4 cursor_tile = calc_cursor_tile();

  gl_FragColor = vec4(draw(px, tile, cursor_tile), 1.);
//   gl_FragColor = texture2D(u_texture, uv_pos);
}
