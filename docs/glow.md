# Terminal Glow

`rndr-2d` supports glow as a terminal-native rendering effect. It is not real
optical bloom; it is a deterministic approximation built from ANSI color,
background color, Unicode braille, and half-block glyphs.

## Primitives

### `DenseLightSurface`

Use this when shape detail matters.

- stores additive RGB light in braille dot space
- compiles to `2x4` braille cells
- supports hash or ordered Bayer dithering
- works well for sparks, outlines, particles, trails, and crisp highlights

### `HalfBlockLightSurface`

Use this when smooth color matters.

- stores two vertical light samples per terminal cell
- compiles with `▀` and `▄`
- uses foreground and background color in one cell
- works well for soft auras, large glows, fog, and background light fields

### `HybridLightSurface`

Use this for the strongest glow illusion in normal ANSI output.

- renders soft mass with `HalfBlockLightSurface`
- renders crisp detail with `DenseLightSurface`
- preserves the soft background under braille highlights

## Techniques

### Palette Ramps

Linear RGB scaling usually looks flat. A `LightColorRamp` maps accumulated
energy to hand-tuned colors:

```ts
const ramp = [
  { energy: 0, color: { r: 3, g: 18, b: 72 } },
  { energy: 0.7, color: { r: 35, g: 92, b: 255 } },
  { energy: 1.3, color: { r: 58, g: 224, b: 255 } },
  { energy: 2.1, color: { r: 242, g: 252, b: 255 } }
];
```

### Background Glow

Background glow is the most convincing static effect. It lets low-energy light
color the cell background even when no foreground glyph is emitted.

```ts
const glow = new HalfBlockLightSurface(24, 12, {
  colorRamp: ramp,
  backgroundGlow: true,
  backgroundGlowMinEnergy: 0.02,
  backgroundGlowScale: 1
});
```

When applying background glow over readable board text, blit the glow layer
with `blendMode: "background"`. Background-only glow cells will tint the
destination background while preserving the destination glyph and foreground.

### Ordered Dithering

Hash dithering looks sparkly. Ordered Bayer dithering looks steadier and more
intentional for large gradients.

```ts
const detail = new DenseLightSurface(24, 12, {
  ditherMode: "bayer4",
  ditherSeed: 3
});
```

### Temporal Helpers

The glow helpers are pure. They do not own game loops. Use `lightPulse` and
`lightShimmerSeed` to derive deterministic per-frame parameters.

```ts
const pulse = lightPulse({ frame, period: 48, base: 0.9, amplitude: 0.25 });
const seed = lightShimmerSeed(11, frame, 1);
```

## Example

```ts
import {
  HybridLightSurface,
  lightPulse,
  lightShimmerSeed
} from "rndr-2d";

const glow = new HybridLightSurface(30, 12, {
  halfBlock: {
    colorRamp: ramp,
    backgroundGlow: true,
    backgroundGlowMinEnergy: 0.02
  },
  dense: {
    colorRamp: ramp,
    ditherMode: "bayer4",
    ditherSeed: lightShimmerSeed(7, frame, 1)
  }
});

const pulse = lightPulse({ frame, period: 48, base: 0.9, amplitude: 0.25 });

glow.soft.addHalo({ x: 15, y: 12 }, 12, { r: 35, g: 92, b: 255 }, 0.35 * pulse);
glow.soft.addRing({ x: 15, y: 12 }, 6, 4, { r: 58, g: 224, b: 255 }, 0.5 * pulse);
glow.detail.addRing({ x: 30, y: 24 }, 12, 2, { r: 242, g: 252, b: 255 }, 0.9 * pulse);
```

Run the visual checks:

```bash
pnpm demo:zoo
pnpm demo:glow-techniques
pnpm demo:halfblock-glow
```

In the feature zoo, switch to page `4` for the glow lab.
