import {
  Sprite,
  Surface,
  ansiColor,
  createHexFacingSpriteSet,
  type CellStyle,
  type HexFacing,
  type HexFacingSpriteSet
} from "../src/index.js";

export const DEMO_HEX_FACING_LABELS: Record<HexFacing, string> = {
  n: "N",
  ne: "NE",
  se: "SE",
  s: "S",
  sw: "SW",
  nw: "NW"
};

export function buildDemoHexShipSet(color: number, cockpitGlyph: string): HexFacingSpriteSet {
  const style = {
    foreground: ansiColor(color),
    bold: true
  } satisfies CellStyle;
  const body = Sprite.fromText({
    lines: [" /-\\ ", `| ${cockpitGlyph} |`, " \\_/ "],
    transparentGlyphs: [],
    style
  });

  return createHexFacingSpriteSet((facing) => {
    const surface = new Surface(9, 5);
    surface.blit(body, { x: 2, y: 1 });

    switch (facing) {
      case "n":
        surface.drawText({ x: 4, y: 0 }, "^", style);
        break;
      case "ne":
        surface.drawText({ x: 6, y: 0 }, "/", style);
        surface.drawText({ x: 8, y: 1 }, ">", style);
        break;
      case "se":
        surface.drawText({ x: 8, y: 3 }, ">", style);
        surface.drawText({ x: 6, y: 4 }, "\\", style);
        break;
      case "s":
        surface.drawText({ x: 4, y: 4 }, "v", style);
        break;
      case "sw":
        surface.drawText({ x: 0, y: 3 }, "<", style);
        surface.drawText({ x: 2, y: 4 }, "/", style);
        break;
      case "nw":
        surface.drawText({ x: 2, y: 0 }, "\\", style);
        surface.drawText({ x: 0, y: 1 }, "<", style);
        break;
      default:
        break;
    }

    return Sprite.fromRaster(surface);
  });
}
