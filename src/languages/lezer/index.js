import { snippetCompletion } from "@codemirror/autocomplete";
import {
	delimitedIndent,
	foldInside,
	foldNodeProp,
	indentNodeProp,
	LanguageSupport,
	LRLanguage,
	syntaxTree,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import {
	associativity,
	charClasses,
	expressionDirectives,
	externalTokenDirectives,
	localTokenDirectives,
	ruleProps,
	skipScopeDirectives,
	tokenDirectives,
	topLevelDirectives,
} from "./keywords";
import { parser } from "./parser";

// Owned Lezer grammar (.grammar) CodeMirror language package.
//
// The parser follows the syntax accepted by @lezer/generator and the upstream
// lezer-grammar package, adding escape highlighting and a distinction between
// node (capitalized) and hidden (lowercase) rule names:
// https://lezer.codemirror.net/docs/guide/
// https://code.haverbeke.berlin/lezer/lezer-grammar
const definitionParents = [
	"RuleDeclaration",
	"TokenDeclaration",
	"InlineRule",
	"ExternalToken",
	"ElseToken",
];
const definitionSelector = (kind) =>
	definitionParents.map((parent) => `${parent}/RuleName/${kind}`).join(" ");

const configuredParser = parser.configure({
	props: [
		styleTags({
			LineComment: t.lineComment,
			BlockComment: t.blockComment,
			// Delimiter tokens are tagged directly: untagged children of a
			// highlighted node would otherwise lose the parent's style.
			[`Literal Literal/"\\"" Literal/"'"`]: t.string,
			Escape: t.escape,
			'CharSet InvertedCharSet CharSet/"$[" InvertedCharSet/"![" CharSet/"]" InvertedCharSet/"]"':
				t.regexp,
			"@asciiLetter @asciiLowercase @asciiUppercase @digit @whitespace @eof AnyChar":
				t.atom,

			"@top @tokens @local @external @precedence @skip @context @dialects @detectDelim":
				t.definitionKeyword,
			"@conflict @else": t.keyword,
			"@left @right @cut": t.modifier,
			"@specialize @extend": t.operatorKeyword,
			"tokens from as prop propSource extend specialize": t.keyword,

			"RuleName/NodeName": t.typeName,
			"RuleName/HiddenName": t.variableName,
			[definitionSelector("NodeName")]: t.definition(t.typeName),
			[definitionSelector("HiddenName")]: t.definition(t.variableName),
			"Call/RuleName/NodeName Call/RuleName/HiddenName": t.function(t.variableName),
			"ParamName/NodeName ParamName/HiddenName": t.local(t.variableName),
			"PrecedenceName/NodeName PrecedenceName/HiddenName": t.labelName,
			"Precedence/PrecedenceName/NodeName Precedence/PrecedenceName/HiddenName":
				t.definition(t.labelName),
			"Name/NodeName Name/HiddenName": t.name,
			"AmbiguityMarker/Name/NodeName AmbiguityMarker/Name/HiddenName": t.labelName,

			"AtName PropName/NodeName PropName/HiddenName": t.attributeName,
			"PropValue/NodeName PropValue/HiddenName": t.attributeValue,

			'PrecedenceMarker/"!" AmbiguityMarker/"~"': t.modifier,
			'"*" "+" "?" "|"': t.operator,
			"=": t.definitionOperator,
			".": t.derefOperator,
			",": t.separator,
			"( )": t.paren,
			'Props/"[" Props/"]"': t.squareBracket,
			"{ }": t.brace,
			"< >": t.angleBracket,
		}),
		indentNodeProp.add({
			"Body TokensBody PrecedenceBody ConflictBody DialectsBody SkipBody PropEscape":
				delimitedIndent({ closing: "}" }),
			ParenExpression: delimitedIndent({ closing: ")" }),
			"ArgList ParamList": delimitedIndent({ closing: ">" }),
			Props: delimitedIndent({ closing: "]" }),
		}),
		foldNodeProp.add({
			"Body TokensBody PrecedenceBody ConflictBody DialectsBody SkipBody ParenExpression ArgList":
				foldInside,
			BlockComment: (node) =>
				node.to - node.from > 4 ? { from: node.from + 2, to: node.to - 2 } : null,
		}),
	],
});

export const lezerLanguage = LRLanguage.define({
	name: "lezer",
	parser: configuredParser,
	languageData: {
		commentTokens: {
			line: "//",
			block: { open: "/*", close: "*/" },
		},
		closeBrackets: { brackets: ["(", "[", "{", "'", '"'] },
		indentOnInput: /^\s*(?:\}|\)|\]|>)$/,
		wordChars: "-",
	},
});

const toSnippets = (items, type) =>
	items.map((item) =>
		item.apply
			? snippetCompletion(item.apply, {
					label: item.label,
					detail: item.detail,
					type,
				})
			: { label: item.label, detail: item.detail, type },
	);

const topLevelOptions = toSnippets(topLevelDirectives, "keyword");
const tokenOptions = toSnippets(tokenDirectives, "keyword");
const localTokenOptions = toSnippets(localTokenDirectives, "keyword");
const externalTokenOptions = toSnippets(externalTokenDirectives, "keyword");
const skipScopeOptions = toSnippets(skipScopeDirectives, "keyword");
const propOptions = toSnippets(ruleProps, "property");
const expressionOptions = [
	...toSnippets(expressionDirectives, "function"),
	...charClasses.map((label) => ({ label, type: "constant", detail: "char class" })),
];
const associativityOptions = associativity.map((label) => ({
	label,
	type: "keyword",
	detail: "associativity",
}));

const ruleDefinitionNodes = new Set([
	"RuleDeclaration",
	"TokenDeclaration",
	"ExternalToken",
	"ElseToken",
]);

function collectNames(state) {
	const rules = new Map();
	const precedences = new Set();
	const ambiguities = new Set();
	const doc = state.doc;
	syntaxTree(state).iterate({
		enter(node) {
			if (ruleDefinitionNodes.has(node.name)) {
				const nameNode = node.node.getChild("RuleName");
				if (!nameNode) return;
				const label = doc.sliceString(nameNode.from, nameNode.to);
				if (rules.has(label)) return;
				const isToken =
					node.name !== "RuleDeclaration" || node.node.parent?.name === "TokensBody";
				rules.set(label, {
					label,
					type: nameNode.firstChild?.name === "NodeName" ? "type" : "variable",
					detail: node.node.getChild("ParamList")
						? "template"
						: isToken
							? "token"
							: "rule",
				});
			} else if (node.name === "Precedence") {
				const nameNode = node.node.getChild("PrecedenceName");
				if (nameNode) precedences.add(doc.sliceString(nameNode.from, nameNode.to));
			} else if (node.name === "AmbiguityMarker") {
				const nameNode = node.node.getChild("Name");
				if (nameNode) ambiguities.add(doc.sliceString(nameNode.from, nameNode.to));
			}
		},
	});
	return { rules: [...rules.values()], precedences, ambiguities };
}

function enclosingParams(node, doc) {
	for (let cur = node; cur; cur = cur.parent) {
		if (cur.name === "RuleDeclaration" || cur.name === "TokenDeclaration") {
			const params = cur.getChild("ParamList");
			if (!params) return [];
			return params
				.getChildren("ParamName")
				.map((param) => doc.sliceString(param.from, param.to));
		}
	}
	return [];
}

/** Finds the innermost structural context around the cursor. */
function completionScope(node) {
	for (let cur = node; cur; cur = cur.parent) {
		switch (cur.name) {
			case "Props":
				return "props";
			case "PrecedenceDeclaration":
				return "precedence";
			case "PrecedenceBody":
			case "ConflictBody":
				// Token precedence/conflict lists reference existing tokens.
				return cur.parent?.name === "PrecedenceDeclaration" ? "precedence" : "names";
			case "Body":
			case "ArgList":
				return "expression";
			case "TokensBody": {
				const owner = cur.parent?.name;
				if (owner === "LocalTokensDeclaration") return "localTokens";
				if (owner === "TokensDeclaration") return "tokens";
				return "externalTokens";
			}
			case "SkipBody":
				return "skipScope";
			case "Grammar":
				return "top";
		}
	}
	return "top";
}

const atOptionsByScope = {
	top: topLevelOptions,
	skipScope: skipScopeOptions,
	tokens: tokenOptions,
	localTokens: localTokenOptions,
	externalTokens: externalTokenOptions,
	expression: expressionOptions,
	names: [],
	precedence: associativityOptions,
	props: propOptions.filter((option) => option.label.startsWith("@")),
};

function lezerCompletionSource(context) {
	const { state, pos } = context;
	const word = context.matchBefore(/@?[\p{L}\p{N}_-]*/u);
	if (!word) return null;
	if (word.from === word.to && !context.explicit) return null;

	const tree = syntaxTree(state);
	const inner = tree.resolveInner(pos, -1);
	if (
		["LineComment", "BlockComment", "Literal", "CharSet", "InvertedCharSet"].includes(
			inner.name,
		) ||
		inner.parent?.name === "Literal"
	) {
		return null;
	}

	const scope = completionScope(inner);
	const validFor = /^@?[\p{L}\p{N}_-]*$/u;

	if (word.text.startsWith("@")) {
		const options = atOptionsByScope[scope];
		return options.length ? { from: word.from, options, validFor } : null;
	}

	const before = state.sliceDoc(Math.max(0, word.from - 1), word.from);
	const { rules, precedences, ambiguities } = collectNames(state);

	if (before === "!") {
		return {
			from: word.from,
			options: [...precedences].map((label) => ({
				label,
				type: "constant",
				detail: "precedence",
			})),
			validFor,
		};
	}
	if (before === "~") {
		return {
			from: word.from,
			options: [...ambiguities].map((label) => ({
				label,
				type: "constant",
				detail: "ambiguity",
			})),
			validFor,
		};
	}

	if (scope === "props") return { from: word.from, options: propOptions, validFor };
	if (scope !== "expression" && scope !== "names") return null;

	const params = enclosingParams(inner, state.doc).map((label) => ({
		label,
		type: "variable",
		detail: "parameter",
		boost: 1,
	}));
	return {
		from: word.from,
		options: [...params, ...rules],
		validFor,
	};
}

const lezerCompletion = lezerLanguage.data.of({
	autocomplete: lezerCompletionSource,
});

export function lezer() {
	return new LanguageSupport(lezerLanguage, [lezerCompletion]);
}

export const lezerMode = {
	name: "lezer",
	caption: "Lezer Grammar",
	extensions: ["grammar"],
	load: lezer,
};
