# OTLP Log Viewer

A log viewer for OTLP log records — flat or grouped by service, with a time histogram. Built for a take-home coding challenge; this README is written for the interviewers reviewing it.

**Live demo:** https://otlp-logs.vercel.app/

## Quick start

```bash
npm install
npm run dev       # app at http://localhost:3000
npm run storybook # component catalog at http://localhost:6006
```

## Assumptions & scope decisions

- **Shipped only what was asked.** The brief's three requirements (log table, time histogram, group-by-service toggle) are implemented; I deliberately avoided inventing adjacent features (filtering, search, saved views) that weren't requested — some of that overlaps with the Part 2 discussion anyway.
- **Code quality was spent on organization and seams, not internals.** Time went into component boundaries and interfaces (`LogRecordsTable`, `TimeHistogram`, the design-system primitives) rather than polishing every line inside them. Given more time, the internals are where I'd go next.
- **The API is used as-is, unmodified.** No proxy, no server-side reshaping. If I owned the backend I'd want pagination and/or streaming instead of one large payload — see "Deliberately not done" below.
- **Scope, not time, was the constraint I optimized for.** I stayed close to the brief's requirements rather than chasing extra polish for its own sake — the discipline was about what to build, not a clock.

## Deliberately not done

These are things I considered and consciously deferred, not things I missed:

- **API-level changes** — pagination, streaming, or server-side filtering on the `logs` endpoint. I used it exactly as given; a real backend would need these before the dataset grows.
- **Histogram performance at larger scale** — bucketing currently scans every log record client-side. Fine at today's dataset size, but it won't scale indefinitely; the real fix is moving bucket aggregation to the API. Details in [`docs/perf-notes.md`](docs/perf-notes.md).
- **Error-state UI** — the query handles the loading state but not a failed fetch; there's no visible error UI if the request fails.
- **Automated tests** — no `*.test.ts` files. Storybook stories exist for the key components (with `@storybook/addon-vitest` wired up), but there's no dedicated unit/integration test suite.

## Further reading

Design decisions and domain vocabulary are written down rather than left implicit:

- [`CONTEXT.md`](CONTEXT.md) — domain glossary (Flat View, Grouped View, Service Group, `unknown_service`, Top-8 + Other cap)
- [`docs/adr/0001-service-group-key.md`](docs/adr/0001-service-group-key.md) — why grouping keys on `service.namespace` + `service.name`
- [`docs/adr/0002-histogram-top-n-cap.md`](docs/adr/0002-histogram-top-n-cap.md) — why the histogram caps stacked segments at the top 8 services + "Other"
- [`docs/adr/0003-grouped-view-single-virtualizer.md`](docs/adr/0003-grouped-view-single-virtualizer.md) — why Grouped View is one flattened virtualized list, not one table per service
- [`docs/perf-notes.md`](docs/perf-notes.md) — what's been optimized, what's been consciously left alone, and what would need to change at larger scale

## Original assignment

This repo was built from a take-home brief (log viewer + a "do not code" filtering/sharing design discussion). The original spec has been removed from this README since it's the prompt, not the deliverable — happy to share it again on request.
