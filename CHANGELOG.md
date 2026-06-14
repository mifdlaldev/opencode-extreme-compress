# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-13

### Added
- 3-layer adaptive compression architecture
  - Layer 1: Tool output filter (line/byte truncation with pattern preservation)
  - Layer 2: File content stripper (regex-based comment removal with string-literal awareness)
  - Layer 3: Semantic summarizer (LLM-based, wired via real `opencode.client.session.prompt()`)
- 5 compression modes: `off`, `shadow`, `light`, `medium`, `extreme`
- Anti-Hallucination Charter (6 principles) with 15 BLOCKING tests
- Model-aware profiles (flash auto-promotes to medium, M3 stays light)
- Output budget tracking (triggers compression when output budget low)
- Subagent propagation logic (configurable: inherit, force-off, force-light, force-medium)
- JSONC config parser with proper string-boundary respect (state machine, not regex)
- Deep config merge (preserves nested defaults when partially overridden)
- Path traversal protection in config loader
- Session state cleanup via `event` hook (prevents memory leaks)
- Structured logger with level filtering
- Plugin signature accepts `PluginInput` for proper SDK access (`input.client`)
- Session lifecycle hook (`session.deleted`/`session.compacted` events)
- 9 SDK client wiring tests (real LLM call simulation)
- GitHub Actions CI workflow (type check + tests + build verification)

### Security
- `loadConfig` rejects paths containing `..` (path traversal)
- `stripComments` preserves strings containing `//` and `/* */` (no false positives)
- `extractIdentifiers` filters common English verbs (no false positives)
- `tool.execute.before` is observe-only (never modifies inputs)
- `result.marker` includes line truncation marker + compression summary (transparency)

### Test Coverage
- 140 tests across 14 files
- 15 hallucination resistance tests (BLOCKING — release blocked if any fails)
- 9 SDK client integration tests
- 5 integration tests
- 5 model-specific behavior tests

### Known Limitations
- Layer 3 requires an active LLM model; in `light` mode (default) this layer is dormant
- Tree-sitter AST parsing for Layer 2 is deferred to v0.2.0 (v0.1.0 uses regex)
- Reference-based compression (Layer 4) is not implemented; targeted for v0.3.0
- Compression ratios are measured in unit tests only; real-session benchmarks pending

[0.1.0]: https://github.com/mifdlaldev/opencode-extreme-compress/releases/tag/v0.1.0
