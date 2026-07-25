import { completeFromList } from "@codemirror/autocomplete";
import {
	continuedIndent,
	foldInside,
	foldNodeProp,
	indentNodeProp,
	indentService,
	LanguageSupport,
	LRLanguage,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import {
	assignOperators,
	automaticVariables,
	builtinVariables,
	directives,
	functions,
	specialTargets,
} from "./keywords";
import { parser } from "./parser";

const configuredParser = parser.configure({
	props: [
		styleTags({
			// Comments — comment.line.number-sign.makefile
			"Comment CommentInline CommentLine": t.lineComment,

			// Directives — keyword.control.*.makefile
			"IncludeKw VpathKw ExportKw UnexportKw UndefineKw OverrideKw PrivateKw DefineKw EndefKw":
				t.definitionKeyword,
			"IfeqKw IfneqKw IfdefKw IfndefKw ElseKw EndifKw": t.controlKeyword,

			// Targets — entity.name.function.target / support.function.target
			"SpecialTarget Name/SpecialTarget TargetPart/SpecialTarget": t.standard(
				t.definition(t.function(t.variableName)),
			),
			"TargetPart/Name/Identifier TargetPart/Identifier TargetPart/Word": t.function(
				t.definition(t.variableName),
			),
			"PrereqPart/Name/Identifier PrereqPart/Identifier PrereqPart/Word":
				t.labelName,
			Identifier: t.variableName,
			PatternWildcard: t.special(t.string),

			// Assignments — variable.other + punctuation.separator.key-value
			"VariableAssignment/Name/Identifier DefineDirective/Name/Identifier PrivateDirective/Name/Identifier ExportDirective/Name/Identifier OverrideDirective/Name/Identifier":
				t.definition(t.variableName),
			AssignOp: t.operator,
			ColonSep: t.punctuation,
			OrderOnlySep: t.punctuation,
			CommaSep: t.separator,

			// Options, Paths, Values & Strings
			Word: t.modifier,
			PathChar: t.atom,
			ValueText: t.content,
			RecipeText: t.content,
			"RecipePart/Word RecipePart/Name/Identifier": t.keyword,
			QuotedString: t.string,
			Escape: t.escape,
			LineContinue: t.escape,

			// Expansions — string.interpolated / variable.language / support.function
			"SimpleVariable NamedVarRef BuiltinVariable BuiltinVarRef": t.special(
				t.variableName,
			),
			"AutomaticVariable AutoVar AutoVarParen AutoVarBrace": t.standard(
				t.special(t.variableName),
			),
			"FunctionName FunctionCall/FunctionName": t.standard(t.function(t.variableName)),
			"DollarOpenParen DollarOpenBrace DollarCloseParen DollarCloseBrace":
				t.paren,

			// Recipe — meta.scope.recipe (flags baked into RecipeStart)
			RecipeStart: t.meta,
		}),
		indentNodeProp.add({
			DefineDirective: continuedIndent({ except: /^\s*endef\b/ }),
			Conditional: continuedIndent({ except: /^\s*(else|endif)\b/ }),
			FunctionCall: continuedIndent({ except: /^\s*\)/ }),
			SubstitutionRef: continuedIndent({ except: /^\s*\)/ }),
		}),
		foldNodeProp.add({
			DefineDirective: foldInside,
			// foldInside uses firstChild.to, which can sit past the header line's
			// end (after the newline). syntaxFolding requires from <= lineEnd.
			Conditional(node, state) {
				const line = state.doc.lineAt(node.from);
				if (line.to >= node.to) return null;
				return { from: line.to, to: node.to };
			},
		}),
	],
});

export const makefileLanguage = LRLanguage.define({
	name: "makefile",
	parser: configuredParser,
	languageData: {
		commentTokens: { line: "#" },
		closeBrackets: { brackets: ["(", "{", '"', "'"] },
		indentOnInput: /^\s*(else\b|endif\b|endef\b|\))/,
		wordChars: "-_.@%",
	},
});

const makefileCompletion = makefileLanguage.data.of({
	autocomplete: completeFromList([
		...directives.map((label) => ({
			label,
			type: "keyword",
			boost: 2,
		})),
		...functions.map((label) => ({
			label,
			type: "function",
			detail: "function",
			boost: 1,
		})),
		...functions.map((label) => ({
			label: `$(${label} )`,
			type: "function",
			detail: "function call",
			apply: `$(${label} )`,
		})),
		...specialTargets.map((label) => ({
			label,
			type: "class",
			detail: "special target",
		})),
		...builtinVariables.map((label) => ({
			label,
			type: "variable",
			detail: "builtin",
		})),
		...builtinVariables.map((label) => ({
			label: `$(${label})`,
			type: "variable",
			detail: "builtin ref",
		})),
		...automaticVariables.map((label) => ({
			label,
			type: "variable",
			detail: "automatic",
		})),
		...assignOperators.map((label) => ({
			label,
			type: "operator",
		})),
		{
			label: "ifeq",
			type: "keyword",
			detail: "conditional",
			apply: "ifeq ($(var),value)\n\nendif",
		},
		{
			label: "ifneq",
			type: "keyword",
			detail: "conditional",
			apply: "ifneq ($(var),value)\n\nendif",
		},
		{
			label: "ifdef",
			type: "keyword",
			detail: "conditional",
			apply: "ifdef var\n\nendif",
		},
		{
			label: "ifndef",
			type: "keyword",
			detail: "conditional",
			apply: "ifndef var\n\nendif",
		},
		{
			label: "define",
			type: "keyword",
			detail: "multi-line variable",
			apply: "define name\n\nendef",
		},
		{
			label: ".PHONY",
			type: "class",
			detail: "special target",
			apply: ".PHONY: ",
		},
	]),
});

function previousNonEmptyLine(doc, lineNumber) {
	for (let n = lineNumber - 1; n > 0; n--) {
		const line = doc.line(n);
		if (line.text.trim()) return line;
	}
	return null;
}

function isRuleHeader(text) {
	if (/^\t/.test(text)) return false;
	const trimmed = text.trim();
	if (!trimmed || trimmed.startsWith("#")) return false;
	if (
		/^(ifeq|ifneq|ifdef|ifndef|else|endif|define|endef|include|sinclude|-include|export|unexport|override|private|undefine|vpath)\b/.test(
			trimmed,
		)
	) {
		return false;
	}
	if (/^[^\s#:=]+[ \t]*[!+:?]?=/.test(trimmed)) return false;
	if (/:[ \t]*[^\s#:=]+[ \t]*[!+:?]?=/.test(trimmed)) return false;
	return /:[^=]/.test(trimmed) || /:$/.test(trimmed);
}

function isConditionalOpen(text) {
	return /^\s*(ifeq|ifneq|ifdef|ifndef)\b/.test(text);
}

function isConditionalMiddle(text) {
	return /^\s*else\b/.test(text);
}

function isConditionalClose(text) {
	return /^\s*endif\b/.test(text);
}

function isDefineOpen(text) {
	return /^\s*(override|export|private\s+)*define\b/.test(text);
}

function isDefineClose(text) {
	return /^\s*endef\b/.test(text);
}

function blockIndentBefore(doc, uptoLineNumber, unit) {
	let indent = 0;
	for (let n = 1; n < uptoLineNumber; n++) {
		const text = doc.line(n).text;
		const trimmed = text.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		if (isConditionalClose(trimmed) || isDefineClose(trimmed)) {
			indent = Math.max(0, indent - unit);
		} else if (isConditionalMiddle(trimmed)) {
			indent = Math.max(0, indent - unit);
		}

		if (
			isConditionalOpen(trimmed) ||
			isConditionalMiddle(trimmed) ||
			isDefineOpen(trimmed)
		) {
			indent += unit;
		}
	}
	return indent;
}

function makefileIndent(context, pos) {
	const doc = context.state.doc;
	const line = doc.lineAt(pos);
	const textAfter = line.text.slice(Math.max(0, pos - line.from));
	const trimmed = textAfter.trim();
	let indent = blockIndentBefore(doc, line.number, context.unit);

	if (
		isConditionalClose(trimmed) ||
		isConditionalMiddle(trimmed) ||
		isDefineClose(trimmed)
	) {
		indent = Math.max(0, indent - context.unit);
	}

	const previous = previousNonEmptyLine(doc, line.number);
	if (previous && isRuleHeader(previous.text) && !trimmed) {
		return indent + context.unit;
	}
	if (previous && /\\[ \t]*$/.test(previous.text)) {
		return indent + context.unit;
	}

	return indent;
}

const makefileIndentation = indentService.of(makefileIndent);

export function makefile() {
	return new LanguageSupport(makefileLanguage, [
		makefileCompletion,
		makefileIndentation,
	]);
}

export const makefileMode = {
	name: "makefile",
	caption: "Makefile",
	extensions: [
		"mk",
		"mak",
		"make",
		"Makefile",
		"makefile",
		"GNUmakefile",
		"Gnumakefile",
	],
	load: makefile,
};
