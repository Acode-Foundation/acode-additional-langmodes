function words(value) {
	return new Set(value.trim().split(/\s+/));
}

// Zig keyword, builtin type, and builtin function names are kept local rather
// than imported from a third-party CodeMirror package. The list follows the
// tree-sitter-zig grammar and the official VS Code TextMate grammar.
export const keywords = words(`
	addrspace align allowzero and anyframe anytype asm async await break
	callconv catch comptime const continue defer else enum errdefer error
	export extern false fn for if inline linksection noalias nosuspend null
	opaque or orelse packed pub resume return struct suspend switch test
	threadlocal true try undefined union unreachable usingnamespace var
	volatile while
`);

export const builtinTypes = words(`
	bool c_int c_long c_longdouble c_longlong c_char c_short c_uint c_ulong
	c_ulonglong c_ushort comptime_float comptime_int f16 f32 f64 f80 f128
	isize noreturn type usize void anyerror anyopaque
`);

export const builtins = words(`
	ArgType Frame FrameSize Type TypeOf This addWithOverflow alignCast alignOf
	as atomicLoad atomicRmw atomicStore bitCast bitOffsetOf bitSizeOf branchHint
	breakpoint byteSwap bitReverse call cDefine cImport cInclude clz cmpxchgStrong
	cmpxchgWeak compileError compileLog constCast ctz cUndef divExact divFloor
	divTrunc embedFile enumFromInt errorFromInt errorName errorReturnTrace
	errorCast export extern field fieldParentPtr FieldType floatCast floatFromInt
	frameAddress hasDecl hasField import inComptime intCast intFromBool intFromEnum
	intFromError intFromFloat intFromPtr max min memcpy memset mod mulAdd
	wasmMemorySize wasmMemoryGrow offsetOf panic popCount prefetch ptrCast
	ptrFromInt rem returnAddress select setAlignStack setCold setEvalBranchQuota
	setFloatMode setRuntimeSafety shlExact shlWithOverflow shrExact shuffle
	sizeOf splat reduce src sqrt sin cos tan exp exp2 log log2 log10 abs floor
	ceil trunc round subWithOverflow tagName trap truncate typeInfo typeName
	unionInit Vector volatileCast workGroupId workGroupSize workItemId
`);
