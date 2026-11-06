# OpenOrbia ops: lead, researcher, content specialist, maker coordinator

A small workflow for finding and checking free AI tools, drafting listings and posts, and handling maker outreach. The
founder gives a goal in plain words; the lead splits it into one bounded assignment, runs only the roles it needs, and
returns one approval report. Nothing leaves this machine or changes the live site without the founder's instruction.

## What exists, and what does not

| Piece | What it is |
|---|---|
| `ops/roles/*.md` | The four role instructions. Plain text the session follows. |
| `.claude/agents/openorbia-*.md` | The researcher, content specialist and maker coordinator as Claude Code subagents, with their tools limited (see below). The lead is the main session. |
| `ops/formats.md` | The shared task, brief, output, report and checkpoint formats. |
| `ops/scripts/tool-facts.mjs` | Working script: GitHub metadata, source-link status and change detection for up to 5 listed tools. |
| `ops/scripts/dedupe.mjs` | Working script: is a candidate already listed, launching or in the maker tracker. |
| Private store | Tasks, checkpoints, reports and maker contacts, in the database of the founder's private "OpenOrbia Maker Tracker" page on claude.ai. Not in this repository. |

Not implemented: no background monitoring, no schedule, no agents running between conversations. Every run starts when
the founder asks in a Claude Code session. The roles' limits are instructions plus each subagent's tool list; the hard
limits are the account's own permissions (main is protected, production needs the founder's approval, the private store
is readable only by its owner).

## The private store

The maker tracker page's database holds:

- `makers`: the outreach tracker (one document per maker: contact, history, status, missing assets, dates)
- `ops_tasks`: the task queue (format in `ops/formats.md`)
- `ops_checkpoints`: one document per finished assignment
- `ops_reports`: the approval reports

Only the page's owner can read or write these. The lead reads and writes them with the ArtifactData tool, using the page's
link (kept in the session's memory, not in this public file). Contact details never go into the repository.

## Running an assignment

In a Claude Code session in this repository, say what you want in plain words, for example:

- "Check these three tools: garak, Strix, Jan."
- "Find five qualifying security tools."
- "Draft follow-ups that are due."
- "Show what needs my approval."
- "Continue the highest-priority task."
- "continue" (resume the open task from its last checkpoint)

The session acts as the lead (`ops/roles/lead.md`): it checks the queue, writes a brief, runs the roles one after another,
reviews their output and saves the report and checkpoint. Approve, reject or answer the items in the report; approved
listing corrections then go through a pull request, and messages are sent by you.

Limits per assignment: 5 tools or 5 drafts, two attempts per failing step, sequential unless you ask for parallel work.

## Roles as subagents

The three specialists can run as Claude Code subagents (`.claude/agents/`), which keeps their reading out of the lead's
context. They start fresh each time, so the lead passes them the brief and the evidence they need. They cannot write files
or send anything:

| Subagent | Tools |
|---|---|
| openorbia-researcher | Read, Grep, Glob, Bash (for the scripts and `gh api` reads), WebFetch, WebSearch |
| openorbia-content | Read, Grep, Glob |
| openorbia-maker-coordinator | Read, Grep, Glob, WebFetch, WebSearch |

Running a subagent costs more than doing the step in the main session. For small assignments the lead may run a role
inline, following the same role file; the report says which way each role ran.
