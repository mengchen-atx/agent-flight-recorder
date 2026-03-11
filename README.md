# AgentFlightRecorder

Local-first black box recorder for AI agents: capture runs, replay timelines, and diagnose failures fast.

## Why this project

AI agents are easy to demo and hard to debug. AgentFlightRecorder gives you:

- A simple event log schema (`thought`, `tool_call`, `error`, `success`)
- Local JSON storage (no cloud required)
- A replay UI for step-by-step run inspection
- Failure-first visibility (error events highlighted)

## Quick start

```bash
npm run demo
npm run replay:demo
```

Open [http://localhost:8787](http://localhost:8787)

## CLI usage

```bash
# Initialize a run
afr init --run my-run --name "Fix flaky tests" --source mcp

# Log events
afr log --run my-run --type thought --step 1 --message "Reading failing CI logs"
afr log --run my-run --type tool_call --step 2 --tool bash --message "npm test" --durationMs 3200 --tokens 120
afr log --run my-run --type error --step 3 --message "Parser crash" --error "TypeError: Cannot read properties of undefined"

# Ingest events from a JSON file
afr ingest --run my-run --file examples/sample-events.json

# Replay run in browser
afr replay --run my-run --port 8787
```

## Event schema

Each event supports:

- `type` (string): `thought` | `tool_call` | `error` | `success` | any custom type
- `step` (number): ordering in timeline
- `message` (string): human-readable context
- `tool` (string|null): e.g. `bash`, `mcp`, `browser`
- `error` (string|null): stack/error summary
- `durationMs` (number|null): execution latency
- `tokens` (number|null): token usage
- `input` / `output` (optional): structured payloads

All runs are written under `.agent-flight-recorder/runs/`.

## Built for GitHub traction

- Zero dependency runtime, easy for contributors
- Local-first by default for privacy
- Works as an observability layer for any agent framework
- Easy to demo with real incident replays

## Next milestones

- MCP adapter package (`@afr/mcp-adapter`)
- Deterministic replay mode
- Shareable static run report export
- Multi-run comparison and regression alerts

## License

MIT
