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
  pointInPolygon,
  pointInRect
} from "./geometry.js";

export {
  BRAILLE_DOT_COLUMNS,
  BRAILLE_DOT_ROWS,
  brailleCellSizeFromDotSize,
  brailleDotPointFromCell,
  brailleDotRectFromCellRect,
  mapBrailleCellPoints,
  BrailleSurface
} from "./braille.js";
export type {
  BrailleCellAnchor,
  BrailleDot,
  BraillePaint,
  BrailleSurfaceOptions
} from "./braille.js";

export {
  DenseLightSurface,
  HalfBlockLightSurface,
  HybridLightSurface,
  lightPulse,
  lightShimmerSeed,
  sampleLightColorRamp
} from "./glow.js";
export type {
  DenseLightColor,
  DenseLightSample,
  DenseLightSurfaceOptions,
  HalfBlockLightSurfaceOptions,
  HybridLightSurfaceOptions,
  LightColorRamp,
  LightColorRampStop,
  LightDitherMode,
  LightPulseOptions
} from "./glow.js";

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
  drawHexEdge,
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
  projectHexAnchor,
  projectHexCenter,
  projectHexContentBox,
  projectHexContentRows,
  projectHexOrigin,
  rotateHexFacing,
  scaleHexLayout
} from "./hex.js";
export type {
  AxialCoord,
  HexEdge,
  HexEdgeLike,
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

export {
  addProjectedLightDot,
  addProjectedLightLine,
  addProjectedLightPlaneRing,
  blitProjectedBrailleBillboard,
  createOrthographicProjection3D,
  createPerspectiveProjection3D,
  drawProjectedLine,
  drawProjectedHexGrid,
  fillProjectedPlaneCircle,
  fillProjectedPolygon,
  paintProjectedDot,
  projectedHexPlaneCenterPoint,
  projectedHexPlaneCorners,
  projectPointToBrailleDot,
  screenPointToBrailleDot,
  strokeProjectedPlaneCircle,
  strokeProjectedPolygon
} from "./projection.js";
export type {
  CameraBasis3D,
  OrthographicProjection3DInput,
  PerspectiveProjection3DInput,
  Point3,
  ProjectedBrailleBillboardAnchor,
  ProjectedBrailleBillboardInput,
  ProjectedHexGridInput,
  ProjectedHexPlaneLayout,
  ProjectedLightPlaneRingInput,
  ProjectedPlaneCircleInput,
  ProjectedPoint3D,
  Projection3D
} from "./projection.js";

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
