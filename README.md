# Trace

**Turn reading into something you can recall. Keep the source in sight.**

Trace is a local-first microlearning prototype built with vanilla JavaScript. Bring a short article or your own notes, inspect extracted lessons, edit recall cards, and return for spaced practice. An interactive probability lab makes the starter course something you can experiment with, not just read.

**[Open the live demo](https://trace-psi-six.vercel.app/)** · [Architecture](docs/ARCHITECTURE.md) · [Verification](docs/TEST-REPORT.md)

## A two-minute tour

1. Open **When 90% accurate is wrong**, an original three-lesson course about base rates and false positives.
2. In the frequency lab, change prevalence and error rates. Watch expected counts explain why an apparently accurate spam filter can flag mostly legitimate messages.
3. Complete a lesson, reveal a recall card, and inspect its source excerpt. Edit the question without losing the evidence behind it.
4. Choose **Create**, paste notes, and review the extractive draft before saving. Completed lessons feed a due-card review queue.

No account, API key, or model download is needed.

## Engineering highlights

- **An independently testable data engine.** Parsing, validation, scheduling, and probability calculations live in [`dist/core.mjs`](dist/core.mjs), separate from the DOM and browser storage. State transitions return validated copies rather than mutating their inputs.
- **Source provenance as a data invariant.** Every lesson and card quotation must be an exact substring of its stored source. Card edits change the prompt and answer, preserving the original quotation. Tests cover Unicode and CRLF preservation.
- **A defensive import boundary.** JSON backups are checked against a versioned schema and a shared 2 MiB limit. Validation rejects unknown fields, unsafe object keys, duplicate IDs, dangling references, invalid dates, fabricated excerpts, and excessive nesting.
- **Explicit failure recovery.** If saved data cannot be read, the interface preserves it and blocks overwriting. Storage failures fall back to an in-memory session with a warning. Cross-tab storage changes block writes until reload instead of silently overwriting newer work.
- **An inspectable learning model.** The Bayes lab computes expected counts, including fractional values and an undefined posterior when no messages are flagged. Review intervals follow a small, documented rule rather than an opaque scoring system.
- **A small runtime surface.** Native ES modules, CSS, hash routing, and browser APIs. No frontend framework, backend, or third-party JavaScript runtime dependencies. `jsdom` is a development-only dependency for interaction tests.

## Run locally

Use **Node.js 24.15+** and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by the server. The app is served from `dist/`, which contains the maintained application source, not generated framework output.

```sh
npm test                 # Core data-engine tests
npm run test:interface   # DOM interaction scenarios
npm run check            # Project checks
npm run build            # Generate the standalone demo
```

For a server-independent setup, serve `dist/` with any static HTTP server. The source entry uses ES modules and should not be opened as a `file://` URL. `npm run standalone` creates `artifacts/Trace-Learning-Demo.html`, a bundled alternative for direct browser opening. Browser storage behavior can differ on local files; keep a JSON backup before moving between origins.

## Project map

| Area | Start here | What to inspect |
| --- | --- | --- |
| Data engine | [`dist/core.mjs`](dist/core.mjs) | Schema validation, extraction, state transitions, Bayes calculation |
| Browser interface | [`dist/app.mjs`](dist/app.mjs) | Routing, rendering, forms, dialogs, storage recovery |
| Original course | [`dist/starter.mjs`](dist/starter.mjs) | Three lessons and nine source-backed cards |
| Visual system | [`dist/styles.css`](dist/styles.css), [`DESIGN.md`](DESIGN.md) | Cobalt, midnight, and lime palette; responsive learning interface |
| Tests | [`tests/core.test.mjs`](tests/core.test.mjs), [`tests/interface.test.mjs`](tests/interface.test.mjs) | Boundary cases, provenance, and complete interaction sequences |
| Packaging | [`scripts/build-standalone.mjs`](scripts/build-standalone.mjs) | Dependency-free single-file output |

See [Architecture](docs/ARCHITECTURE.md) for data flow, constraints, and tradeoffs.

## What the prototype does and does not do

**Extraction is deterministic, not AI-generated.** Text is split into sections, excerpts are retained, and a word-selection heuristic creates cloze prompts. The same input and timestamp produce the same result. Source text is preserved in full, but a draft covers at most 24 sections. Draft questions need human review.

**Evidence is inspectable, not independently fact-checked.** The starter course contains original teaching notes with an external reference for background. Its quoted evidence comes from those notes. Source citations do not establish truth, and edited answers can still be wrong.

**Review is self-rated.** Again schedules ten minutes later; the first Good schedules one day and the first Easy three days. Later successful intervals multiply by three, capped at 180 days. This is not FSRS, and learning outcomes have not been measured.

**Storage is local, not a cloud backup.** Courses, original sources, edits, and progress live in this browser's `localStorage`. The application makes no content/API/analytics requests and does not fetch source links. Hosting still receives normal page requests; opening an external reference navigates to that site. Local storage is not encrypted application storage. Clearing site data or switching browsers can lose work. Export JSON backups from Settings.

There is no live tutor, PDF parser, account system, synchronization, payment flow, or automatically cached offline web app. This is a working product prototype, not a production service or a demonstrated educational intervention.

## Next steps

- Test the import and recall loop with people studying their own material before expanding features.
- Add real-browser regression tests for file import, backup restoration, responsive layouts, and keyboard flows.
- Evaluate card quality and next-day recall before making claims about learning improvement.
- If multi-device use proves important, design explicit sync, conflict resolution, and privacy controls rather than treating local storage as durable infrastructure.

The code and visual identity are original to Trace. The redesign takes layout inspiration from [Teaflask](https://teaflask.com/) while retaining Trace's own palette and learning workflow. See [the design notes](docs/VISUAL-OVERHAUL.md).
