/** Trace's browser-local, deterministic data engine. No network or DOM access. */
export const STORAGE_KEY = "trace-learning-v1";
const MAX_BYTES = 2 * 1024 * 1024;
const DAY = 86400000;
const MINUTE = 60000;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const plain = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);
const clone = (value) => JSON.parse(JSON.stringify(value));
const bytes = (value) => new TextEncoder().encode(value).length;
const dangerous = new Set(["__proto__", "prototype", "constructor"]);
const limits = { courses: 100, lessons: 24, cards: 48 };

function instant(now) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
    throw new Error("Provide a valid Date.");
  return now.toISOString();
}
function isDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(
      value,
    ) &&
    Number.isFinite(Date.parse(value)) &&
    (() => {
      const [year, month, day] = value.slice(0, 10).split("-").map(Number);
      const hour = Number(value.slice(11, 13)),
        minute = Number(value.slice(14, 16)),
        second = Number(value.slice(17, 19));
      return (
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= new Date(Date.UTC(year, month, 0)).getUTCDate() &&
        hour < 24 &&
        minute < 60 &&
        second < 60
      );
    })()
  );
}
export function safeSourceUrl(url) {
  if (
    typeof url !== "string" ||
    !url.trim() ||
    url.length > 2048 ||
    /[\u0000-\u0020\u007f]/.test(url.trim())
  )
    return "";
  try {
    const parsed = new URL(url.trim());
    return ["http:", "https:"].includes(parsed.protocol) &&
      parsed.hostname &&
      !parsed.username &&
      !parsed.password
      ? parsed.href
      : "";
  } catch {
    return "";
  }
}

/** Validate before cloning, rendering, or persisting untrusted content. */
export function validateState(value) {
  const errors = [];
  const fail = (message) => {
    if (errors.length < 50) errors.push(message);
  };
  const seenObjects = new WeakSet();
  let nodes = 0;
  function preflight(item, depth = 0, path = "state") {
    if (++nodes > 50000) {
      fail("State has too many values.");
      return;
    }
    if (depth > 12) {
      fail("State is nested too deeply.");
      return;
    }
    if (
      item === null ||
      ["string", "boolean", "number"].includes(typeof item)
    ) {
      if (typeof item === "number" && !Number.isFinite(item))
        fail(`${path} contains a nonfinite number.`);
      if (typeof item === "string" && item.length > 100000)
        fail(`${path} is too long.`);
      return;
    }
    if (typeof item !== "object") {
      fail(`${path} contains an unsupported value.`);
      return;
    }
    if (!Array.isArray(item) && !plain(item)) {
      fail(`${path} must use plain objects.`);
      return;
    }
    if (seenObjects.has(item)) {
      fail("State must not contain cycles or shared objects.");
      return;
    }
    seenObjects.add(item);
    if (Object.getOwnPropertySymbols(item).length) {
      fail(`${path} must not contain symbol keys.`);
      return;
    }
    const descriptors = Object.getOwnPropertyDescriptors(item);
    if (
      Array.isArray(item) &&
      (item.length > 50000 ||
        Object.keys(descriptors).length - 1 !== item.length ||
        Object.keys(descriptors).some(
          (key) => key !== "length" && !/^(0|[1-9][0-9]*)$/.test(key),
        ))
    ) {
      fail(`${path} must be a dense array without extra properties.`);
      return;
    }
    for (const key of Object.keys(descriptors)) {
      if (key === "length" && Array.isArray(item)) continue;
      if (dangerous.has(key)) {
        fail(`${path} contains an unsafe key.`);
        continue;
      }
      const descriptor = descriptors[key];
      if (!descriptor.enumerable) {
        fail(`${path} must not contain hidden properties.`);
        continue;
      }
      if (!own(descriptor, "value")) {
        fail(`${path} must not contain accessors.`);
        continue;
      }
      preflight(descriptor.value, depth + 1, `${path}.${key}`);
      if (nodes > 50000 || errors.length >= 50) return;
    }
  }
  try {
    preflight(value);
  } catch {
    fail("State could not be inspected safely.");
  }
  if (errors.length) return { ok: false, errors };
  try {
    if (bytes(JSON.stringify(value)) > MAX_BYTES)
      fail("State exceeds the 2 MB backup limit.");
  } catch {
    fail("State cannot be serialized.");
  }
  if (errors.length) return { ok: false, errors };
  function object(item, fields, path, optional = []) {
    if (!plain(item)) {
      fail(`${path} must be an object.`);
      return false;
    }
    for (const field of fields)
      if (!own(item, field) && !optional.includes(field))
        fail(`${path}.${field} is required.`);
    for (const field of Object.keys(item))
      if (!fields.includes(field)) fail(`${path}.${field} is not supported.`);
    return true;
  }
  function string(item, path, max, allowEmpty = false) {
    if (
      typeof item !== "string" ||
      (!allowEmpty && !item.trim()) ||
      item.length > max
    )
      fail(
        `${path} must be ${allowEmpty ? "a string" : "nonempty text"} of at most ${max} characters.`,
      );
  }
  function date(item, path) {
    if (!isDate(item)) fail(`${path} must be a valid ISO date.`);
  }
  const ids = new Set(),
    lessonIds = new Set(),
    cardIds = new Set();
  function id(item, path, group) {
    if (
      typeof item !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(item) ||
      dangerous.has(item)
    )
      fail(`${path} is not a safe ID.`);
    else if (ids.has(item)) fail(`${path} duplicates ID ${item}.`);
    else {
      ids.add(item);
      if (group) group.add(item);
    }
  }
  if (
    !object(
      value,
      [
        "schemaVersion",
        "courses",
        "progress",
        "reviews",
        "settings",
        "updatedAt",
      ],
      "state",
    )
  )
    return { ok: false, errors };
  if (value.schemaVersion !== 1) fail("Unsupported schemaVersion; expected 1.");
  date(value.updatedAt, "state.updatedAt");
  if (!Array.isArray(value.courses) || value.courses.length > limits.courses)
    fail("courses must be an array of at most 100 courses.");
  else
    value.courses.forEach((course, ci) => {
      const path = `courses[${ci}]`;
      if (
        !object(
          course,
          [
            "id",
            "title",
            "description",
            "createdAt",
            "origin",
            "source",
            "lessons",
          ],
          path,
        )
      )
        return;
      id(course.id, `${path}.id`);
      string(course.title, `${path}.title`, 120);
      string(course.description, `${path}.description`, 2000, true);
      date(course.createdAt, `${path}.createdAt`);
      if (!["starter", "imported"].includes(course.origin))
        fail(`${path}.origin is invalid.`);
      let sourceText = "";
      if (object(course.source, ["title", "url", "text"], `${path}.source`)) {
        string(course.source.title, `${path}.source.title`, 200);
        string(course.source.text, `${path}.source.text`, 100000);
        sourceText =
          typeof course.source.text === "string" ? course.source.text : "";
        if (
          typeof course.source.url !== "string" ||
          (course.source.url !== "" && !safeSourceUrl(course.source.url))
        )
          fail(`${path}.source.url must be empty or a valid HTTP(S) URL.`);
      }
      function quote(text, quotePath) {
        string(text, quotePath, 100000);
        if (
          typeof text === "string" &&
          (!text.trim() || !sourceText.includes(text))
        )
          fail(`${quotePath} must be an exact nonempty source excerpt.`);
      }
      if (
        !Array.isArray(course.lessons) ||
        course.lessons.length < 1 ||
        course.lessons.length > limits.lessons
      ) {
        fail(`${path}.lessons must have 1–24 lessons.`);
        return;
      }
      let cardCount = 0;
      course.lessons.forEach((lesson, li) => {
        const lp = `${path}.lessons[${li}]`;
        if (
          !object(
            lesson,
            ["id", "title", "paragraphs", "quote", "cards", "simulator"],
            lp,
            ["simulator"],
          )
        )
          return;
        id(lesson.id, `${lp}.id`, lessonIds);
        string(lesson.title, `${lp}.title`, 120);
        quote(lesson.quote, `${lp}.quote`);
        if (own(lesson, "simulator") && typeof lesson.simulator !== "boolean")
          fail(`${lp}.simulator must be boolean.`);
        if (
          !Array.isArray(lesson.paragraphs) ||
          !lesson.paragraphs.length ||
          lesson.paragraphs.length > 20
        )
          fail(`${lp}.paragraphs must have 1–20 paragraphs.`);
        else
          lesson.paragraphs.forEach((paragraph, pi) =>
            string(paragraph, `${lp}.paragraphs[${pi}]`, 5000),
          );
        if (!Array.isArray(lesson.cards) || lesson.cards.length > limits.cards)
          fail(`${lp}.cards must be an array of at most 48 cards.`);
        else {
          cardCount += lesson.cards.length;
          lesson.cards.forEach((card, ki) => {
            const kp = `${lp}.cards[${ki}]`;
            if (!object(card, ["id", "prompt", "answer", "quote"], kp)) return;
            id(card.id, `${kp}.id`, cardIds);
            string(card.prompt, `${kp}.prompt`, 1000);
            string(card.answer, `${kp}.answer`, 1000);
            quote(card.quote, `${kp}.quote`);
          });
        }
      });
      if (cardCount > limits.cards) fail(`${path} exceeds 48 cards.`);
    });
  if (plain(value.progress)) {
    for (const [key, item] of Object.entries(value.progress)) {
      if (!lessonIds.has(key))
        fail(`progress references unknown lesson ${key}.`);
      if (object(item, ["completedAt"], `progress.${key}`))
        date(item.completedAt, `progress.${key}.completedAt`);
    }
  } else fail("progress must be an object.");
  if (plain(value.reviews)) {
    for (const [key, item] of Object.entries(value.reviews)) {
      if (!cardIds.has(key)) fail(`reviews references unknown card ${key}.`);
      if (
        !object(
          item,
          ["dueAt", "intervalDays", "repetitions", "lastRating"],
          `reviews.${key}`,
        )
      )
        continue;
      date(item.dueAt, `reviews.${key}.dueAt`);
      if (
        typeof item.intervalDays !== "number" ||
        !Number.isFinite(item.intervalDays) ||
        item.intervalDays <= 0 ||
        item.intervalDays > 180
      )
        fail(
          `reviews.${key}.intervalDays must be greater than 0 and at most 180.`,
        );
      if (!Number.isSafeInteger(item.repetitions) || item.repetitions < 0)
        fail(`reviews.${key}.repetitions must be a nonnegative integer.`);
      if (!["again", "good", "easy"].includes(item.lastRating))
        fail(`reviews.${key}.lastRating is invalid.`);
    }
  } else fail("reviews must be an object.");
  if (
    object(value.settings, ["sound"], "settings") &&
    typeof value.settings.sound !== "boolean"
  )
    fail("settings.sound must be boolean.");
  return { ok: errors.length === 0, errors };
}
function assertState(state) {
  const result = validateState(state);
  if (!result.ok)
    throw new Error(`Invalid Trace state: ${result.errors.join(" ")}`);
}
export function createState(starters = [], now = new Date()) {
  const timestamp = instant(now);
  const state = {
    schemaVersion: 1,
    courses: starters,
    progress: {},
    reviews: {},
    settings: { sound: false },
    updatedAt: timestamp,
  };
  assertState(state);
  return clone(state);
}
export function importState(json) {
  if (typeof json !== "string") throw new Error("Choose a JSON text backup.");
  if (bytes(json) > MAX_BYTES)
    throw new Error("Backup exceeds the 2 MB limit.");
  let state;
  try {
    state = JSON.parse(json);
  } catch {
    throw new Error(
      "Backup is not valid JSON; your existing data has not changed.",
    );
  }
  assertState(state);
  // Validation forbids unsafe keys and unknown fields before this independent copy.
  return clone(state);
}
export function serializeState(state) {
  assertState(state);
  return JSON.stringify(state);
}

function hash(text) {
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b, 33) ^ c;
  }
  return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`;
}
function excerpt(text, max) {
  if (text.length <= max) return text;
  const first = text.slice(0, max);
  const ends = [...first.matchAll(/[.!?](?:["'”’)]*)(?=\s|$)/g)];
  const end = ends.length
    ? ends.at(-1).index + ends.at(-1)[0].length
    : first.lastIndexOf(" ");
  return text.slice(0, end > max * 0.4 ? end : max).trimEnd();
}
function firstSentence(text) {
  const candidates = text.match(/[^.!?\n]+(?:[.!?]+["'”’)]*|$)/g) || [text];
  return excerpt(
    (
      candidates.find(
        (sentence) =>
          sentence.trim().length >= 20 && /[\p{L}\p{N}]/u.test(sentence),
      ) || text
    ).trim(),
    850,
  );
}
export function parseTextCourse(input, now = new Date()) {
  if (!plain(input)) throw new Error("Provide a title and source text.");
  const { title, text, sourceTitle = "", sourceUrl = "" } = input;
  if (typeof title !== "string" || !title.trim() || title.trim().length > 120)
    throw new Error("Course title must contain 1–120 characters.");
  if (
    typeof text !== "string" ||
    text.length < 40 ||
    text.length > 100000 ||
    text.trim().length < 40
  )
    throw new Error(
      "Source text must contain 40–100,000 characters of readable content.",
    );
  if (typeof sourceTitle !== "string" || sourceTitle.trim().length > 200)
    throw new Error("Source title must be at most 200 characters.");
  if (
    typeof sourceUrl !== "string" ||
    (sourceUrl.trim() && !safeSourceUrl(sourceUrl))
  )
    throw new Error("Source URL must use http:// or https://.");
  const createdAt = instant(now);
  const courseId = `course-${hash(`${title.trim()}\n${text}\n${createdAt}`)}`;
  const blocks = text
    .split(/\r?\n[ \t]*\r?\n|(?=^#{1,6}[ \t]+)/m)
    .map((block) => block.trim())
    .filter(Boolean);
  const sections = [];
  let heading = "";
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    if (/^#{1,6}\s+/.test(lines[0])) {
      heading = lines[0]
        .replace(/^#{1,6}\s+/, "")
        .replace(/\s+#+\s*$/, "")
        .trim()
        .slice(0, 120);
      // Slice the original block: joining split lines would alter CRLF evidence.
      const body = block.slice(lines[0].length).trim();
      if (!body) continue;
      sections.push({ heading, body });
      heading = "";
    } else {
      sections.push({ heading, body: block });
      heading = "";
    }
  }
  if (!sections.length) sections.push({ heading: "", body: text.trim() });
  const lessons = sections.slice(0, 24).map((section, index) => {
    const quote = excerpt(section.body, 1200);
    const sentence = firstSentence(quote);
    const words = [...sentence.matchAll(/[\p{L}\p{N}][\p{L}\p{N}’'-]*/gu)];
    const meaningful = words.filter(
      (match) =>
        match[0].length >= 5 &&
        !/^(there|these|those|their|which|would|could|should|about|because|through|where|while)$/i.test(
          match[0],
        ),
    );
    const word =
      meaningful.sort((a, b) => b[0].length - a[0].length)[0] || words[0];
    const cards = word
      ? [
          {
            id: `${courseId}-card-${index + 1}`,
            prompt: `Draft cloze · Complete the source sentence:\n${sentence.slice(0, word.index)}[…]${sentence.slice(word.index + word[0].length)}`,
            answer: word[0].slice(0, 1000),
            quote: sentence,
          },
        ]
      : [];
    return {
      id: `${courseId}-lesson-${index + 1}`,
      title: section.heading || `Source section ${index + 1}`,
      paragraphs: [quote],
      quote,
      cards,
    };
  });
  const course = {
    id: courseId,
    title: title.trim(),
    description:
      "Extractive draft from your source. Review each excerpt and cloze before studying. The complete pasted source is preserved in its evidence record.",
    createdAt,
    origin: "imported",
    source: {
      title: sourceTitle.trim() || title.trim(),
      url: sourceUrl.trim() ? safeSourceUrl(sourceUrl) : "",
      text,
    },
    lessons,
  };
  // Use the same boundary checks for newly authored courses and backups.
  createState([course], now);
  return course;
}
export function listCards(state) {
  assertState(state);
  return state.courses.flatMap((course) =>
    course.lessons.flatMap((lesson) =>
      lesson.cards.map((card) => ({
        ...card,
        courseId: course.id,
        courseTitle: course.title,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
      })),
    ),
  );
}
export function dueCards(state, now = new Date()) {
  instant(now);
  return listCards(state).filter(
    (card) =>
      own(state.progress, card.lessonId) &&
      (!own(state.reviews, card.id) ||
        Date.parse(state.reviews[card.id].dueAt) <= now.getTime()),
  );
}
export function completeLesson(state, lessonId, now = new Date()) {
  assertState(state);
  const timestamp = instant(now);
  if (
    !state.courses.some((course) =>
      course.lessons.some((lesson) => lesson.id === lessonId),
    )
  )
    throw new Error("Lesson was not found.");
  const next = clone(state);
  if (!own(next.progress, lessonId)) {
    next.progress[lessonId] = { completedAt: timestamp };
    next.updatedAt = timestamp;
  }
  assertState(next);
  return next;
}
export function recordReview(state, cardId, rating, now = new Date()) {
  const cards = listCards(state);
  const timestamp = instant(now);
  const card = cards.find((item) => item.id === cardId);
  if (!card) throw new Error("Review card was not found.");
  if (!["again", "good", "easy"].includes(rating))
    throw new Error("Rating must be again, good, or easy.");
  if (!own(state.progress, card.lessonId))
    throw new Error("Complete the lesson before reviewing its cards.");
  const previous = state.reviews[cardId];
  const intervalDays =
    rating === "again"
      ? 10 / 1440
      : Math.min(
          180,
          previous && previous.repetitions > 0
            ? previous.intervalDays * 3
            : rating === "easy"
              ? 3
              : 1,
        );
  const next = clone(state);
  next.reviews[cardId] = {
    dueAt: new Date(
      now.getTime() + (rating === "again" ? 10 * MINUTE : intervalDays * DAY),
    ).toISOString(),
    intervalDays,
    repetitions:
      rating === "again"
        ? 0
        : Math.min(Number.MAX_SAFE_INTEGER, (previous?.repetitions || 0) + 1),
    lastRating: rating,
  };
  next.updatedAt = timestamp;
  assertState(next);
  return next;
}
export function deleteCourse(state, courseId) {
  assertState(state);
  const course = state.courses.find((item) => item.id === courseId);
  if (!course) throw new Error("Course was not found.");
  const next = clone(state);
  next.courses = next.courses.filter((item) => item.id !== courseId);
  for (const lesson of course.lessons) {
    delete next.progress[lesson.id];
    for (const card of lesson.cards) delete next.reviews[card.id];
  }
  next.updatedAt = new Date().toISOString();
  assertState(next);
  return next;
}
export function updateCard(
  state,
  { courseId, lessonId, cardId, prompt, answer } = {},
) {
  assertState(state);
  for (const [label, value] of [
    ["Prompt", prompt],
    ["Answer", answer],
  ])
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.trim().length > 1000
    )
      throw new Error(`${label} must contain 1–1000 characters.`);
  const next = clone(state);
  const card = next.courses
    .find((course) => course.id === courseId)
    ?.lessons.find((lesson) => lesson.id === lessonId)
    ?.cards.find((item) => item.id === cardId);
  if (!card) throw new Error("Card was not found in that course and lesson.");
  card.prompt = prompt.trim();
  card.answer = answer.trim();
  next.updatedAt = new Date().toISOString();
  assertState(next);
  return next;
}
export function calculateBayes({
  baseRate,
  sensitivity,
  falsePositiveRate,
  population = 1000,
} = {}) {
  for (const [label, value] of Object.entries({
    baseRate,
    sensitivity,
    falsePositiveRate,
  }))
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100
    )
      throw new Error(`${label} must be a percentage between 0 and 100.`);
  if (
    typeof population !== "number" ||
    !Number.isFinite(population) ||
    population <= 0 ||
    population > 1e12
  )
    throw new Error(
      "Population must be greater than zero and at most one trillion.",
    );
  const affected = (population * baseRate) / 100,
    unaffected = population - affected;
  const truePositive = (affected * sensitivity) / 100,
    falsePositive = (unaffected * falsePositiveRate) / 100;
  const positiveTotal = truePositive + falsePositive;
  return {
    truePositive,
    falsePositive,
    trueNegative: unaffected - falsePositive,
    falseNegative: affected - truePositive,
    positivePredictiveValue:
      positiveTotal > 0 ? truePositive / positiveTotal : null,
    positiveTotal,
  };
}
