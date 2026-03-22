---
description: "Ingest a kro-ui user research response JSON, cross-reference against existing specs, and offer to create or update specs. Usage: /ingest-research path/to/response.json"
handoffs:
  - label: Create new spec
    agent: speckit.specify
    prompt: "Create a spec for the following feature idea from user research: "
  - label: Open spec inventory
    agent: start
    prompt: "Show me the current spec inventory"
---

## User Input

```text
$ARGUMENTS
```

---

## Step 1 — Load the response file

Read the JSON file at the path provided in `$ARGUMENTS`.

If the path is missing or the file does not exist, stop and print:
```
Error: no response file path given.
Usage: /ingest-research path/to/response.json
```

Parse the JSON. Expected shape (produced by the kro-ui user research form):
```json
{
  "meta": { "form_version": "1.0.0", "project": "kro-ui", "timestamp": "..." },
  "q1_roles": ["platform-engineer"],
  "q2_workflows": "...",
  "q3_priorities": {
    "must_have":  ["..."],
    "nice_have":  ["..."],
    "unique":     ["..."]
  },
  "q4_pain_points": "...",
  "q5_open": "..."
}
```

If the file cannot be parsed as JSON, stop and print:
```
Error: could not parse JSON. Make sure you exported the form response correctly.
```

---

## Step 2 — Extract feature signals

From the parsed response, extract a flat list of **feature signals** — discrete
capabilities or improvements the respondent mentioned. Pull signals from:

- `q2_workflows` — each workflow is a signal
- `q3_priorities.must_have`, `nice_have`, `unique` — each item is a signal
- `q4_pain_points` — extract implied features (e.g. "I can't tell what's blocking" → live reconciliation status)
- `q5_open` — any additional feature mentions

Deduplicate and normalize. Aim for 5–15 concrete signals. For each, note its
**stated priority**: `must-have`, `nice-to-have`, `unique`, or `implied` (for
signals inferred from pain points / open text).

---

## Step 3 — Load the existing spec inventory

Read `.specify/specs/` to enumerate all spec directories. For each one that
has a `spec.md`, read its title and first paragraph of description to understand
what is covered.

Also read `AGENTS.md` (the project root file) to get the spec status table
(Merged, Blocked, In Progress) if present.

---

## Step 4 — Cross-reference: Have / Partially Have / Don't Have

For each feature signal extracted in Step 2, classify it against the existing
spec inventory:

| Signal | Priority | Status | Notes |
|--------|----------|--------|-------|
| Live reconciliation status with node states | must-have | **Have** | spec `005-instance-detail-live` (merged) |
| ... | ... | ... | ... |

Classification rules:
- **Have** — a merged spec fully addresses the signal
- **Partially have** — a merged spec covers some aspects but the signal goes
  further, or it's in a spec that is not yet merged
- **Don't have** — no existing spec covers this signal at all
- **Blocked** — depends on upstream kro work (e.g., `009-rgd-graph-diff` needs KREP-013)

Use your best judgment when a signal maps loosely. Add a `Notes` column entry
to explain the mapping.

---

## Step 5 — Present findings

Print the full cross-reference table from Step 4, followed by a summary:

```
## Research Ingestion — Summary

Respondent roles: [list]
Form timestamp:   [timestamp]

### Feature signals by status
- Have (N):            [comma-separated list of signal names]
- Partially have (N):  [...]
- Don't have (N):      [...]
- Blocked upstream (N):[...]

### Respondent priority breakdown
- Must-have signals:  N  (X already covered, Y gaps)
- Nice-to-have:       N  (X already covered, Y gaps)
- Unique/differentiating: N  (X already covered, Y gaps)
```

---

## Step 6 — Gap triage (interactive)

For each signal classified as **Don't have** or **Partially have**, present it
to the user one at a time (or grouped if closely related) and ask:

```
## Gap: [signal name]

Priority stated by respondent: [must-have / nice-to-have / unique]

[1–2 sentence description of the gap]

What would you like to do?
  A) Create a new spec for this feature  → will invoke /speckit.specify
  B) Update an existing spec             → which spec? [list candidates]
  C) Add to a research backlog file      → appends to .specify/memory/research-backlog.md
  D) Skip for now
```

Wait for the user's choice before moving to the next gap.

**For choice A**: Compose a feature description combining the respondent's own
words and the signal context, then output:
```
Suggested /speckit.specify invocation:
/speckit.specify [feature description]
```
Ask the user to confirm or edit before suggesting they run it.

**For choice B**: Show the candidate spec(s) and describe what would need to be
added. Offer to open the spec file with a summary of the required change.

**For choice C**: Append the gap to `.specify/memory/research-backlog.md` in
this format (create the file if it does not exist):
```markdown
## [signal name]
- **Priority**: [stated priority]
- **Source**: user research — [respondent roles] — [timestamp]
- **Description**: [extracted text]
- **Classification**: Don't have / Partially have
- **Notes**: [any cross-reference notes]
```

**For choice D**: Skip without recording.

---

## Step 7 — Session summary

After all gaps have been triaged, print:

```
## Ingestion complete

Processed N feature signals from research response ([timestamp]).

| Action taken     | Count |
|------------------|-------|
| Already covered  | N     |
| New spec queued  | N     |
| Spec update noted| N     |
| Backlogged       | N     |
| Skipped          | N     |

Backlog file: .specify/memory/research-backlog.md  (if any items were added)
```

If any new spec invocations were queued in Step 6, list them and remind the
user to run `/speckit.specify <description>` for each one.
