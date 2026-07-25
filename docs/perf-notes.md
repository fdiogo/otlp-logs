# Performance notes: `app/page.tsx`

Working notes from a review of the logs viewer's performance characteristics.
Split into what's true today vs. what would need to change at a different scale,
so decisions are traceable to the assumption that justified them.

## Assumptions (current reality)

- The logs API (`take-home-assignment-otlp-logs-api.vercel.app`) returns a
  **fixed, static dataset**: 10 `resourceLogs`, 298 total `logRecords`, ~215KB
  JSON, fetched in ~200ms. It does not paginate, stream, or change over time.
- There are 10 distinct Service Groups in that dataset.
- The client renders the whole result set client-side after a single fetch;
  the log table is virtualized ([`LogRecordsTable`](../components/LogRecordsTable.tsx))
  but the outer page is not.

None of the changes below were made in response to a measured bottleneck —
at this data volume every transform in `page.tsx` runs in well under a
millisecond. They're either free wins (no downside) or deferred until the
assumptions above stop holding.

## Done

- **`staleTime: Infinity` on `logsQuery`** ([`queries/logsQuery.ts`](../queries/logsQuery.ts)):
  the dataset is static, so refetching on window refocus/remount was pure
  waste. Revisit if the backend ever starts pushing live/changing data.
- **`useMemo` for all derived view data** in `HomeContent`
  (`logRecords`, `serviceGroups`, `flatBuckets`, `groupedBuckets`): these were
  being recomputed from scratch on every render. Chose plain `useMemo` over
  composing them as separate `useQuery`/`select` layers — the transforms are
  synchronous and pure, and only consumed within this one component tree, so
  query-cache bookkeeping would add indirection without a real benefit over
  `useMemo`'s referential-equality guard on `resourceLogs`.

## Considered, not worth it at current scale

- **Single-pass bucketing**: `bucketDurationMs`'s min/max scan and
  `bucketLogRecords`/`bucketLogRecordsByService` each independently parse
  `BigInt(timeUnixNano)` per record — a redundant pass over ~300 records.
  Left as three separate, readable, independently-testable functions rather
  than merging them for a sub-millisecond win. Revisit if per-request record
  counts grow into the tens/hundreds of thousands and profiling shows this
  loop actually costing something.
- **`React.memo` / prop memoization**: traced the actual re-render surface —
  `HomeContent` only re-renders on the `logsQuery` result resolving or
  `searchParams` changing (the groupBy toggle). Row/section expand state
  lives locally in `LogRecordsTable`/`ServiceGroupSection` and doesn't bubble
  up. There's no re-render storm to fix.

## Future scale — architectural options if the dataset stops being small & static

- **BFF layer + client-side paging**: if the real backend eventually serves a
  live, growing, or genuinely large log stream, put a server layer between
  `logsQuery` and the client that fetches once server-side and exposes a
  paged/cursor API to the client, rather than shipping the entire result set
  in one response. Not justified today — the whole payload is 215KB and
  fetches in ~200ms.
- **Server-side first fetch via `use cache` (Next 16 Cache Components)**:
  the page is `"use client"` end-to-end, so first load is a full client
  waterfall (HTML shell → JS → mount → client fetch → render) with nothing
  visible until it completes. Next 16's `use cache` directive would let the
  initial OTLP fetch happen in a Server Component and arrive embedded in the
  first response, cutting the client round-trip on first load. Deferred: at
  ~200ms for a 215KB fetch this isn't a real user-facing problem yet, and
  restructuring away from a single client tree (which currently owns
  `useSearchParams`-driven view state and local expand state) is a genuine
  architectural lift, not a quick win — real candidate for scope creep on a
  focused task.
- **Per-group virtualization ceiling**: Grouped View already uses a single
  flattened `useVirtualizer` across all rows (see
  [ADR 0003](adr/0003-grouped-view-single-virtualizer.md)), so the number of
  Service Groups doesn't multiply the number of scroll containers or
  virtualizer instances — that scaling concern is resolved. What's still
  bounded by dataset size is collapse state and the flattened row-list
  construction happening in a single `useMemo` pass; fine at today's ~10
  groups / ~300 records, worth another look if Service Group counts grow
  into the hundreds.
