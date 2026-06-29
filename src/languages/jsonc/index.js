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
			True: t.bool,
			False: t.bool,
			Null: t.null,
			Number: t.number,
			String: t.string,
			PropertyName: t.propertyName,
			LineComment: t.lineComment,
			BlockComment: t.blockComment,
			"Object/\"{\" Object/\"}\"": t.brace,
			"Array/\"[\" Array/\"]\"": t.squareBracket,
			"\",\" \":\"": t.punctuation,
		}),
		indentNodeProp.add({
			Object: delimitedIndent({ closing: "}" }),
			Array: delimitedIndent({ closing: "]" }),
		}),
		foldNodeProp.add({
			Object: foldInside,
			Array: foldInside,
		}),
	],
});

export const jsoncLanguage = LRLanguage.define({
	name: "jsonc",
	parser: configuredParser,
	languageData: {
		commentTokens: {
			line: "//",
			block: { open: "/*", close: "*/" },
		},
		closeBrackets: { brackets: ["{", "[", '"'] },
		indentOnInput: /^\s*[\}\]]$/,
	},
});

const jsoncCompletion = jsoncLanguage.data.of({
	autocomplete: completeFromList([
		{ label: "true", type: "keyword" },
		{ label: "false", type: "keyword" },
		{ label: "null", type: "keyword" },
	]),
});

export function jsonc() {
	return new LanguageSupport(jsoncLanguage, [jsoncCompletion]);
}

export const jsoncMode = {
	name: "jsonc",
	caption: "JSONC",
	extensions: ["jsonc"],
	load: jsonc,
};
