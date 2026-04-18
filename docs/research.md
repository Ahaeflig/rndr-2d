# Research Notes

This repo follows the structure recommended by
[`agent-bootstrap`](https://github.com/Ahaeflig/agent-bootstrap):

- root `AGENTS.md`
- `docs/` for architecture, plans, and evals
- `skills/` reserved for reusable repo-specific know-how
- minimum useful structure first

Outside inspirations shaping the architecture:

- Notcurses: explicit planes/cells suggest keeping composition separate from
  terminal IO.
- Asciimatics: scenes/effects/sprites suggest that animation should build on
  reusable frame primitives instead of each app inventing its own loop.
- Terminal Kit: off-screen screen buffers and sprite support reinforce the
  value of a generic raster buffer before terminal serialization.
- Ratatui and similar buffer-first renderers: frame composition is easier to
  test when the terminal backend is thin.

What we are intentionally not copying:

- a full TUI widget toolkit
- event-loop ownership in the rendering core
- framework-specific state management

The goal is a game rendering substrate, not a replacement for general TUI
frameworks.

