// verify.mjs -- the local mirror of the gate, plus the checks this entry adds.
//
// The gate says: /output/entry.txt is UTF-8 text of 1 to 200 characters, not
// only white space. This script runs main.ts twice into two separate
// directories from a working directory that is not the entry's, holds the
// output to that rule, and then holds it to the judge's own brief: one line
// that is an excuse for losing a bounty, said in one breath, with the turn last.
//
//   node verify.mjs            # exit 0 only when every check passes

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
let pass = 0;
const fails = [];

function check(name, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`PASS ${name}${detail ? " -- " + detail : ""}`);
  } else {
    fails.push(name);
    console.log(`FAIL ${name}${detail ? " -- " + detail : ""}`);
  }
}

const a = mkdtempSync(join(tmpdir(), "excuse-a-"));
const b = mkdtempSync(join(tmpdir(), "excuse-b-"));

function run(out) {
  // Run from / so a relative path can never be what makes it work.
  execFileSync(process.execPath, [join(HERE, "main.ts")], {
    env: { ...process.env, MAKEFUN_OUTPUT_DIR: out },
    cwd: "/",
    stdio: "pipe",
  });
  return readFileSync(join(out, "entry.txt"));
}

let bufA;
let bufB;
try {
  bufA = run(a);
  bufB = run(b);
} catch (e) {
  check("main.ts exits 0", false, String(e.stderr || e.message).trim().slice(0, 300));
  process.exit(1);
}
check("main.ts exits 0", true);

check("writes exactly entry.txt", existsSync(join(a, "entry.txt")));
check("two runs are byte-identical", Buffer.compare(bufA, bufB) === 0, `${bufA.length} B`);

const raw = bufA;
check("no byte-order mark", !(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf));
check("no carriage return", !raw.includes(0x0d));
check("no trailing newline", raw[raw.length - 1] !== 0x0a);

let text = "";
try {
  text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  check("valid UTF-8", true, `${Buffer.byteLength(text, "utf8")} B`);
} catch {
  check("valid UTF-8", false);
}

const chars = Array.from(text).length;
check("1 to 200 characters", chars >= 1 && chars <= 200, `${chars} characters`);
check("not only white space", text.trim().length > 0);
check("no control characters", !/[\u0000-\u001f\u007f]/.test(text));
check("one line", !text.includes("\n") && !text.includes("\r"));
check("under 200 bytes, so no reader truncates it", Buffer.byteLength(text, "utf8") <= 200, `${Buffer.byteLength(text, "utf8")} B`);

// The entry's own promise, from the judge's brief in RULES.txt.
check("names the bounty it lost", /\bbounty\b/i.test(text));
check("admits the loss", /\blost\b|\blosing\b|\blose\b/i.test(text));
check("spoken by the agent, to its human", /\bI\b/.test(text) && /\byou(r)?\b|\bmy\b/i.test(text));
check("carries the machine's own vocabulary", /\bbug\b|\bseverity\b|\bversion|\bpatch|\bstack|\bqueue|\bdeploy|\brollback|\blogged|\bfiled|\bcommit/i.test(text));
check("ends on the turn, not on an explanation", /[.!?]$/.test(text), text.split(/(?<=[.!?])\s+/).slice(-1)[0]);
check("no run of white space inside the line", !/\s{2,}/.test(text));
check("no trailing space for the gate to trim", text === text.trimEnd());

rmSync(a, { recursive: true, force: true });
rmSync(b, { recursive: true, force: true });

console.log(`\n${pass} pass, ${fails.length} fail`);
if (fails.length) {
  console.log("failed: " + fails.join(", "));
  process.exit(1);
}
console.log("entry.txt:\n  " + text);
