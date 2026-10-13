import { c } from "@fazelstudio/codemirror-lang-c";
import { kotlin } from "@fazelstudio/codemirror-lang-kotlin";
import { lua } from "@fazelstudio/codemirror-lang-lua";
import { swift } from "@fazelstudio/codemirror-lang-swift";
import { clojure } from "@nextjournal/lang-clojure";
import { latex } from "codemirror-lang-latex";

/**
 * Lezer-based community packages for languages that current Acode registers
 * through @codemirror/legacy-modes (or, for C, the C++ grammar). Acode will
 * drop those modes, so these use the canonical names. While Acode still has a
 * mode with the same name, `replaces` makes the registry fall back to
 * "<name>-enhanced" / "<Caption> (Enhanced)" so both stay selectable. They
 * list at least the same extensions as Acode's modes so modelist's tie-break
 * (later registration wins) picks these for matching files.
 */
export const enhancedLanguageModes = [
	{
		name: "c",
		caption: "C",
		replaces: true,
		extensions: ["c", "h", "ino"],
		load: c,
	},
	{
		name: "clojure",
		caption: "Clojure",
		replaces: true,
		extensions: ["clj", "cljs", "cljc", "cljx", "edn"],
		load: clojure,
	},
	{
		name: "kotlin",
		caption: "Kotlin",
		replaces: true,
		extensions: ["kt", "kts"],
		load: kotlin,
	},
	{
		name: "latex",
		caption: "LaTeX",
		replaces: true,
		// Acode's LaTeX mode also claims "text", so include a 5-char extension
		// to outrank it in modelist's specificity score.
		extensions: ["tex", "ltx", "sty", "cls", "latex"],
		// Leave autocompletion, bracket closing, and linting to Acode's editor
		// settings; the package's defaults would override them per file.
		load: () =>
			latex({
				enableAutocomplete: false,
				autoCloseBrackets: false,
				enableLinting: false,
			}),
	},
	{
		name: "lua",
		caption: "Lua",
		replaces: true,
		extensions: ["lua"],
		load: lua,
	},
	{
		name: "swift",
		caption: "Swift",
		replaces: true,
		extensions: ["swift"],
		load: swift,
	},
];
