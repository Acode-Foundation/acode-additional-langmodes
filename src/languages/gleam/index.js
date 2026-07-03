import { completeFromList } from "@codemirror/autocomplete";
import {
	delimitedIndent,
	foldInside,
	foldNodeProp,
	indentNodeProp,
	LanguageSupport,
	LRLanguage,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import { parser } from "./parser";

const configuredParser = parser.configure({
	props: [
		styleTags({
			ModuleComment: t.docComment,
			DocComment: t.docComment,
			LineComment: t.lineComment,
			String: t.string,
			Float: t.number,
			Integer: t.number,
			Discard: t.comment,
			"FunctionDefinition/Identifier": t.function(t.definition(t.variableName)),
			"FunctionCall/Identifier": t.function(t.variableName),
			TypeName: t.typeName,
			ModulePath: t.namespace,
			Identifier: t.variableName,
			"True False": t.bool,
			Nil: t.null,
			"As Assert Case Else If Import Let Pub Type Use Const Opaque": t.keyword,
			Fn: t.definitionKeyword,
			"Panic Todo Echo": t.controlKeyword,
			Operator: t.operator,
			Attribute: t.meta,
			"( )": t.paren,
			"[ ]": t.squareBracket,
			"{ }": t.brace,
			"<< >>": t.special(t.brace),
			Punctuation: t.punctuation,
		}),
		indentNodeProp.add({
			Block: delimitedIndent({ closing: "}" }),
			Bracketed: delimitedIndent({ closing: "]" }),
			Parenthesized: delimitedIndent({ closing: ")" }),
			BitArray: delimitedIndent({ closing: ">>" }),
		}),
		foldNodeProp.add({
			Block: foldInside,
			Bracketed: foldInside,
			Parenthesized: foldInside,
			BitArray: foldInside,
		}),
	],
});

export const gleamLanguage = LRLanguage.define({
	name: "gleam",
	parser: configuredParser,
	languageData: {
		commentTokens: { line: "//" },
		closeBrackets: { brackets: ["(", "[", "{", '"', "<<"] },
		indentOnInput: /^\s*}$/,
	},
});

const keywords = [
	"as", "assert", "case", "const", "echo", "else", "fn", "if", "import",
	"let", "opaque", "panic", "pub", "todo", "type", "use",
];

const builtinTypes = [
	"Int", "Float", "String", "Bool", "Nil", "UtfCodepoint", "BitArray", "Result", "List",
];

const gleamCompletion = gleamLanguage.data.of({
	autocomplete: completeFromList([
		...keywords.map((label) => ({ label, type: "keyword" })),
		...builtinTypes.map((label) => ({ label, type: "type" })),
		{ label: "True", type: "constant" },
		{ label: "False", type: "constant" },
		{ label: "Nil", type: "constant" },
	]),
});

export function gleam() {
	return new LanguageSupport(gleamLanguage, [gleamCompletion]);
}

export const gleamMode = {
	name: "gleam",
	caption: "Gleam",
	extensions: ["gleam"],
	load: gleam,
};
