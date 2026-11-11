---
name: Trace Open Study
description: A spacious midnight landing surface around a practical, source-backed learning workspace.
colors:
  primary: "#2456d3"
  primary-deep: "#183fa6"
  midnight: "#142e46"
  lime: "#d4eb86"
  paper: "#f5f7fa"
  surface: "#ffffff"
  muted: "#566879"
  line: "#d5dfe8"
  pale: "#e9effa"
typography:
  display:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "66px"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 500
    lineHeight: 1.1
  reading:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.7
  body:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  control: "999px"
  surface: "14px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  page: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "13px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  navigation-active:
    backgroundColor: "#38516a"
    textColor: "{colors.surface}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    padding: "30px"
---

# Design System: Trace Open Study

## Reference and scope

The redesign takes Teaflask’s spacious centered composition, restrained sans headline, compact pill navigation, and product framing as a visual reference. Trace’s palette, content, storage schema, and learning workflows remain its own. No Teaflask code or brand assets are used.

## Palette

- Midnight `#142e46` is the landing background and global header.
- Cobalt `#2456d3` marks learning actions, progress, and the course cover.
- Lime `#d4eb86` highlights the main landing action, learning emphasis, and path diagram.
- Paper `#f5f7fa` and white support actual reading and operating surfaces.
- Muted blue `#566879` serves secondary text on light backgrounds. `#bdccdc` and `#aabed1` serve secondary text on midnight.
- Dark chrome uses `#203b55`, `#213d56`, and selected navigation `#38516a`.

## Typography

Self-hosted Instrument Sans carries display, navigation, labels, and controls. Newsreader is reserved for lesson prose and recall questions. Font files include their SIL Open Font License notices. Web CSS references local font files; the standalone build embeds the same bytes.

The landing headline is fluid up to 66px, 54px on tablets, 40px on phones, and 35px on very narrow phones. Display tracking is -0.035em, line height 1.08–1.12. Route titles are 44px desktop and 35px mobile. Lesson prose remains 22px desktop and 21px mobile, with 1.7–1.75 line height and a 70ch maximum measure. Form fields use 16px on mobile.

## Composition

A three-part header places the Trace wordmark left, pill navigation center, and the create action right. On phones the navigation occupies a second row. It stays in document flow rather than covering lesson content.

The library opens with one centered message and two useful actions. The working library sits in a thin-bordered application frame below it. It is real application content, not a screenshot or simulated product. The lesson card, search, creation link, and progress line remain operable.

The content width is 1200px with 48px side padding on desktop, 28px on tablets, and 16px on the mobile landing page. Lesson content stays on paper, with a course index at the side on wide screens and above the reader on narrower ones. Forms, reviews, dialogs, and settings share the same light component system.

## Components and states

Buttons and compact navigation use pill shapes. Panels remain 12–16px rounded rectangles. Borders define surfaces; shadows are reserved for transient toast feedback. Source evidence expands inline. Destructive actions and card editing use native dialogs. Keyboard focus is visible. Recall reveal motion respects reduced-motion preferences.

## Design decisions

- Keep the route header legible and the first action obvious.
- Show the actual course instead of decorative product metrics.
- Retain a crisp returning-path diagram as Trace’s original geometric mark.
- Keep explanatory text readable, with source evidence close to the associated idea.
- Do not invent endorsements, outcomes, usage, or AI features.
- Use no runtime font CDN, content API, or analytics service.

## Verification

See `docs/TEST-REPORT.md` for test results and the exact scope of browser checks. Impeccable 4.8.2’s context, craft-floor, and detector were used. The detector reported design-document drift advisories and a subjective warning about the retained Instrument Sans family; no deterministic blocking finding. Documentation now describes the intended implementation rather than the previous navigation-rail layout.
