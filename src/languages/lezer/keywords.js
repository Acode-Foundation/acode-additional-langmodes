// Directive, prop, and character class names accepted by @lezer/generator:
// https://lezer.codemirror.net/docs/guide/

export const topLevelDirectives = [
	{
		label: "@top",
		detail: "entry rule",
		apply: "@top ${Program} { ${} }",
	},
	{
		label: "@tokens",
		detail: "token declarations",
		apply: "@tokens {\n\t${}\n}",
	},
	{
		label: "@skip",
		detail: "skipped tokens",
		apply: "@skip { ${space} }",
	},
	{
		label: "@precedence",
		detail: "precedence names",
		apply: "@precedence {\n\t${name} @left\n}",
	},
	{
		label: "@external tokens",
		detail: "external tokenizer",
		apply: '@external tokens ${name} from "${./tokens}" { ${Token} }',
	},
	{
		label: "@external prop",
		detail: "external node prop",
		apply: '@external prop ${name} from "${./props}"',
	},
	{
		label: "@external propSource",
		detail: "external prop source",
		apply: '@external propSource ${highlighting} from "${./highlight}"',
	},
	{
		label: "@external specialize",
		detail: "external specializer",
		apply:
			'@external specialize { ${Identifier} } ${name} from "${./tokens}" { ${Keyword} }',
	},
	{
		label: "@external extend",
		detail: "external extender",
		apply:
			'@external extend { ${Identifier} } ${name} from "${./tokens}" { ${Keyword} }',
	},
	{
		label: "@local tokens",
		detail: "local token group",
		apply: "@local tokens {\n\t${}\n\t@else ${content}\n}",
	},
	{
		label: "@context",
		detail: "context tracker",
		apply: '@context ${tracker} from "${./context}"',
	},
	{
		label: "@dialects",
		detail: "dialect names",
		apply: "@dialects { ${name} }",
	},
	{ label: "@detectDelim", detail: "detect delimiters" },
];

export const tokenDirectives = [
	{
		label: "@precedence",
		detail: "token precedence",
		apply: "@precedence { ${} }",
	},
	{
		label: "@conflict",
		detail: "allowed token conflict",
		apply: "@conflict { ${a}, ${b} }",
	},
];

export const localTokenDirectives = [
	tokenDirectives[0],
	{ label: "@else", detail: "fallback token", apply: "@else ${content}" },
];

export const externalTokenDirectives = [
	{
		label: "@conflict",
		detail: "allowed token conflict",
		apply: "@conflict { ${} }",
	},
];

export const skipScopeDirectives = [
	{ label: "@top", detail: "entry rule", apply: "@top ${Program} { ${} }" },
];

export const associativity = ["@left", "@right", "@cut"];

export const charClasses = [
	"@asciiLetter",
	"@asciiLowercase",
	"@asciiUppercase",
	"@digit",
	"@whitespace",
	"@eof",
];

export const expressionDirectives = [
	{
		label: "@specialize",
		detail: "specialized token",
		apply: '@specialize<${token}, "${value}">',
	},
	{
		label: "@extend",
		detail: "extended token",
		apply: '@extend<${token}, "${value}">',
	},
];

export const ruleProps = [
	{ label: "@name", detail: "node name", apply: "@name=${}" },
	{ label: "@inline", detail: "inline the rule" },
	{ label: "@export", detail: "export the term" },
	{ label: "@isGroup", detail: "group name", apply: "@isGroup=${}" },
	{ label: "@dialect", detail: "dialect-only", apply: "@dialect=${}" },
	{
		label: "@dynamicPrecedence",
		detail: "runtime precedence",
		apply: "@dynamicPrecedence=1",
	},
	{ label: "group", detail: "node group", apply: "group=${}" },
	{ label: "openedBy", detail: "node prop", apply: "openedBy=${}" },
	{ label: "closedBy", detail: "node prop", apply: "closedBy=${}" },
];
