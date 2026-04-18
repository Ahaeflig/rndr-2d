import { colorEquals, colorToAnsiCodes, type TerminalColor } from "./color.js";

export interface CellStyle {
  foreground?: TerminalColor;
  background?: TerminalColor;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
}

export const EMPTY_STYLE: CellStyle = Object.freeze({});

export function styleEquals(a: CellStyle | undefined, b: CellStyle | undefined) {
  return (
    colorEquals(a?.foreground, b?.foreground) &&
    colorEquals(a?.background, b?.background) &&
    (a?.bold ?? false) === (b?.bold ?? false) &&
    (a?.dim ?? false) === (b?.dim ?? false) &&
    (a?.italic ?? false) === (b?.italic ?? false) &&
    (a?.underline ?? false) === (b?.underline ?? false) &&
    (a?.inverse ?? false) === (b?.inverse ?? false)
  );
}

export function normalizeStyle(style: CellStyle | undefined): CellStyle | undefined {
  if (!style || styleEquals(style, undefined)) {
    return undefined;
  }

  return { ...style };
}

export function mergeStyle(
  base: CellStyle | undefined,
  overlay: CellStyle | undefined
): CellStyle | undefined {
  if (!base && !overlay) {
    return undefined;
  }

  return normalizeStyle({
    ...(base ?? {}),
    ...(overlay ?? {})
  });
}

export function styleToAnsiCodes(style: CellStyle | undefined) {
  if (!style) {
    return [];
  }

  const codes: string[] = [];

  if (style.bold) {
    codes.push("1");
  }

  if (style.dim) {
    codes.push("2");
  }

  if (style.italic) {
    codes.push("3");
  }

  if (style.underline) {
    codes.push("4");
  }

  if (style.inverse) {
    codes.push("7");
  }

  codes.push(...colorToAnsiCodes(style.foreground, "foreground"));
  codes.push(...colorToAnsiCodes(style.background, "background"));

  return codes;
}

