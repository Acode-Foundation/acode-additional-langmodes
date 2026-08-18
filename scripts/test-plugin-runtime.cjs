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
	get(name) {
		return name === "yaml" ? { name: "yaml" } : null;
	},
	register(name, extensions, caption, load) {
		registered.push({ name, extensions, caption, load });
	},
	unregister(name) {
		unregistered.push(name);
	},
};

function installAcodeMock(requireImpl) {
	global.acode = {
		require: requireImpl,
		setPluginInit(_id, init) {
			initPlugin = init;
		},
		setPluginUnmount(_id, unmount) {
			unmountPlugin = unmount;
		},
	};
	global.window = { acode: global.acode };
}

// Default: host exposes full CodeMirror / Lezer runtimes (modern Acode).
installAcodeMock((id) =>
	id === "editorLanguages" ? editorLanguages : runtimeModules[id],
);

require("../dist/main.js");

async function testHostRuntime() {
	registered.length = 0;
	unregistered.length = 0;
	await initPlugin("file:///plugin/", null, {});

	const modes = new Map(registered.map((mode) => [mode.name, mode]));
	const expectedNames = [
		"asciidoc",
		"assembly",
		"autohotkey",
		"zig",
		"gitignore",
		"jsonc",
		"yaml-enhanced",
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
		"gitattributes",
		"gleam",
		"gitcommitmsg",
		"makefile",
		"solidity",
	];

	assert.deepEqual([...modes.keys()], expectedNames);
	assert(modes.get("asciidoc").extensions.includes("adoc"));
	assert(modes.get("assembly").extensions.includes("asm"));
	assert(modes.get("autohotkey").extensions.includes("ahk"));
	assert(modes.get("zig").extensions.includes("zon"));
	assert(modes.get("gitignore").extensions.includes("gitignore"));
	assert(modes.get("jsonc").extensions.includes("jsonc"));
	assert(modes.get("yaml-enhanced").extensions.includes("yaml"));
	assert(modes.get("yaml-enhanced").extensions.includes("yml"));
	assert(modes.get('gitcommitmsg').extensions.includes("^COMMIT_EDITMSG"));
	assert(modes.get("makefile").extensions.includes("mk"));
	assert(modes.get("makefile").extensions.includes("Makefile"));
	assert(modes.get("solidity").extensions.includes("sol"));

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
		"yaml-enhanced": `defaults: &defaults
  enabled: true
  retries: 3
jobs:
  build:
    <<: *defaults
    runs-on: ubuntu-latest
    matrix: {node: [18, 20]}
`,
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
		gitattributes: "# comment\n*.txt text eol=lf\n",
		gleam: "pub fn main() { Nil }\n",
		gitcommitmsg: `
# Please enter the commit message for your changes. Lines starting
# with '#' will be ignored, and an empty message aborts the commit.
#
# On branch main
# Your branch is up to date with 'origin/main'.
#
# Changes to be committed:
#	modified:   src/components/AuthProvider.tsx
#	new file:   src/index.html
#	modified:   src/lib/data.ts
#	modified:   src/lib/utils.ts
#
# Changes not staged for commit:
#	modified:   package.json
#	modified:   src/hooks/use-toast.ts
#	modified:   src/index.html
#
# ------------------------ >8 ------------------------
# Do not modify or remove the line above.
# Everything below it will be ignored.
diff --git a/src/components/AuthProvider.tsx b/src/components/AuthProvider.tsx
index 395e257..c594478 100644
--- a/src/components/AuthProvider.tsx
+++ b/src/components/AuthProvider.tsx
@@ -9,3 +9,5 @@ interface AuthProviderProps {
 export default function AuthProvider({ children }: AuthProviderProps) {
     return <SessionProvider>{children}</SessionProvider>
 }
+
+
diff --git a/src/index.html b/src/index.html
new file mode 100644
index 0000000..e69de29`,
		makefile: `CC := gcc
.PHONY: all
all: main.o
	$(CC) -o app $@
ifeq ($(DEBUG),1)
  CFLAGS += -g
endif
`,
		solidity: `pragma solidity ^0.8.24;
contract Token {
  uint256 public totalSupply;
  function mint(address to) public {
    require(to != address(0));
  }
}
`,
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
		if (
			name === "asciidoc" ||
			name === "assembly" ||
			name === "yaml-enhanced" ||
			name === "makefile" ||
			name === "solidity"
		) {
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
					: name === "assembly"
						? ["DirectiveName", "Label", "Instruction", "Register", "String"]
						: name === "makefile"
							? [
									"VariableAssignment",
									"SpecialTarget",
									"TargetLine",
									"RecipeLine",
									"Conditional",
									"AutomaticVariable",
								]
							: name === "solidity"
								? [
										"PragmaDirective",
										"ContractDeclaration",
										"StateVariableDeclaration",
										"FunctionDefinition",
										"PrimitiveType",
										"BuiltinName",
									]
							: ["BlockMapping", "FlowMapping", "FlowSequence", "Anchor", "Alias", "Boolean", "Integer"];
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
		`Validated ${expectedNames.length} Acode registrations and language loaders (host @lezer/*).`,
	);
}

/**
 * Older Acode builds do not expose @lezer/lr or @lezer/common via
 * acode.require. The plugin must fall back to its bundled copies so modes
 * that need LRParser / ExternalTokenizer / ContextTracker / parseMixed still load.
 */
async function testBundledLezerFallback() {
	const distPath = require.resolve("../dist/main.js");
	delete require.cache[distPath];
	registered.length = 0;
	unregistered.length = 0;

	installAcodeMock((id) => {
		if (id === "editorLanguages") return editorLanguages;
		// Simulate pre-@lezer/* host: these requires return undefined.
		if (id === "@lezer/lr" || id === "@lezer/common") return undefined;
		return runtimeModules[id];
	});

	require(distPath);
	await initPlugin("file:///plugin/", null, {});

	const modes = new Map(registered.map((mode) => [mode.name, mode]));
	assert(modes.has("makefile"), "makefile should register without host @lezer/lr");
	assert(
		modes.has("yaml-enhanced"),
		"yaml-enhanced should register without host @lezer/common",
	);

	const makefileSource = `CC := gcc
.PHONY: all
all: main.o
	$(CC) -o app $@
ifeq ($(DEBUG),1)
  CFLAGS += -g
endif
`;
	const makefileSupport = modes.get("makefile").load();
	const makefileTree = makefileSupport.language.parser.parse(makefileSource);
	assert.equal(
		makefileTree.length,
		makefileSource.length,
		"makefile should parse with bundled @lezer/lr",
	);

	const yamlSource = `jobs:
  build:
    runs-on: ubuntu-latest
`;
	const yamlSupport = modes.get("yaml-enhanced").load();
	const yamlTree = yamlSupport.language.parser.parse(yamlSource);
	assert.equal(
		yamlTree.length,
		yamlSource.length,
		"yaml-enhanced should parse with bundled @lezer/lr + @lezer/common",
	);

	await unmountPlugin();
	console.log(
		"Validated bundled @lezer/lr and @lezer/common fallback for older Acode.",
	);
}

async function test() {
	await testHostRuntime();
	await testBundledLezerFallback();
}

test().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
