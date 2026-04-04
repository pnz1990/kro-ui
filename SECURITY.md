# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| latest  | :white_check_mark: |

kro-ui is pre-1.0 software. Security fixes are applied to the latest release
only. There are no backport branches at this time.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please report vulnerabilities via
[GitHub Security Advisories](https://github.com/pnz1990/kro-ui/security/advisories/new).

You will receive an acknowledgement within **48 hours** and a detailed response
within **7 days** indicating next steps.

### What to include

- Description of the vulnerability
- Steps to reproduce (or a proof-of-concept)
- Impact assessment (what an attacker could achieve)
- Any suggested fix, if you have one

### Scope

kro-ui is a **read-only** observability tool. It never issues mutating
Kubernetes API calls (create, update, patch, delete). The primary attack
surface is:

- The HTTP server (port 40107) — served content, API responses
- Kubeconfig handling — file paths, context switching
- Embedded frontend — XSS via cluster data rendered in the UI
- Container image — base image vulnerabilities, supply chain

### Disclosure timeline

We follow [coordinated disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure):

1. Reporter submits via GitHub Security Advisory
2. We acknowledge within 48 hours
3. We develop and test a fix (target: 14 days for critical, 30 days for others)
4. We release the fix and publish the advisory
5. Reporter may publish details 30 days after the fix is released

## Security Measures

- **Dependency scanning**: Dependabot monitors Go modules, npm packages, and
  GitHub Actions for known vulnerabilities
- **Code scanning**: CodeQL runs on every PR and weekly on `main`
- **Go vulnerability checking**: `govulncheck` runs in CI on every PR
- **Container scanning**: Trivy scans the Docker image on every PR and release
- **Minimal runtime image**: Production container uses `distroless/static:nonroot`
  (no shell, no package manager, non-root user)
- **RBAC enforcement**: kro-ui never issues mutating Kubernetes API calls; only `get`, `list`, and `watch` verbs are used
