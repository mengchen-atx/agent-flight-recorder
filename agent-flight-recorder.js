#!/usr/bin/env node

import { createServer } from "http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const STORE_DIR = join(process.cwd(), ".agent-flight-recorder");
const RUN_DIR = join(STORE_DIR, "runs");

function ensureStore() {
  if (!existsSync(STORE_DIR)) mkdirSync(STORE_DIR, { recursive: true });
  if (!existsSync(RUN_DIR)) mkdirSync(RUN_DIR, { recursive: true });
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
  afr demo
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

  throw new Error(`Unknown command: ${cmd}`);
}

try {
  main();
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}

