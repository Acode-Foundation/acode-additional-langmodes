import {
	delimitedIndent,
	foldInside,
	foldNodeProp,
	indentNodeProp,
	LanguageSupport,
	LRLanguage,
	syntaxTree,
} from "@codemirror/language";
import { NodeProp } from "@lezer/common";
import { styleTags, tags as t } from "@lezer/highlight";
import {
	attributes,
	bifs,
	booleans,
	keywords,
	moduleFunctions,
	otherModules,
	wordOperators,
} from "./keywords.js";
import { parser } from "./parser.js";

const blockOpeners = [
	"Begin",
	"Case",
	"Fun",
	"If",
	"Maybe",
	"Receive",
	"Try",
];

/** The last child of `node` that is not an error node and starts before `pos`. */
function lastChildBefore(node, pos) {
	let child = node.lastChild;
	while (child && (child.type.isError || child.from >= pos)) {
		child = child.prevSibling;
	}
	return child;
}

/** Nodes that are a single clause: head, `->` and body. */
const clauseNodes = new Set(["Clause", "TryClause", "FunClause", "FunctionClause"]);

/**
 * Indentation for a position that follows the clauses typed so far, which is
 * where the cursor sits while a clause is still being written: the clause
 * node ends before the cursor, so the cursor belongs to the node holding the
 * clauses. After a `;` the next clause head lines up with the previous heads;
 * otherwise the cursor continues the body of the last clause.
 */
function afterClauses(context, node) {
	const last = lastChildBefore(node, context.pos);
	if (!last) return null;
	if (last.name === ";") return context.lineIndent(node.from);
	return context.lineIndent(last.from) + context.unit;
}

/** Indentation inside a function declaration or a list of clauses. */
function clauseSequenceIndent(context) {
	return afterClauses(context, context.node) ?? context.baseIndent + context.unit;
}

/**
 * Indentation for keyword blocks: contents go one unit in, while the closing
 * `end` and the section keywords (`of`, `catch`, `after`, `else`) line up with
 * the line that opened the block.
 */
function blockIndent(context) {
	if (/^\s*(?:end|of|catch|after|else)\b/.test(context.textAfter)) {
		return context.baseIndent;
	}
	const last = lastChildBefore(context.node, context.pos);
	if (last) {
		if (last.name === "ClauseList" || last.name === "TryClauseList") {
			const indent = afterClauses(context, last);
			if (indent != null) return indent;
		} else if (clauseNodes.has(last.name)) {
			// A clause that is not part of a list, e.g. `receive ... after T ->`.
			return context.lineIndent(last.from) + context.unit;
		}
	}
	return context.baseIndent + context.unit;
}

/** Clause bodies are indented one unit from the line the clause starts on. */
function clauseIndent(context) {
	return context.baseIndent + context.unit;
}

/** Folds a keyword block from the end of its first line up to `end`. */
function foldBlock(node, state) {
	const end = node.lastChild;
	if (!end || end.name !== "End") return null;
	const from = state.doc.lineAt(node.from).to;
	return from < end.from ? { from, to: end.from } : null;
}

/** Folds a function: everything after the head line of its first clause. */
function foldFunction(node, state) {
	const from = state.doc.lineAt(node.from).to;
	return from < node.to ? { from, to: node.to } : null;
}

/** Folds the clauses of a multi-clause function individually. */
function foldLaterClause(node, state) {
	if (!node.prevSibling) return null;
	const from = state.doc.lineAt(node.from).to;
	return from < node.to ? { from, to: node.to } : null;
}

const configuredParser = parser.configure({
	props: [
		styleTags({
			LineComment: t.lineComment,
			Shebang: t.meta,
			Atom: t.atom,
			QuotedAtom: t.atom,
			Boolean: t.bool,
			Variable: t.variableName,
			Integer: t.integer,
			Float: t.float,
			Char: t.character,
			String: t.string,
			TripleString: t.string,
			Sigil: t.special(t.string),
			Escape: t.escape,
			FormatDirective: t.special(t.string),
			Macro: t.macroName,
			CallName: t.function(t.variableName),
			"FunctionName/CallName": t.function(t.definition(t.variableName)),
			ModuleName: t.namespace,
			"FunRef/Atom FunRef/QuotedAtom": t.function(t.variableName),
			"FunName/Variable": t.function(t.definition(t.variableName)),
			"AttributeName/Atom AttributeName/CallName AttributeName/If AttributeName/Else":
				t.meta,
			"RecordName/Atom RecordName/QuotedAtom": t.typeName,
			"RecordField/Atom RecordField/QuotedAtom": t.propertyName,
			"After Begin Case Catch Else End If Maybe Of Receive Try When":
				t.controlKeyword,
			Fun: t.definitionKeyword,
			Reserved: t.keyword,
			WordOperator: t.operatorKeyword,
			"Operator/... ->": t.operator,
			'Attribute/"-"': t.meta,
			"Punctuation EndDot FieldDot ;": t.punctuation,
			"( )": t.paren,
			"[ ]": t.squareBracket,
			"{ }": t.brace,
			"<< >>": t.special(t.brace),
		}),
		indentNodeProp.add({
			Parenthesized: delimitedIndent({ closing: ")" }),
			Bracketed: delimitedIndent({ closing: "]" }),
			Braced: delimitedIndent({ closing: "}" }),
			Binary: delimitedIndent({ closing: ">>" }),
			Program: () => 0,
			Attribute: clauseIndent,
			FunctionClause: clauseIndent,
			FunctionDeclaration: clauseSequenceIndent,
			Clause: clauseIndent,
			TryClause: clauseIndent,
			FunClause: clauseIndent,
			ClauseList: clauseSequenceIndent,
			TryClauseList: clauseSequenceIndent,
			CaseExpression: blockIndent,
			IfExpression: blockIndent,
			ReceiveExpression: blockIndent,
			TryExpression: blockIndent,
			BeginExpression: blockIndent,
			MaybeExpression: blockIndent,
			FunExpression: blockIndent,
		}),
		foldNodeProp.add({
			Parenthesized: foldInside,
			Bracketed: foldInside,
			Braced: foldInside,
			Binary: foldInside,
			CaseExpression: foldBlock,
			IfExpression: foldBlock,
			ReceiveExpression: foldBlock,
			TryExpression: foldBlock,
			BeginExpression: foldBlock,
			MaybeExpression: foldBlock,
			FunExpression: foldBlock,
			FunctionClause: foldLaterClause,
			FunctionDeclaration: foldFunction,
			Attribute: foldFunction,
		}),
		// Lets bracket matching pair `case`/`if`/`fun`/... with their `end`.
		NodeProp.closedBy.add(
			Object.fromEntries(blockOpeners.map((name) => [name, ["End"]])),
		),
		NodeProp.openedBy.add({ End: blockOpeners }),
	],
});

export const erlangLanguage = LRLanguage.define({
	name: "erlang",
	parser: configuredParser,
	languageData: {
		commentTokens: { line: "%" },
		closeBrackets: { brackets: ["(", "[", "{", '"', "'"] },
		indentOnInput: /^\s*(?:end|of|catch|after|else|\)|\]|\}|>>)$/,
	},
});

const predefinedMacros = [
	"FILE",
	"FUNCTION_ARITY",
	"FUNCTION_NAME",
	"LINE",
	"MACHINE",
	"MODULE",
	"MODULE_STRING",
	"OTP_RELEASE",
];

const moduleNames = [...Object.keys(moduleFunctions), ...otherModules].sort();

const wordOptions = [
	...keywords.map((label) => ({ label, type: "keyword" })),
	...wordOperators.map((label) => ({ label, type: "keyword" })),
	...booleans.map((label) => ({ label, type: "constant" })),
	...bifs.map((label) => ({ label, type: "function", boost: 1 })),
	...moduleNames.map((label) => ({
		label,
		type: "namespace",
		apply: `${label}:`,
	})),
];

const attributeOptions = attributes.map((label) => ({
	label,
	type: "keyword",
}));

const macroOptions = predefinedMacros.map((label) => ({
	label,
	type: "constant",
}));

const moduleFunctionOptions = Object.fromEntries(
	Object.entries(moduleFunctions).map(([name, functions]) => [
		name,
		functions.map((label) => ({ label, type: "function" })),
	]),
);

/** True where completion would only get in the way of prose or literals. */
function inLiteral(state, pos) {
	const name = syntaxTree(state).resolveInner(pos, -1).name;
	return (
		name === "LineComment" ||
		name === "String" ||
		name === "TripleString" ||
		name === "Sigil" ||
		name === "QuotedAtom" ||
		name === "Char" ||
		name === "Escape" ||
		name === "FormatDirective"
	);
}

export function erlangComplete(context) {
	if (inLiteral(context.state, context.pos)) return null;

	const remote = context.matchBefore(/[a-z][a-zA-Z0-9_@]*:\w*$/);
	if (remote) {
		const module = remote.text.slice(0, remote.text.indexOf(":"));
		const options = moduleFunctionOptions[module];
		if (!options) return null;
		return {
			from: remote.from + module.length + 1,
			options,
			validFor: /^\w*$/,
		};
	}

	const macro = context.matchBefore(/\?\w*$/);
	if (macro) {
		return { from: macro.from + 1, options: macroOptions, validFor: /^\w*$/ };
	}

	const attribute = context.matchBefore(/^-[a-z_]*$/m);
	if (attribute) {
		return {
			from: attribute.from + 1,
			options: attributeOptions,
			validFor: /^[a-z_]*$/,
		};
	}

	const word = context.matchBefore(/[a-z][a-zA-Z0-9_@]*$/);
	if (!word && !context.explicit) return null;
	return {
		from: word ? word.from : context.pos,
		options: wordOptions,
		validFor: /^[a-zA-Z0-9_@]*$/,
	};
}

const erlangCompletion = erlangLanguage.data.of({
	autocomplete: erlangComplete,
});

export function erlang() {
	return new LanguageSupport(erlangLanguage, [erlangCompletion]);
}

// Acode ships a legacy stream mode for `erl`; `replaces` registers this one as
// "erlang-enhanced" next to it and promotes it to the canonical name once
// Acode drops the legacy mode. It lists a superset of the legacy extensions so
// modelist's tie-break (later registration wins) picks it for Erlang files.
export const erlangMode = {
	name: "erlang",
	caption: "Erlang",
	replaces: true,
	extensions: ["erl", "hrl", "escript", "app.src"],
	load: erlang,
};
