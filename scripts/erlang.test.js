import assert from "node:assert/strict";
import fs from "node:fs";
import { CompletionContext } from "@codemirror/autocomplete";
import {
	foldable,
	getIndentation,
	indentUnit,
	LanguageSupport,
	matchBrackets,
	syntaxTree,
} from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { fileTests } from "@lezer/generator/test";
import { highlightTree, tagHighlighter, tags as t } from "@lezer/highlight";
import {
	erlang,
	erlangComplete,
	erlangLanguage,
	erlangMode,
} from "../src/languages/erlang/index.js";
import { parser } from "../src/languages/erlang/parser.js";

// -- helpers ----------------------------------------------------------------

function nodeNames(tree) {
	const names = [];
	tree.iterate({
		enter(node) {
			names.push(node.name);
		},
	});
	return names;
}

function count(tree, name) {
	return nodeNames(tree).filter((n) => n === name).length;
}

function errorPositions(tree) {
	const errors = [];
	tree.iterate({
		enter(node) {
			if (node.type.isError) errors.push(node.from);
		},
	});
	return errors;
}

/** Parses `source`, asserting that the tree covers it without error nodes. */
function parseClean(source, label = source) {
	const tree = parser.parse(source);
	assert.equal(tree.length, source.length, `${label}: tree must cover input`);
	assert.deepEqual(errorPositions(tree), [], `${label}: unexpected error nodes`);
	return tree;
}

function formKinds(tree) {
	const kinds = [];
	const cursor = tree.cursor();
	cursor.firstChild();
	do {
		if (cursor.name === "Form") {
			const form = cursor.node.firstChild;
			kinds.push(form.name);
		}
	} while (cursor.nextSibling());
	return kinds;
}

// -- 1. Tree fixtures -------------------------------------------------------

const fixturePath = "src/languages/erlang/test.txt";
const treeTests = fileTests(fs.readFileSync(fixturePath, "utf8"), fixturePath);
for (const test of treeTests) test.run(parser);
console.log(`Validated ${treeTests.length} Erlang parser fixtures.`);

// -- 2. A realistic module --------------------------------------------------

const counterModule = `%%% @doc A tiny counter server.
-module(counter).
-behaviour(gen_server).

-export([start_link/0, increment/1, value/1]).
-export([init/1, handle_call/3, handle_cast/2]).

-define(TIMEOUT, 5000).
-define(LOG(Fmt, Args), io:format("[~p] " ++ Fmt ++ "~n", [?MODULE | Args])).

-record(state, {count = 0 :: non_neg_integer(), name :: atom()}).

-type reply() :: ok | {error, term()}.
-spec increment(pid()) -> reply().
-spec value(pid()) -> non_neg_integer().

start_link() ->
    gen_server:start_link({local, ?MODULE}, ?MODULE, [], []).

increment(Pid) ->
    gen_server:call(Pid, increment, ?TIMEOUT).

value(Pid) -> gen_server:call(Pid, value).

init([]) -> {ok, #state{}}.

handle_call(increment, _From, State = #state{count = N}) when N < 100 ->
    ?LOG("incrementing ~p", [N]),
    {reply, ok, State#state{count = N + 1}};
handle_call(increment, _From, State) ->
    {reply, {error, limit}, State};
handle_call(value, _From, #state{count = N} = State) ->
    {reply, N, State}.

handle_cast(Msg, State) ->
    try process(Msg) of
        {ok, New} -> {noreply, New};
        _ -> {noreply, State}
    catch
        throw:stop -> {stop, normal, State};
        error:Reason:Stack ->
            ?LOG("crashed: ~p ~p", [Reason, Stack]),
            {noreply, State}
    after
        ok
    end.

process(Msg) ->
    F = fun(X) when is_integer(X) -> X + 1;
           (_) -> 0
        end,
    _Bin = <<1:8, "abc"/binary>>,
    _Doubled = [F(X) || X <- [1, 2, 3], X > 1],
    receive
        {done, Ref} when is_reference(Ref) -> Msg
    after 100 -> timeout
    end.
`;

{
	const tree = parseClean(counterModule, "counter module");
	assert.equal(count(tree, "TermForm"), 0, "only attributes and functions");
	assert.deepEqual(
		formKinds(tree),
		[
			...Array(10).fill("Attribute"),
			...Array(7).fill("FunctionDeclaration"),
		],
	);

	// Every function name and its number of clauses.
	const functions = [];
	const cursor = tree.cursor();
	cursor.iterate((node) => {
		if (node.name !== "FunctionDeclaration") return;
		const clauses = node.node.getChildren("FunctionClause");
		const first = clauses[0].firstChild;
		functions.push([
			counterModule.slice(first.from, first.to),
			clauses.length,
		]);
		return false;
	});
	assert.deepEqual(functions, [
		["start_link", 1],
		["increment", 1],
		["value", 1],
		["init", 1],
		["handle_call", 3],
		["handle_cast", 1],
		["process", 1],
	]);
}
console.log("Validated a realistic Erlang module.");

// -- 3. Context-sensitive constructs ----------------------------------------

{
	// `maybe` is a keyword only when it ends its line (maybe_expr feature).
	let tree = parseClean("f() -> {maybe, maybe(1), [maybe]}.\n", "maybe as atom");
	assert.equal(count(tree, "MaybeExpression"), 0);
	assert.equal(count(tree, "Maybe"), 0);
	tree = parseClean("f() ->\n    maybe % comment\n        {ok, A} ?= g(),\n        A\n    end.\n");
	assert.equal(count(tree, "MaybeExpression"), 1);

	// Remote calls: only `atom:name(` is a ModuleName.
	tree = parseClean(
		"f(M, F) -> {lists:map(F, []), M:run(), error:badarg, fun lists:map/2, " +
			"X::integer()}.\n",
	);
	assert.equal(count(tree, "ModuleName"), 1);
	tree = parseClean("-type t() :: {a::integer(), b::atom()}.\n");
	assert.equal(count(tree, "ModuleName"), 0, "`a::integer()` is not remote");

	// A record field access is not the end of the form.
	tree = parseClean("f(S) -> S#state.count + #state.count.\ng() -> #state{}.\n");
	assert.equal(count(tree, "FieldDot"), 2);
	assert.deepEqual(formKinds(tree), ["FunctionDeclaration", "FunctionDeclaration"]);

	// `fun` as a type, a reference, an expression and a named expression.
	tree = parseClean(
		"-spec f(fun((A) -> B)) -> fun().\n" +
			"f(G) -> [fun h/1, fun m:h/1, fun(X) -> G(X) end, fun F(0) -> 1; F(N) -> F(N - 1) end].\n",
	);
	assert.equal(count(tree, "FunType"), 2);
	assert.equal(count(tree, "FunRef"), 2);
	assert.equal(count(tree, "FunExpression"), 2);

	// The old-style `catch` operator, including as a try clause's first expression.
	tree = parseClean(
		"f(X) ->\n" +
			"    Y = (catch g(X)),\n" +
			"    case Y of a -> catch h(); _ -> ok end,\n" +
			"    try g() of\n" +
			"        _ -> catch h()\n" +
			"    catch\n" +
			"        _:_ -> catch k()\n" +
			"    end.\n",
	);
	assert.equal(count(tree, "TryExpression"), 1);
	assert.equal(count(tree, "CaseExpression"), 1);

	// `catch` after an operator or comma is the operator; after an expression
	// it starts the next section of the try.
	tree = parseClean(
		"f() ->\n" +
			"    try X = catch g(), X of\n" +
			"        _ -> Y = catch h(), Y\n" +
			"    catch\n" +
			"        _:_ -> Z = catch k(), Z\n" +
			"    after\n" +
			"        W = catch m()\n" +
			"    end.\n",
	);
	assert.equal(count(tree, "TryExpression"), 1);
	assert.equal(count(tree, "TryClauseList"), 2, "of and catch sections");
	assert.equal(count(tree, "After"), 1);

	// Macros as whole clauses, preprocessor attributes, Latin-1 identifiers.
	tree = parseClean("f(1) -> a;\n?CLAUSE(2).\n");
	assert.equal(count(tree, "MacroCall"), 1);
	assert.deepEqual(formKinds(tree), ["FunctionDeclaration"]);
	tree = parseClean("-if(?OTP_RELEASE >= 25).\nf() -> ok.\n-else.\nf() -> no.\n-endif.\n");
	assert.equal(count(tree, "If"), 1);
	assert.equal(count(tree, "Else"), 1);
	tree = parseClean("f() -> größe.\nÉcrire(X) -> X.\n".replace("Écrire(X) -> X.", "g(Ärger) -> Ärger."));
	assert.equal(count(tree, "Variable"), 2);

	// `.` inside numbers, ranges and ellipses must not end a form.
	tree = parseClean("-type r() :: 1..10 | [integer(), ...].\nf() -> 1.5e3 + 1_000 + 2#101.\n");
	assert.deepEqual(formKinds(tree), ["Attribute", "FunctionDeclaration"]);
}
console.log("Validated context-sensitive Erlang constructs.");

// -- 4. Modern syntax and non-module files ----------------------------------

{
	const tree = parseClean(
		`-moduledoc """
Docs with "quotes", 100% and ~p.
""".
-doc "A function.".
f() -> [~"binary", ~s"str\\n", ~S|raw\\|, ~b(parens), ~"""
        triple
        """].
`,
		"OTP 27 syntax",
	);
	assert.equal(count(tree, "TripleString"), 1);
	assert.equal(count(tree, "Sigil"), 5);

	// rebar.config, sys.config and .app.src files are sequences of terms.
	const terms = parseClean(
		`%% rebar.config
{erl_opts, [debug_info, {d, 'TEST'}]}.
{deps, [{cowboy, "2.10.0"}, {jsx, {git, "https://x.y/jsx", {tag, "v3"}}}]}.
{shell, [{apps, [demo]}]}.
`,
		"term file",
	);
	assert.deepEqual(formKinds(terms), ["TermForm", "TermForm", "TermForm"]);

	// escript files start with a shebang line.
	const escript = parseClean(
		"#!/usr/bin/env escript\n%% -*- erlang -*-\n%%! -smp enable\nmain(Args) -> io:format(\"~p~n\", [Args]).\n",
		"escript",
	);
	assert.equal(count(escript, "Shebang"), 1);
	assert.deepEqual(formKinds(escript), ["FunctionDeclaration"]);
}
console.log("Validated OTP 27 syntax, term files and escripts.");

// -- 5. Robustness on incomplete code ---------------------------------------

// Editors hold half-typed code almost all of the time: every prefix of a real
// module must parse without throwing and must cover the whole input.
for (let end = 0; end <= counterModule.length; end++) {
	const prefix = counterModule.slice(0, end);
	const tree = parser.parse(prefix);
	assert.equal(tree.length, prefix.length, `prefix of ${end} chars`);
}
for (const garbage of [
	"end end end",
	"fun(",
	"case of",
	"<<<<>>",
	"'unterminated",
	'"unterminated',
	"~",
	"#",
	"?",
	"f() -> ); ] }.",
	"try catch after end",
	"\u0000\u0001 \uffff",
]) {
	const tree = parser.parse(garbage);
	assert.equal(tree.length, garbage.length, `garbage ${JSON.stringify(garbage)}`);
}
console.log("Validated parsing of incomplete and invalid code.");

// -- 6. Highlighting --------------------------------------------------------

const highlighter = tagHighlighter([
	{ tag: t.lineComment, class: "comment" },
	{ tag: t.meta, class: "meta" },
	{ tag: t.atom, class: "atom" },
	{ tag: t.bool, class: "bool" },
	{ tag: t.variableName, class: "var" },
	{ tag: t.function(t.variableName), class: "call" },
	{ tag: t.function(t.definition(t.variableName)), class: "fundef" },
	{ tag: t.integer, class: "int" },
	{ tag: t.float, class: "float" },
	{ tag: t.character, class: "char" },
	{ tag: t.string, class: "string" },
	{ tag: t.special(t.string), class: "special" },
	{ tag: t.escape, class: "escape" },
	{ tag: t.macroName, class: "macro" },
	{ tag: t.namespace, class: "module" },
	{ tag: t.typeName, class: "record" },
	{ tag: t.propertyName, class: "field" },
	{ tag: t.controlKeyword, class: "control" },
	{ tag: t.definitionKeyword, class: "fun" },
	{ tag: t.keyword, class: "keyword" },
	{ tag: t.operatorKeyword, class: "wordop" },
	{ tag: t.operator, class: "op" },
	{ tag: t.punctuation, class: "punct" },
]);

function highlightClasses(source) {
	const result = new Array(source.length).fill("");
	const tree = erlangLanguage.parser.parse(source);
	highlightTree(tree, highlighter, (from, to, cls) => {
		for (let i = from; i < to; i++) result[i] = cls;
	});
	return result;
}

function classOf(source, text, nth = 0) {
	let index = -1;
	for (let i = 0; i <= nth; i++) {
		index = source.indexOf(text, index + 1);
		assert(index >= 0, `${JSON.stringify(text)} #${nth} not in source`);
	}
	const cls = highlightClasses(source).slice(index, index + text.length);
	assert(
		cls.every((c) => c === cls[0]),
		`${JSON.stringify(text)} has mixed classes: ${cls.join(",")}`,
	);
	return cls[0];
}

{
	const src = [
		"-module(m).",
		"%% remark",
		"f(X, _Y) when is_atom(X) ->",
		'    lists:map(fun g/1, [?MODULE, "abc~p\\n", $c, 1.5, 16#FF, true, \'q a\', foo]),',
		"    S#state.count, X andalso not Y, begin ok end.",
		"",
	].join("\n");
	const at = (text, nth) => classOf(src, text, nth);

	assert.equal(at("-"), "meta", "attribute dash");
	assert.equal(at("module"), "meta", "attribute name");
	assert.equal(at("%% remark"), "comment");
	assert.equal(at("f", 0), "fundef", "clause head name");
	assert.equal(at("X", 0), "var");
	assert.equal(at("_Y"), "var");
	assert.equal(at("when"), "control");
	assert.equal(at("is_atom"), "call");
	assert.equal(at("lists"), "module");
	assert.equal(at("map"), "call");
	assert.equal(at("fun"), "fun");
	assert.equal(at("g"), "call", "fun reference");
	assert.equal(at("?MODULE"), "macro");
	assert.equal(at("abc"), "string", "string text");
	assert.equal(at("~p"), "special", "format directive");
	assert.equal(at("\\n"), "escape");
	assert.equal(at("$c"), "char");
	assert.equal(at("1.5"), "float");
	assert.equal(at("16#FF"), "int");
	assert.equal(at("true"), "bool");
	assert.equal(at("'q a'"), "atom");
	assert.equal(at("foo"), "atom");
	assert.equal(at("state"), "record");
	assert.equal(at("count"), "field");
	assert.equal(at("andalso"), "wordop");
	assert.equal(at("not"), "wordop");
	assert.equal(at("begin"), "control");
	assert.equal(at("end"), "control");
	assert.equal(at("->"), "op");
}
{
	// Definition styling is limited to the name in a clause head: calls and
	// variables in guards and bodies must keep their own styles.
	const src = [
		"go(N) when is_integer(N) ->",
		"    F = fun(X) -> X + Y end,",
		"    G = fun Loop(0) -> done; Loop(M) -> Loop(M - 1) end,",
		"    helper(F, G).",
		"",
	].join("\n");
	const at = (text, nth) => classOf(src, text, nth);

	assert.equal(at("go"), "fundef");
	assert.equal(at("is_integer"), "call", "call in a guard");
	assert.equal(at("helper"), "call", "call in a body");
	assert.equal(at("X", 0), "var", "fun parameter");
	assert.equal(at("X", 1), "var", "variable in a fun body");
	assert.equal(at("Y"), "var", "variable in a fun body");
	assert.equal(at("Loop", 0), "fundef", "named fun, first clause");
	assert.equal(at("Loop", 1), "fundef", "named fun, repeated clause name");
	assert.equal(at("Loop", 2), "var", "recursive call through the fun name");
	assert.equal(at("F", 1), "var");
}
console.log("Validated Erlang syntax highlighting.");

// -- 7. Editor behavior -----------------------------------------------------

function stateFor(doc) {
	return EditorState.create({
		doc,
		extensions: [erlang(), indentUnit.of("    ")],
	});
}

/** Indentation for a new line typed after `doc`, i.e. right after Enter. */
function indentAfter(doc) {
	const state = stateFor(`${doc}\n`);
	return getIndentation(state, doc.length + 1);
}

{
	const cases = [
		["foo(X) ->", 4, "function body"],
		["foo(X) ->\n    A = 1,", 4, "body continuation"],
		["foo(X) ->\n    ok.", 0, "after the final dot"],
		["foo(0) ->\n    1;", 0, "next clause head"],
		["-module(m).\n-export([a/0]).", 0, "after attributes"],
		["-export([", 4, "inside an attribute list"],
		["foo(X) ->\n    case X of", 8, "after `of`"],
		["foo(X) ->\n    case X of\n        a ->", 12, "case clause body"],
		["foo(X) ->\n    case X of\n        a ->\n            1;", 8, "next case clause"],
		[
			"foo(X) ->\n    case X of\n        a ->\n            1;\n        b ->\n            2",
			12,
			"case clause body continuation",
		],
		["foo(X) ->\n    receive\n        a -> ok\n    after 5 ->", 8, "receive after body"],
		["foo() ->\n    try\n        a()\n    catch\n        error:_ ->", 12, "catch clause body"],
		["foo() ->\n    X = [", 8, "inside a list"],
		["foo() ->\n    X = [\n        1,", 8, "list items"],
		["foo() ->\n    try", 8, "inside try"],
		["foo() ->\n    lists:map(fun(X) ->", 8, "fun body"],
		["foo() ->\n    receive\n        stop ->", 12, "receive clause body"],
	];
	for (const [doc, expected, label] of cases) {
		assert.equal(indentAfter(doc), expected, `indent: ${label}`);
	}

	// `end`, `catch` and `after` line up with the line that opened the block.
	const block =
		"foo() ->\n    try\n        a()\n    catch\n        _:_ -> b\n    after\n        c()\n    end.";
	const state = stateFor(block);
	for (const word of ["    catch", "    after", "    end"]) {
		assert.equal(getIndentation(state, block.indexOf(word)), 4, word.trim());
	}
}
console.log("Validated Erlang indentation.");

{
	const source =
		"foo(X) ->\n    case X of\n        a -> 1;\n        b -> 2\n    end;\nfoo(_) ->\n    ok.\n\n-export([\n    a/0\n]).\n";
	const state = stateFor(source);
	const fold = (line) => {
		const info = state.doc.line(line);
		return foldable(state, info.from, info.to);
	};
	const lineEnd = (line) => state.doc.line(line).to;
	const lineStart = (line) => state.doc.line(line).from;

	// A function folds from its head line to the end of its last clause.
	assert.deepEqual(fold(1), { from: lineEnd(1), to: source.indexOf(".\n\n-export") + 1 });
	// The case block folds up to `end`.
	assert.deepEqual(fold(2), { from: lineEnd(2), to: lineStart(5) + 4 });
	// Later clauses of a function fold on their own.
	assert.equal(fold(6)?.from, lineEnd(6));
	// Bracket groups fold their contents.
	assert.equal(fold(9)?.from, lineEnd(9));
	// Single-line constructs have nothing to fold.
	assert.equal(fold(3), null);
	assert.equal(fold(7), null);
}
console.log("Validated Erlang folding.");

{
	const source = "f(X) ->\n    case X of\n        a -> fun() -> ok end\n    end.\n";
	const state = stateFor(source);
	const pair = (needle) => {
		const from = source.indexOf(needle);
		return matchBrackets(state, from + 1, -1) || matchBrackets(state, from, 1);
	};
	const caseMatch = pair("case");
	assert(caseMatch?.matched, "case should match end");
	assert.equal(source.slice(caseMatch.end.from, caseMatch.end.to), "end");
	assert.equal(caseMatch.end.from, source.lastIndexOf("end"));
	const funMatch = pair("fun");
	assert(funMatch?.matched, "fun should match end");
	assert.equal(funMatch.end.from, source.indexOf("end"));
}
console.log("Validated Erlang keyword bracket matching.");

{
	const state = stateFor("");
	const data = (name) => state.languageDataAt(name, 0)[0];
	assert.equal(data("commentTokens").line, "%");
	assert.deepEqual(data("closeBrackets").brackets, ["(", "[", "{", '"', "'"]);
	assert(data("indentOnInput").test("    end"));
	assert(data("indentOnInput").test("after"));
	assert(!data("indentOnInput").test("endpoint"));
}
console.log("Validated Erlang language data.");

// -- 8. Completion ----------------------------------------------------------

function complete(doc, explicit = false) {
	// `|` marks the cursor.
	const pos = doc.indexOf("|");
	const source = doc.replace("|", "");
	const state = stateFor(source);
	const result = erlangComplete(new CompletionContext(state, pos, explicit));
	return result && { from: result.from, labels: result.options.map((o) => o.label) };
}

{
	let result = complete("-mo|");
	assert.equal(result.from, 1);
	assert(result.labels.includes("module"));
	assert(result.labels.includes("export"));

	result = complete("f() -> lists:fo|");
	assert.equal(result.from, "f() -> lists:".length);
	assert(result.labels.includes("foldl"));
	assert(result.labels.includes("foreach"));
	assert(!result.labels.includes("receive"), "only lists functions after `lists:`");

	assert.equal(complete("f() -> not_a_module:fo|"), null);

	result = complete("f() -> ?MOD|");
	assert.equal(result.from, "f() -> ?".length);
	assert(result.labels.includes("MODULE"));

	result = complete("f() -> rece|");
	assert.equal(result.from, "f() -> ".length);
	assert(result.labels.includes("receive"));
	assert(result.labels.includes("register"), "BIFs are offered");
	assert(result.labels.includes("lists"), "module names are offered");

	assert.equal(complete("f() -> |"), null, "nothing to complete implicitly");
	assert(complete("f() -> |", true).labels.includes("case"));

	assert.equal(complete("%% rece|"), null, "no completion in comments");
	assert.equal(complete('f() -> "rece|"'), null, "no completion in strings");
	assert.equal(complete("f() -> 'rece|'"), null, "no completion in quoted atoms");
}
console.log("Validated Erlang completion.");

// -- 9. Mode descriptor -----------------------------------------------------

{
	assert.equal(erlangMode.name, "erlang");
	assert.equal(erlangMode.caption, "Erlang");
	assert.equal(erlangMode.replaces, true, "Acode ships a legacy erlang mode");
	for (const extension of ["erl", "hrl", "escript", "app.src"]) {
		assert(erlangMode.extensions.includes(extension), extension);
	}
	const support = erlangMode.load();
	assert(support instanceof LanguageSupport);
	assert.equal(support.language.name, "erlang");
	assert.equal(syntaxTree(stateFor("-module(m).")).type.name, "Program");
}
console.log("Validated the Erlang mode descriptor.");
