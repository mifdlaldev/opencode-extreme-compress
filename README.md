# opencode-extreme-compress

Opencode plugin for extreme token compression with anti-hallucination guarantees.

## What it does

Compresses token usage in opencode sessions across **3 layers**:

1. **Layer 1: Tool Output Filter** — truncates large `read`, `grep`, `bash`, `glob`, `webfetch` outputs (always on in `light` mode)
2. **Layer 2: File Content Stripper** — strips comments from large code files (`medium`+ mode)
3. **Layer 3: Semantic Summarizer** — summarizes old conversation turns using LLM (`medium`+ mode)

## Compression targets

| Mode | Target reduction | Hallucination risk | Use case |
|------|-----------------|-------------------|----------|
| `light` (default) | 40-75% | **ZERO** (no LLM call) | Daily use, safe default |
| `medium` | 65-85% | LOW (verified) | Coding sessions |
| `extreme` | 85-92% | MEDIUM (verified) | Long sessions |
| `shadow` | 0% (observe only) | ZERO | Calibration |
| `off` | 0% (disabled) | ZERO | Disable entirely |

## Anti-Hallucination Charter

We follow 6 strict principles to prevent compression from causing AI hallucination:

1. NEVER compress system prompt, AGENTS.md, error messages
2. NEVER lose file paths, identifiers, numbers
3. WHEN uncertain: don't compress (fail-safe)
4. WHEN summarizing: include verification anchors
5. NEVER silently truncate (always show markers)
6. ESTIMATE tokens before compressing

**15 dedicated BLOCKING tests verify these guarantees.** Release is blocked if any fails.

## Installation

```bash
# 1. Build
cd /path/to/opencode-extreme-compress
bun install
bun run build

# 2. Install
./scripts/install.sh

# 3. Edit ~/.config/opencode/opencode.json to add:
#    "plugin": [..., "./plugins/extreme-compress"]

# 4. Restart opencode
```

## Configuration

Edit `~/.config/opencode/compress.jsonc`. The default config (mode: light) is copied by `install.sh`.

## Development

```bash
# Run all tests
bun test

# Run hallucination resistance tests (BLOCKING — 15 tests)
bun test:hallucination

# Run integration tests (5 tests)
bun test:integration

# Run model-specific tests (5 tests)
bun test:model

# Type check
bun run check

# Build
bun run build
```

## Current stats

- **131 tests passing** across 13 test files
- **15 hallucination resistance tests** (BLOCKING)
- **3 compression layers** with adaptive mode
- **TypeScript strict mode** with zero `any` or `@ts-ignore`

## Rollout phases

1. **Phase 0** (Internal): Build + test in isolated branch — DONE
2. **Phase 1** (Shadow): Install with `mode: 'shadow'` — observe only
3. **Phase 2** (Light): Switch to `mode: 'light'` — production safe
4. **Phase 3** (On-demand): Use `medium`/`extreme` per session as needed

## License

MIT
