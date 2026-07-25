import { ExternalTokenizer } from "@lezer/lr";
import {
	defineKw,
	elseKw,
	endefKw,
	endifKw,
	exportKw,
	ifdefKw,
	ifeqKw,
	ifndefKw,
	ifneqKw,
	includeKw,
	overrideKw,
	privateKw,
	sincludeKw,
	undefineKw,
	unexportKw,
	vpathKw,
} from "./parser.terms.js";

const NEWLINE = 10;
const CARRIAGE = 13;
const SPACE = 32;
const TAB = 9;
const HASH = 35;

/** Map of directive keyword → term id. Longer keys first for -include. */
const DIRECTIVE_TERMS = [
	["-include", includeKw],
	["sinclude", sincludeKw],
	["unexport", unexportKw],
	["undefine", undefineKw],
	["override", overrideKw],
	["private", privateKw],
	["include", includeKw],
	["export", exportKw],
	["define", defineKw],
	["endef", endefKw],
	["ifneq", ifneqKw],
	["ifndef", ifndefKw],
	["endif", endifKw],
	["ifeq", ifeqKw],
	["ifdef", ifdefKw],
	["vpath", vpathKw],
	["else", elseKw],
];

const CONDITIONAL_AFTER_ELSE = new Set([
	ifeqKw,
	ifneqKw,
	ifdefKw,
	ifndefKw,
]);

function isSpace(ch) {
	return ch === SPACE || ch === TAB;
}

function isIdentChar(ch) {
	return (
		(ch >= 48 && ch <= 57) || // 0-9
		(ch >= 65 && ch <= 90) || // A-Z
		(ch >= 97 && ch <= 122) || // a-z
		ch === 95 || // _
		ch === 45 // - (for -include)
	);
}

/**
 * True when the current position is at the start of a makefile statement:
 * beginning of file / after newline, with only spaces (not tabs) before it.
 * Recipe lines start with a tab and must not get directive keywords.
 */
function atStatementStart(input) {
	let i = -1;
	let sawTab = false;
	for (;;) {
		const ch = input.peek(i);
		if (ch === SPACE) {
			i--;
			continue;
		}
		if (ch === TAB) {
			sawTab = true;
			i--;
			continue;
		}
		if (ch < 0 || ch === NEWLINE || ch === CARRIAGE) {
			// Tabs before first content mean recipe line
			return !sawTab;
		}
		return false;
	}
}

/**
 * True when the only non-space content already on this line is the word "else"
 * (supports `else ifeq (...)` / `else ifdef VAR`).
 */
function afterElseOnLine(input) {
	let i = -1;
	while (isSpace(input.peek(i))) i--;

	const word = "else";
	for (let j = word.length - 1; j >= 0; j--, i--) {
		if (input.peek(i) !== word.charCodeAt(j)) return false;
	}

	const charBeforeElse = input.peek(i);
	if (charBeforeElse >= 0 && isIdentChar(charBeforeElse)) return false;

	for (;;) {
		const ch = input.peek(i);
		if (ch < 0 || ch === NEWLINE || ch === CARRIAGE) {
			return true;
		}
		if (!isSpace(ch)) {
			return false;
		}
		i--;
	}
}

function matchDirective(input) {
	for (const [word, term] of DIRECTIVE_TERMS) {
		let ok = true;
		for (let i = 0; i < word.length; i++) {
			if (input.peek(i) !== word.charCodeAt(i)) {
				ok = false;
				break;
			}
		}
		if (!ok) continue;

		const next = input.peek(word.length);
		if (next >= 0 && isIdentChar(next)) continue;

		return { term, length: word.length };
	}
	return null;
}

const MODIFIER_TERMS = new Set([
	defineKw,
	undefineKw,
	exportKw,
	overrideKw,
	privateKw,
	unexportKw,
]);

const MODIFIER_WORDS = ["override", "export", "private"];

function afterModifierOnLine(input) {
	let i = -1;
	while (isSpace(input.peek(i))) i--;

	for (const mod of MODIFIER_WORDS) {
		let ok = true;
		for (let j = mod.length - 1, k = i; j >= 0; j--, k--) {
			if (input.peek(k) !== mod.charCodeAt(j)) {
				ok = false;
				break;
			}
		}
		if (!ok) continue;

		const charBefore = input.peek(i - mod.length);
		if (charBefore >= 0 && isIdentChar(charBefore)) continue;

		let k = i - mod.length;
		let validAtStart = true;
		for (;;) {
			const ch = input.peek(k);
			if (ch < 0 || ch === NEWLINE || ch === CARRIAGE) break;
			if (!isSpace(ch)) {
				validAtStart = false;
				break;
			}
			k--;
		}
		if (validAtStart) return true;
	}
	return false;
}

function afterColonOnLine(input) {
	let i = -1;
	while (isSpace(input.peek(i))) i--;
	return input.peek(i) === 58; // ':'
}

/**
 * Contextual directive keywords: only at statement start (or conditional
 * keywords after `else` on the same line, or directive keywords after statement-start modifiers / colons).
 */
export const directiveTokens = new ExternalTokenizer((input) => {
	// Never tokenize comments as directives
	if (input.next === HASH) return;

	const atStart = atStatementStart(input);
	const afterElse = !atStart && afterElseOnLine(input);
	const afterMod = !atStart && !afterElse && afterModifierOnLine(input);
	const afterColon = !atStart && !afterElse && !afterMod && afterColonOnLine(input);
	if (!atStart && !afterElse && !afterMod && !afterColon) return;

	const matched = matchDirective(input);
	if (!matched) return;

	if (afterElse && !CONDITIONAL_AFTER_ELSE.has(matched.term)) return;
	if (afterMod && !MODIFIER_TERMS.has(matched.term)) return;
	if (afterColon && !MODIFIER_TERMS.has(matched.term)) return;

	input.acceptToken(matched.term, matched.length);
});
// Not contextual: must run before Identifier (see grammar external order).
// Returns nothing mid-line so Identifier/Word can match path words like "include".
