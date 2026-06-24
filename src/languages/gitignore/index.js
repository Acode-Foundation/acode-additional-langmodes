import { LanguageSupport, StreamLanguage } from "@codemirror/language";

const separator = /[\/]/;
const globOperator = /[*?\[\]]/;

function tokenBase(stream) {
	if (stream.sol()) {
		stream.eatSpace();
		const first = stream.peek();

		if (first === "#") {
			stream.skipToEnd();
			return "lineComment";
		}

		if (first === "!") {
			stream.next();
			return "operator";
		}
	}

	if (stream.eat("\\")) {
		if (!stream.eol()) stream.next();
		return "escape";
	}

	if (stream.eat(separator)) return "punctuation";
	if (stream.eat(globOperator)) return "operator";

	stream.eatWhile(/[^\\/*?\[\]]/);
	return "string";
}

export const gitignoreLanguage = StreamLanguage.define({
	name: "gitignore",
	token: tokenBase,
	languageData: {
		commentTokens: { line: "#" },
	},
});

export function gitignore() {
	return new LanguageSupport(gitignoreLanguage);
}

export const gitignoreMode = {
	name: "gitignore",
	caption: "Git Ignore",
	extensions: ["gitignore", "ignore", "exclude"],
	load: gitignore,
};
