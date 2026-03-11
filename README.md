# AgentFlightRecorder

<p align="left">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" alt="Node.js 18+" />
  <img src="https://img.shields.io/badge/Local--First-Yes-2E7D32" alt="Local first" />
  <img src="https://img.shields.io/badge/Runtime-Zero%20Dependency-1565C0" alt="Zero dependency runtime" />
  <img src="https://img.shields.io/badge/License-MIT-7B1FA2" alt="MIT License" />
</p>

Record every AI agent run, replay failures visually, export incident reports, and compare run-to-run regressions.

AgentFlightRecorder is a local-first observability layer for agents. It helps you debug what happened, where it failed, and whether your fix actually improved reliability.

---

## Why AgentFlightRecorder

Most agent stacks optimize for generation, not diagnosis. When things break, teams waste time manually reconstructing runs.

AgentFlightRecorder gives you:

- **Run recording**: save step-by-step events (`thought`, `tool_call`, `error`, `success`)
- **Replay UI**: inspect the full timeline in a local browser viewer
- **Shareable reports**: export static HTML or Markdown reports for PRs and incident docs
- **Regression diff**: compare two runs and see error/time/token deltas instantly
- **Local-first privacy**: all data is stored on your machine by default

---

## Quick Start

```bash
npm run demo
npm run replay:demo
```

Then open [http://localhost:8787](http://localhost:8787).

---

## CLI Commands

```bash
# Initialize a run
afr init --run my-run --name "Fix flaky tests" --source mcp

# Log events
afr log --run my-run --type thought --step 1 --message "Reading failing CI logs"
afr log --run my-run --type tool_call --step 2 --tool bash --message "npm test" --durationMs 3200 --tokens 120
afr log --run my-run --type error --step 3 --message "Parser crash" --error "TypeError: Cannot read properties of undefined"

# Ingest events from JSON
afr ingest --run my-run --file examples/sample-events.json

# Replay run in browser
afr replay --run my-run --port 8787

# Export report
afr export --run my-run --format html
afr export --run my-run --format md --out my-run-report.md

# Compare two runs
afr diff --base my-run-before --head my-run-after
```

---

## Event Model

Each event supports:

- `type` (string): event category (`thought`, `tool_call`, `error`, `success`, ...)
- `step` (number): timeline order
- `message` (string): human-readable context
- `tool` (string|null): tool name (`bash`, `mcp`, `browser`, ...)
- `error` (string|null): error summary or stack snippet
- `durationMs` (number|null): latency
- `tokens` (number|null): token usage
- `input` / `output` (optional): structured payloads

Storage layout:

- Runs: `.agent-flight-recorder/runs/`
- Exports: `.agent-flight-recorder/exports/`

---

## Export Reports

Use `afr export` to generate artifacts for async collaboration:

- `--format html`: styled static timeline report
- `--format md`: Markdown report for GitHub issues/PRs
- `--out`: optional custom output path

```bash
afr export --run demo-run --format html
afr export --run demo-run --format md
```

---

## Run Diff

Use `afr diff` to evaluate changes between two runs:

- event count delta
- error count delta
- duration delta
- token delta
- resolved vs newly introduced error steps

```bash
afr diff --base run-v1 --head run-v2
```

---

## Scripts

```bash
npm run demo
npm run demo2
npm run replay:demo
npm run export:demo
npm run export:demo:md
npm run diff:demo
```

---

## Roadmap

- MCP adapter package (`@afr/mcp-adapter`)
- deterministic replay mode
- multi-run dashboard and trend analytics
- CI-ready machine-readable summaries

---

## Contributing

Issues and PRs are welcome. If you open an issue, include:

- your command
- the run id
- expected behavior
- actual behavior

This makes triage and fixes much faster.

---

## License

MIT
