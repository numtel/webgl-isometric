# WebGL orthographic view

* Maps created with [Tiled Map Editor](https://thorbjorn.itch.io/tiled)
* Art under CC license from [Open Game Art](https://opengameart.org/content/zelda-like-tilesets-and-sprites)

# Map Properties

The root `map` node must contain the following properties:

Name | Description
----|-----------
`initCharX` | `int` Tile X position for character starting point
`initCharY` | `int` Tile Y position for character starting point

## Layer Properties

Each layer can have a selection of the following properties:

> Only tile layers supported so far!

Name | Description
-----|----------------
`aboveChar` | `bool` Layer is to be drawn above the character
`frame` | `int` Layer is part of an animation, display on this frame number
`frame_max` | `int` Must be specified if `frame` is given, the total number of frames in the animation sequare
`blocking` | `boolean` Layer tiles will block the character's path
`trigger` | `string` These tiles invoke an action when stopped atop. Layer will not be drawn. Each trigger defines its own additional properties.

### Available trigger actions

#### `loadMap`

Transport the player to a new scene. All properties required.

Additional Property | Description
-----|-----------------
`mapFile` | `string` Filename ending in `.tmx` to load
`setCharX` | `string` Character starting point in new map
`setCharY` | `string` Character starting point in new map

#### `msgBox`

Display a message to the player. String `text` property required.
