import { htmlLanguage } from "@codemirror/lang-html";
import {
	foldInside,
	foldNodeProp,
	LanguageSupport,
	LRLanguage,
} from "@codemirror/language";
import { parseMixed } from "@lezer/common";
import { parser } from "@grumptech/lezer-mustache";

// @grumptech/lezer-mustache only ships the template parser. Overlay HTML on
// the literal Content nodes so markup between tags is highlighted too.
const configuredParser = parser.configure({
	props: [
		foldNodeProp.add({
			Element: foldInside,
		}),
	],
	wrap: parseMixed((node) =>
		node.type.isTop
			? {
					parser: htmlLanguage.parser,
					overlay: (child) => child.type.name === "Content",
				}
			: null,
	),
});

export const mustacheLanguage = LRLanguage.define({
	name: "mustache",
	parser: configuredParser,
	languageData: {
		commentTokens: { block: { open: "{{!", close: "}}" } },
	},
});

export function mustache() {
	return new LanguageSupport(mustacheLanguage);
}

export const mustacheMode = {
	name: "mustache",
	caption: "Mustache",
	extensions: ["mustache"],
	load: mustache,
};
