# Feature Specification: Controller Metrics Panel

**Feature Branch**: `022-controller-metrics-panel`  
**Created**: 2026-03-22  
**Status**: Draft  
**Input**: User description: "kro controller metrics panel — add a backend endpoint that reads kro's Prometheus /metrics endpoint and exposes key operational counters (active GroupResources watched, GVRs served, dynamic workqueue depth/backlog) as a JSON API; surface these as a compact metrics strip on the home page or a dedicated Health tab, so kro contributors can monitor controller load without leaving the dashboard"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Controller Health at a Glance (Priority: P1)

A kro contributor opens the kro-ui dashboard and, without navigating away from the home page, immediately sees a compact strip of operational counters showing how many ResourceGraphDefinitions are actively watched, how many GVRs are being served, and the current workqueue depth and backlog. This tells them at a glance whether the controller is healthy and processing normally or is under pressure.

**Why this priority**: This is the core value proposition of the feature — a zero-friction signal that eliminates the need to SSH into the cluster or open a separate monitoring tool. It is the foundation every other story builds on.

**Independent Test**: Can be fully tested by loading the home page and verifying that the metrics strip appears with numeric values (or a clear "unavailable" state) without any additional navigation.

**Acceptance Scenarios**:

1. **Given** a kro-ui dashboard connected to a cluster where kro's metrics endpoint is reachable, **When** the user loads or refreshes the home page, **Then** a metrics strip is visible showing current values for: active GroupResources watched, GVRs served, workqueue depth, and workqueue backlog.
2. **Given** a kro-ui dashboard where metrics have loaded successfully, **When** the user reads any counter, **Then** each counter displays a numeric value with a human-readable label describing what it measures.
3. **Given** a kro-ui dashboard connected to a cluster, **When** the metrics endpoint is unreachable or returns an error, **Then** the metrics strip shows a degraded state for the strip only (e.g., "Metrics unavailable") without disrupting the rest of the home page content.

---

### User Story 2 - Metrics Data Refreshes Automatically (Priority: P2)

A kro contributor leaves the dashboard open on the home page while running a batch of resource deployments. They expect the metric counters to update periodically so they can monitor whether the workqueue depth rises and drains back to zero without manually refreshing the page.

**Why this priority**: Stale metrics are only marginally better than no metrics. Automatic refresh makes the panel genuinely useful for active monitoring during deployments.

**Independent Test**: Can be fully tested by observing that counter values update without a manual page reload at a documented, predictable interval.

**Acceptance Scenarios**:

1. **Given** the metrics strip is visible on the home page, **When** 30 seconds elapse, **Then** the strip silently re-fetches and displays updated counter values.
2. **Given** an in-flight refresh is pending, **When** the user navigates away from the home page, **Then** the polling stops and no further network requests are issued.
3. **Given** a refresh fails mid-session (metrics endpoint temporarily unavailable), **When** subsequent refreshes succeed, **Then** the strip recovers and shows current values without requiring a page reload.

---

### User Story 3 - Backend Metrics API is Independently Queryable (Priority: P3)

A kro contributor or tooling author wants to query the kro-ui server's metrics summary endpoint directly (e.g., via `curl`) to integrate the operational counters into an existing alerting workflow without building a custom Prometheus scraper.

**Why this priority**: Treating the metrics API as a first-class, independently usable endpoint keeps kro-ui composable and extends its value beyond the browser UI.

**Independent Test**: Can be fully tested using a plain HTTP client (`curl`) against the `/api/v1/kro/metrics` endpoint and verifying the response schema without opening a browser.

**Acceptance Scenarios**:

1. **Given** a running kro-ui server with a reachable kro metrics source, **When** a client issues a `GET /api/v1/kro/metrics` request, **Then** the server responds within 5 seconds with a JSON body containing the four operational counter fields.
2. **Given** the kro metrics source is unavailable, **When** a client issues the request, **Then** the server responds with a structured error JSON body (not a 5xx with an HTML page) and an appropriate status code.
3. **Given** multiple concurrent requests to the metrics endpoint, **When** the upstream source is slow, **Then** the server enforces its 5-second response budget and does not queue indefinitely.

---

### Edge Cases

- What happens when kro's Prometheus metrics endpoint exists but contains none of the four expected counter metrics (e.g., a newer kro version renamed them)? The panel displays the counters it found with valid values and shows "Not reported" for any counter that could not be located — no counter is shown as `0` when it is merely absent.
- How does the system handle kro's metrics endpoint returning a non-200 HTTP status? The backend propagates a structured error; the UI shows the degraded strip state.
- What happens when kro-ui is deployed without cluster-level network access to the kro controller pod's metrics port? Same degraded strip state as endpoint unreachable; no crash, no full-page error.
- What happens when a counter value changes between the time the backend fetches it and the time it is rendered? The most recently fetched value is shown; no staleness indicator is needed unless a fetch has failed.
- What happens when the home page loads and the first metrics fetch is still in-flight? The strip renders in a loading state (spinner or skeleton) until the first response arrives, then transitions to values or the degraded state.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose a read-only `GET /api/v1/kro/metrics` endpoint that returns a JSON object containing the four operational counters: active GroupResources watched, GVRs currently served, workqueue current depth, and workqueue backlog total.
- **FR-002**: The backend endpoint MUST fetch data from kro's Prometheus-format metrics source and parse the specific counter names needed; it MUST NOT return fabricated or hardcoded values.
- **FR-003**: The backend MUST respond to `GET /api/v1/kro/metrics` within 5 seconds under all conditions (healthy, degraded, or unreachable source), consistent with the project-wide API performance budget.
- **FR-004**: When kro's metrics source is unreachable or returns an error, the endpoint MUST respond with a structured JSON error body and an appropriate HTTP status code — never an HTML error page.
- **FR-005**: The home page MUST display a compact metrics strip showing the four counter values fetched from the backend metrics endpoint.
- **FR-006**: The metrics strip MUST automatically refresh its data at a 30-second interval while the home page is mounted, and MUST stop polling when the page is unmounted.
- **FR-007**: When a metrics fetch fails, the strip MUST render a degraded state scoped to the strip itself; the rest of the home page MUST continue to function normally.
- **FR-008**: Each counter in the strip MUST be accompanied by a human-readable label sufficient for a kro contributor unfamiliar with Prometheus naming to understand what is being measured.
- **FR-009**: When a counter value cannot be located in the metrics source (metric name absent), the counter MUST display "Not reported" rather than `0` or `undefined`.
- **FR-010**: The metrics strip MUST display a loading state during the initial data fetch before the first response arrives.
- **FR-011**: The backend MUST resolve the kro metrics source address without hardcoding any service name, namespace, or port — the address MUST be configurable via a CLI flag or environment variable with a documented default.

### Key Entities

- **ControllerMetrics**: A snapshot of kro controller operational state at a point in time. Contains: `groupResourcesWatched` (integer), `gvrsServed` (integer), `workqueueDepth` (integer), `workqueueBacklog` (integer), and a `fetchedAt` timestamp. Each field carries a "present" flag so consumers can distinguish "zero" from "not reported".
- **MetricsSource**: The upstream endpoint that kro-ui contacts to obtain raw metrics. Configurable address; returns data in Prometheus text exposition format. Treated as an external dependency — kro-ui reads it but never writes to it.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A kro contributor can see current controller operational counters without navigating away from the home page or opening any additional tool.
- **SC-002**: Counter values on the home page are never more than 35 seconds stale during an active browser session (30-second polling interval + allowance for network round-trip).
- **SC-003**: The metrics backend endpoint responds in under 5 seconds under all conditions (healthy, degraded, or source unreachable), matching the project-wide API performance budget.
- **SC-004**: The rest of the home page remains fully interactive when the metrics strip is in a degraded or loading state — zero content above or below the strip is hidden, removed, or blocked.
- **SC-005**: A plain HTTP client can retrieve the four operational counters from the backend endpoint without any browser or UI involvement, enabling scripted integration scenarios.
- **SC-006**: When kro's metrics source is not configured or not reachable, the dashboard starts and the home page loads without errors — the metrics strip is the only degraded element.

---

## Assumptions

- kro exposes a Prometheus-format `/metrics` endpoint. The specific metric names targeted are the standard `workqueue_depth`, `workqueue_adds_total` (used to derive backlog trend), and kro-specific gauges for active GroupResources and GVRs. If exact names differ in a given cluster version, only the absent counters show "Not reported" — the endpoint does not fail entirely.
- The kro metrics endpoint is reachable from the machine running kro-ui (in-cluster: via a `ClusterIP` service; out-of-cluster: via kubectl port-forward or a configured address). Network-level reachability is an operator responsibility.
- The default metrics source address is `http://localhost:8080/metrics`, which matches kro controller defaults for local development. In-cluster deployments will override this via flag/env var.
- No authentication is required to reach kro's metrics endpoint in the default deployment. If mTLS or bearer tokens are needed in a specific environment, that is out of scope for this spec.
- Metric scraping is best-effort: kro-ui fetches on demand per request plus the 30-second polling cycle; it does not maintain a persistent time-series store.
- The four targeted counters are surfaced as individual labeled values in the strip. Graphing or historical trending is out of scope.
- This feature does not require changes to the RBAC `ClusterRole` for kro-ui because it does not make any new Kubernetes API calls — it makes an HTTP call to kro's own metrics endpoint.
