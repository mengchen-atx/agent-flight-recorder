# Task Plan: AgentFlightRecorder MVP

## Goal
Build a star-oriented open source MVP named AgentFlightRecorder: a local-first recorder and replay tool for AI agent runs, with CLI ingestion and a minimal web UI.

## Phases
| Phase | Status | Notes |
|---|---|---|
| 1. Initialize planning and repo skeleton | complete | Created planning docs and project files |
| 2. Implement CLI recorder and schema | complete | CLI supports init/log/ingest/list/replay/demo |
| 3. Implement web replay UI | complete | Added timeline viewer with error highlighting |
| 4. Documentation and examples | complete | Added README, sample events, license |
| 5. Validate build and git setup | in_progress | Demo validated, git init next |

## Decisions
- Use TypeScript + Node for DX and contributor friendliness.
- Use local JSON files for storage (local-first, zero setup).
- Use a tiny static web app served by the CLI to keep MVP simple.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| None yet | - | - |

