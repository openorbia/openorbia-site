# Shared formats

Every role reads and writes these shapes, so the lead can check and combine them. Records live in the private store
(`ops/README.md`), never in this repository.

**IDs:** tasks are `T-001`, `T-002`, ... An assignment is one bounded run on a task: `A-001`, `A-002`, ... The assignment's
report and checkpoint use the same id, so `A-001` is the brief, the report (in `ops_reports`) and the checkpoint
(in `ops_checkpoints`) of that one run. There is no separate report id.

## Task (one document in `ops_tasks`, id = the task id)

```json
{
  "id": "T-001",
  "title": "Re-check garak, PentestGPT, Ollama",
  "owner": "lead | researcher | content | maker",
  "status": "Queued | Working | Needs my input | Ready for review | Done",
  "priority": 1,
  "next": "One sentence: the next concrete step",
  "evidence": ["https://... (checked 2026-11-03)"],
  "blocker": "",
  "checkpoint": "A-001",
  "updated": "2026-11-03"
}
```

Priority: 1 = launch blocker or agreed deadline, 2 = launch quality, 3 = later. Check the open tasks before adding one.

## Assignment brief (the lead writes it before any work)

```
Assignment A-001 for task T-001
Goal: <the founder's words>
Roles: researcher -> content -> maker   (only those needed, in this order)
Tools: <at most 5>
Done when: <what the report must contain>
Out of scope: <for example: published listings stay unchanged>
```

## Researcher block

```
Tool: <name> (<owner/repo>)  Checked: <date>  Changed since last run: <fields or "nothing">
- Free part: <what and limits>                       [source URL]
- License / maintenance: <SPDX, last push, release>  [source URL]
- Needs: <accounts, hardware, hosting, models, APIs> [source URL]
- Data: <where it goes>                              [source URL]
- Setup: <simplest path>                             [source URL]
- Free useful task: <one task with no required paid service> [source URL]
- Listing check: <field: matches | differs (how)>
- UNCONFIRMED: <fact> — would be confirmed by <source or person>
```

## Content block

```
Tool: <name>
Correction <n>: field <name>
  Current:  <published text>
  Proposed: <new text>
  Reason:   <one line>
  Source:   <URL, checked date>
No change: <fields that are still right>
Back to researcher: <missing facts>
```

## Maker block

```
Maker: <tool>  Tracker status: <Not contacted | Invited | Interested | Confirmed | Submitted | no entry>
History: <what happened, dates>
Next action: <none | invite | reply | follow-up | reminder | ask a fact> — why
Channel: <public channel, or "private: see tracker">
Draft: <exact message>
```

## Approval report (one document in `ops_reports`, id = the assignment id)

```
# Approval report A-001 (<date>)
Assignment: <goal, tools>   Roles run: <list>

## Ready for review
<numbered items: each change with current / proposed / reason / source; each message with recipient / history / exact text>

## Decisions needed from you
<numbered questions, each with the options and the lead's recommendation>

## Blockers
<what stopped, after which attempt, and what would unblock it>

## Next recommended task
<one task, with its id and why it is next>

Details: <checkpoint id>
```

## Checkpoint (one document in `ops_checkpoints`, id = the assignment id)

```json
{
  "id": "A-001", "task": "T-001", "date": "2026-11-03",
  "done": ["researcher: 3 tools", "content: 1 correction", "maker: 1 draft", "lead: report A-001"],
  "remaining": ["founder decisions D1, D2"],
  "sources": { "garak": { "readme": "a9a42d0f1952", "checked": "2026-11-03" } }
}
```
