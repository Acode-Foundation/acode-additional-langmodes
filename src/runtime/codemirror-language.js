const language = acode.require("@codemirror/language");

export const {
	Language,
	LanguageSupport,
	LRLanguage,
	bracketMatching,
	bracketMatchingHandle,
	continuedIndent,
	defineLanguageFacet,
	foldInside,
	foldNodeProp,
	flatIndent,
	getIndentation,
	getIndentUnit,
	indentString,
	indentNodeProp,
	delimitedIndent,
	sublanguageProp,
	syntaxTree,
} = language;
