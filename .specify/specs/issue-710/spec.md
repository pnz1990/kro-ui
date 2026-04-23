# Spec: issue-710 — RGD display: kro upstream field parity SLO

## Design reference
- **Design doc**: `docs/design/28-rgd-display.md`
- **Section**: `§ Future`
- **Implements**: RGD display: kro upstream field parity SLO (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

**O1**: `CONTRIBUTING.md` MUST include a section titled "kro Upstream Field Parity SLO"
(or similar) that explicitly states: any new kro CRD field that is user-visible in the
kro-ui display surface MUST appear in the display within 2 kro-ui releases of the kro
version that introduced it.

**O2**: The SLO section MUST describe what "user-visible" means in the kro-ui context
(DAG node inspection, YAML tab, spec diff, validation linting) to avoid ambiguity.

**O3**: The SLO section MUST reference the automated kro-upstream-check workflow
(doc 27 §27.1) so contributors know how new kro fields are detected and tracked.

**O4**: The design doc `docs/design/28-rgd-display.md` MUST be updated to move this
item from `🔲 Future` to `✅ Present`.

---

## Zone 2 — Implementer's judgment

- Section placement: after "Architecture Rules" in CONTRIBUTING.md, before "License".
- "2 kro-ui releases" is the stated SLO from the issue; this MUST be exact, not
  paraphrased as "soon" or "as soon as possible".
- The kro-upstream-check workflow reference should link to `.github/workflows/` file
  if it exists, or describe it generically.

---

## Zone 3 — Scoped out

- Retroactively auditing all existing kro fields (that's the kro-upstream-check job)
- Adding a CI check that enforces the SLO automatically (separate future item)
