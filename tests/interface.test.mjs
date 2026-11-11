import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require("jsdom");
let html;
try {
  html = await readFile(
    new URL("../artifacts/Trace-Learning-Demo.html", import.meta.url),
    "utf8",
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  html = await readFile(
    new URL("../Trace-Learning-Demo.html", import.meta.url),
    "utf8",
  );
}
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const key = "trace-learning-v1";
function setup(saved) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (e) => errors.push(e.message));
  const dom = new JSDOM(html, {
    url: "http://localhost:8080/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole,
  });
  const w = dom.window;
  w.scrollTo = () => {};
  w.matchMedia = () => ({ matches: true });
  w.Element.prototype.scrollIntoView = () => {};
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  if (saved) w.localStorage.setItem(key, saved);
  w.eval(script);
  const $ = (selector) => w.document.querySelector(selector);
  const click = (selector) => {
    assert.ok($(selector), selector);
    $(selector).click();
  };
  const route = async (hash) => {
    w.location.hash = hash;
    await new Promise((r) => setTimeout(r, 10));
  };
  const fill = (selector, value) => {
    $(selector).value = value;
    $(selector).dispatchEvent(new w.Event("input", { bubbles: true }));
  };
  const submit = (selector) =>
    $(selector).dispatchEvent(
      new w.Event("submit", { bubbles: true, cancelable: true }),
    );
  return {
    dom,
    w,
    $,
    click,
    route,
    fill,
    submit,
    errors,
    saved: () => w.localStorage.getItem(key),
  };
}
test("redesigned lesson, recall, edit, repeat completion, review and reload preserve data", async () => {
  const a = setup();
  try {
    assert.equal(a.w.document.querySelectorAll(".course-card").length, 1);
    assert.match(a.$("h1").textContent, /Make what you read/);
    await a.route("#/lesson/trace-starter-bayes/trace-bayes-base-rates");
    const lessonHash = a.w.location.hash;
    a.click(".skip-link");
    assert.equal(a.w.location.hash, lessonHash);
    assert.equal(a.w.document.activeElement.id, "main");
    a.click('[data-action="complete-lesson"]');
    assert.ok(a.$("#lesson-practice"));
    a.click('[data-action="reveal-lesson"]');
    assert.ok(a.$(".answer"));
    a.click('[data-action="edit-card"]');
    assert.ok(a.$("dialog").open);
    a.fill("#edit-prompt", "What does the starting rate tell us?");
    a.fill(
      "#edit-answer",
      "It describes the share of the crowd in the target group.",
    );
    a.submit("#edit-card-form");
    assert.equal(a.$("dialog").open, false);
    assert.match(a.$(".question").textContent, /starting rate/);
    const savedBefore = a.saved();
    await a.route("#/library");
    await a.route("#/lesson/trace-starter-bayes/trace-bayes-base-rates");
    assert.equal(a.saved(), savedBefore);
    assert.equal(a.$('[data-action="complete-lesson"]'), null);
    await a.route("#/review");
    a.click('[data-action="reveal-review"]');
    a.click('[data-action="rate"][data-rating="good"]');
    const stored = JSON.parse(a.saved());
    assert.equal(Object.keys(stored.progress).length, 1);
    assert.ok(Object.values(stored.reviews).some((r) => r.repetitions === 1));
    const b = setup(a.saved());
    try {
      await b.route("#/lesson/trace-starter-bayes/trace-bayes-base-rates");
      assert.match(b.$(".question").textContent, /starting rate/);
      assert.equal(b.saved(), a.saved());
      assert.deepEqual(b.errors, []);
    } finally {
      b.dom.window.close();
    }
    assert.deepEqual(a.errors, []);
  } finally {
    a.dom.window.close();
  }
});
test("paste, preview editing, back, repeated navigation, save and cancel are coherent", async () => {
  const a = setup();
  try {
    await a.route("#/import");
    a.fill("#course-title", "How practice works");
    a.fill(
      "#source-text",
      "# Retrieval\n\nRetrieval practice means bringing an idea to mind without looking at the answer. A useful question connects a clear prompt to evidence.\n\n# Spacing\n\nSpacing practice over time creates repeated opportunities to recall. The source remains available to check what the lesson actually says.",
    );
    a.submit("#import-form");
    assert.ok(a.$("#preview-form"));
    const draftPrompt = a.$('[data-field="prompt"]');
    const draftName = draftPrompt.id;
    a.fill("#" + draftName, "Explain retrieval practice in your own words.");
    a.click('[data-action="back-import"]');
    assert.equal(a.$("#course-title").value, "How practice works");
    a.submit("#import-form");
    await a.route("#/library");
    await a.route("#/import");
    assert.ok(a.$("#preview-form"));
    a.submit("#preview-form");
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(JSON.parse(a.saved()).courses.length, 2);
    assert.match(a.$("#course-grid").textContent, /How practice works/);
    await a.route("#/import");
    a.fill("#course-title", "Unsaved draft");
    a.fill(
      "#source-text",
      "A sufficiently long source for an unsaved draft that should be discarded only after explicit confirmation.",
    );
    a.click('[data-action="cancel-import"]');
    assert.ok(a.$("dialog").open);
    a.click('[data-action="close-dialog"]');
    assert.equal(a.$("#course-title").value, "Unsaved draft");
    a.click('[data-action="cancel-import"]');
    a.click('[data-action="confirm-dialog"]');
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(JSON.parse(a.saved()).courses.length, 2);
    assert.deepEqual(a.errors, []);
  } finally {
    a.dom.window.close();
  }
});
test("search, destructive-action cancellation, lab extremes and invalid lesson navigation recover", async () => {
  const a = setup();
  try {
    const initial = a.saved();
    a.fill("#library-search", "no matching material");
    assert.match(a.$("#course-grid").textContent, /No courses found/);
    a.click('[data-action="clear-search"]');
    assert.ok(a.$(".course-card"));
    a.click('[data-action="delete-course"]');
    assert.ok(a.$("dialog").open);
    a.click('[data-action="close-dialog"]');
    assert.equal(a.saved(), initial);
    await a.route("#/lesson/trace-starter-bayes/trace-bayes-frequency");
    assert.ok(a.$(".lab"));
    a.fill("#lab-baseRate", "0");
    a.fill("#lab-falsePositiveRate", "0");
    assert.equal(a.$(".posterior").textContent, "—");
    assert.match(a.$(".lab-disclaimer").textContent, /undefined/);
    a.fill("#lab-baseRate", "2");
    a.fill("#lab-sensitivity", "80");
    a.fill("#lab-falsePositiveRate", "4");
    assert.match(a.$(".posterior").textContent, /29/);
    a.click('[data-action="predict"][data-answer="29"]');
    assert.match(a.$(".prediction-feedback").textContent, /That’s right/);
    await a.route("#/lesson/does-not-exist/missing");
    assert.match(a.$("h1").textContent, /Lesson not found/);
    await a.route("#/settings");
    assert.ok(a.$('[data-action="export-backup"]'));
    assert.equal(a.saved(), initial);
    assert.deepEqual(a.errors, []);
  } finally {
    a.dom.window.close();
  }
});


test("storage recovery status does not claim unsaved session changes are saved", async () => {
  const original = "invalid saved workspace";
  const a = setup(original);
  try {
    assert.match(a.$(".notice.error").textContent, /could not be read/);
    assert.equal(a.$(".window-status").textContent.trim(), "Session only");
    assert.equal(a.saved(), original);
    assert.deepEqual(a.errors, []);
  } finally {
    a.dom.window.close();
  }
});
