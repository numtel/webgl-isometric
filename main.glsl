#ifdef GL_ES
precision highp float;
precision highp int;
#endif

varying vec2 uv_pos;
uniform vec2 canvas_size;
uniform float frame_num;
uniform vec2 tile_size;
uniform vec3 cursor;
uniform float origin[6];
#include <map_uniforms>

uniform sampler2D u_texture0;
uniform sampler2D u_texture1;

vec2 screen_px() {
  return vec2((1. - uv_pos.x) * canvas_size.x, uv_pos.y * canvas_size.y);
}

bool is_origin(vec2 px, float dist) {
  return abs(px.x - origin[0]) < dist && abs(px.y - origin[1]) < dist;
}

bool is_cursor(vec2 px) {
  return abs(px.x - cursor.x) < cursor.z && abs(px.y - cursor.y) < cursor.z;
}

vec4 calc_px_tile(vec2 px) {
  vec2 raw = px - vec2(origin[0], origin[1]);
  return vec4(
    floor(raw.x / tile_size.x),
    floor(raw.y / tile_size.x),
    mod(raw.x, tile_size.x),
    mod(raw.y, tile_size.x)
  );
}

vec4 calc_cursor_tile() {
  vec2 cursor_raw = vec2(cursor) - vec2(origin[0], origin[1]);
  return vec4(
    floor(cursor_raw.x / tile_size.x),
    floor(cursor_raw.y / tile_size.x),
    mod(cursor_raw.x, tile_size.x),
    mod(cursor_raw.y, tile_size.x)
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
    comp.b = max(0.5, comp.b);
  }
  if(tile.x >= 0. && tile.y >= 0. && tile.x <= 99. && tile.y <= 99.) {
    vec4 tileset_coord = texture2D(u_layer0, vec2(
      (tile.x+0.01) / 200.,
      (tile.y+0.01) / 200.
    )).rgba;
    if(tileset_coord.a > 0.5) {
      comp.rgb = texture2D(u_texture0, vec2(
        ((tile.z/tile_size.x)+(tileset_coord.x*255.))/64.,
        ((tile.w/tile_size.x)+(tileset_coord.y*255.))/64.
      )).rgb;
    }
    tileset_coord = texture2D(u_layer0, vec2(
      ((tile.x+0.01) / 200.) + (1./2.),
      (tile.y+0.01) / 200.
    )).rgba;
    if(tileset_coord.a > 0.5) {
      vec4 layer1 = texture2D(u_texture0, vec2(
        ((tile.z/tile_size.x)+(tileset_coord.x*255.))/64.,
        ((tile.w/tile_size.x)+(tileset_coord.y*255.))/64.
      )).rgba;
      if(layer1.a > 0.5) {
        comp.rgb = layer1.rgb;
      }
    }
    tileset_coord = texture2D(u_layer0, vec2(
      (tile.x+0.01) / 200.,
      ((tile.y+0.01) / 200.) + (1./2.)
    )).rgba;
    if(tileset_coord.a > 0.5) {
      vec4 layer1 = texture2D(u_texture0, vec2(
        ((tile.z/tile_size.x)+(tileset_coord.x*255.))/64.,
        ((tile.w/tile_size.x)+(tileset_coord.y*255.))/64.
      )).rgba;
      if(layer1.a > 0.5) {
        comp.rgb = layer1.rgb;
      }
    }
    tileset_coord = texture2D(u_layer0, vec2(
      ((tile.x+0.01) / 200.) + (1./2.),
      ((tile.y+0.01) / 200.) + (1./2.)
    )).rgba;
    if(tileset_coord.a > 0.5) {
      vec4 layer1 = texture2D(u_texture0, vec2(
        ((tile.z/tile_size.x)+(tileset_coord.x*255.))/64.,
        ((tile.w/tile_size.x)+(tileset_coord.y*255.))/64.
      )).rgba;
      if(layer1.a > 0.5) {
        comp.rgb = layer1.rgb;
      }
    }

//     comp.rgb = texture2D(u_layer0, vec2(0.01,0.5)).rgb;
  }
  if(tile.x == cursor_tile.x && tile.y == cursor_tile.y) {
    comp.g = 1.;
  }
  vec2 tile_real = vec2(
    tile.x + (tile.z / tile_size.x),
    tile.y + (tile.w / tile_size.x)
  );
  vec2 CHAR_HALFSIZE=vec2(0.5,1.);
  if((abs(tile_real.x - origin[2]) < CHAR_HALFSIZE.x)
      && (abs(tile_real.y - origin[3]) < CHAR_HALFSIZE.y)) {
    vec2 offset = vec2(
      tile_real.x - origin[2],
      tile_real.y - origin[3]
    );
//     comp.rgb = vec3(offset.x/CHAR_HALFSIZE.x,offset.y/CHAR_HALFSIZE.y,0.);
    vec2 tileset_coord = vec2(
      offset.x + CHAR_HALFSIZE.x,
      offset.y + CHAR_HALFSIZE.y
    );

    vec4 char = texture2D(u_texture1, vec2(
      ((tileset_coord.x/CHAR_HALFSIZE.x/2.)+origin[4])/4.,
      ((tileset_coord.y/CHAR_HALFSIZE.y/2.)+origin[5])/4.
    )).rgba;
    if(char.a > 0.5) {
      comp.rgb = char.rgb;
    }
  }

//   if(tile.z < tile_border_width) {
//     comp.g = max(0.8, comp.g);
//   }
//   if(tile.w < tile_border_width) {
//     comp.r = max(0.8, comp.r);
//   }

  return comp;
}

void main() {
  vec2 px = screen_px();
  vec4 tile = calc_px_tile(px);
  vec4 cursor_tile = calc_cursor_tile();

  gl_FragColor = vec4(draw(px, tile, cursor_tile), 1.);
//   gl_FragColor = texture2D(u_texture, uv_pos);
}
