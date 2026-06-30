const language = acode.require("@codemirror/language");

export const {
	Language,
	LanguageSupport,
	LRLanguage,
	StreamLanguage,
	bracketMatching,
	bracketMatchingHandle,
	continuedIndent,
	defineLanguageFacet,
	foldInside,
	foldNodeProp,
	foldService,
	flatIndent,
	getIndentation,
	getIndentUnit,
	indentString,
	indentNodeProp,
	indentService,
	delimitedIndent,
	sublanguageProp,
	syntaxTree,
} = language;
