import assert from "node:assert/strict";
import { CompletionContext } from "@codemirror/autocomplete";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { fileTests } from "@lezer/generator/test";

const require = createRequire(import.meta.url);

async function bundledRequire(entryPoint, outfileName) {
	const outfile = path.join(os.tmpdir(), outfileName);
	await build({
		entryPoints: [entryPoint],
		bundle: true,
		format: "cjs",
		platform: "node",
		outfile,
		logLevel: "silent",
	});
	return require(outfile);
}

const { parser: autoHotkeyParser } = await bundledRequire(
	"src/languages/autohotkey/parser.js",
	"acode-autohotkey-parser-test.cjs",
);

const autoHotkeySamples = [
	{
		name: "AutoHotkey v2",
		source: `#Requires AutoHotkey v2.0
#SingleInstance Force

class Counter extends Object {
  __New(value := 0) {
    this.value := value
  }

  Increment(step := 1) {
    this.value += step
    return this.value
  }
}

^!j:: {
  counter := Counter(1)
  MsgBox("Value: " counter.Increment())
}

:*:btw::by the way
`,
		nodes: [
			"Directive",
			"ClassDeclaration",
			"FunctionDeclaration",
			"HotkeyDeclaration",
			"HotstringDeclaration",
			"BuiltinFunction",
		],
	},
	{
		name: "AutoHotkey v1",
		source: `#NoEnv
SendMode Input
SetWorkingDir %A_ScriptDir%

^j::
MsgBox, 64, Example, Hello World
Gosub, Worker
return

Worker:
FileRead, text, %A_ScriptFullPath%
index := A_Index
return
`,
		nodes: [
			"Directive",
			"HotkeyDeclaration",
			"LabelOrProperty",
			"Command",
			"PercentVariable",
			"BuiltinVariable",
		],
	},
	{
		name: "comments and strings",
		source: `; line comment
text := "escaped ""quote"""
/* block
comment */
`,
		nodes: ["LineComment", "String", "BlockComment"],
	},
];

for (const sample of autoHotkeySamples) {
	const tree = autoHotkeyParser.parse(sample.source);
	const names = new Set();
	const errors = [];

	tree.iterate({
		enter(node) {
			names.add(node.name);
			if (node.type.isError) errors.push([node.from, node.to]);
		},
	});

	assert.equal(errors.length, 0, `${sample.name} produced parse errors`);
	assert.equal(tree.length, sample.source.length, `${sample.name} was not fully parsed`);
	for (const node of sample.nodes) {
		assert(names.has(node), `${sample.name} did not produce ${node}`);
	}
}

console.log(`Validated ${autoHotkeySamples.length} AutoHotkey parser fixtures.`);

// Test JSONC Parser
const { parser: jsoncParser } = await bundledRequire(
	"src/languages/jsonc/parser.js",
	"acode-jsonc-parser-test.cjs",
);

const jsoncSamples = [
	{
		name: "JSON with comments and trailing commas",
		source: `{
			// Line comment
			"name": "Acode",
			/* Block comment */
			"features": [
				"syntax highlighting",
				"git support",
			],
			"config": {
				"active": true,
				"version": 1.0,
				"meta": null
			}
		}`,
		nodes: [
			"LineComment",
			"BlockComment",
			"PropertyName",
			"String",
			"Array",
			"Object",
			"Property",
			"True",
			"Number",
			"Null",
		],
	},
];

for (const sample of jsoncSamples) {
	const tree = jsoncParser.parse(sample.source);
	const names = new Set();
	const errors = [];

	tree.iterate({
		enter(node) {
			names.add(node.name);
			if (node.type.isError) {
				errors.push([node.from, node.to]);
			}
		},
	});

	assert.equal(errors.length, 0, `${sample.name} produced parse errors`);
	assert.equal(tree.length, sample.source.length, `${sample.name} was not fully parsed`);
	for (const node of sample.nodes) {
		assert(names.has(node), `${sample.name} did not produce ${node}`);
	}
}

console.log(`Validated ${jsoncSamples.length} JSONC parser fixtures.`);

const { parser: ejsParser } = await bundledRequire(
	"src/languages/ejs/parser.js",
	"acode-ejs-parser-test.cjs",
);

const ejsFixturePath = "src/languages/ejs/test.txt";
const ejsFixtures = fileTests(fs.readFileSync(ejsFixturePath, "utf8"), ejsFixturePath);
for (const test of ejsFixtures) test.run(ejsParser);
console.log(`Validated ${ejsFixtures.length} EJS Lezer parser fixtures.`);

const ejsBehaviorBundle = path.join(os.tmpdir(), "acode-ejs-behavior-test-bundle.mjs");
const ejsBehaviorSource = String.raw`
import assert from "node:assert/strict";
import { CompletionContext } from "@codemirror/autocomplete";
import { EditorSelection, EditorState } from "@codemirror/state";
import { insertNewlineAndIndent, toggleComment } from "@codemirror/commands";
import { foldable, getIndentation, indentUnit, matchBrackets, syntaxTree } from "@codemirror/language";
import { classHighlighter, highlightTree } from "@lezer/highlight";
import { ejs, ejsLanguage } from "./src/languages/ejs/index.js";

function spansFor(doc) {
	const state = EditorState.create({ doc, extensions: [ejsLanguage] });
	syntaxTree(state);
	const spans = [];
	highlightTree(syntaxTree(state), classHighlighter, (from, to, cls) => {
		spans.push({ from, to, cls, text: state.doc.sliceString(from, to) });
	});
	return { state, tree: syntaxTree(state), spans };
}

{
	const source = "<%# <% if (user) { %>\n  <h2><%= user.name %></h2>\n<% } %> %>";
	const result = spansFor(source);
	assert.equal(result.tree.toString(), "Template(EjsComment)");
	assert.equal(result.spans.length, 1);
	assert.equal(result.spans[0].cls, "tok-comment");
	assert.equal(result.spans[0].text, source);
}

{
	const result = spansFor("<% if (user) { %>\n  <!-- <h2><%= user.name %></h2> -->\n<% } %>");
	assert(result.spans.some((span) => span.cls === "tok-comment" && span.text.includes("<%= user.name %>")));
	assert(!result.spans.some((span) => /user|name|<%=/.test(span.text) && span.cls !== "tok-comment" && span.from >= 20 && span.to <= 54));
}

{
	const source = "<% if (user) { %>\n  <h2><%= user.name %></h2>\n<% } %>";
	const result = spansFor(source);
	assert(result.spans.some((span) => span.text === "h2" && span.cls.includes("typeName")));
	assert(result.spans.some((span) => span.text === "user" && span.cls.includes("variableName")));
	const open = result.state.doc.toString().indexOf("{");
	const close = result.state.doc.toString().lastIndexOf("}");
	assert.notEqual(matchBrackets(result.state, open + 1, 1)?.matched, false);
	assert.notEqual(matchBrackets(result.state, close + 1, -1)?.matched, false);
}

{
	assert.equal(spansFor("my title").spans.length, 0);
}

function enter(doc, extensions = []) {
	const cursor = doc.indexOf("%>\n  <% }") + 2;
	const state = EditorState.create({
		doc,
		selection: EditorSelection.cursor(cursor),
		extensions: [ejs(), ...extensions],
	});
	syntaxTree(state);
	let transaction = null;
	insertNewlineAndIndent({ state, dispatch(tr) { transaction = tr; } });
	const line = transaction.newDoc.lineAt(transaction.newSelection.main.head);
	return line.text;
}

{
	const source = "<% if (user) { %>\n  <h2><%= user.name %></h2>\n  <% if('id' in user) { %>\n  <% } %>\n<% } %>";
	assert.equal(enter(source), "    ");
	assert.equal(enter(source, [indentUnit.of("	"), EditorState.tabSize.of(4)]), "	");
	assert.equal(enter(source, [indentUnit.of("	"), EditorState.tabSize.of(2)]), "		");
}

{
	const source = "<% if (user) { %>\n  <h2><%= user.name %></h2>\n  <% if('id' in user) { %>\n\n  <% } %>\n<% } %>";
	const state = EditorState.create({ doc: source, extensions: [ejs()] });
	syntaxTree(state);
	assert.equal(getIndentation(state, state.doc.line(4).from), 4);
	assert.equal(getIndentation(state, state.doc.line(5).from), 2);
	assert.deepEqual(foldable(state, state.doc.line(1).from, state.doc.line(1).to), {
		from: state.doc.line(1).to,
		to: state.doc.line(6).from,
	});
}


{
	const state = EditorState.create({ doc: "<h2></h2>", extensions: [ejs()] });
	syntaxTree(state);
	assert.equal(state.update({ changes: { from: 3, insert: "2" } }).newDoc.toString(), "<h22></h22>");
}

{
	const state = EditorState.create({ doc: "<h22></h22>", extensions: [ejs()] });
	syntaxTree(state);
	assert.equal(state.update({ changes: { from: 3, to: 4 } }).newDoc.toString(), "<h2></h2>");
}

{
	const state = EditorState.create({ doc: "<h2></h2>", extensions: [ejs()] });
	syntaxTree(state);
	const transaction = state.update({ changes: [{ from: 3, insert: "2" }, { from: 8, insert: "2" }] });
	assert.equal(transaction.newDoc.toString(), "<h22></h22>");
}

{
	const state = EditorState.create({ doc: "fo", extensions: [ejs()] });
	const source = state.languageDataAt("autocomplete", 2)[0];
	const result = source(new CompletionContext(state, 2, true));
	const completion = result.options.find((option) => option.label === "for");
	assert(completion?.apply, "EJS for completion should be a snippet");

	let next = state;
	const fakeView = {
		state: next,
		dispatch(transaction) {
			next = transaction.state;
			this.state = next;
		},
	};
	completion.apply(fakeView, completion, result.from, 2);
	assert.equal(next.doc.toString(), "<% for (const item of items) { %>\n  \n<% } %>");
	assert.equal(next.selection.main.from, 14);
	assert.equal(next.selection.main.to, 18);
}
{
	let updated = "";
	const source = "  <!-- <h2><%= user.name %></h2> -->";
	const state = EditorState.create({ doc: source, selection: { anchor: 2, head: source.length }, extensions: [ejs()] });
	assert(toggleComment({ state, dispatch(tr) { updated = tr.newDoc.toString(); } }));
	assert.equal(updated.trim(), "<h2><%= user.name %></h2>");
}

console.log("Validated EJS CodeMirror behavior fixtures.");
`;

await build({
  stdin: {
    contents: ejsBehaviorSource,
    resolveDir: process.cwd(),
    sourcefile: "ejs-behavior-test.mjs",
    loader: "js",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: ejsBehaviorBundle,
  logLevel: "silent",
});

try {
	await import(pathToFileURL(ejsBehaviorBundle).href + `?t=${Date.now()}`);
} finally {
	fs.rmSync(ejsBehaviorBundle, { force: true });
}
