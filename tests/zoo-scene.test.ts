import { describe, expect, it } from "vitest";

import {
  buildZooFrame,
  createInitialZooState
} from "../examples/zoo-scene.js";

describe("feature zoo scene", () => {
  it("renders the glow lab page inside the standard frame", () => {
    const state = createInitialZooState();
    state.page = "glow";

    const frame = buildZooFrame({
      state,
      elapsedMs: 1200,
      frameNumber: 12,
      fps: 18,
      previousStats: null,
      previousDiff: null,
      terminalColumns: 80,
      terminalRows: 24
    });

    expect(frame.width).toBe(80);
    expect(frame.height).toBe(24);
    expect(frame.toLines().join("\n")).toContain("GLOW LAB");
  });
});
