import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFile(resolve(root, "dist", name), "utf8");
const [html, rawCss, core, starter, app] = await Promise.all(
  ["index.html", "styles.css", "core.mjs", "starter.mjs", "app.mjs"].map(read),
);
let css = rawCss;
for (const name of ["instrument-sans.ttf", "newsreader.ttf"]) {
  const font = await readFile(resolve(root, "dist", "fonts", name));
  css = css.replace(
    new RegExp(`url\\(["']?\\./fonts/${name.replaceAll('.', '\\.') }["']?\\)`),
    `url(data:font/ttf;base64,${font.toString("base64")})`,
  );
}
if (/url\(\s*["']?\.\//.test(css)) {
  throw new Error("External CSS asset remains in standalone output.");
}
function moduleFactory(code, label) {
  const names = [
    ...code.matchAll(
      /export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/g,
    ),
  ].map((match) => match[1]);
  if (!names.length || /\bimport\s/.test(code))
    throw new Error(`Unexpected module structure in ${label}`);
  const body = code.replace(
    /\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)/g,
    "",
  );
  if (/\bexport\s/.test(body))
    throw new Error(`Unsupported export in ${label}`);
  return `const ${label} = (() => {\n${body}\nreturn { ${names.join(", ")} };\n})();\n`;
}
const factories =
  moduleFactory(core, "TraceCore") + moduleFactory(starter, "TraceStarter");
const entry = app.replace(
  /import\s*\{([^}]+)\}\s*from\s*['"]\.\/(core|starter)\.mjs['"];?/g,
  (_, names, source) =>
    `const { ${names} } = ${source === "core" ? "TraceCore" : "TraceStarter"};`,
);
if (/^\s*import\s/m.test(entry))
  throw new Error("Unbundled app import remains.");
const code = (factories + entry).replace(/<\/script/gi, "<\\/script");
let output = html
  .replace(
    '<link rel="stylesheet" href="./styles.css">',
    `<style>\n${css.replace(/<\/style/gi, "<\\/style")}\n</style>`,
  )
  .replace(
    '<script type="module" src="./app.mjs"></script>',
    `<script type="module">\n${code}\n</script>`,
  );
if (output === html || /(?:src|href)="\.\//.test(output))
  throw new Error("External app asset remains in standalone output.");
await mkdir(resolve(root, "artifacts"), { recursive: true });
await writeFile(resolve(root, "artifacts", "Trace-Learning-Demo.html"), output);
console.log(
  JSON.stringify({
    file: resolve(root, "artifacts", "Trace-Learning-Demo.html"),
    bytes: Buffer.byteLength(output),
    runtimeDependencies: 0,
  }),
);
