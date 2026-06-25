const assert = require("node:assert/strict");
const { EditorState } = require("@codemirror/state");

const runtimeModules = {
	"@codemirror/autocomplete": require("@codemirror/autocomplete"),
	"@codemirror/language": require("@codemirror/language"),
	"@codemirror/lint": require("@codemirror/lint"),
	"@codemirror/state": require("@codemirror/state"),
	"@codemirror/view": require("@codemirror/view"),
	"@lezer/common": require("@lezer/common"),
	"@lezer/highlight": require("@lezer/highlight"),
	"@lezer/lr": require("@lezer/lr"),
};

let initPlugin;
let unmountPlugin;
const registered = [];
const unregistered = [];

const editorLanguages = {
	get() {
		return null;
	},
	register(name, extensions, caption, load) {
		registered.push({ name, extensions, caption, load });
	},
	unregister(name) {
		unregistered.push(name);
	},
};

global.acode = {
	require(id) {
		return id === "editorLanguages" ? editorLanguages : runtimeModules[id];
	},
	setPluginInit(_id, init) {
		initPlugin = init;
	},
	setPluginUnmount(_id, unmount) {
		unmountPlugin = unmount;
	},
};
global.window = { acode: global.acode };

require("../dist/main.js");

async function test() {
	await initPlugin("file:///plugin/", null, {});

	const modes = new Map(registered.map((mode) => [mode.name, mode]));
	const expectedNames = [
		"autohotkey",
		"zig",
		"gitignore",
		"bibtex",
		"elixir",
		"golfscript",
		"graphql",
		"dot",
		"hcl",
		"j",
		"janet",
		"pkl",
		"svelte",
		"wgsl",
	];

	assert.deepEqual([...modes.keys()], expectedNames);
	assert(modes.get("autohotkey").extensions.includes("ahk"));
	assert(modes.get("zig").extensions.includes("zon"));
	assert(modes.get("gitignore").extensions.includes("gitignore"));

	const samples = {
		autohotkey: "MsgBox('ok')",
		zig: 'const std = @import("std");',
		gitignore: "# build output\ndist/\n!important.log\n*.tmp\n",
		bibtex: "@article{example, title={Example}}",
		elixir: "defmodule Example do\nend",
		golfscript: "1 2 +",
		graphql: "query Example { viewer { id } }",
		dot: "digraph G { a -> b }",
		hcl: 'name = "example"',
		j: "1 + 2",
		janet: "(def x 1)",
		pkl: 'name = "example"',
		svelte: "<script>let x = 1;</script><p>{x}</p>",
		wgsl: "@vertex fn main() -> @builtin(position) vec4f { return vec4f(); }",
	};

	for (const [name, source] of Object.entries(samples)) {
		const support = modes.get(name).load();
		assert(support?.language, `${name} did not return LanguageSupport`);
		if (name === "bibtex") {
			assert.equal(
				support.support.length,
				0,
				"bibtex should not enable package autocomplete or linter extensions",
			);
		}
		EditorState.create({
			doc: source,
			extensions: [support],
		});
		assert.equal(
			support.language.parser.parse(source).length,
			source.length,
			`${name} did not parse the full fixture`,
		);
	}

	await unmountPlugin();
	assert.deepEqual(unregistered, [...expectedNames].reverse());

	console.log(
		`Validated ${expectedNames.length} Acode registrations and language loaders.`,
	);
}

test().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
