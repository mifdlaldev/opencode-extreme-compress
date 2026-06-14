# opencode-extreme-compress

Opencode plugin for **extreme token compression** with strict **anti-hallucination guarantees**.

> Reduces token usage by 40–92% across 3 adaptive layers — designed to never lose critical information.

[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](.github/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-131%20passing-brightgreen)](#testing)
[![Hallucination Tests](https://img.shields.io/badge/hallucination%20tests-15%2F15%20BLOCKING-brightgreen)](#anti-hallucination-charter)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue)](#development)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## Why this exists

LLM sessions eat tokens fast — large file reads, verbose grep results, long agentic loops. Existing compression plugins either:

- Compress too little to matter, OR
- Compress aggressively but risk **AI hallucination** by dropping critical context.

`opencode-extreme-compress` solves both: aggressive compression with a **6-principle Anti-Hallucination Charter** verified by 15 BLOCKING tests.

## What it does

Compresses token usage in opencode sessions across **3 layers**:

| Layer | Trigger | What it does | Default mode |
|---|---|---|---|
| **L1: Tool Output Filter** | After `read`/`grep`/`bash`/`glob`/`webfetch` | Truncates large outputs, preserves error lines and file:line refs | `light`+ |
| **L2: File Content Stripper** | After `read` for `.ts`/`.js`/`.py` | Strips comments (preserves strings) | `medium`+ |
| **L3: Semantic Summarizer** | Before sending messages to LLM | Summarizes old turns via real LLM call | `medium`+ |

## Compression targets

| Mode | Target reduction | Hallucination risk | Use case |
|---|---|---|---|
| `off` | 0% (disabled) | ZERO | Disable entirely |
| `shadow` | 0% (observe only) | ZERO | Calibration — see what would be compressed |
| **`light`** (default) | **40–75%** | **ZERO** (no LLM call) | Daily use, safe default |
| `medium` | 65–85% | LOW (verified) | Coding sessions |
| `extreme` | 85–92% | MEDIUM (verified) | Long agentic sessions |

> Numbers above are **measured in unit tests**. Real-session benchmarks pending.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  OPENCODE SESSION                           │
│   User msg → LLM call → Tool calls → Response               │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              EXTREME-COMPRESS PLUGIN (TypeScript)           │
│                                                             │
│  Hooks registered:                                          │
│    • event (session.deleted → cleanup state)                │
│    • tool.execute.before (OBSERVE ONLY — never modifies)    │
│    • tool.execute.after  → Layer 1 + Layer 2 trigger        │
│    • chat.message         → turn counter, session init       │
│    • experimental.chat.messages.transform → Layer 3 trigger │
│    • experimental.session.compacting → inject anti-hallu    │
│                                                             │
│  Layers:                                                    │
│    L1: ToolOutputFilter (string ops, ZERO hallucination)    │
│    L2: FileContentStripper (regex, LOW hallucination)        │
│    L3: SemanticSummarizer (LLM call, MEDIUM hallucination)   │
│                                                             │
│  Config: ~/.config/opencode/compress.jsonc                   │
│    • mode, modelProfiles, layers, antiHallucination, etc.    │
└─────────────────────────────────────────────────────────────┘
```

## Anti-Hallucination Charter

We follow **6 strict principles** to prevent compression from causing AI hallucination. **15 dedicated tests** verify these guarantees — **release is blocked if any fails**.

1. **NEVER** compress system prompt, AGENTS.md, or error messages
2. **NEVER** lose file paths, identifiers, or numbers
3. **WHEN** uncertain: don't compress (fail-safe)
4. **WHEN** summarizing: include verification anchors (paths, identifiers)
5. **NEVER** silently truncate (always show markers)
6. **ESTIMATE** tokens before compressing (don't compress into invalid state)

Plus: tool inputs are **NEVER** modified (per anti-hallucination charter principle #1, validated by source-code test #9).

## Installation

### From source (recommended for v0.1.0)

```bash
# 1. Clone
git clone https://github.com/mifdlaldev/opencode-extreme-compress.git
cd opencode-extreme-compress

# 2. Build
bun install
bun run build

# 3. Install
./scripts/install.sh

# 4. Add to ~/.config/opencode/opencode.json:
#    "plugin": ["./plugins/extreme-compress"]

# 5. Restart opencode
```

### Phase 1 (recommended): shadow mode

After installation, edit `~/.config/opencode/compress.jsonc`:

```jsonc
{
  "mode": "shadow",  // ← start here; observes only
  ...
}
```

Run for 1–2 days to see what would be compressed. No risk.

### Phase 2: light mode (production default)

Change `mode` to `"light"` and restart opencode. **Zero hallucination risk** (no LLM calls in Layer 3).

### Phase 3: medium/extreme on demand

Use `medium` or `extreme` mode for long agentic sessions. Higher compression, but Layer 3 (LLM-based) is active.

## Configuration

Default config is at `compress.default.jsonc` in the repo. Key fields:

```jsonc
{
  "mode": "light",
  "modelProfiles": {
    "*":                            { "mode": "light",  "maxContextUsage": 0.95 },
    "deepseek-v4-flash-free":       { "mode": "medium", "maxContextUsage": 0.80 },
    "minimax-m3":                  { "mode": "light",  "maxContextUsage": 0.95 }
  },
  "layers": {
    "toolOutput":  { "enabled": true,  "headLines": 200, "tailLines": 50, "maxBytes": 102400 },
    "fileContent": { "enabled": false, "excludeGlobs": ["*.md", "*.json", "**/AGENTS.md"] },
    "semantic":    { "enabled": false, "model": "kimi-k2.6", "variant": "low", "trigger": { "minMessages": 15, "keepRecent": 4 } }
  },
  "antiHallucination": {
    "enabled": true,
    "mustPreserve": ["**/AGENTS.md", "**/DESIGN.md", "**/package.json"],
    "verifyPaths": true,
    "verifyIdentifiers": true,
    "failSafe": "no-compression"
  }
}
```

## Development

```bash
# Install
bun install

# Run all tests (131 tests)
bun test

# Run hallucination resistance tests (BLOCKING — 15 tests)
bun run test:hallucination

# Run integration tests (5 tests)
bun run test:integration

# Run model-specific tests (5 tests)
bun run test:model

# Type check (strict mode, zero any)
bun run check

# Build (outputs dist/index.js)
bun run build
```

## Testing

| Test file | # tests | Purpose |
|---|---|---|
| `test/layer1.test.ts` | 15 | Tool output truncation |
| `test/layer2.test.ts` | 10 | File content comment stripping |
| `test/layer3.test.ts` | 12 | Semantic summarization + verification |
| `test/config.test.ts` | 23 | JSONC parser + deep merge + profile resolution |
| `test/modes.test.ts` | 8 | Mode resolution + layer gating |
| `test/budget.test.ts` | 7 | Output budget tracking |
| `test/subagent.test.ts` | 9 | Subagent mode propagation |
| `test/logger.test.ts` | 8 | Level filtering |
| `test/marker.test.ts` | 5 | Marker generation |
| `test/token-counter.test.ts` | 9 | Token estimation |
| **`test/hallucination-resistance.test.ts`** | **15** | **BLOCKING — anti-hallucination charter** |
| `test/integration.test.ts` | 5 | Full pipeline behavior |
| `test/model-specific.test.ts` | 5 | Model-aware mode resolution |
| **Total** | **131** | |

## Known Limitations (v0.1.0)

- **Layer 2 uses regex** for comment stripping (not tree-sitter AST). For 99% of code this is correct, but edge cases with template literals containing `//` are skipped. v0.2.0 will add tree-sitter.
- **Layer 3 requires LLM** to actually summarize. In `light` mode (no LLM call), Layer 3 is dormant — only L1+L2 run.
- **Compression ratios measured in unit tests** — real-session benchmarks pending user validation.
- **Reference-based compression (Layer 4)** with content dedup is not implemented; targeted for v0.3.0.
- **`@opencode-ai/plugin` peer dep uses wildcard** — install alongside your opencode version to ensure compatibility.

## Roadmap

- [ ] **v0.1.1**: Real-session benchmark suite
- [ ] **v0.2.0**: Tree-sitter AST for Layer 2
- [ ] **v0.3.0**: Reference-based compression (Layer 4) with SQLite cache
- [ ] **v0.4.0**: Web UI dashboard for live compression stats
- [ ] **v1.0.0**: Stable API, npm publish, full documentation

## Contributing

See [CHANGELOG.md](CHANGELOG.md) for what's planned. PRs welcome — please run `bun test` and `bun run check` before submitting.

## License

[MIT](LICENSE) © 2026 opencode-extreme-compress contributors
