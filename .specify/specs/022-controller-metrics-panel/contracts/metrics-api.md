# API Contract: Controller Metrics Endpoint

**Spec**: 022-controller-metrics-panel  
**Route**: `GET /api/v1/kro/metrics`  
**Added by**: This spec (replaces 501 stub from spec `001c-instance-api`)

---

## Overview

Returns a JSON snapshot of the kro controller's key operational counters, scraped from the controller's Prometheus metrics endpoint. This is a read-only, best-effort endpoint. Counter values may be `null` when the corresponding metric was absent in the upstream scrape.

---

## Request

```
GET /api/v1/kro/metrics
```

**No query parameters.**  
**No request body.**  
**No authentication required** (kro-ui inherits whatever auth the running binary has; the endpoint itself is unauthenticated within kro-ui).

---

## Success Response — `200 OK`

```json
{
  "watchCount":     4,
  "gvrCount":       3,
  "queueDepth":     0,
  "workqueueDepth": 0,
  "scrapedAt":      "2026-03-22T14:05:30Z"
}
```

### Fields

| Field | Type | Nullable | Description |
|---|---|---|---|
| `watchCount` | integer | yes | Number of active informers managed by the WatchManager (`dynamic_controller_watch_count`). Represents the number of distinct GroupResource types currently being watched. |
| `gvrCount` | integer | yes | Number of instance GVRs currently managed by the dynamic controller (`dynamic_controller_gvr_count`). |
| `queueDepth` | integer | yes | Current length of the kro dynamic controller workqueue (`dynamic_controller_queue_length`). |
| `workqueueDepth` | integer | yes | Current depth of the underlying client-go workqueue (`workqueue_depth{name="dynamic-controller-queue"}`). STABLE metric, complementary to `queueDepth`. |
| `scrapedAt` | string (RFC3339) | no | Wall-clock time at which the upstream metrics endpoint responded successfully. |

**Null semantics**: A `null` value for any counter means the metric name was not present in the upstream Prometheus output during this scrape cycle. This is distinct from `0`, which means the metric was present and reported zero. Consumers MUST treat `null` as "not reported" rather than zero.

---

## Error Responses

### `503 Service Unavailable` — upstream metrics endpoint unreachable

The kro metrics endpoint could not be reached (connection refused, DNS failure, timeout).

```json
{
  "error": "metrics source unreachable: dial tcp 127.0.0.1:8080: connect: connection refused"
}
```

### `502 Bad Gateway` — upstream returned non-200

The kro metrics endpoint responded with a non-200 HTTP status code.

```json
{
  "error": "metrics source returned HTTP 403"
}
```

### `504 Gateway Timeout` — upstream did not respond within budget

The upstream endpoint did not respond within the 4-second scrape timeout.

```json
{
  "error": "metrics source timeout after 4s"
}
```

**Note**: Error responses always use the `{"error": "<message>"}` envelope, consistent with all other kro-ui API error responses. The HTTP status code reflects the upstream failure mode, not an internal server error.

---

## Behaviour rules

1. **Response time**: The handler MUST respond within 5 seconds under all conditions (constitution §XI). The upstream scrape timeout is set to 4 seconds to preserve 1 second for JSON marshalling and network overhead.
2. **Absent metrics**: If the upstream endpoint responds 200 but a target metric name is absent in the body, the corresponding JSON field is `null`. The endpoint returns `200 OK` with a partial response — it does NOT return an error for absent metrics.
3. **Partial parse**: If some metrics parse correctly and others do not, the successfully parsed values are returned and absent/malformed ones are `null`. A complete parse failure (no metrics found) still returns `200 OK` with all fields `null` and a valid `scrapedAt`.
4. **No caching**: Every request triggers a fresh upstream scrape. No server-side caching is applied.
5. **Concurrent requests**: Each request creates an independent HTTP client with its own timeout. No shared state between concurrent callers.

---

## Example: all metrics absent (new kro install, metrics not yet emitted)

```json
{
  "watchCount":     null,
  "gvrCount":       null,
  "queueDepth":     null,
  "workqueueDepth": null,
  "scrapedAt":      "2026-03-22T14:05:30Z"
}
```

HTTP status: `200 OK`.

---

## Example: metrics source not configured (default URL unreachable)

```json
{
  "error": "metrics source unreachable: dial tcp 127.0.0.1:8080: connect: connection refused"
}
```

HTTP status: `503 Service Unavailable`.

---

## Configuration

The metrics source URL is configured via the `--metrics-url` CLI flag on `kro-ui serve`:

```
kro-ui serve --metrics-url http://kro-controller-metrics.kro-system.svc:8080/metrics
```

**Default**: `http://localhost:8080/metrics`  
**Format**: Absolute HTTP or HTTPS URL. Validated at startup; invalid URLs cause `kro-ui serve` to fail fast with a clear error message.

---

## Upstream metric names (authoritative)

| JSON field | Prometheus metric | Stability | Label filter |
|---|---|---|---|
| `watchCount` | `dynamic_controller_watch_count` | ALPHA | none (label-free gauge) |
| `gvrCount` | `dynamic_controller_gvr_count` | ALPHA | none (label-free gauge) |
| `queueDepth` | `dynamic_controller_queue_length` | ALPHA | none (label-free gauge) |
| `workqueueDepth` | `workqueue_depth` | STABLE | `name="dynamic-controller-queue"` |

**Stability note**: ALPHA metrics may be renamed or removed without notice in future kro versions. Absent metrics render as `null` in the response — the endpoint never returns an error due to a renamed ALPHA metric.
