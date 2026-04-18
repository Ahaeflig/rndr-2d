export type TerminalColor =
  | { kind: "default" }
  | { kind: "ansi"; code: number }
  | { kind: "rgb"; r: number; g: number; b: number };

export const DEFAULT_COLOR: TerminalColor = { kind: "default" };

function assertByte(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new RangeError(`${name} must be an integer between 0 and 255.`);
  }
}

export function ansiColor(code: number): TerminalColor {
  assertByte("ANSI color code", code);
  return { kind: "ansi", code };
}

export function rgbColor(r: number, g: number, b: number): TerminalColor {
  assertByte("RGB red component", r);
  assertByte("RGB green component", g);
  assertByte("RGB blue component", b);
  return { kind: "rgb", r, g, b };
}

export function colorEquals(a: TerminalColor | undefined, b: TerminalColor | undefined) {
  if (!a || !b) {
    return a === b;
  }

  if (a.kind !== b.kind) {
    return false;
  }

  if (a.kind === "default") {
    return true;
  }

  if (a.kind === "ansi" && b.kind === "ansi") {
    return a.code === b.code;
  }

  if (a.kind === "rgb" && b.kind === "rgb") {
    return a.r === b.r && a.g === b.g && a.b === b.b;
  }

  return false;
}

export function colorToAnsiCodes(
  color: TerminalColor | undefined,
  layer: "foreground" | "background"
) {
  if (!color || color.kind === "default") {
    return [];
  }

  if (color.kind === "ansi") {
    return [layer === "foreground" ? `38;5;${color.code}` : `48;5;${color.code}`];
  }

  return [
    layer === "foreground"
      ? `38;2;${color.r};${color.g};${color.b}`
      : `48;2;${color.r};${color.g};${color.b}`
  ];
}
