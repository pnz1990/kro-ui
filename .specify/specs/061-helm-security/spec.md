# Feature Specification: Helm Chart Security Hardening

**Feature Branch**: `061-helm-security`
**Created**: 2026-03-28
**Status**: In Progress

## Context

The Helm chart was missing Kubernetes security context settings needed for:
- PodSecurity admission (restricted profile)
- CIS Kubernetes benchmark compliance
- Defense-in-depth for a read-only dashboard

## Changes

**values.yaml**:
- `podSecurityContext`: `runAsNonRoot=true`, `runAsUser/Group=65534` (nobody), `seccompProfile=RuntimeDefault`
- `containerSecurityContext`: `readOnlyRootFilesystem=true`, `allowPrivilegeEscalation=false`, `capabilities.drop=[ALL]`

**deployment.yaml**: Uses `{{- with .Values.podSecurityContext }}` and `{{- with .Values.containerSecurityContext }}` blocks.

The kro-ui binary makes no disk writes at runtime — `readOnlyRootFilesystem=true` is safe.
The distroless base image ships nobody (UID 65534) — `runAsNonRoot=true` works without modification.
