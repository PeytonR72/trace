import {
  createState,
  parseTextCourse,
  validateState,
  importState,
  serializeState,
  listCards,
  dueCards,
  recordReview,
  completeLesson,
  deleteCourse,
  updateCard,
  calculateBayes,
  safeSourceUrl,
} from "./core.mjs";
import { STARTER_COURSES } from "./starter.mjs";

const STORAGE_KEY = "trace-learning-v1";
const app = document.querySelector("#app");
const dialog = document.querySelector("#dialog");
const status = document.querySelector("#status");
const h = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
  leaf: '<path d="M5 6h9a5 5 0 0 1 0 10H9a3 3 0 0 1 0-6h10M5 3v18"/>',
  home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  book: '<path d="M12 5C9 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 1Z"/><path d="M12 5v15"/>',
  cards:
    '<rect x="5" y="6" width="15" height="14" rx="2"/><path d="M16 3H4a2 2 0 0 0-2 2v11M9 11h7M9 15h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  back: '<path d="M20 12H5m5-5-5 5 5 5"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  shield:
    '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  settings:
    '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="16" cy="17" r="3" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  link: '<path d="m9 15 6-6m-5-3 2-2a5 5 0 0 1 7 7l-2 2m-3 5-2 2a5 5 0 0 1-7-7l2-2"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14Z"/>',
  spark:
    '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>',
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
let state;
let storageProblem = "";
let blockedWrite = false;
let originalStorage = "";
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    originalStorage = saved;
    state = importState(saved);
  } else {
    state = createState(STARTER_COURSES);
    localStorage.setItem(STORAGE_KEY, serializeState(state));
  }
} catch (error) {
  state = createState(STARTER_COURSES);
  blockedWrite = true;
  storageProblem = originalStorage
    ? "Your saved data could not be read. It has been preserved. This temporary workspace will not overwrite it. Download the original data below, or restore a valid backup in Settings."
    : "Browser storage is unavailable. You can use Trace for this visit; download a backup before leaving.";
}
let query = "";
let draft = null;
let importForm = { title: "", text: "", sourceTitle: "", sourceUrl: "" };
let formError = "";
let modalAction = null;
let reviewSession = null;
let reviewRevealed = false;
let lessonRevealed = false;
let lessonCardIndex = 0;
let labValues = {
  baseRate: 1,
  sensitivity: 90,
  falsePositiveRate: 10,
  population: 1000,
};
let transferAnswer = null;
let toastTimer;
let route = getRoute();

function getRoute() {
  const parts = location.hash
    .replace(/^#\/?/, "")
    .split("/")
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return "";
      }
    });
  return {
    page: parts[0] || "library",
    courseId: parts[1],
    lessonId: parts[2],
  };
}
function go(hash) {
  if (location.hash === hash) render(true);
  else location.hash = hash;
}
function lessonUrl(course, lesson) {
  return `#/lesson/${encodeURIComponent(course.id)}/${encodeURIComponent(lesson.id)}`;
}
function courseProgress(course) {
  return course.lessons.filter((l) => state.progress[l.id]).length;
}
function activeLesson(course) {
  return course.lessons.find((l) => !state.progress[l.id]) || course.lessons[0];
}
function notify(message) {
  status.textContent = "";
  requestAnimationFrame(() => {
    status.textContent = message;
  });
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.remove(), 4200);
}
function commit(next, message = "") {
  state = next;
  if (!blockedWrite) {
    try {
      localStorage.setItem(STORAGE_KEY, serializeState(state));
      storageProblem = "";
    } catch {
      blockedWrite = true;
      storageProblem =
        "Changes are only saved for this visit because browser storage is unavailable or full. Download a backup in Settings before leaving.";
    }
  }
  if (message) notify(message);
}
function download(text, filename, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function errorMessage(error) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
function sound() {
  if (!state.settings.sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    const ctx = new Audio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 620;
    gain.gain.setValueAtTime(0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
    osc.onended = () => ctx.close();
  } catch {}
}
function storageNotice() {
  return storageProblem
    ? `<div class="notice error" role="alert"><p>${h(storageProblem)}</p>${originalStorage && blockedWrite ? '<button class="text-button" data-action="download-original">Download original saved data</button>' : ""}</div>`
    : "";
}
function navItem(page, label, name, count = "") {
  return `<a href="#/${page}" class="${route.page === page || (page === "library" && route.page === "lesson") ? "active" : ""}" ${route.page === page || (page === "library" && route.page === "lesson") ? 'aria-current="page"' : ""}>${icon(name)}<span>${label}</span>${count ? `<span class="nav-count">${count}</span>` : ""}</a>`;
}
function shell(content) {
  const due = dueCards(state).length;
  const isLibrary = route.page === "library";
  app.innerHTML = `<header class="site-header"><a href="#/library" class="brand" aria-label="Trace home">${icon("leaf")}<span>trace</span></a><nav class="nav" aria-label="Main navigation">${navItem("library", "Library", "book")}${navItem("review", "Review", "cards", due || "")}${navItem("import", "Create", "plus")}${navItem("settings", "Settings", "settings")}</nav><a class="header-action" href="#/import">Add your reading ${icon("plus")}</a></header><div class="shell ${isLibrary ? "landing-shell" : ""}"><main id="main" class="page-${h(route.page)}" tabindex="-1">${storageNotice()}${content}<footer class="footer-note"><a href="#/library" class="footer-brand">${icon("leaf")} trace</a><span>A little learning. A lasting trace.</span><a href="#/settings">Browser-local workspace ${icon("shield")}</a></footer></main></div>`;
}

function render(focus = false) {
  route = getRoute();
  if (route.page !== "review") reviewSession = null;
  try {
    if (route.page === "lesson") renderLesson();
    else if (route.page === "review") renderReview();
    else if (route.page === "import") renderImport();
    else if (route.page === "settings") renderSettings();
    else renderLibrary();
    if (focus) {
      document.querySelector("main")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  } catch (error) {
    shell(
      `<div class="empty-state"><h1>Let’s take a step back.</h1><p>${h(errorMessage(error))}</p><a class="button primary" href="#/library">Return to your library</a></div>`,
    );
  }
}
function renderLibrary() {
  const totalLessons = state.courses.reduce(
    (sum, c) => sum + c.lessons.length,
    0,
  );
  const completed = Object.keys(state.progress).length;
  const due = dueCards(state).length;
  const filtered = state.courses.filter((c) =>
    `${c.title} ${c.description} ${c.source.title}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const resumed = state.courses.find(
    (c) => courseProgress(c) > 0 && courseProgress(c) < c.lessons.length,
  );
  shell(
    `<section class="hero" aria-labelledby="hero-title"><div class="hero-copy"><h1 id="hero-title">Make what you read<br>part of <em>what you know.</em></h1><p>Short lessons. Questions worth coming back to.<br>Your source, always in sight.</p><div class="actions"><a href="${resumed ? lessonUrl(resumed, activeLesson(resumed)) : state.courses.length ? lessonUrl(state.courses[0], activeLesson(state.courses[0])) : "#/import"}" class="button primary">${resumed ? "Continue learning" : state.courses.length ? "Try a short lesson" : "Create your first course"} ${icon("arrow")}</a><a href="#/import" class="button secondary">Create from your reading</a></div><p class="hero-note">No account needed. Your learning stays in this browser.</p></div></section><section class="library-window" aria-labelledby="library-title"><div class="window-bar"><span class="window-mark">${icon("leaf")} YOUR LEARNING SPACE</span><span class="window-status"><i></i> ${blockedWrite ? "Session only" : "Saved locally"}</span></div><div class="library-content"><div class="section-head"><div><h2 id="library-title">Your library <span class="library-count">${state.courses.length}</span></h2><p class="section-description">Pick up an idea. Make it yours.</p></div><label class="search-field">${icon("search")}<span class="sr-only">Search your library</span><input id="library-search" type="search" placeholder="Find a course…" value="${h(query)}" autocomplete="off"></label></div><div class="course-grid" id="course-grid">${filtered.map(courseCard).join("")}${!filtered.length && query ? '<div class="empty-state"><h2>No courses found</h2><p>Try another title or source.</p><button class="button secondary" data-action="clear-search">Clear search</button></div>' : ""}${!query ? `<a class="add-course" href="#/import"><div class="add-symbol">${icon("plus")}</div><div><h3>What are you curious about?</h3><p>Bring your notes, an article, or a chapter.</p></div><span class="text-button">Create a course ${icon("arrow")}</span></a>` : ""}</div><div class="workspace-summary" aria-label="Your progress"><span>${icon("check")} <strong>${completed} of ${totalLessons}</strong> lessons completed</span><a href="#/review">${icon("cards")} <strong>${due}</strong> ready to revisit ${icon("arrow")}</a></div></div></section><section class="learning-principles" aria-label="How Trace works"><div><span class="principle-label">Read with context</span><p>Follow any idea back<br>to its original source.</p>${icon("link")}</div><div><span class="principle-label">Make it stick</span><p>Recall in your own words.<br>Return when it’s time.</p>${icon("cards")}</div><div><span class="principle-label">Keep it yours</span><p>No account. No content uploads.<br>Export a backup anytime.</p>${icon("shield")}</div></section>`,
  );
}
function courseCard(course) {
  const completed = courseProgress(course);
  const total = course.lessons.length;
  return `<article class="course-card"><div class="course-art ${course.origin === "imported" ? "imported" : ""}" aria-hidden="true"><svg class="trace-diagram" viewBox="0 0 220 170" fill="none"><path d="M20 45h115a40 40 0 0 1 0 80H85a25 25 0 0 1 0-50h115" stroke="currentColor" stroke-width="1.5"/><circle cx="20" cy="45" r="7" fill="currentColor"/><circle cx="85" cy="125" r="7" fill="currentColor"/><circle cx="200" cy="75" r="7" fill="currentColor"/><path d="M20 65v65m-8-10 8 10 8-10M200 20v35m-8-10 8 10 8-10" stroke="currentColor" stroke-width="1.5"/></svg><span class="cover-caption">READ. RECALL. CONNECT.</span></div><div class="course-body"><div class="course-meta"><span class="tag">${icon("link")} ${course.origin === "starter" ? "SOURCE-BACKED" : "EXTRACTIVE DRAFT"}</span><span class="small muted">${total} lesson${total === 1 ? "" : "s"} · ~${total * 3} min</span></div><h3><a href="${lessonUrl(course, activeLesson(course))}">${h(course.title)}</a></h3><p>${h(course.description || "Short lessons from your own reading, with the original source close at hand.")}</p><div class="course-progress"><div class="progress-line" role="progressbar" aria-label="${h(course.title)} completed lessons" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${completed}"><span style="width:${total ? (completed / total) * 100 : 0}%"></span></div><span>${completed} / ${total} read</span></div><div class="course-bottom"><a class="text-button" href="${lessonUrl(course, activeLesson(course))}">${completed === total ? "Revisit course" : completed ? "Continue learning" : "Start learning"} ${icon("arrow")}</a><button class="icon-button" data-action="delete-course" data-course="${h(course.id)}" aria-label="Delete ${h(course.title)}">${icon("trash")}</button></div></div></article>`;
}
function findLesson() {
  const course = state.courses.find((c) => c.id === route.courseId);
  const lesson =
    course?.lessons.find((l) => l.id === route.lessonId) || course?.lessons[0];
  return { course, lesson };
}
function evidence(course, quote, full = false) {
  const url = safeSourceUrl(course.source.url);
  return `<details class="evidence"><summary>${icon("link")} Follow the evidence</summary><div class="evidence-body"><blockquote>${h(quote)}</blockquote><div class="evidence-source">Exact excerpt from <strong>${h(course.source.title || course.title)}</strong>. ${url ? `<a href="${h(url)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>` : "Source text is saved with this course."}<br>Sources provide context; they are not independently fact-checked.</div>${full ? `<details class="source-full"><summary>Read the complete saved source</summary><pre>${h(course.source.text)}</pre></details>` : ""}</div></details>`;
}
function renderLesson() {
  const { course, lesson } = findLesson();
  if (!course || !lesson) {
    shell(
      '<div class="empty-state"><h1>Lesson not found.</h1><p>This course may have been removed.</p><a href="#/library" class="button primary">Back to library</a></div>',
    );
    return;
  }
  const index = course.lessons.indexOf(lesson);
  const completed = Boolean(state.progress[lesson.id]);
  shell(
    `<div class="reader-layout"><article class="reader-main"><a class="back-link" href="#/library">${icon("back")} Back to your library</a><h1>${h(lesson.title)}</h1><div class="reading-meta"><span class="lesson-position">Lesson ${index + 1} / ${course.lessons.length}</span><span>${icon("clock")} ~3 min read</span><span>From ${h(course.title)}</span></div>${course.origin === "imported" ? '<div class="notice">This lesson is an extractive draft from your source. Review its coverage and edit the recall cards to fit what you want to learn.</div>' : ""}<div class="lesson-prose">${lesson.paragraphs.map((p) => `<p>${h(p)}</p>`).join("")}</div>${evidence(course, lesson.quote, true)}${lesson.simulator ? renderLab() : ""}<div class="completion"><div>${completed ? `<span class="lesson-complete-note">${icon("check")} You’ve marked this lesson as read.</span>` : "<p>Ready to make it stick?<br>Mark this lesson as read to unlock recall practice.</p>"}</div>${!completed ? `<button class="button primary" data-action="complete-lesson">Mark read & practice ${icon("arrow")}</button>` : course.lessons[index + 1] ? `<a href="${lessonUrl(course, course.lessons[index + 1])}" class="button secondary">Next lesson ${icon("arrow")}</a>` : '<a class="button secondary" href="#/review">Go to review queue ' + icon("arrow") + "</a>"}</div>${completed ? lessonRecall(course, lesson) : ""}<div class="actions" style="margin-top:24px"><button class="text-button" data-action="download-notes" data-course="${h(course.id)}">${icon("download")} Download course notes</button></div></article><aside class="reader-aside" aria-label="Course lessons"><h2>${h(course.title)}</h2><div class="progress-line"><span style="width:${(courseProgress(course) / course.lessons.length) * 100}%"></span></div><ol class="lesson-list">${course.lessons.map((l, i) => `<li><button data-action="open-lesson" data-course="${h(course.id)}" data-lesson="${h(l.id)}" class="${l.id === lesson.id ? "current" : ""}" ${l.id === lesson.id ? 'aria-current="step"' : ""}><span class="lesson-number ${state.progress[l.id] ? "done" : ""}">${state.progress[l.id] ? "✓" : i + 1}</span><span>${h(l.title)}</span></button></li>`).join("")}</ol><p class="aside-note">Read a little.<br>Try to recall it.<br>Come back when it’s time.<br><br>Understanding grows with practice.</p></aside></div>`,
  );
}
function lessonRecall(course, lesson) {
  if (!lesson.cards.length)
    return '<p class="small muted">There are no recall cards in this lesson.</p>';
  lessonCardIndex = Math.min(lessonCardIndex, lesson.cards.length - 1);
  const card = lesson.cards[lessonCardIndex];
  return `<section class="recall-panel" id="lesson-practice" tabindex="-1" aria-labelledby="recall-title"><div class="recall-top"><span class="context-label">Recall practice</span><span class="small muted">Card ${lessonCardIndex + 1} of ${lesson.cards.length}</span></div><h2 id="recall-title">What stayed with you?</h2><p class="small muted">Answer in your own words before you reveal. You decide how well you remembered.</p><div class="question" tabindex="-1">${h(card.prompt)}</div>${lessonRevealed ? `<div class="answer" tabindex="-1">${h(card.answer)}</div>${ratingButtons(card.id, "lesson")}${evidence(course, card.quote)}` : `<button class="button primary" data-action="reveal-lesson">Reveal answer ${icon("arrow")}</button>`}<div class="recall-top" style="margin-top:18px"><button class="text-button" data-action="edit-card" data-card="${h(card.id)}">${icon("edit")} Edit card</button>${lesson.cards.length > 1 ? '<button class="text-button" data-action="next-lesson-card">Next card ' + icon("arrow") + "</button>" : ""}</div></section>`;
}
function ratingButtons(cardId, context) {
  return `<p class="small muted" style="font-size:10px;margin:0 0 11px">How did that feel? Choose your next review interval.</p><div class="rating-row"><button class="rating" data-action="rate" data-rating="again" data-card="${h(cardId)}" data-context="${context}"><strong>Again</strong><small>10 minutes</small></button><button class="rating" data-action="rate" data-rating="good" data-card="${h(cardId)}" data-context="${context}"><strong>Got it</strong><small>${nextInterval(cardId, "good")}</small></button><button class="rating" data-action="rate" data-rating="easy" data-card="${h(cardId)}" data-context="${context}"><strong>Easy</strong><small>${nextInterval(cardId, "easy")}</small></button></div>`;
}
function nextInterval(cardId, rating) {
  const review = state.reviews[cardId];
  const days =
    !review || !review.repetitions
      ? rating === "easy"
        ? 3
        : 1
      : Math.min(180, (review.intervalDays || 1) * 3);
  return `${days} day${days === 1 ? "" : "s"}`;
}
function renderLab() {
  return `<section class="lab" aria-labelledby="lab-title"><h2 id="lab-title">See the numbers change.</h2><p>Imagine a filter applied to 1,000 messages. Change the assumptions and follow the expected counts.</p><div class="sliders">${slider("baseRate", "Base rate · messages that are spam", 0, 100, 0.1)}${slider("sensitivity", "Sensitivity · spam caught by the filter", 0, 100, 0.1)}${slider("falsePositiveRate", "False positive rate · legitimate messages flagged", 0, 100, 0.1)}</div><div class="lab-output" aria-live="polite" aria-atomic="true">${labOutput()}</div><p class="lab-disclaimer">Expected counts may be fractional; they describe averages across comparable inboxes. This is an educational model with hypothetical inputs.</p><div class="transfer"><h3>A spam filter flags an email. What now?</h3><p>Suppose 2% of emails are spam. A filter catches 80% of spam and incorrectly flags 4% of other emails. About what share of flagged emails are actually spam?</p><div class="transfer-options" role="group" aria-label="Choose a prediction">${[29, 80, 2].map((n) => `<button class="button secondary ${transferAnswer === n ? "selected" : ""}" data-action="predict" data-answer="${n}" aria-pressed="${transferAnswer === n}">About ${n}%</button>`).join("")}</div><div class="transfer-feedback" aria-live="polite">${transferFeedback()}</div></div></section>`;
}
function transferFeedback() {
  if (transferAnswer === null) return "";
  return `<p class="prediction-feedback"><strong>${transferAnswer === 29 ? "That’s right." : "Try counting the emails."}</strong> Out of 1,000 emails, expect 20 spam emails. The filter catches 16 of those and incorrectly flags 39.2 of the other 980. So 16 ÷ 55.2 ≈ <strong>29%</strong> of flags are actual spam. The starting rate changes what a positive result means.</p>`;
}
function slider(name, label, min, max, step) {
  return `<div><label class="slider-label" for="lab-${name}"><span>${label}</span><output id="out-${name}" for="lab-${name}">${labValues[name]}%</output></label><input id="lab-${name}" type="range" min="${min}" max="${max}" step="${step}" value="${labValues[name]}" data-lab="${name}" aria-describedby="out-${name}"></div>`;
}
function number(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
    value,
  );
}
function labOutput() {
  const r = calculateBayes(labValues);
  const posterior = r.positivePredictiveValue;
  const trueWidth =
    r.positiveTotal > 0 ? (r.truePositive / r.positiveTotal) * 100 : 0;
  const falseWidth =
    r.positiveTotal > 0 ? (r.falsePositive / r.positiveTotal) * 100 : 0;
  return `<div class="lab-result"><div class="posterior-row"><p>Among flagged messages,<br><strong>${posterior === null ? "none can be evaluated" : `${number(posterior * 100)}% are expected to be actual spam.`}</strong></p><span class="posterior">${posterior === null ? "—" : number(posterior * 100) + "%"}</span></div><div class="frequency-bar" role="img" aria-label="${number(r.truePositive)} expected spam flags and ${number(r.falsePositive)} expected legitimate-message flags"><span class="true" style="width:${trueWidth}%"></span><span class="false" style="width:${falseWidth}%"></span></div><div class="frequency-legend"><span><i class="legend-dot"></i>${number(r.truePositive)} spam flags</span><span><i class="legend-dot false"></i>${number(r.falsePositive)} legitimate flags</span></div><div class="count-grid"><div class="count-item"><strong>${number(r.truePositive)}</strong>Spam, correctly flagged</div><div class="count-item"><strong>${number(r.falsePositive)}</strong>Legitimate, incorrectly flagged</div><div class="count-item"><strong>${number(r.falseNegative)}</strong>Spam, missed by the filter</div><div class="count-item"><strong>${number(r.trueNegative)}</strong>Legitimate, left unflagged</div></div><p class="lab-disclaimer">${r.positiveTotal ? `${number(r.truePositive)} ÷ ${number(r.positiveTotal)} flagged messages = ${number(posterior * 100)}%.` : "No flags are expected, so the percentage is undefined."} All expected counts are out of 1,000 messages.</p></div>`;
}
function renderReview() {
  if (reviewSession === null) reviewSession = dueCards(state).map((c) => c.id);
  const cards = listCards(state);
  reviewSession = reviewSession.filter((id) => cards.some((c) => c.id === id));
  const card = cards.find((c) => c.id === reviewSession[0]);
  if (!card) {
    const completed = Object.keys(state.progress).length;
    const scheduled = Object.values(state.reviews)
      .filter((r) => new Date(r.dueAt) > new Date())
      .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    shell(
      `<div class="review-wrap"><div class="page-title"><div><h1>A moment to recall.</h1></div></div><div class="empty-state"><div class="add-symbol" style="margin:0 auto 20px">${icon(completed ? "check" : "book")}</div><h2>${completed ? "You’re all caught up." : "Your next idea is waiting."}</h2><p>${completed ? "Nothing is due right now. Your next review will appear here when it’s time." : "Read a lesson and mark it complete to add its cards to your review queue."}</p>${scheduled.length ? `<p class="small">Next review: ${h(new Date(scheduled[0].dueAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }))}</p>` : ""}<a class="button primary" href="#/library">Explore your library ${icon("arrow")}</a></div><p class="review-foot">A simple interval schedule: Again · 10 minutes, Got it · 1 day, Easy · 3 days.<br>Later successful reviews extend the interval by 3×, up to 180 days.</p></div>`,
    );
    return;
  }
  const course = state.courses.find((c) => c.id === card.courseId);
  shell(
    `<div class="review-wrap"><div class="page-title"><div><h1>A moment to recall.</h1></div><span class="tag">${reviewSession.length} REMAINING</span></div><div class="review-card"><div class="recall-top"><span class="context-label">${course.origin === "imported" ? "EXTRACTIVE DRAFT" : "RETRIEVAL PRACTICE"}</span>${icon("cards")}</div><div class="review-context">${h(card.courseTitle)} / ${h(card.lessonTitle)}</div><div class="question" tabindex="-1">${h(card.prompt)}</div>${reviewRevealed ? `<div class="answer" tabindex="-1">${h(card.answer)}</div>${ratingButtons(card.id, "review")}` : `<p class="small muted">Pause. Try an answer in your own words.</p><button class="button primary" data-action="reveal-review">Reveal answer ${icon("arrow")}</button>`}${evidence(course, card.quote)}<div class="recall-top"><button class="text-button" data-action="edit-card" data-card="${h(card.id)}">${icon("edit")} Edit card</button><a class="text-button" href="${lessonUrl(
      course,
      course.lessons.find((l) => l.id === card.lessonId),
    )}">Revisit lesson ${icon("arrow")}</a></div></div><p class="review-foot">Self-rated recall. A simple interval schedule, saved in this browser.</p></div>`,
  );
}
function renderImport() {
  if (draft) {
    renderPreview();
    return;
  }
  shell(
    `<div class="page-title"><div><h1>Leave a little trace.</h1></div></div><div class="form-layout"><form class="panel" id="import-form"><div class="file-upload"><button class="button secondary" type="button" data-action="choose-source">${icon("upload")} Upload text file</button><input class="sr-only" tabindex="-1" id="source-file" type="file" accept=".txt,.md,text/plain,text/markdown"><span class="small muted">.txt or .md · up to 100 KB</span></div><div class="field"><label for="course-title">Course title</label><input id="course-title" name="title" required maxlength="120" placeholder="What would you like to understand?" value="${h(importForm.title)}"></div><div class="field"><label for="source-text">Paste your source text</label><textarea class="source-text" id="source-text" name="text" required minlength="40" maxlength="100000" placeholder="An article, a chapter, or your own notes…\n\nHeadings help organize your lessons." aria-describedby="source-hint">${h(importForm.text)}</textarea><p class="field-hint" id="source-hint">40–100,000 characters. Source stays in this browser. No links are fetched.</p></div><div class="field"><label for="source-title">Source name <span class="muted">(optional)</span></label><input id="source-title" name="sourceTitle" maxlength="200" placeholder="Article or author name" value="${h(importForm.sourceTitle)}"></div><div class="field"><label for="source-url">Source link <span class="muted">(optional)</span></label><input id="source-url" name="sourceUrl" type="url" placeholder="https://…" value="${h(importForm.sourceUrl)}"><p class="field-hint">For reference only. Use an http or https link.</p></div>${formError ? `<p class="inline-error" role="alert">${h(formError)}</p>` : ""}<div class="actions"><button class="button primary" type="submit">Preview your lessons ${icon("arrow")}</button><button class="button quiet" type="button" data-action="cancel-import">Cancel</button></div></form><aside class="form-aside"><h2>Make room for an idea.</h2><div class="step"><span class="step-num">1</span><p>Bring something<br>worth understanding.</p></div><div class="step"><span class="step-num">2</span><p>Review short lessons<br>and edit your recall cards.</p></div><div class="step"><span class="step-num">3</span><p>Practice a little.<br>Come back when it’s time.</p></div><p style="border-top:1px solid #d1dbc8;padding-top:18px;margin-top:23px">Extractive drafts, not AI-generated. Text is grouped into short sections and prompts use sentences from your source.</p><p>Up to 24 sections and 48 cards. Long sources may have partial lesson coverage; the complete source is always kept.</p></aside></div>`,
  );
}
function renderPreview() {
  shell(
    `<div class="page-title"><div><h1>${h(draft.title)}</h1></div><span class="tag">EXTRACTIVE DRAFT</span></div><div class="preview-intro"><p>${draft.lessons.length} lesson${draft.lessons.length === 1 ? "" : "s"} · ${draft.lessons.reduce((n, l) => n + l.cards.length, 0)} recall cards. Read through your draft and refine the questions and answers below before saving.</p><div class="notice">These are extractive drafts, not AI-generated explanations. Long sources use up to the first 24 extracted sections; lesson excerpts are shortened to about 1,200 characters. Lesson coverage can be partial. Your complete original source is preserved and available in each lesson.</div></div><form id="preview-form">${draft.lessons.map((lesson, i) => `<section class="draft-section"><div class="context-label">Lesson ${i + 1}</div><h2>${h(lesson.title)}</h2>${lesson.paragraphs.map((p) => `<p>${h(p)}</p>`).join("")}${lesson.cards.map((card) => `<div class="draft-card"><div class="context-label">Draft recall card</div><label for="prompt-${h(card.id)}">Question or cloze prompt</label><textarea id="prompt-${h(card.id)}" name="prompt-${h(card.id)}" data-draft-card="${h(card.id)}" data-field="prompt" required maxlength="1000">${h(card.prompt)}</textarea><label for="answer-${h(card.id)}">Answer</label><textarea id="answer-${h(card.id)}" name="answer-${h(card.id)}" data-draft-card="${h(card.id)}" data-field="answer" required maxlength="1000">${h(card.answer)}</textarea><p class="field-hint">Evidence stays linked to the unchanged original excerpt.</p></div>`).join("")}</section>`).join("")}${formError ? `<p class="inline-error" role="alert">${h(formError)}</p>` : ""}<div class="sticky-actions"><button class="button secondary" type="button" data-action="back-import">${icon("back")} Back to source</button><span class="preview-count">${draft.lessons.length} lessons ready to review</span><button class="button primary" type="submit">Save to your library ${icon("arrow")}</button></div></form>`,
  );
}
function renderSettings() {
  shell(
    `<div class="page-title"><div><h1>A space of your own.</h1></div></div><div class="settings-grid"><section class="panel"><h2 style="margin-top:10px">Back up your workspace.</h2><p>Download your courses, original sources, edited cards, and review progress in one JSON file.</p><div class="data-summary"><span><strong>${state.courses.length}</strong> courses</span><span><strong>${listCards(state).length}</strong> cards</span><span><strong>${Object.keys(state.progress).length}</strong> lessons read</span></div><button class="button primary" data-action="export-backup">${icon("download")} Download backup</button></section><section class="panel"><h2 style="margin-top:10px">Restore a backup.</h2><p>Choose a Trace JSON backup. We’ll validate it and ask before replacing this workspace.</p><p class="small">Restoring replaces all current courses and progress. Download a backup first if you want to keep them.</p><button class="button secondary" data-action="choose-backup">${icon("upload")} Choose backup file</button><input class="sr-only" tabindex="-1" type="file" id="backup-file" accept=".json,application/json"></section><section class="panel"><h2 style="margin-top:10px">Make practice yours.</h2><p>A soft tone after you rate a card. Sound is off by default.</p><div class="setting-row"><label for="sound-setting">Review sound</label><input type="checkbox" id="sound-setting" ${state.settings.sound ? "checked" : ""}></div></section><section class="panel"><h2 style="margin-top:10px">Start again.</h2><p>Reset this workspace to the starter course. Your imported courses, edits, and progress will be removed.</p><button class="button danger" data-action="reset-workspace">Reset workspace</button></section><section class="panel settings-full"><h2 style="margin-top:10px">Learning with the source in sight.</h2><p>Trace is a browser-local learning demo. It never sends your reading anywhere, fetches source links, or calls an AI service. Imported lessons are extractive drafts that you can review and edit. Sources provide context; they are not independently fact-checked.</p><p>Your data lives in this browser’s local storage. Clearing site data, changing browsers, or using a private window can remove it. Download a backup to keep a portable copy. Offline use requires the downloaded app package; online pages are not automatically cached.</p><p style="margin-bottom:0">Review uses a simple interval schedule, not FSRS: Again schedules 10 minutes; Got it starts at 1 day; Easy starts at 3 days. Later successful reviews multiply the interval by 3, up to 180 days. Recall is self-rated.</p></section></div>`,
  );
}
function openDialog(html, action = null) {
  modalAction = action;
  dialog.innerHTML = html;
  if (!dialog.open) dialog.showModal();
  const first =
    dialog.querySelector("[autofocus]") ||
    dialog.querySelector("button,input,textarea");
  first?.focus();
}
function confirmDialog({
  title,
  body,
  label = "Confirm",
  danger = false,
  onConfirm,
}) {
  openDialog(
    `<h2 id="dialog-title">${h(title)}</h2><p>${h(body)}</p><div class="actions"><button class="button secondary" data-action="close-dialog" autofocus>Cancel</button><button class="button ${danger ? "danger" : "primary"}" data-action="confirm-dialog">${h(label)}</button></div>`,
    onConfirm,
  );
}
function closeDialog() {
  dialog.close();
  modalAction = null;
}
function editCardDialog(cardId) {
  const card = listCards(state).find((c) => c.id === cardId);
  if (!card) throw new Error("This card could not be found.");
  openDialog(
    `<form id="edit-card-form" data-card="${h(card.id)}" data-course="${h(card.courseId)}" data-lesson="${h(card.lessonId)}"><h2 id="dialog-title">Make this card yours.</h2><p>Refine the wording. Its evidence stays linked to the original source.</p><div class="field"><label for="edit-prompt">Prompt</label><textarea id="edit-prompt" name="prompt" required maxlength="1000" autofocus>${h(card.prompt)}</textarea></div><div class="field"><label for="edit-answer">Answer</label><textarea id="edit-answer" name="answer" required maxlength="1000">${h(card.answer)}</textarea></div><p id="edit-error" class="inline-error" role="alert"></p><div class="actions"><button class="button secondary" type="button" data-action="close-dialog">Cancel</button><button class="button primary" type="submit">Save card</button></div></form>`,
  );
}
function collectImportForm(form) {
  const fd = new FormData(form);
  importForm = {
    title: String(fd.get("title") || ""),
    text: String(fd.get("text") || ""),
    sourceTitle: String(fd.get("sourceTitle") || ""),
    sourceUrl: String(fd.get("sourceUrl") || ""),
  };
}
function courseNotes(course) {
  return `# ${course.title}\n\n${course.description}\n\nSource: ${course.source.title}${course.source.url ? "\n" + course.source.url : ""}\n\n${course.lessons.map((l) => `## ${l.title}\n\n${l.paragraphs.join("\n\n")}\n\n### Recall\n\n${l.cards.map((c) => `- ${c.prompt}\n  Answer: ${c.answer}`).join("\n\n")}\n\n### Evidence\n\n> ${l.quote.replace(/\n/g, "\n> ")}`).join("\n\n")}\n\n---\nSources provide context; they are not independently fact-checked.\n`;
}

window.addEventListener("hashchange", () => {
  lessonRevealed = false;
  lessonCardIndex = 0;
  reviewRevealed = false;
  formError = "";
  render(true);
});
document.addEventListener("click", async (event) => {
  if (event.target.closest(".skip-link")) {
    event.preventDefault();
    document.querySelector("#main")?.focus();
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  try {
    if (action === "close-dialog") {
      closeDialog();
      return;
    }
    if (action === "confirm-dialog") {
      const fn = modalAction;
      closeDialog();
      fn?.();
      return;
    }
    if (action === "choose-source") {
      document.querySelector("#source-file").click();
      return;
    }
    if (action === "choose-backup") {
      document.querySelector("#backup-file").click();
      return;
    }
    if (action === "download-original") {
      download(originalStorage, "trace-original-saved-data.txt", "text/plain");
      return;
    }
    if (action === "predict") {
      transferAnswer = Number(button.dataset.answer);
      document.querySelector(".transfer-feedback").innerHTML =
        transferFeedback();
      document.querySelectorAll('[data-action="predict"]').forEach((b) => {
        b.setAttribute(
          "aria-pressed",
          String(Number(b.dataset.answer) === transferAnswer),
        );
        b.classList.toggle(
          "selected",
          Number(b.dataset.answer) === transferAnswer,
        );
      });
      return;
    }
    if (action === "clear-search") {
      query = "";
      render();
      document.querySelector("#library-search")?.focus();
      return;
    }
    if (action === "open-lesson") {
      go(
        `#/lesson/${encodeURIComponent(button.dataset.course)}/${encodeURIComponent(button.dataset.lesson)}`,
      );
      return;
    }
    if (action === "delete-course") {
      const course = state.courses.find((c) => c.id === button.dataset.course);
      if (!course) return;
      confirmDialog({
        title: "Remove this course?",
        body: `“${course.title}”, its source, edited cards, and review progress will be removed from this workspace. This cannot be undone.`,
        label: "Remove course",
        danger: true,
        onConfirm: () => {
          commit(deleteCourse(state, course.id), "Course removed.");
          render(true);
        },
      });
      return;
    }
    if (action === "complete-lesson") {
      const { lesson } = findLesson();
      commit(
        completeLesson(state, lesson.id),
        "Lesson complete. Your recall cards are ready.",
      );
      lessonRevealed = false;
      lessonCardIndex = 0;
      render();
      document
        .querySelector("#lesson-practice")
        ?.focus({ preventScroll: true });
      document
        .querySelector("#lesson-practice")
        ?.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          block: "start",
        });
      return;
    }
    if (action === "reveal-lesson") {
      lessonRevealed = true;
      render();
      document.querySelector(".answer")?.focus({ preventScroll: true });
      document
        .querySelector("#lesson-practice")
        ?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (action === "next-lesson-card") {
      const { lesson } = findLesson();
      lessonCardIndex = (lessonCardIndex + 1) % lesson.cards.length;
      lessonRevealed = false;
      render();
      document
        .querySelector("#lesson-practice .question")
        ?.focus({ preventScroll: true });
      document
        .querySelector("#lesson-practice")
        ?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (action === "reveal-review") {
      reviewRevealed = true;
      render();
      document.querySelector(".answer")?.focus({ preventScroll: true });
      document.querySelector(".answer")?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (action === "rate") {
      commit(recordReview(state, button.dataset.card, button.dataset.rating));
      sound();
      const due = state.reviews[button.dataset.card].dueAt;
      notify(
        `Review saved. Next: ${new Date(due).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`,
      );
      if (button.dataset.context === "review") {
        reviewSession = reviewSession.filter(
          (id) => id !== button.dataset.card,
        );
        reviewRevealed = false;
        render(true);
      } else {
        const { lesson } = findLesson();
        lessonCardIndex = (lessonCardIndex + 1) % lesson.cards.length;
        lessonRevealed = false;
        render();
        document
          .querySelector("#lesson-practice .question")
          ?.focus({ preventScroll: true });
        document
          .querySelector("#lesson-practice")
          ?.scrollIntoView({ block: "nearest" });
      }
      return;
    }
    if (action === "edit-card") {
      editCardDialog(button.dataset.card);
      return;
    }
    if (action === "cancel-import") {
      const form = document.querySelector("#import-form");
      if (form) collectImportForm(form);
      if (importForm.title || importForm.text)
        confirmDialog({
          title: "Discard this draft?",
          body: "Your unsaved source and draft will be removed. Courses already in your library are kept.",
          label: "Discard draft",
          danger: true,
          onConfirm: () => {
            draft = null;
            importForm = {
              title: "",
              text: "",
              sourceTitle: "",
              sourceUrl: "",
            };
            formError = "";
            go("#/library");
          },
        });
      else go("#/library");
      return;
    }
    if (action === "back-import") {
      draft = null;
      formError = "";
      render(true);
      return;
    }
    if (action === "export-backup") {
      download(
        serializeState(state),
        `trace-backup-${new Date().toISOString().slice(0, 10)}.json`,
      );
      notify("Backup downloaded. Keep it somewhere safe.");
      return;
    }
    if (action === "reset-workspace") {
      confirmDialog({
        title: "Start with a fresh page?",
        body: "This removes all imported courses, card edits, and review progress, and restores the starter course. Download a backup first if you want to keep your work.",
        label: "Reset workspace",
        danger: true,
        onConfirm: () => {
          blockedWrite = false;
          originalStorage = "";
          commit(
            createState(STARTER_COURSES),
            "Workspace reset to the starter course.",
          );
          draft = null;
          importForm = { title: "", text: "", sourceTitle: "", sourceUrl: "" };
          render(true);
        },
      });
      return;
    }
    if (action === "download-notes") {
      const course = state.courses.find((c) => c.id === button.dataset.course);
      if (course) {
        download(
          courseNotes(course),
          `${course.title
            .replace(/[^a-z0-9]/gi, "-")
            .replace(/-+/g, "-")
            .slice(0, 70)}.md`,
          "text/markdown",
        );
        notify("Course notes downloaded.");
      }
      return;
    }
  } catch (error) {
    notify(errorMessage(error));
  }
});
document.addEventListener("input", (event) => {
  const el = event.target;
  if (el.id === "library-search") {
    query = el.value;
    const filtered = state.courses.filter((c) =>
      `${c.title} ${c.description} ${c.source.title}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
    document.querySelector("#course-grid").innerHTML =
      filtered.map(courseCard).join("") +
      (!filtered.length
        ? '<div class="empty-state"><h2>No courses found</h2><p>Try another title or source.</p><button class="button secondary" data-action="clear-search">Clear search</button></div>'
        : "");
  }
  if (el.dataset.lab) {
    labValues[el.dataset.lab] = Number(el.value);
    document.querySelector(`#out-${el.dataset.lab}`).textContent =
      `${el.value}%`;
    document.querySelector(".lab-output").innerHTML = labOutput();
  }
  if (el.closest("#import-form") && el.name) importForm[el.name] = el.value;
  if (el.dataset.draftCard && draft) {
    for (const lesson of draft.lessons) {
      const card = lesson.cards.find((c) => c.id === el.dataset.draftCard);
      if (card) {
        card[el.dataset.field] = el.value;
        break;
      }
    }
  }
});
document.addEventListener("change", async (event) => {
  const el = event.target;
  if (el.id === "sound-setting") {
    commit(
      {
        ...state,
        settings: { ...state.settings, sound: el.checked },
        updatedAt: new Date().toISOString(),
      },
      el.checked ? "Review sound on." : "Review sound off.",
    );
    if (el.checked) sound();
    return;
  }
  if (el.id === "source-file") {
    const file = el.files?.[0];
    if (!file) return;
    try {
      if (!/\.(txt|md)$/i.test(file.name))
        throw new Error("Choose a .txt or .md file.");
      if (file.size > 102400)
        throw new Error(
          "That file is larger than 100 KB. Choose a smaller text file.",
        );
      const text = await file.text();
      if (text.length > 100000)
        throw new Error(
          "This source exceeds 100,000 characters. Choose a shorter excerpt.",
        );
      importForm.text = text;
      if (!importForm.title)
        importForm.title = file.name.replace(/\.(txt|md)$/i, "").slice(0, 120);
      if (!importForm.sourceTitle) importForm.sourceTitle = file.name;
      formError = "";
      render();
      notify(`Loaded ${file.name}. Review the text before continuing.`);
    } catch (error) {
      formError = errorMessage(error);
      render();
    }
  }
  if (el.id === "backup-file") {
    const file = el.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error("This backup is larger than the 2 MB limit.");
      const restored = importState(await file.text());
      confirmDialog({
        title: "Restore this workspace?",
        body: `This backup contains ${restored.courses.length} course${restored.courses.length === 1 ? "" : "s"}, ${listCards(restored).length} cards, and ${Object.keys(restored.progress).length} completed lessons. It will replace all current courses and progress.`,
        label: "Replace & restore",
        onConfirm: () => {
          blockedWrite = false;
          originalStorage = "";
          commit(restored, "Backup restored. Welcome back.");
          reviewSession = null;
          draft = null;
          importForm = { title: "", text: "", sourceTitle: "", sourceUrl: "" };
          render(true);
        },
      });
    } catch (error) {
      openDialog(
        `<h2 id="dialog-title">This backup wasn’t restored.</h2><p>${h(errorMessage(error))}</p><p>Your current courses and progress are unchanged.</p><div class="actions"><button class="button primary" data-action="close-dialog" autofocus>Got it</button></div>`,
      );
    } finally {
      el.value = "";
    }
  }
});
document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!["import-form", "preview-form", "edit-card-form"].includes(form.id))
    return;
  event.preventDefault();
  try {
    if (form.id === "import-form") {
      collectImportForm(form);
      if (importForm.sourceUrl && !safeSourceUrl(importForm.sourceUrl))
        throw new Error("Use an http or https source link.");
      draft = parseTextCourse(importForm);
      formError = "";
      render(true);
    }
    if (form.id === "preview-form") {
      for (const lesson of draft.lessons)
        for (const card of lesson.cards) {
          card.prompt = card.prompt.trim();
          card.answer = card.answer.trim();
          if (!card.prompt || !card.answer)
            throw new Error(
              "Each recall card needs a nonempty prompt and answer.",
            );
        }
      const next = {
        ...state,
        courses: [...state.courses, draft],
        updatedAt: new Date().toISOString(),
      };
      const valid = validateState(next);
      if (!valid.ok) throw new Error(valid.errors.join(" "));
      commit(next, "Course saved to your library.");
      draft = null;
      importForm = { title: "", text: "", sourceTitle: "", sourceUrl: "" };
      formError = "";
      go("#/library");
    }
    if (form.id === "edit-card-form") {
      const fd = new FormData(form);
      commit(
        updateCard(state, {
          courseId: form.dataset.course,
          lessonId: form.dataset.lesson,
          cardId: form.dataset.card,
          prompt: String(fd.get("prompt")),
          answer: String(fd.get("answer")),
        }),
        "Card updated.",
      );
      closeDialog();
      render();
      document.querySelector(".question")?.focus({ preventScroll: true });
    }
  } catch (error) {
    if (form.id === "edit-card-form")
      document.querySelector("#edit-error").textContent = errorMessage(error);
    else {
      formError = errorMessage(error);
      render();
      document
        .querySelector('[role="alert"]')
        ?.scrollIntoView({ block: "center" });
    }
  }
});
dialog.addEventListener("cancel", () => {
  modalAction = null;
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const box = dialog.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      closeDialog();
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY || event.key === null) {
    blockedWrite = true;
    storageProblem =
      "This workspace changed in another tab. Changes here will stay in memory. Download a backup if needed, then reload to use the latest saved data.";
    notify(storageProblem);
    render();
  }
});
render();
