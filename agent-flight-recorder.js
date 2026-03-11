#!/usr/bin/env node

import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const STORE_DIR = join(process.cwd(), ".agent-flight-recorder");
const RUN_DIR = join(STORE_DIR, "runs");
const EXPORT_DIR = join(STORE_DIR, "exports");

function ensureStore() {
  if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true });
  if (!existsSync(RUN_DIR)) mkdirSync(RUN_DIR, { recursive: true });
  if (!existsSync(EXPORT_DIR)) mkdirSync(EXPORT_DIR, { recursive: true });
}

function runPath(runId) {
  return join(RUN_DIR, `${runId}.json`);
}

function loadRun(runId) {
  const path = runPath(runId);
  if (!existsSync(path)) throw new Error(`Run not found: ${runId}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function saveRun(run) {
  writeFileSync(runPath(run.id), JSON.stringify(run, null, 2), "utf8");
}

function nowISO() {
  return new Date().toISOString();
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const cur = argv[i];
    if (cur.startsWith("--")) {
      const key = cur.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(cur);
    }
  }
  return args;
}

function createRun({ id, name, source }) {
  const run = {
    id: id || randomUUID(),
    name: name || "untitled-run",
    source: source || "manual",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    events: []
  };
  saveRun(run);
  return run;
}

function addEvent(runId, eventInput) {
  const run = loadRun(runId);
  const event = {
    id: randomUUID(),
    ts: eventInput.ts || nowISO(),
    type: eventInput.type || "log",
    step: Number(eventInput.step || run.events.length + 1),
    message: eventInput.message || "",
    tool: eventInput.tool || null,
    input: eventInput.input || null,
    output: eventInput.output || null,
    error: eventInput.error || null,
    durationMs: eventInput.durationMs ? Number(eventInput.durationMs) : null,
    tokens: eventInput.tokens ? Number(eventInput.tokens) : null
  };
  run.events.push(event);
  run.updatedAt = nowISO();
  saveRun(run);
  return event;
}

function printHelp() {
  console.log(`
AgentFlightRecorder (afr)

Commands:
  afr init --run <id> [--name <name>] [--source <source>]
  afr log --run <id> --type <type> [--message <msg>] [--step <n>] [--tool <name>] [--error <err>]
  afr ingest --run <id> --file <json-file>
  afr list
  afr replay --run <id> [--port 8787]
  afr export --run <id> [--format html|md] [--out <output-file>]
  afr diff --base <run-id> --head <run-id>
  afr demo
  afr demo2
`);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function startViewer(runId, port) {
  const viewerHtml = readFileSync(join(process.cwd(), "viewer.html"), "utf8");
  const server = createServer((req, res) => {
    if (!req.url) {
      sendJson(res, 400, { error: "Bad request" });
      return;
    }
    if (req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(viewerHtml);
      return;
    }
    if (req.url === "/api/run") {
      try {
        const run = loadRun(runId);
        sendJson(res, 200, run);
      } catch (err) {
        sendJson(res, 404, { error: err.message });
      }
      return;
    }
    sendJson(res, 404, { error: "Not found" });
  });

  server.listen(port, () => {
    console.log(`Replay UI: http://localhost:${port}`);
    console.log(`Run ID: ${runId}`);
  });
}

function sortEvents(events) {
  return [...events].sort((a, b) => (a.step || 0) - (b.step || 0));
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function runMetrics(run) {
  const events = sortEvents(run.events || []);
  const errors = events.filter((evt) => evt.error || evt.type === "error");
  const durationMs = events.reduce((sum, evt) => sum + (evt.durationMs || 0), 0);
  const tokens = events.reduce((sum, evt) => sum + (evt.tokens || 0), 0);
  return {
    eventCount: events.length,
    errorCount: errors.length,
    durationMs,
    tokens
  };
}

function renderMarkdownReport(run) {
  const events = sortEvents(run.events || []);
  const metrics = runMetrics(run);
  const lines = [];
  lines.push(`# AgentFlightRecorder Report: ${run.name}`);
  lines.push("");
  lines.push(`- Run ID: \`${run.id}\``);
  lines.push(`- Source: \`${run.source}\``);
  lines.push(`- Created: \`${run.createdAt}\``);
  lines.push(`- Updated: \`${run.updatedAt}\``);
  lines.push(`- Events: \`${metrics.eventCount}\``);
  lines.push(`- Errors: \`${metrics.errorCount}\``);
  lines.push(`- Total duration: \`${metrics.durationMs}ms\``);
  lines.push(`- Total tokens: \`${metrics.tokens}\``);
  lines.push("");
  lines.push("## Timeline");
  lines.push("");
  for (const evt of events) {
    lines.push(`### Step ${evt.step} - ${evt.type}`);
    lines.push(`- Time: \`${evt.ts}\``);
    if (evt.message) lines.push(`- Message: ${evt.message}`);
    if (evt.tool) lines.push(`- Tool: \`${evt.tool}\``);
    if (evt.error) lines.push(`- Error: \`${evt.error}\``);
    if (evt.durationMs != null) lines.push(`- Duration: \`${evt.durationMs}ms\``);
    if (evt.tokens != null) lines.push(`- Tokens: \`${evt.tokens}\``);
    lines.push("");
  }
  return lines.join("\n");
}

function renderHtmlReport(run) {
  const events = sortEvents(run.events || []);
  const metrics = runMetrics(run);
  const items = events
    .map((evt) => {
      const hasError = evt.error || evt.type === "error";
      return `
        <article class="event ${hasError ? "error" : ""}">
          <header><span class="badge">step ${escapeHtml(evt.step)}</span> <strong>${escapeHtml(evt.type)}</strong></header>
          <p class="muted">${escapeHtml(evt.ts)}</p>
          ${evt.message ? `<p>${escapeHtml(evt.message)}</p>` : ""}
          ${evt.tool ? `<p><span class="muted">tool:</span> ${escapeHtml(evt.tool)}</p>` : ""}
          ${evt.error ? `<pre>${escapeHtml(evt.error)}</pre>` : ""}
          ${(evt.durationMs != null || evt.tokens != null) ? `<p class="muted">duration: ${escapeHtml(evt.durationMs ?? "-")}ms | tokens: ${escapeHtml(evt.tokens ?? "-")}</p>` : ""}
        </article>
      `;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AFR Export - ${escapeHtml(run.id)}</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #0b1220; color: #dbe5ff; }
    .wrap { max-width: 1000px; margin: 0 auto; padding: 24px; }
    .card { background: #121b2f; border: 1px solid #24314f; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; border: 1px solid #385287; color: #bcd0ff; font-size: 12px; }
    .event { border-left: 4px solid #4566ab; padding-left: 12px; margin: 12px 0; }
    .event.error { border-left-color: #ff5e7a; }
    .muted { color: #9fb0d6; }
    pre { white-space: pre-wrap; background: #0f1728; border: 1px solid #283450; border-radius: 8px; padding: 8px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>AgentFlightRecorder Report</h1>
      <p><strong>${escapeHtml(run.name)}</strong></p>
      <p class="muted">run=${escapeHtml(run.id)} | source=${escapeHtml(run.source)} | events=${metrics.eventCount} | errors=${metrics.errorCount}</p>
      <p class="muted">totalDuration=${metrics.durationMs}ms | totalTokens=${metrics.tokens}</p>
    </div>
    <div class="card">
      <h2>Timeline</h2>
      ${items}
    </div>
  </div>
</body>
</html>`;
}

function exportRun(runId, format, out) {
  const run = loadRun(runId);
  const normalized = format === "markdown" ? "md" : (format || "html");
  if (!["html", "md"].includes(normalized)) {
    throw new Error("Invalid --format. Use html or md");
  }
  const outputFile = out || join(EXPORT_DIR, `${run.id}.${normalized === "md" ? "md" : "html"}`);
  const content = normalized === "md" ? renderMarkdownReport(run) : renderHtmlReport(run);
  writeFileSync(outputFile, content, "utf8");
  console.log(`Exported ${normalized.toUpperCase()} report: ${outputFile}`);
}

function diffRuns(baseId, headId) {
  const base = loadRun(baseId);
  const head = loadRun(headId);
  const bm = runMetrics(base);
  const hm = runMetrics(head);
  const eventDelta = hm.eventCount - bm.eventCount;
  const errorDelta = hm.errorCount - bm.errorCount;
  const durationDelta = hm.durationMs - bm.durationMs;
  const tokenDelta = hm.tokens - bm.tokens;

  const baseErrorSteps = new Set(sortEvents(base.events).filter((evt) => evt.error || evt.type === "error").map((evt) => evt.step));
  const headErrorSteps = new Set(sortEvents(head.events).filter((evt) => evt.error || evt.type === "error").map((evt) => evt.step));
  const resolvedErrorSteps = [...baseErrorSteps].filter((step) => !headErrorSteps.has(step));
  const newErrorSteps = [...headErrorSteps].filter((step) => !baseErrorSteps.has(step));

  console.log(`Diff: ${baseId} -> ${headId}`);
  console.log("");
  console.log(`Events: ${bm.eventCount} -> ${hm.eventCount} (${eventDelta >= 0 ? "+" : ""}${eventDelta})`);
  console.log(`Errors: ${bm.errorCount} -> ${hm.errorCount} (${errorDelta >= 0 ? "+" : ""}${errorDelta})`);
  console.log(`Total duration(ms): ${bm.durationMs} -> ${hm.durationMs} (${durationDelta >= 0 ? "+" : ""}${durationDelta})`);
  console.log(`Total tokens: ${bm.tokens} -> ${hm.tokens} (${tokenDelta >= 0 ? "+" : ""}${tokenDelta})`);
  console.log("");
  console.log(`Resolved error steps: ${resolvedErrorSteps.length ? resolvedErrorSteps.join(", ") : "none"}`);
  console.log(`New error steps: ${newErrorSteps.length ? newErrorSteps.join(", ") : "none"}`);
}

function main() {
  ensureStore();
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];

  if (!cmd || cmd === "help" || cmd === "--help") {
    printHelp();
    return;
  }

  if (cmd === "init") {
    const runId = args.run;
    if (!runId) throw new Error("Missing --run");
    const run = createRun({ id: runId, name: args.name, source: args.source });
    console.log(`Initialized run: ${run.id}`);
    return;
  }

  if (cmd === "log") {
    if (!args.run) throw new Error("Missing --run");
    const event = addEvent(args.run, {
      type: args.type,
      step: args.step,
      message: args.message,
      tool: args.tool,
      input: args.input,
      output: args.output,
      error: args.error,
      durationMs: args.durationMs,
      tokens: args.tokens
    });
    console.log(`Logged event ${event.id} on run ${args.run}`);
    return;
  }

  if (cmd === "ingest") {
    if (!args.run) throw new Error("Missing --run");
    if (!args.file) throw new Error("Missing --file");
    const raw = JSON.parse(readFileSync(args.file, "utf8"));
    if (!Array.isArray(raw)) throw new Error("Ingest file must be a JSON array of events");
    for (const evt of raw) addEvent(args.run, evt);
    console.log(`Ingested ${raw.length} events into ${args.run}`);
    return;
  }

  if (cmd === "list") {
    const files = readdirSync(RUN_DIR).filter((f) => f.endsWith(".json"));
    if (files.length === 0) {
      console.log("No runs found.");
      return;
    }
    for (const file of files) {
      const run = JSON.parse(readFileSync(join(RUN_DIR, file), "utf8"));
      console.log(`${run.id} | ${run.name} | events=${run.events.length} | updated=${run.updatedAt}`);
    }
    return;
  }

  if (cmd === "replay") {
    if (!args.run) throw new Error("Missing --run");
    const port = args.port ? Number(args.port) : 8787;
    startViewer(args.run, port);
    return;
  }

  if (cmd === "export") {
    if (!args.run) throw new Error("Missing --run");
    exportRun(args.run, args.format, args.out);
    return;
  }

  if (cmd === "diff") {
    if (!args.base) throw new Error("Missing --base");
    if (!args.head) throw new Error("Missing --head");
    diffRuns(args.base, args.head);
    return;
  }

  if (cmd === "demo") {
    const demoId = "demo-run";
    createRun({ id: demoId, name: "Demo agent bugfix flow", source: "demo" });
    addEvent(demoId, { type: "thought", step: 1, message: "Investigating failing test suite." });
    addEvent(demoId, { type: "tool_call", step: 2, tool: "bash", message: "npm test", durationMs: 3200, tokens: 119 });
    addEvent(demoId, { type: "error", step: 3, message: "TypeError in parser.ts", error: "Cannot read properties of undefined" });
    addEvent(demoId, { type: "tool_call", step: 4, tool: "edit", message: "Patch parser null handling", durationMs: 1800, tokens: 245 });
    addEvent(demoId, { type: "success", step: 5, message: "Tests pass and PR ready.", durationMs: 900, tokens: 38 });
    console.log("Demo run created: demo-run");
    return;
  }

  if (cmd === "demo2") {
    const demoId = "demo-run-v2";
    createRun({ id: demoId, name: "Demo agent bugfix flow v2", source: "demo" });
    addEvent(demoId, { type: "thought", step: 1, message: "Investigating failing test suite." });
    addEvent(demoId, { type: "tool_call", step: 2, tool: "bash", message: "npm test", durationMs: 2500, tokens: 110 });
    addEvent(demoId, { type: "tool_call", step: 3, tool: "edit", message: "Patch parser null handling", durationMs: 1400, tokens: 200 });
    addEvent(demoId, { type: "success", step: 4, message: "Tests pass and PR ready.", durationMs: 700, tokens: 30 });
    console.log("Demo run created: demo-run-v2");
    return;
  }

  throw new Error(`Unknown command: ${cmd}`);
}

try {
  main();
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}

