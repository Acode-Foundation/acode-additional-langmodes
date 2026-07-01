import { completeFromList } from "@codemirror/autocomplete";
import { LanguageSupport, LRLanguage } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import { parser } from "./parser";

const configuredParser = parser.configure({
	props: [
		styleTags({
			Comment: t.lineComment,
			MacroTag: t.definitionKeyword,
			Word: t.propertyName,
			BuiltinAttr: t.keyword,
			BooleanVal: t.bool,
			StringVal: t.string,
			PatternNegation: t.operator,
			RangeNegation: t.operator,
			Wildcard: t.special(t.string),
			EscapedChar: t.escape,
			CharacterClass: t.typeName,
			QuotedPatternElement: t.string,
			QuotedPattern: t.string,
			AttrReset: t.modifier,
			AttrUnset: t.modifier,
			"RangeNotation/\"[\" RangeNotation/\"]\"": t.squareBracket,
			"ValAssign/\"=\"": t.operator,
		}),
	],
});

export const gitattributesLanguage = LRLanguage.define({
	name: "gitattributes",
	parser: configuredParser,
	languageData: {
		commentTokens: {
			line: "#",
		},
	},
});

const gitattributesCompletion = gitattributesLanguage.data.of({
	autocomplete: completeFromList([
		{
			label: "text",
			type: "keyword",
			info: "Enable/disable end-of-line normalization",
		},
		{
			label: "eol",
			type: "keyword",
			info: "Set end-of-line format (lf or crlf)",
		},
		{ label: "binary", type: "keyword", info: "Mark files as binary" },
		{ label: "diff", type: "keyword", info: "Specify diff driver" },
		{ label: "merge", type: "keyword", info: "Specify merge driver" },
		{ label: "filter", type: "keyword", info: "Specify filter driver" },
		{
			label: "working-tree-encoding",
			type: "keyword",
			info: "Specify encoding for working tree files",
		},
		{ label: "ident", type: "keyword", info: "Enable ident substitution" },
		{ label: "whitespace", type: "keyword", info: "Specify whitespace checks" },
		{
			label: "export-ignore",
			type: "keyword",
			info: "Exclude files from git archive",
		},
		{
			label: "export-subst",
			type: "keyword",
			info: "Enable attribute substitution in git archive",
		},
		{ label: "true", type: "keyword" },
		{ label: "false", type: "keyword" },
	]),
});

export function gitattributes() {
	return new LanguageSupport(gitattributesLanguage, [gitattributesCompletion]);
}

export const gitattributesMode = {
	name: "gitattributes",
	caption: "Git Attributes",
	extensions: ["gitattributes"],
	load: gitattributes,
};
