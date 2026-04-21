# Spec: issue-572 — Supply Chain Security for Releases (27.10 + 27.22)

## Design reference
- **Design doc**: `docs/design/27-stage3-kro-tracking.md`
- **Section**: `§ Future — 27.10`
- **Implements**: Supply chain security for releases: cosign keyless signing, SBOM generation, SLSA provenance attestation (🔲 → ✅)
- **Prerequisite**: 27.22 — `id-token: write` permission added to release job

## Zone 1 — Obligations (falsifiable)

1. `release.yml` job `permissions` block MUST include `id-token: write` (required for cosign keyless signing OIDC token).
2. The container image pushed to `ghcr.io` MUST be signed with cosign keyless signing (Sigstore). A signature manifest is visible at `ghcr.io/pnz1990/kro-ui:<tag>` and cosign verify succeeds.
3. The container image MUST have an attached SBOM in CycloneDX JSON format (`cosign attach sbom`).
4. `.goreleaser.yaml` MUST declare `sboms:` for the archive artifacts so syft-generated SBOMs are included in the GitHub Release.
5. SLSA provenance attestation MUST be attached to the container image via `cosign attest --predicate` (SLSA provenance type).
6. CI (`release.yml`) MUST NOT fail when signing/SBOM steps run against a pushed image.
7. The additional signing steps MUST NOT require any externally managed signing keys — keyless only (ambient OIDC credential from GitHub Actions).
8. The `release.yml` job `permissions` MUST retain existing `contents: write` and `packages: write` permissions.

## Zone 2 — Implementer's judgment

- Choice of cosign version (use `sigstore/cosign-installer` GitHub Action for reproducibility).
- Choice of syft version (use `anchore/sbom-action` for SBOM generation).
- Whether to generate SBOM before or after pushing the image (after push is standard; image digest needed).
- Whether to use `cosign attest` or `cosign sign --payload` for SLSA provenance (attest is the recommended path).
- SLSA provenance predicate format (slsaprovenance or slsaprovenance02).

## Zone 3 — Scoped out

- Cosign signing of binary archives (goreleaser handles checksums; image signing is the primary supply-chain signal).
- Rekor transparency log verification in CI (this is done by consumers, not the publisher).
- Keyring-based signing (keyless only — consistent with kubernetes-sigs practice).
- SBOM for the embedded SPA JavaScript bundle.
