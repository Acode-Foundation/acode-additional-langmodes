import { BooleanVal, BuiltinAttr } from "./parser.terms.js";

const builtins = new Set([
	"text",
	"eol",
	"crlf",
	"working-tree-encoding",
	"ident",
	"filter",
	"diff",
	"merge",
	"whitespace",
	"export-ignore",
	"export-subst",
	"delta",
	"encoding",
	"binary",
]);

export function specializeAttrName(value) {
	return builtins.has(value) ? BuiltinAttr : -1;
}

export function specializeValue(value) {
	return value === "true" || value === "false" ? BooleanVal : -1;
}
