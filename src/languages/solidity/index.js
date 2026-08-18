import { completeFromList } from "@codemirror/autocomplete";
import {
	delimitedIndent,
	foldInside,
	foldNodeProp,
	indentNodeProp,
	LanguageSupport,
	LRLanguage,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import {
	builtins,
	globals,
	keywords,
	natspecTags,
	primitiveTypes,
	units,
} from "./keywords";
import { parser } from "./parser";

const configuredParser = parser.configure({
	props: [
		styleTags({
			// NatSpec (`///`, `/** */`) is a Solidity comment form. Style it as a
			// line/block comment so editor themes that only color those tags still
			// treat documentation comments as comments.
			"NatSpecLineComment LineComment": t.lineComment,
			"NatSpecBlockComment BlockComment": t.blockComment,
			"String HexString UnicodeString StringLiteral": t.string,
			"Number VersionLiteral": t.number,
			NumberUnit: t.atom,
			"VersionOp PragmaName": t.literal,
			BooleanLiteral: t.bool,
			Placeholder: t.special(t.variableName),
			"PrimitiveType AddressPayableType var": t.standard(t.typeName),
			"TypeDefinition TypeName UserDefinedType": t.typeName,
			"ContractDeclaration/TypeDefinition InterfaceDeclaration/TypeDefinition LibraryDeclaration/TypeDefinition":
				t.definition(t.className),
			"StructDeclaration/TypeDefinition EnumDeclaration/TypeDefinition EventDefinition/TypeDefinition ErrorDeclaration/TypeDefinition UserDefinedTypeDefinition/TypeDefinition":
				t.definition(t.typeName),
			"FunctionName FunctionDefinition/FunctionName": t.function(
				t.definition(t.variableName),
			),
			"ModifierDefinition/FunctionName": t.function(t.definition(t.variableName)),
			"CallExpression/VariableName CallExpression/BuiltinName": t.function(
				t.variableName,
			),
			"CallExpression/MemberExpression/PropertyName": t.function(t.propertyName),
			"VariableDefinition Parameter/VariableDefinition": t.definition(
				t.variableName,
			),
			"EventParameter/VariableDefinition ErrorParameter/VariableDefinition":
				t.definition(t.variableName),
			PropertyName: t.propertyName,
			EnumValue: t.propertyName,
			VariableName: t.variableName,
			Identifier: t.variableName,
			"YulIdentifier YulPath": t.variableName,
			YulBuiltin: t.standard(t.function(t.variableName)),
			"SpecialVariable this super": t.self,
			BuiltinName: t.standard(t.function(t.variableName)),
			"pragma import as from": t.moduleKeyword,
			"abstract contract interface library struct enum event error type mapping function modifier constructor fallback receive":
				t.definitionKeyword,
			"if else for while do break continue try catch return emit revert unchecked assembly leave switch case default":
				t.controlKeyword,
			"new delete using for is global layout at let": t.keyword,
			"public private internal external pure view payable virtual override immutable constant transient indexed anonymous memory storage calldata":
				t.modifier,
			"returns": t.controlKeyword,
			Star: t.modifier,
			"UpdateOp": t.updateOperator,
			"ArithOp": t.arithmeticOperator,
			"LogicOp": t.logicOperator,
			"BitOp": t.bitwiseOperator,
			"CompareOp": t.compareOperator,
			"AssignOp Eq YulAssign": t.definitionOperator,
			Arrow: t.operator,
			"( )": t.paren,
			"[ ]": t.squareBracket,
			"{ }": t.brace,
			".": t.derefOperator,
			", ; :": t.separator,
		}),
		indentNodeProp.add({
			ContractBody: delimitedIndent({ closing: "}" }),
			Block: delimitedIndent({ closing: "}" }),
			StructBody: delimitedIndent({ closing: "}" }),
			EnumBody: delimitedIndent({ closing: "}" }),
			YulBlock: delimitedIndent({ closing: "}" }),
			ParamList: delimitedIndent({ closing: ")" }),
			ArgList: delimitedIndent({ closing: ")" }),
			NamedArgs: delimitedIndent({ closing: "}" }),
			InlineArrayExpression: delimitedIndent({ closing: "]" }),
			MappingType: delimitedIndent({ closing: ")" }),
			AssemblyFlags: delimitedIndent({ closing: ")" }),
		}),
		foldNodeProp.add({
			ContractBody: foldInside,
			Block: foldInside,
			StructBody: foldInside,
			EnumBody: foldInside,
			YulBlock: foldInside,
			ParamList: foldInside,
			ArgList: foldInside,
			NamedArgs: foldInside,
			InlineArrayExpression: foldInside,
		}),
	],
});

export const solidityLanguage = LRLanguage.define({
	name: "solidity",
	parser: configuredParser,
	languageData: {
		commentTokens: {
			line: "//",
			block: { open: "/*", close: "*/" },
		},
		closeBrackets: { brackets: ["(", "[", "{", "'", '"'] },
		indentOnInput: /^\s*(?:\}|\)|\])$/,
		wordChars: "$_",
	},
});

const solidityCompletion = solidityLanguage.data.of({
	autocomplete: completeFromList([
		...keywords.map((label) => ({ label, type: "keyword" })),
		...primitiveTypes.map((label) => ({ label, type: "type" })),
		...builtins.map((label) => ({ label, type: "function" })),
		...globals.map((label) => ({ label, type: "variable" })),
		...units.map((label) => ({ label, type: "unit" })),
		...natspecTags.map((label) => ({ label, type: "type", detail: "natspec" })),
		{
			label: "contract",
			type: "keyword",
			detail: "declaration",
			apply: "contract Name {\n  \n}",
		},
		{
			label: "function",
			type: "keyword",
			detail: "declaration",
			apply: "function name() public {\n  \n}",
		},
		{
			label: "modifier",
			type: "keyword",
			detail: "declaration",
			apply: "modifier name() {\n  _;\n}",
		},
		{
			label: "pragma solidity",
			type: "keyword",
			detail: "directive",
			apply: "pragma solidity ^0.8.0;",
		},
	]),
});

export function solidity() {
	return new LanguageSupport(solidityLanguage, [solidityCompletion]);
}

export const solidityMode = {
	name: "solidity",
	caption: "Solidity",
	extensions: ["sol"],
	load: solidity,
};
