# Jungle Soldier 3D · Forest Level 1 (PlayCanvas)

Forest Level 1, "Overgrown Trail", rebuilt in full 3D on the PlayCanvas engine with
the new creature roster. This is a separate game from the original 2.5D Jungle Soldier
(V16), which lives in [Arcade_Archer](https://github.com/pkumar1301/Arcade_Archer).

Play it at https://pkumar1301.github.io/Jungle_Soldier_3D/, or locally:

```sh
python3 -m http.server 8775 --bind 127.0.0.1
```

Open http://127.0.0.1:8775/. Add `?q=low` or `?q=medium` to force a graphics level.

## Controls

W run · S brake · A/D strafe (double-tap to roll) · Space jump · mouse aim · hold
left click fire · E or right click grenade · Esc pause · M music.

## The level

950 m, about 2 minutes 40 seconds at a full run. Nine enemy roles, each introduced
with a one-line tip the first time it appears:

| Enemy | Model | Role | How to beat it |
| --- | --- | --- | --- |
| Raptor | raptor.glb | Rusher | It rears up (0.6 s) before it lunges: strafe away |
| Jungle spider | spider.glb | Spitter | Holds 12-15 m away; acid lands on a green ring |
| Jungle rats | rat.glb | Swarm of five | Thin them out; each bite is small, passing rats cost 2 |
| Bloated rat | rat.glb, bloat skin | Exploder | Shoot it early; its burst hurts you and other enemies |
| Wyvern | wyvern.glb | Flyer | Spits fireballs; dives onto a red ring: roll out |
| Charger | charger.glb | Elite | Roars and marks a red lane, then charges; dodge and it is stunned (double damage) |
| Shell beetle | shell_beetle.glb, moss skin | Armoured blocker | Its front stops bullets; flank it or use a grenade |
| Trapdoor spider | spider.glb | Ambusher | Watch for moving ground ahead |
| Turret | built in code | Turret | Hit the glowing core on its back |

## Bestiary

The menu's Bestiary shows every creature model in all five biome skins (Forest,
Desert, Tundra, Volcano, Alien hive), including the ones planned for later biomes.

## Files

- `index.html` page, HUD, menus, Bestiary
- `js/game.js` game loop, enemy behaviour, combat, HUD, test hooks (`window.pcTest`)
- `js/creatures.js` creature registry: model files, clips, facing, scale
- `js/skins.js` biome skins made by recolouring each model's own texture
- `js/world.js` the Forest scene; `js/scenery.js` MegaKit foliage on the code-built trunks
- `js/models.js` turret, pickups, projectiles; `js/fx.js` particles; `js/textures.js` procedural textures
- `models/` creature GLBs and the MegaKit subset; `assets/` soldier, sky, ground textures
- `tools/` engine build, soldier converter, model reducer, texture shrinker, preview pages

See `CREDITS.md` for sources and licences. Several creature licences still need confirming.

## Graphics levels

High: 3 shadow cascades, light shafts, SSAO, 4x MSAA. Medium: 2 cascades, light shafts,
no SSAO. Low: 1 cascade, no light shafts, lower resolution. The game drops a level by
itself if the frame rate stays under 34 fps for 4 seconds.
