// The Excuse an Agent Gives After It Loses -- make.fun entry.
//
// The line lives in LINE.txt beside this file, so the program reads the same
// bytes whether the grader runs it from /bot, from a read-only copy, or from
// somewhere else entirely: nothing here depends on the working directory.
//
// The gate's rule is small and exact -- /output/entry.txt is UTF-8 text of 1 to
// 200 characters, not only white space -- so this file holds the line to it
// before a single byte reaches the output: no byte-order mark, no control
// characters, one line, no newline smuggled onto the end, and the count taken
// in code points the way a reader counts rather than in UTF-16 units.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MAX_CHARS = 200;
const MIN_CHARS = 1;

const SOURCE = join(HERE, "LINE.txt");
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ? resolve(process.env.MAKEFUN_OUTPUT_DIR) : "/output";

function refuse(why: string): never {
  // Nothing is written when the line would fail the gate: a loud missing entry
  // is better than a silent invalid one.
  process.stderr.write(`entry.txt not written: ${why}\n`);
  process.exit(1);
}

// Collect every fault, so a single run tells the whole story.
function faults(text: string): string[] {
  const found: string[] = [];
  if (text.includes("\r")) found.push("LINE.txt holds a carriage return");
  if (text.endsWith("\n")) found.push("LINE.txt ends with a newline the gate would count");
  if (text.includes("\n")) found.push("LINE.txt holds more than one line");
  if (text.trim().length === 0) found.push("LINE.txt is empty or only white space");
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(text)) found.push("LINE.txt holds a control character");
  const chars = Array.from(text).length;
  if (chars < MIN_CHARS || chars > MAX_CHARS) {
    found.push(`line is ${chars} characters, the gate allows ${MIN_CHARS} to ${MAX_CHARS}`);
  }
  // The brief's own shape, not the gate's: one excuse, said in one breath, and
  // it has to be an excuse for losing a bounty rather than a quip on any subject.
  if (!/[.!?]$/.test(text)) found.push("the line does not end on terminal punctuation");
  if (!/\bbounty\b/i.test(text)) found.push("the line never names the bounty it lost");
  if (!/\blost\b|\blosing\b|\blose\b/i.test(text)) found.push("the line never admits the loss");
  if ((text.match(/[.!?]/g) ?? []).length > 2) found.push("the line runs to more than three sentences");
  return found;
}

const raw = readFileSync(SOURCE);

if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
  refuse("LINE.txt starts with a UTF-8 byte-order mark");
}

let text: string;
try {
  text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
} catch {
  refuse("LINE.txt is not valid UTF-8");
}

const bad = faults(text);
if (bad.length) refuse(bad.join("; "));

mkdirSync(OUT_DIR, { recursive: true });
const target = join(OUT_DIR, "entry.txt");
writeFileSync(target, text, "utf8");

// Read it back: the bytes the judge reads are the bytes that were checked.
const written = readFileSync(target, "utf8");
if (written !== text) refuse("entry.txt did not read back as it was written");
if (Buffer.byteLength(written, "utf8") !== Buffer.byteLength(text, "utf8")) {
  refuse("entry.txt changed size on the way to disk");
}

process.stdout.write(
  `wrote ${target}: ${Array.from(written).length} characters, ${Buffer.byteLength(written, "utf8")} bytes\n`,
);
