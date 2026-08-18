function words(value) {
	return value.trim().split(/\s+/);
}

// Keyword, type, builtin, and unit names follow tree-sitter-solidity plus the
// official-style TextMate grammar used by Shiki:
// https://github.com/JoranHonig/tree-sitter-solidity/blob/master/grammar.js
// https://github.com/shikijs/textmate-grammars-themes/blob/main/packages/tm-grammars/grammars/solidity.json

export const keywords = words(`
	abstract anonymous as assembly break catch constant constructor continue
	contract delete do else emit enum error event external fallback false
	for from function global if import indexed interface internal is
	leave let library mapping memory modifier new override payable pragma
	private public pure receive return returns revert storage struct super
	switch this true try type unchecked using var view virtual while
	calldata immutable transient default case
`);

export const primitiveTypes = words(`
	address bool string byte bytes int uint fixed ufixed
	int8 int16 int24 int32 int40 int48 int56 int64 int72 int80 int88 int96
	int104 int112 int120 int128 int136 int144 int152 int160 int168 int176
	int184 int192 int200 int208 int216 int224 int232 int240 int248 int256
	uint8 uint16 uint24 uint32 uint40 uint48 uint56 uint64 uint72 uint80
	uint88 uint96 uint104 uint112 uint120 uint128 uint136 uint144 uint152
	uint160 uint168 uint176 uint184 uint192 uint200 uint208 uint216 uint224
	uint232 uint240 uint248 uint256
	bytes1 bytes2 bytes3 bytes4 bytes5 bytes6 bytes7 bytes8 bytes9 bytes10
	bytes11 bytes12 bytes13 bytes14 bytes15 bytes16 bytes17 bytes18 bytes19
	bytes20 bytes21 bytes22 bytes23 bytes24 bytes25 bytes26 bytes27 bytes28
	bytes29 bytes30 bytes31 bytes32
`);

export const builtins = words(`
	require assert revert keccak256 sha256 sha3 ripemd160 ecrecover
	addmod mulmod selfdestruct suicide blockhash blobhash gasleft
`);

export const globals = words(`
	this super msg block tx abi now
`);

export const units = words(`
	wei gwei szabo finney ether seconds minutes hours days weeks years
`);

export const natspecTags = words(`
	@title @author @notice @dev @param @return @inheritdoc
`);
