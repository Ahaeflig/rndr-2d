import type { Cell } from "./cell.js";
import type { Point, Size } from "./geometry.js";
import type { RasterSource } from "./raster.js";
import { Surface, type BlendMode } from "./surface.js";
import type { CellStyle } from "./style.js";

export interface LayerItem {
  source: RasterSource;
  position: Point;
  visible?: boolean;
  blendMode?: BlendMode;
  style?: CellStyle;
}

export interface Layer {
  name: string;
  z?: number;
  visible?: boolean;
  items: readonly LayerItem[];
}

export interface Scene {
  size: Size;
  background?: Cell | null;
  layers: readonly Layer[];
}

export function composeScene(scene: Scene) {
  const frame = new Surface(scene.size.width, scene.size.height, scene.background ?? null);
  const orderedLayers = scene.layers
    .map((layer, index) => ({ index, layer }))
    .filter(({ layer }) => layer.visible ?? true)
    .sort((left, right) => {
      const zDiff = (left.layer.z ?? 0) - (right.layer.z ?? 0);
      return zDiff !== 0 ? zDiff : left.index - right.index;
    });

  for (const { layer } of orderedLayers) {
    for (const item of layer.items) {
      if (item.visible === false) {
        continue;
      }

      frame.blit(item.source, item.position, {
        ...(item.blendMode ? { blendMode: item.blendMode } : {}),
        ...(item.style ? { style: item.style } : {})
      });
    }
  }

  return frame;
}

