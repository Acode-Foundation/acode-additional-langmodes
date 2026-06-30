import { completeFromList } from "@codemirror/autocomplete";
import {
	continuedIndent,
	delimitedIndent,
	indentNodeProp,
	indentService,
	LanguageSupport,
	LRLanguage,
} from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import { parser } from "./parser";

// Assembly CodeMirror language package.
//
// Parser/token coverage follows CodeMirror's Lezer language package pattern
// and adapts RubixDev/tree-sitter-asm's labels, directives, instructions,
// operands, pointer/register syntax, strings, numbers, and comments.
// https://github.com/RubixDev/tree-sitter-asm/blob/main/grammar.js

const directives = [
	".align",
	".ascii",
	".asciz",
	".balign",
	".bss",
	".byte",
	".code",
	".comm",
	".data",
	".double",
	".else",
	".elseif",
	".end",
	".endif",
	".endm",
	".equ",
	".extern",
	".file",
	".float",
	".global",
	".globl",
	".hidden",
	".include",
	".int",
	".long",
	".macro",
	".org",
	".p2align",
	".quad",
	".rodata",
	".section",
	".set",
	".short",
	".size",
	".space",
	".string",
	".text",
	".type",
	".word",
	"align",
	"bits",
	"common",
	"cpu",
	"db",
	"dd",
	"dq",
	"dt",
	"dw",
	"equ",
	"extern",
	"global",
	"incbin",
	"include",
	"org",
	"resb",
	"resd",
	"resq",
	"resw",
	"section",
	"segment",
	"struc",
	"struct",
	"times",
	"use16",
	"use32",
	"use64",
];

const mnemonics = [
	// x86/x64
	"adc",
	"add",
	"and",
	"bsf",
	"bsr",
	"bt",
	"call",
	"clc",
	"cld",
	"cli",
	"cmova",
	"cmovae",
	"cmovb",
	"cmovbe",
	"cmove",
	"cmovg",
	"cmovge",
	"cmovl",
	"cmovle",
	"cmovne",
	"cmp",
	"cmpxchg",
	"cpuid",
	"dec",
	"div",
	"hlt",
	"idiv",
	"imul",
	"in",
	"inc",
	"int",
	"ja",
	"jae",
	"jb",
	"jbe",
	"jc",
	"je",
	"jg",
	"jge",
	"jl",
	"jle",
	"jmp",
	"jna",
	"jnae",
	"jnb",
	"jnbe",
	"jnc",
	"jne",
	"jng",
	"jnge",
	"jnl",
	"jnle",
	"jno",
	"jnp",
	"jns",
	"jnz",
	"jo",
	"jp",
	"js",
	"jz",
	"lea",
	"leave",
	"lock",
	"loop",
	"loope",
	"loopne",
	"mov",
	"movaps",
	"movd",
	"movdqa",
	"movdqu",
	"movq",
	"movs",
	"movsb",
	"movsd",
	"movsq",
	"movss",
	"movsw",
	"movsx",
	"movsxd",
	"movups",
	"movzx",
	"mul",
	"neg",
	"nop",
	"not",
	"or",
	"out",
	"pop",
	"popcnt",
	"push",
	"rcl",
	"rcr",
	"rep",
	"repe",
	"repne",
	"ret",
	"rol",
	"ror",
	"sal",
	"sar",
	"sbb",
	"seta",
	"setae",
	"setb",
	"setbe",
	"sete",
	"setg",
	"setge",
	"setl",
	"setle",
	"setne",
	"shl",
	"shld",
	"shr",
	"shrd",
	"stc",
	"std",
	"sti",
	"sub",
	"syscall",
	"test",
	"ud2",
	"xadd",
	"xchg",
	"xor",
	// ARM/AArch64
	"adc",
	"adr",
	"adrp",
	"and",
	"asr",
	"b",
	"bfc",
	"bfi",
	"bic",
	"bl",
	"blr",
	"bx",
	"cbnz",
	"cbz",
	"cmn",
	"cmp",
	"csel",
	"eor",
	"ldm",
	"ldr",
	"ldrb",
	"ldrh",
	"ldrsb",
	"ldrsh",
	"ldur",
	"lsl",
	"lsr",
	"mla",
	"mov",
	"movk",
	"movn",
	"movt",
	"movw",
	"mrs",
	"msr",
	"mvn",
	"orr",
	"pop",
	"push",
	"ret",
	"ror",
	"sbc",
	"sdiv",
	"smull",
	"stm",
	"str",
	"strb",
	"strh",
	"stur",
	"svc",
	"tst",
	"udiv",
	"umull",
	// RISC-V
	"add",
	"addi",
	"addiw",
	"addw",
	"amoadd.w",
	"amoand.w",
	"amoor.w",
	"amoswap.w",
	"and",
	"andi",
	"auipc",
	"beq",
	"bge",
	"bgeu",
	"blt",
	"bltu",
	"bne",
	"csrr",
	"csrrc",
	"csrrci",
	"csrrs",
	"csrrsi",
	"csrrw",
	"csrrwi",
	"fence",
	"jal",
	"jalr",
	"lb",
	"lbu",
	"ld",
	"lh",
	"lhu",
	"lui",
	"lw",
	"lwu",
	"or",
	"ori",
	"sb",
	"sd",
	"sh",
	"sll",
	"slli",
	"slliw",
	"sllw",
	"slt",
	"slti",
	"sltiu",
	"sltu",
	"sra",
	"srai",
	"sraiw",
	"sraw",
	"srl",
	"srli",
	"srliw",
	"srlw",
	"sub",
	"subw",
	"sw",
	"xor",
	"xori",
];

const qualifiers = [
	"byte",
	"word",
	"dword",
	"qword",
	"tword",
	"oword",
	"yword",
	"zword",
	"ptr",
	"rel",
	"near",
	"far",
	"offset",
	"short",
	"high",
	"low",
	"high16",
	"low16",
];

const registers = [
	"al",
	"ah",
	"bl",
	"bh",
	"cl",
	"ch",
	"dl",
	"dh",
	"ax",
	"bx",
	"cx",
	"dx",
	"si",
	"di",
	"sp",
	"bp",
	"eax",
	"ebx",
	"ecx",
	"edx",
	"esi",
	"edi",
	"esp",
	"ebp",
	"rax",
	"rbx",
	"rcx",
	"rdx",
	"rsi",
	"rdi",
	"rsp",
	"rbp",
	"rip",
	"eip",
	"lr",
	"pc",
	"fp",
	"x0",
	"x1",
	"x2",
	"x3",
	"x4",
	"x5",
	"x6",
	"x7",
	"x8",
	"x9",
	"x10",
	"x11",
	"x12",
	"x13",
	"x14",
	"x15",
	"w0",
	"w1",
	"w2",
	"w3",
	"w4",
	"w5",
	"w6",
	"w7",
	"a0",
	"a1",
	"a2",
	"a3",
	"a4",
	"a5",
	"a6",
	"a7",
	"zero",
	"ra",
	"gp",
	"tp",
];

const labelPattern = /^\s*(?:[A-Za-z_.$@?][A-Za-z0-9_.$@?]*|\d+):(?:\s|$)/;
const sectionDirectivePattern = /^\s*(?:\.?(?:text|data|bss|rodata|section|segment)\b)/i;
const blockOpenPattern = /^\s*\.?(?:macro|if|ifdef|ifndef|ifeq|ifne|ifgt|iflt|ifge|ifle|rept|irp|irpc|struct|struc)\b/i;
const blockClosePattern = /^\s*\.?(?:endm|endmacro|endif|endr|ends|endstruc|endstruct)\b/i;
const blockMiddlePattern = /^\s*\.?(?:else|elseif|elif)\b/i;
const closingOperandPattern = /^\s*[\])}]/;

function previousNonEmptyLine(doc, lineNumber) {
	for (let number = lineNumber - 1; number > 0; number--) {
		const line = doc.line(number);
		if (line.text.trim()) return line;
	}
	return null;
}

function hasOpenOperand(text) {
	let paren = 0;
	let bracket = 0;
	let brace = 0;
	let quote = "";
	let escaped = false;

	for (const char of text) {
		if (quote) {
			if (escaped) {
				escaped = false;
			} else if (char === "\\") {
				escaped = true;
			} else if (char === quote) {
				quote = "";
			}
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
		} else if (char === "(") {
			paren++;
		} else if (char === ")" && paren) {
			paren--;
		} else if (char === "[") {
			bracket++;
		} else if (char === "]" && bracket) {
			bracket--;
		} else if (char === "{") {
			brace++;
		} else if (char === "}" && brace) {
			brace--;
		}
	}

	return paren > 0 || bracket > 0 || brace > 0;
}

function isContinuedOperand(text) {
	return /(?:,\s*|[+\-*/%|^&=<>]\s*)$/.test(text) || hasOpenOperand(text);
}

function blockIndentBefore(doc, uptoLineNumber, unit) {
	let indent = 0;
	let afterLabel = false;

	for (let number = 1; number < uptoLineNumber; number++) {
		const text = doc.line(number).text;
		const trimmed = text.trim();
		if (!trimmed) continue;

		if (blockClosePattern.test(trimmed) || blockMiddlePattern.test(trimmed)) {
			indent = Math.max(0, indent - unit);
		}

		if (sectionDirectivePattern.test(trimmed)) {
			afterLabel = false;
		} else if (labelPattern.test(trimmed)) {
			afterLabel = true;
		}

		if (blockOpenPattern.test(trimmed) || blockMiddlePattern.test(trimmed)) {
			indent += unit;
			afterLabel = false;
		}
	}

	return indent + (afterLabel ? unit : 0);
}

function assemblyIndent(context, pos) {
	const doc = context.state.doc;
	const line = doc.lineAt(pos);
	const textAfter = line.text.slice(pos - line.from);
	const trimmed = textAfter.trim();
	const previous = previousNonEmptyLine(doc, line.number);
	let indent = blockIndentBefore(doc, line.number, context.unit);

	if (blockClosePattern.test(trimmed) || blockMiddlePattern.test(trimmed)) {
		indent = Math.max(0, indent - context.unit);
	}
	if (labelPattern.test(trimmed) || sectionDirectivePattern.test(trimmed)) {
		return Math.max(0, indent - context.unit);
	}
	if (closingOperandPattern.test(trimmed)) {
		indent = Math.max(0, indent - context.unit);
	}
	if (previous && isContinuedOperand(previous.text.trim())) {
		indent += context.unit;
	}

	return indent;
}

const configuredParser = parser.configure({
	props: [
		styleTags({
			LineComment: t.lineComment,
			BlockComment: t.blockComment,
			Label: t.labelName,
			constKw: t.definitionKeyword,
			DirectiveName: t.meta,
			"Instruction/Identifier": t.keyword,
			Qualifier: t.modifier,
			Register: t.special(t.variableName),
			Address: t.special(t.variableName),
			Identifier: t.variableName,
			Number: t.number,
			String: t.string,
			Operator: t.operator,
			Bracket: t.bracket,
			Separator: t.separator,
		}),
		indentNodeProp.add({
			LineContent: continuedIndent({ except: /^(?:\s*(?:[A-Za-z_.$@?][A-Za-z0-9_.$@?]*|\d+):|\s*\.?(?:endm|endmacro|endif|endr|ends|endstruc|endstruct)\b)/i }),
			OperandItem: continuedIndent(),
			Bracket: delimitedIndent({ closing: "]", align: false }),
		}),
	],
});

export const assemblyLanguage = LRLanguage.define({
	name: "assembly",
	parser: configuredParser,
	languageData: {
		commentTokens: {
			line: ";",
			block: { open: "/*", close: "*/" },
		},
		closeBrackets: { brackets: ["(", "[", "{", '"', "'"] },
		indentOnInput:
			/^\s*(?:[\])}]|\.?(?:else|elseif|elif|endm|endmacro|endif|endr|ends|endstruc|endstruct)\b|(?:[A-Za-z_.$@?][A-Za-z0-9_.$@?]*|\d+):(?:\s|$))/i,
		wordChars: "%.$_",
	},
});

const assemblyCompletion = assemblyLanguage.data.of({
	autocomplete: completeFromList([
		...[...new Set(mnemonics)].map((label) => ({ label, type: "keyword" })),
		...[...new Set(directives)].map((label) => ({ label, type: "property" })),
		...qualifiers.map((label) => ({ label, type: "keyword" })),
		...registers.map((label) => ({ label, type: "variable" })),
	]),
});

const assemblyIndentation = indentService.of(assemblyIndent);

export function assembly() {
	return new LanguageSupport(assemblyLanguage, [
		assemblyCompletion,
		assemblyIndentation,
	]);
}

export const assemblyMode = {
	name: "assembly",
	caption: "Assembly",
	extensions: ["asm", "s", "S", "nasm"],
	load: assembly,
};
