# Spec: issue-718 — Namespace instance count summary

## Design reference
- **Design doc**: `docs/design/29-instance-management.md`
- **Section**: `§ Future`
- **Implements**: Instance management: namespace instance count summary (🔲 → ✅)

---

## Zone 1 — Obligations (falsifiable)

1. When ≥2 namespaces are present in the instances list, a namespace summary row appears
   below the health filter chips and above the loading/error/table sections.

2. Each namespace pill shows: the namespace name + instance count.
   Namespaces with ≥1 error-state instance additionally show an `M err` badge.

3. The summary row is NOT shown when a namespace filter is currently active (nsFilter is set).

4. Clicking a namespace pill sets the namespace filter to that namespace (equivalent to
   selecting it in the namespace dropdown), hides the summary row, and resets to page 0.

5. Pills are sorted by instance count descending, then namespace name ascending.

6. The summary container has `role="group"` and `aria-label="Instances per namespace"`.

7. Token-compliant CSS — no hardcoded hex/rgba.

---

## Zone 2 — Implementer's judgment

- Maximum number of pills to show before truncation (no requirement)
- Whether overflow wraps (flex-wrap is acceptable)
- Pill shape (rounded, pill, etc.)

---

## Zone 3 — Scoped out

- No URL sync for namespace summary visibility
- No backend changes
