import type { Cell } from "./cell.js";

export interface RasterSource {
  width: number;
  height: number;
  cellAt(x: number, y: number): Cell | null;
}

