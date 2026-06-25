import { bibtexLanguage } from "@citedrive/codemirror-lang-bibtex";
import { LanguageSupport } from "@codemirror/language";
import { wgsl } from "@iizukak/codemirror-lang-wgsl";
import { svelte } from "@replit/codemirror-lang-svelte";
import { dot } from "@viz-js/lang-dot";
import { graphqlLanguageSupport } from "cm6-graphql";
import { elixir } from "codemirror-lang-elixir";
import { golfScript } from "codemirror-lang-golfscript";
import { hcl } from "codemirror-lang-hcl";
import { j } from "codemirror-lang-j";
import { janet } from "codemirror-lang-janet";
import { pkl } from "codemirror-lang-pkl";

/**
 * Community CodeMirror packages whose languages aren't present in Acode's
 * current @codemirror/language-data registry.
 */
export const communityLanguageModes = [
	{
		name: "bibtex",
		caption: "BibTeX",
		extensions: ["bib"],
		load: () => new LanguageSupport(bibtexLanguage),
	},
	{
		name: "elixir",
		caption: "Elixir",
		extensions: ["ex", "exs", "eex", "heex", "leex"],
		load: elixir,
	},
	{
		name: "golfscript",
		caption: "GolfScript",
		extensions: ["gs"],
		load: golfScript,
	},
	{
		name: "graphql",
		caption: "GraphQL",
		extensions: ["graphql", "graphqls", "gql"],
		load: graphqlLanguageSupport,
	},
	{
		name: "dot",
		caption: "Graphviz DOT",
		extensions: ["dot", "gv"],
		load: dot,
	},
	{
		name: "hcl",
		caption: "HCL",
		extensions: ["hcl", "tf", "tfvars"],
		load: hcl,
	},
	{
		name: "j",
		caption: "J",
		extensions: ["ijs"],
		load: j,
	},
	{
		name: "janet",
		caption: "Janet",
		extensions: ["janet"],
		load: janet,
	},
	{
		name: "pkl",
		caption: "Pkl",
		extensions: ["pkl"],
		load: pkl,
	},
	{
		name: "svelte",
		caption: "Svelte",
		extensions: ["svelte"],
		load: svelte,
	},
	{
		name: "wgsl",
		caption: "WGSL",
		extensions: ["wgsl"],
		load: wgsl,
	},
];
