import {
  cursorTo,
  renderSurfaceAnsi,
  renderSurfaceDiffAnsi,
  renderSurfacePlain,
  renderSurfaceWithAxes,
  summarizeSurface,
  summarizeSurfaceDiff,
  visualizeAnsi
} from "../src/index.js";
import { buildReviewFrames } from "./review-scene.js";

const { frameA, frameB } = buildReviewFrames();
const diff = renderSurfaceDiffAnsi(frameA, frameB);
const frameAY = 2;
const frameBY = frameAY + frameA.height + 3;
const debugY = frameBY + frameB.height + 3;

process.stdout.write("rndr-2d review showcase\n");
process.stdout.write("frame A and frame B are rendered with ANSI below.\n");
process.stdout.write(renderSurfaceAnsi(frameA, { origin: { x: 0, y: frameAY } }));
process.stdout.write(renderSurfaceAnsi(frameB, { origin: { x: 0, y: frameBY } }));
process.stdout.write(cursorTo({ x: 0, y: debugY }));
process.stdout.write("\nplain frame A\n");
process.stdout.write(`${renderSurfacePlain(frameA)}\n\n`);
process.stdout.write("plain frame B\n");
process.stdout.write(`${renderSurfacePlain(frameB)}\n\n`);
process.stdout.write("debug frame B with axes\n");
process.stdout.write(`${renderSurfaceWithAxes(frameB)}\n\n`);
process.stdout.write("frame A stats\n");
process.stdout.write(`${JSON.stringify(summarizeSurface(frameA), null, 2)}\n\n`);
process.stdout.write("frame B stats\n");
process.stdout.write(`${JSON.stringify(summarizeSurface(frameB), null, 2)}\n\n`);
process.stdout.write("diff stats A -> B\n");
process.stdout.write(`${JSON.stringify(summarizeSurfaceDiff(frameA, frameB), null, 2)}\n\n`);
process.stdout.write("escaped diff preview\n");
process.stdout.write(`${visualizeAnsi(diff).slice(0, 1200)}\n`);

