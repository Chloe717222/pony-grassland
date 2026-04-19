# SVG assets: `content/svg-global/`

Store **background**, **icon**, and **modal decoration** SVGs here (next to `data.json` and CSVs).

## Link to the running page

- **Scenes 1 to 4** still load **`content/scene1-back.svg` through `content/scene4-back.svg`** from `SCENE_STATIC_BACKDROP` in `index.html`. This folder is **not** read automatically.
- When your SVGs are ready: **copy** them over those `scene*-back.svg` files, **or** change the `url` strings in `index.html` to paths under `content/svg-global/...`.

**Modal look** is mostly **CSS** in `index.html`. Use `modals/` and `icons/` for extra vector art; hook them up with `background-image`, `<img>`, or inline SVG when you want.

## Folders

| Path | Use |
|------|-----|
| `backgrounds/` | Fullscreen or large backgrounds |
| `icons/` | Small UI marks |
| `modals/` | Modal frame pieces, header strips |

## Files (edit or replace)

### `backgrounds/`

| File | Notes |
|------|--------|
| `bg-scene-1.svg` | Scene 1 placeholder (same role as `bg-scene-s01.svg`). |
| `bg-scene-s01.svg` | Alternate name for scene 1 (some environments dislike the exact name `bg-scene-01.svg`). |
| `bg-scene-02.svg` ... `bg-scene-05.svg` | Scenes 2 to 5. |
| `bg-grass-strip-tile.svg` | Optional strip for tiled grass. |

### `icons/`

| File | Notes |
|------|--------|
| `icon-ui-close.svg` | Close |
| `icon-ui-info.svg` | Info |
| `icon-ui-chevron-right.svg` | Chevron right |

### `modals/`

| File | Notes |
|------|--------|
| `modal-card-frame.svg` | Card frame |
| `modal-header-accent.svg` | Header accent bar |
