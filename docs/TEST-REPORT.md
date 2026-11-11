# Verification report

Last automated run: 11 November 2026, Node.js 24.22.1.

## Automated checks recorded

- `npm test`: **21 tests passed, 0 failed**.
- `npm run test:interface`: **4 scenarios passed, 0 failed**.

These results describe the source available during the documentation pass. Re-run the checks after subsequent changes and before publishing a release.

### Core coverage

The tests exercise extraction determinism with an explicit timestamp, heading and CRLF handling, Unicode and exact evidence preservation, complete-source retention, malformed inputs, source URL restrictions, backup round trips and size boundaries, unsafe object shapes, duplicate IDs, reference integrity, date validation, idempotent lesson completion, review schedules, editing, deletion, and Bayes edge cases.

### Interface coverage

The jsdom scenarios exercise:

1. Lesson completion, recall, card editing, repeat navigation/completion, review rating, reload persistence, and skip-link behavior.
2. Pasted import, editable preview, returning to the form, navigating with an unsaved draft, saving, and cancellation confirmation.
3. Search recovery, canceled deletion, lab extremes and prediction feedback, missing-lesson recovery, and access to backup controls.
4. Corrupt stored data retains its original bytes and changes the frame status to Session only, rather than falsely claiming persistence.

The tests simulate browser APIs where needed. DOM assertions verify markup and state changes, not rendered geometry, pixels, or native browser behavior.

## Browser verification

Checked in Chromium against the hosted build on 11 November 2026:

- Desktop landing page rendered at 1180 CSS px. Mobile layouts rendered in same-origin 390px and 320px viewport frames. The body measured no horizontal overflow at either mobile width (375px and 305px content width after scrollbars).
- The actual library and a mobile lesson reader were inspected visually. Header navigation, course panels, source text, and phone reading flow remained legible.
- Opened a lesson, expanded evidence, completed the lesson, revealed a recall answer, and opened the card editor. Escape discarded a temporary edit and returned focus to Edit card.
- Rated a due review, created a two-section course from pasted text, previewed it, saved it, found it through search, canceled deletion, then removed the test course and cleared search.
- Used keyboard input on the lab sliders to reach zero base rate and zero false-positive rate; the interface correctly showed an undefined posterior rather than dividing by zero.
- Simultaneous QA tabs exercised the cross-tab write-block warning. Reloading recovered the latest saved state.
- The public production alias returned HTTP 200 without credentials and loaded the application.

These checks used mouse/keyboard input in Chromium and narrow viewport frames, not physical mobile devices. They are not an accessibility certification. A screen-reader pass, real touch gestures, native file selection/backup restoration, storage-full/unavailable/corrupt-data browser simulations, and direct local-file execution of the standalone output remain unverified. The automated suite covers the underlying import, backup, and state-validation logic.

Deployment URL: https://trace-psi-six.vercel.app/

## Reproduce

Use Node.js 24.15+ with the committed lockfile:

```sh
npm ci
npm test
npm run test:interface
npm run check
npm run build
npm run dev
```

The core suite uses Node's built-in test runner. The interface suite uses jsdom 31. No educational outcome, user adoption, production reliability, or security-audit claim follows from these tests.
