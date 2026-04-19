export {
  ANSI_RESET,
  clearScreen,
  cursorTo,
  enterAltScreen,
  hideTerminalCursor,
  leaveAltScreen,
  renderSurfaceAnsi,
  renderSurfaceDiffAnsi,
  showTerminalCursor
} from "./ansi.js";

export {
  ansiColor,
  DEFAULT_COLOR,
  rgbColor
} from "./color.js";
export type { TerminalColor } from "./color.js";

export {
  cellEquals,
  cloneCell,
  createCell,
  withCellStyle
} from "./cell.js";
export type { Cell } from "./cell.js";

export type {
  Point,
  Rect,
  Size
} from "./geometry.js";
export {
  plotLinePoints,
  pointInRect
} from "./geometry.js";

export {
  renderSurfacePlain,
  renderSurfaceWithAxes,
  summarizeSurface,
  summarizeSurfaceDiff,
  visualizeAnsi
} from "./debug.js";
export type { PlainRenderOptions, SurfaceDiffStats, SurfaceStats } from "./debug.js";

export {
  createHexFacingSpriteSet,
  createHexGridSprite,
  DEFAULT_HEX_LAYOUT,
  DEFAULT_HEX_TILE_TEMPLATE,
  drawHexLabel,
  drawHexTextBlock,
  HEX_FACINGS,
  HEX_FACING_ID_BY_NAME,
  HEX_FACING_NAME_BY_ID,
  HEX_FACING_NAMES,
  getHexFacingSprite,
  getHexFacingValue,
  hexFacingVector,
  hexFacingName,
  hexFacingFromScreenDelta,
  hexBoardSize,
  mapHexFacings,
  normalizeHexFacing,
  projectHexCenter,
  projectHexContentBox,
  projectHexContentRows,
  projectHexOrigin,
  rotateHexFacing,
  scaleHexLayout
} from "./hex.js";
export type {
  AxialCoord,
  HexFacing,
  HexFacingLike,
  HexFacingMap,
  HexFacingName,
  HexFacingSpriteSet,
  HexBoardSize,
  HexLayout,
  HexTileTemplate
} from "./hex.js";

export type { RasterSource } from "./raster.js";

export { composeScene } from "./scene.js";
export type { Layer, LayerItem, Scene } from "./scene.js";

export { drawTextBlockInRect, drawTextBlockInRows } from "./text.js";
export type { DrawTextBlockInRectInput, DrawTextBlockInRowsInput } from "./text.js";

export {
  rotateGlyphQuarterTurns,
  Sprite
} from "./sprite.js";
export type { GlyphRotator, SpriteTextInput } from "./sprite.js";

export {
  Surface
} from "./surface.js";
export type { BlendMode, BlitOptions } from "./surface.js";

export {
  EMPTY_STYLE,
  mergeStyle,
  normalizeStyle,
  styleEquals,
  styleToAnsiCodes
} from "./style.js";
export type { CellStyle } from "./style.js";
