import { completeFromList } from "@codemirror/autocomplete";
import {
	foldInside,
	foldNodeProp,
	LanguageSupport,
	LRLanguage,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import { parser } from "./parser";

// AsciiDoc CodeMirror language package.
//
// Parser/token coverage follows CodeMirror's Lezer language package pattern
// and adapts the block/inline structure from Ace and tree-sitter-asciidoc:
// https://github.com/ajaxorg/ace/blob/master/src/mode/asciidoc_highlight_rules.js
// https://github.com/cathaysia/tree-sitter-asciidoc/blob/master/tree-sitter-asciidoc/grammar.js
// https://github.com/cathaysia/tree-sitter-asciidoc/blob/master/tree-sitter-asciidoc_inline/grammar.js

const admonitions = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"];

const macroNames = [
	"kbd",
	"btn",
	"image",
	"audio",
	"video",
	"icon",
	"link",
	"mailto",
	"menu",
	"anchor",
	"xref",
	"ifdef",
	"ifndef",
	"ifeval",
	"endif",
	"indexterm",
	"indexterm2",
	"footnote",
	"footnoteref",
	"stem",
	"latexmath",
	"asciimath",
	"pass",
	"a2s",
	"barcode",
	"blockdiag",
	"bpmn",
	"bytefield",
	"d2",
	"dbml",
	"diagrams",
	"ditaa",
	"dpic",
	"erd",
	"gnuplot",
	"graphviz",
	"lilypond",
	"meme",
	"mermaid",
	"msc",
	"nomnoml",
	"pikchr",
	"plantuml",
	"shaape",
	"smcat",
	"structurizr",
	"svgbob",
	"symbolator",
	"syntrax",
	"tikz",
	"umlet",
	"vega",
	"wavedrom",
];

const intrinsicAttributes = [
	"startsb",
	"endsb",
	"vbar",
	"caret",
	"asterisk",
	"tilde",
	"plus",
	"backslash",
	"backtick",
	"blank",
	"empty",
	"sp",
	"two-colons",
	"two-semicolons",
	"nbsp",
	"deg",
	"zwsp",
	"quot",
	"apos",
	"lsquo",
	"rsquo",
	"ldquo",
	"rdquo",
	"wj",
	"brvbar",
	"pp",
	"cpp",
	"amp",
	"lt",
	"gt",
];

const configuredParser = parser.configure({
	props: [
		styleTags({
			Heading1: t.heading1,
			Heading2: t.heading2,
			Heading3: t.heading3,
			Heading4: t.heading4,
			Heading5: t.heading5,
			Heading6: t.heading6,
			"Heading1Marker Heading2Marker Heading3Marker Heading4Marker Heading5Marker Heading6Marker":
				t.heading,
			AttributeLine: t.attributeName,
			ElementAttributeLine: t.attributeValue,
			BlockTitleLine: t.labelName,
			AdmonitionMarker: t.keyword,
			"ListMarker CalloutListMarker": t.list,
			DescriptionListLine: t.list,
			"LineCommentText CommentBlock": t.comment,
			"CommentFence ListingFence LiteralFence PassthroughFence TableFence DelimitedFence":
				t.processingInstruction,
			"ListingBlock LiteralBlock PassthroughBlock BlockBodyLine": t.literal,
			TableBodyLine: t.content,
			"TableFence TableSeparator": t.separator,
			BlockMacroLine: t.macroName,
			"Url Email Xref": t.link,
			"InlineAnchor BibliographyAnchor": t.labelName,
			"Counter IntrinsicAttribute AttributeReference": t.attributeName,
			InlineMacro: t.macroName,
			Replacement: t.escape,
			Escape: t.escape,
			Strong: t.strong,
			Emphasis: t.emphasis,
			Monospace: t.monospace,
			Literal: t.literal,
			Highlight: t.special(t.content),
			"Superscript Subscript": t.special(t.content),
			Callout: t.number,
			Punctuation: t.punctuation,
		}),
		foldNodeProp.add({
			CommentBlock: foldInside,
			ListingBlock: foldInside,
			LiteralBlock: foldInside,
			PassthroughBlock: foldInside,
			TableBlock: foldInside,
			DelimitedBlock: foldInside,
		}),
	],
});

export const asciidocLanguage = LRLanguage.define({
	name: "asciidoc",
	parser: configuredParser,
	languageData: {
		commentTokens: {
			line: "//",
			block: { open: "////", close: "////" },
		},
		closeBrackets: { brackets: ["[", "(", "{", '"', "'", "`"] },
		wordChars: "-_",
	},
});

const asciidocCompletion = asciidocLanguage.data.of({
	autocomplete: completeFromList([
		...admonitions.map((label) => ({ label: `${label}:`, type: "keyword" })),
		...macroNames.map((label) => ({ label: `${label}:[]`, type: "function" })),
		...intrinsicAttributes.map((label) => ({
			label: `{${label}}`,
			type: "constant",
		})),
		{ label: ":toc:", type: "property" },
		{ label: ":icons:", type: "property" },
		{ label: ":source-highlighter:", type: "property" },
		{ label: "[source]", type: "property" },
		{ label: "[NOTE]", type: "property" },
		{ label: "[TIP]", type: "property" },
		{ label: "[IMPORTANT]", type: "property" },
		{ label: "[WARNING]", type: "property" },
		{ label: "[CAUTION]", type: "property" },
	]),
});

export function asciidoc() {
	return new LanguageSupport(asciidocLanguage, [asciidocCompletion]);
}

export const asciidocMode = {
	name: "asciidoc",
	caption: "AsciiDoc",
	extensions: ["adoc", "asciidoc", "asc"],
	load: asciidoc,
};
