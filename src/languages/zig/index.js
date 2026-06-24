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
import { builtins, builtinTypes, keywords } from "./keywords";

// Owned Zig CodeMirror language package.
//
// Parser/token coverage follows the CodeMirror language package pattern and is
// based on the current upstream Zig grammar plus official VS Code TextMate
// syntax scopes:
// https://codemirror.net/examples/lang-package/
// https://github.com/tree-sitter-grammars/tree-sitter-zig/blob/master/grammar.js
// https://codeberg.org/ziglang/vscode-zig/src/branch/main/syntaxes/zig.tmLanguage.json
const configuredParser = parser.configure({
	props: [
		styleTags({
			"ContainerDocComment DocComment": t.docComment,
			LineComment: t.lineComment,
			LineString: t.special(t.string),
			String: t.string,
			Char: t.character,
			Number: t.number,
			Builtin: t.standard(t.function(t.variableName)),
			"FunctionDeclaration/Identifier": t.function(t.definition(t.variableName)),
			"Label/Identifier": t.labelName,
			Identifier: t.variableName,
			BuiltinTypeName: t.standard(t.typeName),
			"trueKw falseKw": t.bool,
			"nullKw undefinedKw unreachableKw": t.null,
			"fnKw constKw varKw pubKw exportKw externKw threadlocalKw inlineKw noaliasKw": t.definitionKeyword,
			"structKw enumKw unionKw opaqueKw errorKw packedKw anytypeKw anyframeKw": t.keyword,
			"ifKw elseKw forKw whileKw switchKw breakKw continueKw returnKw tryKw catchKw orelseKw resumeKw suspendKw awaitKw asyncKw deferKw errdeferKw nosuspendKw": t.controlKeyword,
			"andKw orKw": t.logicOperator,
			OperatorToken: t.operator,
			"( )": t.paren,
			"[ ]": t.squareBracket,
			"{ }": t.brace,
			PunctuationToken: t.punctuation,
		}),
		indentNodeProp.add({
			Block: delimitedIndent({ closing: "}" }),
			Bracketed: delimitedIndent({ closing: "]" }),
			Parenthesized: delimitedIndent({ closing: ")" }),
		}),
		foldNodeProp.add({
			Block: foldInside,
			Bracketed: foldInside,
			Parenthesized: foldInside,
		}),
	],
});

export const zigLanguage = LRLanguage.define({
	name: "zig",
	parser: configuredParser,
	languageData: {
		commentTokens: { line: "//" },
		closeBrackets: { brackets: ["(", "[", "{", "'", '"'] },
		indentOnInput: /^\s*}$/,
	},
});

const zigCompletion = zigLanguage.data.of({
	autocomplete: completeFromList([
		...[...keywords].map((label) => ({ label, type: "keyword" })),
		...[...builtinTypes].map((label) => ({ label, type: "type" })),
		...[...builtins].map((label) => ({ label: `@${label}`, type: "function" })),
	]),
});

export function zig() {
	return new LanguageSupport(zigLanguage, [zigCompletion]);
}

export const zigMode = {
	name: "zig",
	caption: "Zig",
	extensions: ["zig", "zon"],
	load: zig,
};
