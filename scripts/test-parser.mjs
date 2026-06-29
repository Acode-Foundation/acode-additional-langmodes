import assert from "node:assert/strict";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";

const outfile = path.join(os.tmpdir(), "acode-autohotkey-parser-test.cjs");

await build({
	entryPoints: ["src/languages/autohotkey/parser.js"],
	bundle: true,
	format: "cjs",
	platform: "node",
	outfile,
	logLevel: "silent",
});

const require = createRequire(import.meta.url);
const { parser } = require(outfile);

const samples = [
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

for (const sample of samples) {
	const tree = parser.parse(sample.source);
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

console.log(`Validated ${samples.length} AutoHotkey parser fixtures.`);

// Test JSONC Parser
const jsoncOutfile = path.join(os.tmpdir(), "acode-jsonc-parser-test.cjs");

await build({
	entryPoints: ["src/languages/jsonc/parser.js"],
	bundle: true,
	format: "cjs",
	platform: "node",
	outfile: jsoncOutfile,
	logLevel: "silent",
});

const { parser: jsoncParser } = require(jsoncOutfile);

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

