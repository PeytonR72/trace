# Architecture

Trace is a static, browser-local application. Its main architectural boundary separates a deterministic data engine from browser effects.

## Modules and responsibilities

- **`dist/core.mjs`** owns the versioned state schema, text extraction, immutable state transitions, review eligibility and scheduling, source URL policy, and Bayes expected counts. It has no DOM, storage, or network access.
- **`dist/starter.mjs`** supplies an original course with three lessons and nine cards. External reading is background; evidence quotes refer to the stored authored notes.
- **`dist/app.mjs`** owns hash routes, HTML rendering, event delegation, dialogs, draft state, downloads, optional Web Audio feedback, and `localStorage` integration. User-provided strings are escaped before interpolation into markup; source URLs are restricted to HTTP(S).
- **`dist/index.html` and `dist/styles.css`** provide the document shell and responsive visual system. Fonts are embedded locally in the stylesheet.
- **`scripts/build-standalone.mjs`** packages the known module structure, stylesheet, and document into a single HTML artifact. This is a narrow project-specific bundler, not a general JavaScript build system.

## Import and practice flow

```text
Pasted text / .txt / .md
  → parseTextCourse
  → editable preview
  → validateState
  → browser state + localStorage
  → lesson completion
  → dueCards
  → self-rated review
  → recordReview
  → browser state + localStorage
```

A source URL is metadata only. Importing does not fetch it. Text files have a 100 KiB file-size limit, and source text must contain 40–100,000 characters.

The parser groups text around headings and paragraph breaks, takes at most 24 sections, and preserves complete source text. For each section it selects an excerpt, then a sentence and a word for a draft cloze card. It uses no language model. Timestamp-dependent IDs mean determinism requires both identical input and an identical `now` value.

## State and invariants

Schema version 1 stores `courses`, `progress`, `reviews`, `settings`, and `updatedAt`. A course holds its source and lessons; a lesson holds paragraphs, an evidence quote, and cards. Progress is keyed by lesson ID and review records by card ID.

`validateState` is reused for imports, exports, new courses, and core transitions. Important constraints include:

- At most 100 courses, 24 lessons per course, and 48 cards per course.
- Every quotation must be an exact, nonempty excerpt of its own course source.
- IDs must be unique across the state; progress and reviews cannot reference missing content.
- Unknown fields, unsafe keys, non-plain objects, accessors, cycles, shared object references, sparse arrays, invalid dates, and nonfinite numbers are rejected.
- Preflight limits depth and node count. Serialized state must fit the same 2 MiB boundary on import and export.

Core transitions validate before cloning and validate their result. `completeLesson` is idempotent. `updateCard` preserves source quotes and review history. `deleteCourse` removes only associated progress and review records. `deleteCourse` and `updateCard` currently obtain their own timestamps; other time-sensitive functions accept an explicit `Date` for reproducible tests.

## Persistence and recovery

The storage key is `trace-learning-v1`. On startup, the UI validates saved JSON before using it. Unreadable saved data is preserved while a temporary starter workspace runs with writes blocked. The original data can be downloaded for recovery.

A failed write keeps the current session in memory and warns the user to export. A storage event from another tab also blocks writes and asks for a reload. This prevents blind overwrites, but it is not multi-tab merging or synchronization.

Backup restore validates first and asks for confirmation before replacing the workspace. JSON export includes the complete source, card edits, and review state. The application does not encrypt this data; backups can contain private reading material.

## Review and probability models

Only cards from explicitly completed lessons can become due. A new completed card is immediately eligible. Again schedules ten minutes later and resets successful repetitions. The first successful review schedules one day for Good or three for Easy; subsequent successes triple the existing interval up to 180 days. Ratings are self-assessment, not scored answers or a calibrated memory model.

The lab calculates expected true positives, false positives, true negatives, and false negatives from a population, prevalence, sensitivity, and false-positive rate. Positive predictive value is true positives divided by all positives, or `null` if that denominator is zero. Counts remain fractional until display formatting; this is arithmetic, not a random simulation.

## Deliberate tradeoffs

- **Vanilla modules:** little runtime machinery and easy source inspection; rendering and event coordination remain manual.
- **Local storage:** no account or backend dependency; capacity, durability, privacy, and concurrent editing are limited by the browser.
- **Extractive drafts:** reproducible provenance without inference cost; limited pedagogical quality and incomplete coverage of long sources.
- **Strict schema:** a clear import boundary; future schema changes require an explicit migration strategy, which is not yet implemented.
- **DOM tests:** fast behavior checks without a browser binary; they cannot establish visual quality, native file-picker behavior, or assistive-technology compatibility.
