import test from "node:test";
import assert from "node:assert/strict";
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
  STORAGE_KEY,
} from "../dist/core.mjs";

const NOW = new Date("2026-11-10T10:00:00.000Z");
const SOURCE =
  "# Evidence\n\nBase rates describe how common something is before new evidence arrives. A positive signal depends on false positives as well as sensitivity.\n\n# Frequency\n\nExpected counts can be fractional when a model describes a population. They help us compare true positives with false positives.";
const course = () =>
  parseTextCourse(
    {
      title: "Evidence lab",
      text: SOURCE,
      sourceTitle: "Local notes",
      sourceUrl: "https://example.com/evidence",
    },
    NOW,
  );
const state = () => createState([course()], NOW);
const first = (value) => ({
  lessonId: value.courses[0].lessons[0].id,
  cardId: value.courses[0].lessons[0].cards[0].id,
  courseId: value.courses[0].id,
});
const completed = () => {
  const s = state();
  return completeLesson(s, first(s).lessonId, NOW);
};

test("state creation copies starters, defaults sound off, and has stable key", () => {
  const starter = course();
  const s = createState([starter], NOW);
  starter.title = "Changed externally";
  assert.equal(s.courses[0].title, "Evidence lab");
  assert.deepEqual(s.settings, { sound: false });
  assert.equal(STORAGE_KEY, "trace-learning-v1");
  assert.equal(validateState(s).ok, true);
});

test("extractive draft is deterministic, exact, headed, and retains complete source", () => {
  const a = course();
  const b = course();
  assert.deepEqual(a, b);
  assert.equal(a.source.text, SOURCE);
  assert.equal(a.lessons[0].title, "Evidence");
  assert.equal(a.lessons[1].title, "Frequency");
  for (const lesson of a.lessons) {
    assert.ok(a.source.text.includes(lesson.quote));
    for (const card of lesson.cards) {
      assert.match(card.prompt, /^Draft cloze/);
      assert.ok(a.source.text.includes(card.quote));
      assert.ok(card.quote.includes(card.answer));
      assert.ok(card.prompt.includes("[…]"));
    }
  }
});

test("long source is bounded in lessons but fully retained without truncation", () => {
  const text = Array.from(
    { length: 50 },
    (_, i) =>
      `# Section ${i + 1}\n\n${"A meaningful paragraph has measurable evidence and careful reasoning. ".repeat(25)}`,
  ).join("\n\n");
  const s = parseTextCourse({ title: "Long source", text }, NOW);
  assert.equal(s.source.text, text);
  assert.equal(s.lessons.length, 24);
  assert.ok(s.lessons.every((lesson) => lesson.quote.length <= 1200));
  assert.ok(s.lessons.flatMap((lesson) => lesson.cards).length <= 48);
  assert.equal(validateState(createState([s], NOW)).ok, true);
});

test("source preserves whitespace and unicode; generated quotations remain exact", () => {
  const text =
    "  # Études\r\n\r\n  Les probabilités décrivent une incertitude mesurable.\r\n\r\n  A second useful paragraph contains precise evidence.  ";
  const c = parseTextCourse({ title: "Études", text }, NOW);
  assert.equal(c.source.text, text);
  for (const lesson of c.lessons)
    for (const card of lesson.cards) assert.ok(text.includes(card.quote));
});

test("authoring rejects malformed inputs and dangerous URLs", () => {
  for (const input of [
    { title: "", text: SOURCE },
    { title: "x", text: "short" },
    { title: "x", text: " ".repeat(50) },
    { title: "x", text: "a".repeat(100001) },
    { title: "x".repeat(121), text: SOURCE },
    { title: "x", text: SOURCE, sourceUrl: "javascript:alert(1)" },
  ])
    assert.throws(() => parseTextCourse(input, NOW));
  assert.throws(() =>
    parseTextCourse({ title: "Valid", text: SOURCE }, new Date("invalid")),
  );
});

test("backup roundtrip preserves all source, editing, review, and progress content", () => {
  let s = completed();
  const ids = first(s);
  s = updateCard(s, {
    ...ids,
    prompt: "  My recall prompt  ",
    answer: " My answer ",
  });
  s = recordReview(s, ids.cardId, "good", NOW);
  const restored = importState(serializeState(s));
  assert.deepEqual(restored, s);
  restored.courses[0].title = "Independent copy";
  assert.notEqual(restored.courses[0].title, s.courses[0].title);
});

test("invalid backups fail without changing an existing state", () => {
  const s = state();
  const before = JSON.stringify(s);
  for (const value of [
    "{",
    "null",
    "[]",
    "{}",
    '{"schemaVersion":2}',
    " ".repeat(2 * 1024 * 1024 + 1),
  ])
    assert.throws(() => importState(value));
  assert.equal(JSON.stringify(s), before);
});

test("prototype pollution payloads, unsafe IDs, and inherited shapes are rejected", () => {
  const s = state();
  const payload = JSON.stringify(s).replace(
    '"progress":{}',
    '"progress":{"__proto__":{"polluted":true}}',
  );
  assert.throws(() => importState(payload), /unsafe key/);
  s.courses[0].id = "__proto__";
  assert.equal(validateState(s).ok, false);
  const inherited = Object.create({ schemaVersion: 1 });
  assert.equal(validateState(inherited).ok, false);
  assert.equal({}.polluted, undefined);
});

test("duplicates anywhere, unknown progress, fabricated evidence, bad dates and shapes fail", () => {
  const mutations = [
    (s) => s.courses.push(structuredClone(s.courses[0])),
    (s) => {
      s.courses[0].lessons[1].id = s.courses[0].lessons[0].id;
    },
    (s) => {
      s.courses[0].lessons[1].cards[0].id = s.courses[0].id;
    },
    (s) => {
      s.progress.unknown = { completedAt: NOW.toISOString() };
    },
    (s) => {
      s.courses[0].lessons[0].quote = "Fabricated unsupported evidence";
    },
    (s) => {
      s.courses[0].lessons[0].cards[0].quote = "";
    },
    (s) => {
      s.courses[0].source.url = "data:text/html,unsafe";
    },
    (s) => {
      s.updatedAt = "2026-02-30T00:00:00Z";
    },
    (s) => {
      s.settings.sound = "true";
    },
    (s) => {
      s.courses[0].lessons[0].paragraphs = [];
    },
    (s) => {
      s.courses[0].unexpected = true;
    },
  ];
  for (const mutate of mutations) {
    const s = state();
    mutate(s);
    const result = validateState(s);
    assert.equal(result.ok, false, "mutation should fail validation");
    assert.ok(result.errors.length);
    assert.throws(() => serializeState(s));
  }
});

test("deep, cyclic, accessor, nonfinite, and oversized states fail safely", () => {
  const s = state();
  let nested = {};
  let cursor = nested;
  for (let i = 0; i < 20; i++) {
    cursor.child = {};
    cursor = cursor.child;
  }
  s.extra = nested;
  assert.equal(validateState(s).ok, false);
  s.extra = s;
  assert.equal(validateState(s).ok, false);
  const access = state();
  Object.defineProperty(access, "extra", {
    get() {
      throw new Error("must not run");
    },
    enumerable: true,
  });
  assert.equal(validateState(access).ok, false);
  const invalidNumber = completed();
  const ids = first(invalidNumber);
  invalidNumber.reviews[ids.cardId] = {
    intervalDays: Infinity,
    repetitions: 0,
    dueAt: NOW.toISOString(),
    lastRating: "good",
  };
  assert.equal(validateState(invalidNumber).ok, false);
});

test("no cards are due until explicit lesson completion, and completion is idempotent", () => {
  const s = state();
  const ids = first(s);
  assert.equal(dueCards(s, NOW).length, 0);
  const done = completeLesson(s, ids.lessonId, NOW);
  assert.equal(dueCards(done, NOW).length, 1);
  assert.deepEqual(
    completeLesson(done, ids.lessonId, new Date(NOW.getTime() + 1000)),
    done,
  );
  assert.deepEqual(s.progress, {});
  assert.throws(() => completeLesson(s, "unknown", NOW));
  assert.equal(listCards(s)[0].courseTitle, "Evidence lab");
});

test("review schedule transitions again, good, easy and caps at 180 days", () => {
  let s = completed();
  const { cardId } = first(s);
  s = recordReview(s, cardId, "again", NOW);
  assert.equal(s.reviews[cardId].dueAt, "2026-11-10T10:10:00.000Z");
  assert.equal(s.reviews[cardId].repetitions, 0);
  assert.equal(dueCards(s, new Date("2026-11-10T10:09:59Z")).length, 0);
  assert.equal(dueCards(s, new Date("2026-11-10T10:10:00Z")).length, 1);
  s = recordReview(s, cardId, "good", NOW);
  assert.equal(s.reviews[cardId].intervalDays, 1);
  assert.equal(s.reviews[cardId].dueAt, "2026-11-11T10:00:00.000Z");
  s = recordReview(s, cardId, "easy", NOW);
  assert.equal(s.reviews[cardId].intervalDays, 3);
  s = recordReview(s, cardId, "good", NOW);
  assert.equal(s.reviews[cardId].intervalDays, 9);
  for (let i = 0; i < 10; i++) s = recordReview(s, cardId, "easy", NOW);
  assert.equal(s.reviews[cardId].intervalDays, 180);
  assert.equal(
    recordReview(completed(), cardId, "easy", NOW).reviews[cardId].intervalDays,
    3,
  );
  assert.equal(validateState(s).ok, true);
});

test("review invalid IDs, ratings, incomplete lessons and invalid dates throw", () => {
  const s = state();
  const { cardId } = first(s);
  assert.throws(
    () => recordReview(s, cardId, "good", NOW),
    /Complete the lesson/,
  );
  assert.throws(
    () => recordReview(completed(), "unknown", "good", NOW),
    /not found/,
  );
  assert.throws(() => recordReview(completed(), cardId, "hard", NOW), /Rating/);
  assert.throws(() => dueCards(s, new Date("invalid")));
});

test("editing trims input, preserves quote and review history, and does not mutate", () => {
  let s = completed();
  const ids = first(s);
  s = recordReview(s, ids.cardId, "good", NOW);
  const before = structuredClone(s);
  const result = updateCard(s, {
    ...ids,
    prompt: " New prompt ",
    answer: " New answer ",
  });
  const card = listCards(result)[0];
  assert.equal(card.prompt, "New prompt");
  assert.equal(card.answer, "New answer");
  assert.equal(card.quote, listCards(s)[0].quote);
  assert.deepEqual(result.reviews, s.reviews);
  assert.deepEqual(s, before);
  for (const bad of ["", " ".repeat(4), "x".repeat(1001), undefined])
    assert.throws(() =>
      updateCard(s, { ...ids, prompt: bad, answer: "valid" }),
    );
  assert.throws(() =>
    updateCard(s, {
      ...ids,
      lessonId: "unknown",
      prompt: "valid",
      answer: "valid",
    }),
  );
});

test("course deletion removes only related progress and review records", () => {
  let s = completed();
  const ids = first(s);
  s = recordReview(s, ids.cardId, "good", NOW);
  const other = parseTextCourse({ title: "Other course", text: SOURCE }, NOW);
  s.courses.push(other);
  s = completeLesson(s, other.lessons[0].id, NOW);
  const result = deleteCourse(s, ids.courseId);
  assert.equal(result.courses.length, 1);
  assert.equal(result.courses[0].id, other.id);
  assert.equal(result.progress[ids.lessonId], undefined);
  assert.equal(result.reviews[ids.cardId], undefined);
  assert.ok(result.progress[other.lessons[0].id]);
  assert.equal(s.courses.length, 2);
  assert.equal(validateState(result).ok, true);
  assert.throws(() => deleteCourse(s, "unknown"));
});

test("Bayes expected counts use percentages and maintain fractional precision", () => {
  const b = calculateBayes({
    baseRate: 1,
    sensitivity: 90,
    falsePositiveRate: 5,
  });
  assert.equal(b.truePositive, 9);
  assert.equal(b.falsePositive, 49.5);
  assert.equal(b.falseNegative, 1);
  assert.equal(b.trueNegative, 940.5);
  assert.equal(b.positiveTotal, 58.5);
  assert.equal(b.positivePredictiveValue, 9 / 58.5);
  assert.equal(
    b.truePositive + b.falsePositive + b.trueNegative + b.falseNegative,
    1000,
  );
});

test("Bayes zero rates produce null posterior only when there are no positives", () => {
  assert.deepEqual(
    calculateBayes({ baseRate: 0, sensitivity: 0, falsePositiveRate: 0 }),
    {
      truePositive: 0,
      falsePositive: 0,
      trueNegative: 1000,
      falseNegative: 0,
      positivePredictiveValue: null,
      positiveTotal: 0,
    },
  );
  assert.equal(
    calculateBayes({ baseRate: 0, sensitivity: 100, falsePositiveRate: 1 })
      .positivePredictiveValue,
    0,
  );
  assert.equal(
    calculateBayes({ baseRate: 100, sensitivity: 100, falsePositiveRate: 100 })
      .positivePredictiveValue,
    1,
  );
  for (const rate of [-1, 101, NaN, Infinity, "50", null])
    assert.throws(() =>
      calculateBayes({
        baseRate: rate,
        sensitivity: 50,
        falsePositiveRate: 50,
      }),
    );
  for (const population of [0, -1, Infinity, "1000"])
    assert.throws(() =>
      calculateBayes({
        baseRate: 1,
        sensitivity: 50,
        falsePositiveRate: 50,
        population,
      }),
    );
});

test("safeSourceUrl rejects executable, relative, credentialed and malformed addresses", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///tmp/test",
    "//example.com",
    "/relative",
    "not a url",
    "https://user:pass@example.com",
    "https://exa\nmple.com",
    {},
    null,
  ])
    assert.equal(safeSourceUrl(url), "");
  assert.equal(
    safeSourceUrl("https://example.com/a?b=1#c"),
    "https://example.com/a?b=1#c",
  );
  assert.equal(safeSourceUrl("http://example.com"), "http://example.com/");
});

test("heading bodies retain CRLF so full multiline evidence is exact", () => {
  const text =
    "# Heading\r\nFirst sentence contains meaningful evidence.\r\nSecond line adds another precise observation.";
  const c = parseTextCourse({ title: "CRLF", text }, NOW);
  assert.equal(c.source.text, text);
  assert.equal(c.lessons[0].quote, text.slice("# Heading\r\n".length));
  assert.equal(validateState(createState([c], NOW)).ok, true);
});

test("sparse arrays, hidden state fields, and symbol keys fail before serialization", () => {
  const sparse = state();
  sparse.courses = Array(2);
  assert.equal(validateState(sparse).ok, false);
  const hidden = state();
  Object.defineProperty(hidden, "settings", {
    value: { sound: false },
    enumerable: false,
  });
  assert.equal(validateState(hidden).ok, false);
  const symbols = state();
  symbols[Symbol("unexpected")] = true;
  assert.equal(validateState(symbols).ok, false);
  const arrayExtra = state();
  arrayExtra.courses.extra = "hidden by JSON";
  assert.equal(validateState(arrayExtra).ok, false);
  const badTime = state();
  badTime.updatedAt = "2026-11-10T24:00:00Z";
  assert.equal(validateState(badTime).ok, false);
});

test("every near-limit export fits the same byte boundary used by import", () => {
  const courses = Array.from({ length: 19 }, (_, i) =>
    parseTextCourse({ title: `Large ${i}`, text: "A".repeat(99999) }, NOW),
  );
  const s = createState(courses, NOW);
  const json = serializeState(s);
  assert.ok(new TextEncoder().encode(json).length < 2 * 1024 * 1024);
  assert.deepEqual(importState(json), s);
});
