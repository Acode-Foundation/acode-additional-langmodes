import { ExternalTokenizer } from "@lezer/lr";
import { CallName, FieldDot, Maybe, ModuleName } from "./parser.terms.js";
import { reservedWords } from "./keywords.js";

// Character codes used while scanning ahead.
const tab = 9;
const newline = 10;
const carriageReturn = 13;
const space = 32;
const quote = 39; // '
const openParen = 40;
const percent = 37;
const colon = 58;
const dot = 46;
const question = 63;
const backslash = 92;
const underscore = 95;
const at = 64;

function isDigit(ch) {
	return ch >= 48 && ch <= 57;
}

function isLowerStart(ch) {
	// a-z plus the Latin-1 lowercase letters Erlang allows in unquoted atoms
	// (U+00DF-U+00F6 and U+00F8-U+00FF).
	return (
		(ch >= 97 && ch <= 122) ||
		(ch >= 0xdf && ch <= 0xf6) ||
		(ch >= 0xf8 && ch <= 0xff)
	);
}

function isUpperStart(ch) {
	return (
		(ch >= 65 && ch <= 90) ||
		ch === underscore ||
		(ch >= 0xc0 && ch <= 0xd6) ||
		(ch >= 0xd8 && ch <= 0xde)
	);
}

function isIdentChar(ch) {
	return (
		isLowerStart(ch) ||
		isUpperStart(ch) ||
		isDigit(ch) ||
		ch === at
	);
}

function isBlank(ch) {
	return ch === space || ch === tab;
}

/** Skips spaces and tabs starting at `offset`, returning the next offset. */
function skipBlanks(input, offset) {
	while (isBlank(input.peek(offset))) offset++;
	return offset;
}

/** Returns the offset just past the identifier that starts at `offset`. */
function scanIdentifier(input, offset) {
	while (isIdentChar(input.peek(offset))) offset++;
	return offset;
}

function readWord(input, length) {
	let word = "";
	for (let i = 0; i < length; i++) word += String.fromCharCode(input.peek(i));
	return word;
}

/**
 * Whether the rest of the line after `offset` is blank or only a comment.
 * Used to tell the `maybe` block keyword from a plain `maybe` atom.
 */
function endsLine(input, offset) {
	offset = skipBlanks(input, offset);
	const ch = input.peek(offset);
	return ch < 0 || ch === newline || ch === carriageReturn || ch === percent;
}

/**
 * After the first part of `module:function(`, checks that a function name
 * (atom, variable or macro) follows the colon and is itself called.
 */
function isRemoteCall(input, colonOffset) {
	let offset = colonOffset + 1;
	let ch = input.peek(offset);
	if (ch === question) {
		offset++;
		if (input.peek(offset) === question) offset++;
		ch = input.peek(offset);
	}
	if (!isLowerStart(ch) && !isUpperStart(ch)) return false;
	offset = scanIdentifier(input, offset);
	return input.peek(skipBlanks(input, offset)) === openParen;
}

/** Scans a quoted atom starting at the opening quote; returns its end or -1. */
function scanQuotedAtom(input) {
	let offset = 1;
	for (;;) {
		const ch = input.peek(offset);
		if (ch < 0 || ch === newline || ch === carriageReturn) return -1;
		offset++;
		if (ch === backslash) {
			if (input.peek(offset) < 0) return -1;
			offset++;
		} else if (ch === quote) {
			return offset;
		}
	}
}

/**
 * Context-sensitive tokens that the Lezer token DSL cannot express because
 * they depend on text after the token:
 *
 * - `CallName`: an atom directly followed by `(`, i.e. a function call or a
 *   function clause head (reserved words such as `fun(` are excluded).
 * - `ModuleName`: the `module` part of a remote call such as `lists:map(`.
 * - `FieldDot`: the dot of a record field access such as `State#state.count`.
 *   A form-ending dot is followed by whitespace, so a dot that is directly
 *   followed by an atom after a record name is unambiguous.
 * - `Maybe`: the `maybe` keyword of a `maybe ... end` block. `maybe` is only
 *   reserved when the feature is enabled, so it is treated as a keyword only
 *   when it ends its line, which is how maybe blocks are written.
 */
export const erlangTokens = new ExternalTokenizer((input, stack) => {
	const first = input.next;

	if (first === dot) {
		const next = input.peek(1);
		if ((isLowerStart(next) || next === quote) && stack.canShift(FieldDot)) {
			input.acceptToken(FieldDot, 1);
		}
		return;
	}

	if (first === quote) {
		const end = scanQuotedAtom(input);
		if (
			end > 0 &&
			input.peek(skipBlanks(input, end)) === openParen &&
			stack.canShift(CallName)
		) {
			input.acceptToken(CallName, end);
		}
		return;
	}

	if (!isLowerStart(first)) return;

	const length = scanIdentifier(input, 0);
	const word = readWord(input, length);

	if (word === "maybe" && endsLine(input, length) && stack.canShift(Maybe)) {
		input.acceptToken(Maybe, length);
		return;
	}

	// Reserved words keep their normal Atom token so the grammar can
	// specialize them into keywords and operators.
	if (reservedWords.has(word)) return;

	const next = input.peek(length);
	if (
		input.peek(skipBlanks(input, length)) === openParen &&
		stack.canShift(CallName)
	) {
		input.acceptToken(CallName, length);
	} else if (
		next === colon &&
		input.peek(length + 1) !== colon &&
		isRemoteCall(input, length) &&
		stack.canShift(ModuleName)
	) {
		input.acceptToken(ModuleName, length);
	}
});
