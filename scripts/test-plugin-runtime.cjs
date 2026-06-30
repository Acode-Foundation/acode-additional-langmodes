const assert = require("node:assert/strict");
const { EditorState } = require("@codemirror/state");
const { getIndentation, indentUnit } = require("@codemirror/language");

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
		"asciidoc",
		"assembly",
		"autohotkey",
		"zig",
		"gitignore",
		"jsonc",
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
		"ejs",
	];

	assert.deepEqual([...modes.keys()], expectedNames);
	assert(modes.get("asciidoc").extensions.includes("adoc"));
	assert(modes.get("assembly").extensions.includes("asm"));
	assert(modes.get("autohotkey").extensions.includes("ahk"));
	assert(modes.get("zig").extensions.includes("zon"));
	assert(modes.get("gitignore").extensions.includes("gitignore"));
	assert(modes.get("jsonc").extensions.includes("jsonc"));

	const samples = {
		asciidoc: `= Project Notes
:toc:

NOTE: Review <<setup,setup>> before running.

[#setup]
== Setup

* [x] Install dependencies
* Run \`npm test\`

[source,asm]
----
_start:
  mov eax, 1 <1>
----

<1> Exit syscall.
`,
		assembly: `.text
.global _start
_start:
  mov eax, 1
  mov ebx, message
  int 0x80

message:
  .asciz "ok"
`,
		autohotkey: "MsgBox('ok')",
		zig: 'const std = @import("std");',
		gitignore: "# build output\ndist/\n!important.log\n*.tmp\n",
		jsonc: '{\n  // comment\n  "foo": "bar",\n}',
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
		ejs: "<% if (user) { %>\n<h2><%= user.name %></h2>\n<% } %>",
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
		const state = EditorState.create({
			doc: source,
			extensions: [support, indentUnit.of("  ")],
		});
		const tree = support.language.parser.parse(source);
		assert.equal(tree.length, source.length, `${name} did not parse the full fixture`);
		if (name === "asciidoc" || name === "assembly") {
			const nodeNames = new Set();
			const errors = [];
			tree.iterate({
				enter(node) {
					nodeNames.add(node.name);
					if (node.type.isError) errors.push([node.from, node.to]);
				},
			});
			assert.equal(errors.length, 0, `${name} produced parse errors`);
			const expectedNodes =
				name === "asciidoc"
					? ["Heading1", "Heading2", "AttributeLine", "Xref", "ListingBlock", "ListItem"]
					: ["DirectiveName", "Label", "Instruction", "Register", "String"];
			for (const nodeName of expectedNodes) {
				assert(
					nodeNames.has(nodeName),
					`${name} did not produce ${nodeName}`,
				);
			}
		}
	}

	const asciidocSupport = modes.get("asciidoc").load();
	const asciidocIndentState = EditorState.create({
		doc: "* item\n\n----\ncode\n----\n",
		extensions: [asciidocSupport, indentUnit.of("  ")],
	});
	assert.equal(
		getIndentation(asciidocIndentState, asciidocIndentState.doc.line(2).from),
		2,
		"asciidoc should indent list continuation lines after the marker",
	);
	assert.equal(
		getIndentation(asciidocIndentState, asciidocIndentState.doc.line(4).from),
		0,
		"asciidoc should preserve delimited block content indentation",
	);

	const assemblySupport = modes.get("assembly").load();
	const assemblyIndentState = EditorState.create({
		doc: ".macro exit code\nmov eax,\n]\n.endm\n\n_start:\nmov eax, 1\n.text\n",
		extensions: [assemblySupport, indentUnit.of("  ")],
	});
	assert.equal(
		getIndentation(assemblyIndentState, assemblyIndentState.doc.line(2).from),
		2,
		"assembly should indent inside macro blocks",
	);
	assert.equal(
		getIndentation(assemblyIndentState, assemblyIndentState.doc.line(3).from),
		2,
		"assembly should outdent closing operand delimiters after continued operands",
	);
	assert.equal(
		getIndentation(assemblyIndentState, assemblyIndentState.doc.line(4).from),
		0,
		"assembly should outdent macro closing directives",
	);
	assert.equal(
		getIndentation(assemblyIndentState, assemblyIndentState.doc.line(7).from),
		2,
		"assembly should indent instructions after labels",
	);
	assert.equal(
		getIndentation(assemblyIndentState, assemblyIndentState.doc.line(8).from),
		0,
		"assembly section directives should reset to the section column",
	);

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
