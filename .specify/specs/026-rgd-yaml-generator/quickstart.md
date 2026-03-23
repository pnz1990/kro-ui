# Quickstart: 026-rgd-yaml-generator

## Development setup

No new dependencies. All existing tooling applies.

```bash
# From the worktree root (kro-ui.026-rgd-yaml-generator/)

# 1. Start the backend (Go)
make go CMD="run ./cmd/kro-ui -- serve"

# 2. Start the frontend dev server (hot reload)
bun run --cwd web dev

# 3. Open http://localhost:5173/rgds/<any-rgd-name>?tab=generate
```

The Generate tab is at `?tab=generate` on any RGD detail page.

---

## Running unit tests

```bash
# Frontend unit tests (generator.ts, GenerateTab)
bun run --cwd web test

# Watch mode
bun run --cwd web test --watch

# Type checking
bun run --cwd web tsc --noEmit
```

---

## Implementation order

1. **`web/src/lib/generator.ts`** — pure functions, no React dependencies.
   Start here; unit tests first.

2. **`web/src/components/YAMLPreview.tsx`** — simple wrapper around `KroCodeBlock`
   with two copy buttons. Easiest component.

3. **`web/src/components/InstanceForm.tsx`** — the core form. Renders controlled
   inputs from `SchemaDoc`. Uses `FieldValue[]` state.

4. **`web/src/components/BatchForm.tsx`** — textarea + row parsing. Minimal UI.

5. **`web/src/components/RGDAuthoringForm.tsx`** — most complex; repeatable rows
   with add/remove buttons.

6. **`web/src/components/GenerateTab.tsx`** — orchestrator; wires together the
   three sub-components and `YAMLPreview`.

7. **`web/src/pages/RGDDetail.tsx`** — add `"generate"` to `TabId`, add tab button,
   add `<GenerateTab>` content block.

---

## Testing a specific scenario manually

With a running kro cluster (or the demo cluster from `make demo`):

1. Navigate to any RGD that has spec fields (e.g. `test-app`)
2. Click the **Generate** tab
3. **Instance Form mode**: fill in the `name` and `image` fields; confirm the YAML
   preview updates immediately with correct values
4. **Batch mode**: switch to Batch, enter:
   ```
   name=alpha image=nginx
   name=beta image=nginx:alpine
   ```
   Confirm: 2 YAML documents separated by `---` appear
5. **New RGD mode**: switch to New RGD, change the kind to `Platform`, add a field
   `tier: string | enum=dev,staging,prod`. Confirm the YAML preview shows a valid
   RGD with the enum annotation.
6. Click "Copy kubectl apply" in any mode — paste into a terminal to confirm the
   heredoc syntax is correct.

---

## Key files to read before implementing

| File | Why |
|------|-----|
| `web/src/lib/schema.ts` | `SchemaDoc`, `ParsedField`, `parseSimpleSchema` — the input model |
| `web/src/lib/yaml.ts` | `toYaml` — the serializer to use for instance YAML |
| `web/src/components/ExampleYAML.tsx` | `generateExampleYAML`, `kindSlug` logic to replicate in `generator.ts` |
| `web/src/components/KroCodeBlock.tsx` | Copy button pattern to replicate in `YAMLPreview` |
| `web/src/components/FieldTable.tsx` | `'default' in parsedType` guard for default detection |
| `web/src/pages/RGDDetail.tsx` | Where to add the 7th tab |
| `.specify/specs/026-rgd-yaml-generator/contracts/generate-tab.md` | TypeScript prop interfaces |
| `.specify/specs/026-rgd-yaml-generator/data-model.md` | Data model and algorithm details |
