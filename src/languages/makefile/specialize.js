import {
	BuiltinVariable,
	FunctionName,
	SpecialTarget,
} from "./parser.terms.js";
import { builtinVariables, functions, specialTargets } from "./keywords.js";

const functionSet = new Set(functions);
const builtinVarSet = new Set(builtinVariables);
const specialTargetSet = new Set(specialTargets);

/**
 * Specialize Identifier into make functions, builtin variables, or special
 * targets. Directive keywords are handled by the contextual external tokenizer
 * in tokens.js so mid-line words like `include` remain plain identifiers.
 */
export function specializeIdentifier(value) {
	if (functionSet.has(value)) return FunctionName;
	if (builtinVarSet.has(value)) return BuiltinVariable;
	if (specialTargetSet.has(value)) return SpecialTarget;
	return -1;
}
