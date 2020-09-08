# WebGL orthographic view

* Maps created with [Tiled Map Editor](https://thorbjorn.itch.io/tiled)
* Art under CC license from [Open Game Art](https://opengameart.org/content/zelda-like-tilesets-and-sprites)

## Layer Properties

Each layer can have a selection of the following properties:

Name | Description
-----|----------------
`aboveChar` | `bool` Layer is to be drawn above the character
`blocking` | `boolean` Layer tiles will block the character's path

## Tile objects

Tile objects may be animated along a horizontal strip in a sprite sheet.

Property | Description
--------|--------------
`tileXAnim` | `boolean` True for animation to play
`tileXAnimStage2Frame` | `int` Optional. After animating to end, restart at this frame instead of `tileXMin`
`tileXMax` | `int` Required for animating, the x-index in the sprite sheet at the end of the sequence
`tileXMin` | `int` Required for animating, the x-index in the sprite sheet at the beginning of the sequence
`tileXTime` | `int` Duration to show each frame in milliseconds

## Available trigger actions

Rectangular objects can perform actions when the character stops inside the area.

Property | Description
--------|----------------
`trigger` | `string` These tiles invoke an action when stopped atop. Layer will not be drawn. Each trigger defines its own additional properties.

### `loadMap`

Transport the player to a new scene. All properties required.

Additional Property | Description
-----|-----------------
`mapFile` | `string` Filename ending in `.tmx` to load
`setCharX` | `string` Character starting point in new map
`setCharY` | `string` Character starting point in new map

### `msgBox`

Display a message to the player.

Additional Property | Description
-----|-----------------
`text` | `string` Required
`triggerAnim` | `string` Optional, named of a tile object with `tileXAnim` initialized as `false`
