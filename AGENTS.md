# AGENTS.md

## Project

`rndr-2d` is a terminal-first 2D rendering library for games that treat text
cells as the rendering unit. The first consumer is
`~/projects/agent-game`, especially its CLI hex-board renderer.

## What To Read First

1. [README.md](/home/ahaeflig/projects/rndr-2d/README.md)
2. [docs/architecture.md](/home/ahaeflig/projects/rndr-2d/docs/architecture.md)
3. [docs/roadmap.md](/home/ahaeflig/projects/rndr-2d/docs/roadmap.md)
4. [docs/evals.md](/home/ahaeflig/projects/rndr-2d/docs/evals.md)

## Repo Shape

- `src/`: library code only
- `tests/`: focused unit coverage for rendering primitives and invariants
- `examples/`: thin demos and smoke paths
- `docs/`: plans, architecture notes, eval definitions, and research
- `skills/`: reusable project-specific skills if the repo grows enough to need them

## Working Rules

- Keep the core rendering model pure. Avoid reading terminal state or writing to
  `stdout` from core modules.
- Prefer small, composable primitives over one giant renderer abstraction.
- Treat ANSI as a backend serialization detail, not the authoring format.
- Preserve deterministic behavior. Rendering helpers should be easy to snapshot
  and test.
- Scripts and examples should stay as dumb pipes around the library.
- Add documentation when a design choice is non-obvious or constrains future
  work.

## Quality Bar

- New primitives need tests for behavior, not just happy-path usage.
- Architecture changes should update the relevant docs when they affect public
  concepts or direction.
- If a feature feels consumer-specific, stop and decide whether it belongs in
  `agent-game` instead of `rndr-2d`.

