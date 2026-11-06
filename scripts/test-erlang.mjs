import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

// The Erlang tests exercise the parser together with the CodeMirror language
// support, so they are bundled into a single module. That guarantees one copy
// of @codemirror/state and friends, which the editor APIs require.
const outfile = path.join(os.tmpdir(), "acode-erlang-test-bundle.mjs");

await build({
	entryPoints: ["scripts/erlang.test.js"],
	bundle: true,
	format: "esm",
	platform: "node",
	outfile,
	logLevel: "silent",
});

try {
	await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
} finally {
	fs.rmSync(outfile, { force: true });
}
