import {
	delimitedIndent,
	foldInside,
	foldNodeProp,
	indentNodeProp,
	LanguageSupport,
	LRLanguage,
} from "@codemirror/language";
import { parseMixed } from "@lezer/common";
import { styleTags, tags as t } from "@lezer/highlight";
import { parser as yamlParser } from "@lezer/yaml";
import { parser as scalarParser } from "./parser";

// @lezer/yaml provides an error-tolerant structural YAML parser. The nested
// scalar parser retains that structure while distinguishing the core-schema
// null, boolean, integer, float, and plain-string values described by the
// tree-sitter YAML grammar.
const configuredScalarParser = scalarParser.configure({
	props: [
		styleTags({
			Null: t.null,
			Boolean: t.bool,
			"Integer Float": t.number,
			PlainString: t.string,
		}),
	],
});

const configuredParser = yamlParser.configure({
	wrap: parseMixed((node) => {
		if (node.name !== "Literal" || node.node.parent?.name === "Key") {
			return null;
		}
		return { parser: configuredScalarParser };
	}),
	props: [
		indentNodeProp.add({
			Stream: (context) => {
				for (
					let before = context.node.resolve(context.pos, -1);
					before && before.to >= context.pos;
					before = before.parent
				) {
					if (
						before.name === "BlockLiteralContent" &&
						before.from < before.to
					) {
						return context.baseIndentFor(before);
					}
					if (before.name === "BlockLiteral") {
						return context.baseIndentFor(before) + context.unit;
					}
					if (
						before.name === "BlockSequence" ||
						before.name === "BlockMapping"
					) {
						return context.column(before.firstChild.from, 1);
					}
					if (before.name === "QuotedLiteral") return null;
					if (before.name === "Literal") {
						const column = context.column(before.from, 1);
						if (column === context.lineIndent(before.from, 1)) return column;
						if (before.to > context.pos) return null;
					}
				}
				return null;
			},
			FlowMapping: delimitedIndent({ closing: "}" }),
			FlowSequence: delimitedIndent({ closing: "]" }),
		}),
		foldNodeProp.add({
			"FlowMapping FlowSequence": foldInside,
			"Item Pair BlockLiteral": (node, state) => ({
				from: state.doc.lineAt(node.from).to,
				to: node.to,
			}),
		}),
	],
});

export const yamlLanguage = LRLanguage.define({
	name: "yaml",
	parser: configuredParser,
	languageData: {
		commentTokens: { line: "#" },
		closeBrackets: { brackets: ["[", "{", '"', "'"] },
		indentOnInput: /^\s*[\]\}]$/,
		wordChars: "-_",
	},
});

export function yaml() {
	return new LanguageSupport(yamlLanguage);
}

// Acode already owns the `yaml` registry key. Registering a distinct mode lets
// this plugin coexist with it, while Acode's later-registration tie-breaker
// selects this structured parser for .yaml and .yml files.
export const yamlMode = {
	name: "yaml-enhanced",
	caption: "YAML (Enhanced)",
	extensions: ["yaml", "yml"],
	load: yaml,
};
