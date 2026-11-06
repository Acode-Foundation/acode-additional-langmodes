function words(value) {
	return value.trim().split(/\s+/);
}

// Reserved words (erl_scan). `maybe` is deliberately absent: it is only a
// keyword when the `maybe_expr` feature is enabled, so the tokenizer decides
// per occurrence (see tokens.js).
export const keywords = words(`
	after begin case catch cond else end fun if let of receive try when
`);

// Word operators are reserved words too, but behave like operators.
export const wordOperators = words(`
	and andalso band bnot bor bsl bsr bxor div not or orelse rem xor
`);

/**
 * Words that must never become a `CallName` (an atom followed by `(`),
 * because the grammar specializes them into keywords and operators.
 */
export const reservedWords = new Set([...keywords, ...wordOperators]);

// Preprocessor and module attributes that can follow a leading `-`.
export const attributes = words(`
	author callback compile deprecated dialyzer doc else elif endif export
	export_type feature file if ifdef ifndef import include include_lib
	module moduledoc nifs on_load opaque optional_callbacks record removed
	spec type undef vsn behaviour behavior define
`);

// Auto-imported BIFs (see erl_internal:bif/2), minus obsolete or internal
// ones such as now/0, load_module/2 and pre_loaded/0.
export const bifs = words(`
	abs alias apply atom_to_binary atom_to_list binary_part binary_to_atom
	binary_to_existing_atom binary_to_float binary_to_integer binary_to_list
	binary_to_term bit_size bitstring_to_list byte_size ceil date demonitor
	disconnect_node element erase error exit float float_to_binary
	float_to_list floor garbage_collect get get_keys group_leader halt hd
	integer_to_binary integer_to_list iolist_size iolist_to_binary is_alive
	is_atom is_binary is_bitstring is_boolean is_float is_function is_integer
	is_list is_map is_map_key is_number is_pid is_port is_process_alive
	is_record is_reference is_tuple length link list_to_atom list_to_binary
	list_to_bitstring list_to_existing_atom list_to_float list_to_integer
	list_to_pid list_to_port list_to_ref list_to_tuple make_ref map_get
	map_size max min monitor monitor_node node nodes open_port pid_to_list
	port_close port_command port_connect port_control port_to_list
	process_flag process_info processes put ref_to_list register registered
	round self setelement size spawn spawn_link spawn_monitor spawn_opt
	spawn_request spawn_request_abandon split_binary statistics
	term_to_binary term_to_iovec throw time tl trunc tuple_size
	tuple_to_list unalias unlink unregister whereis
`);

// Frequently used OTP functions for `module:` completion. Every entry is an
// exported function in OTP.
export const moduleFunctions = {
	application: words(`
		ensure_all_started ensure_started get_all_env get_application get_env
		load set_env start stop unset_env which_applications
	`),
	binary: words(`
		at bin_to_list compile_pattern copy decode_hex encode_hex first last
		list_to_bin longest_common_prefix match matches part
		referenced_byte_size replace split
	`),
	erlang: words(`
		apply binary_to_term cancel_timer demonitor display element
		garbage_collect integer_to_binary is_process_alive make_ref monitor
		monotonic_time phash2 process_flag process_info send_after setelement
		start_timer system_time term_to_binary timestamp unique_integer
	`),
	ets: words(`
		delete delete_all_objects delete_object first foldl foldr info insert
		insert_new lookup lookup_element match match_delete match_object member
		new next select select_count select_delete select_replace tab2list take
		update_counter update_element whereis
	`),
	file: words(`
		close consult copy del_dir delete get_cwd list_dir make_dir make_link
		open read read_file read_line rename script set_cwd write write_file
	`),
	filename: words(`
		absname basename dirname extension flatten join nativename rootname
		split
	`),
	gen_server: words(`
		abcast call cast multi_call reply start start_link stop
	`),
	io: words(`
		columns format fwrite get_chars get_line nl printable_range put_chars
		read setopts write
	`),
	io_lib: words(`format fwrite print write`),
	lists: words(`
		all any append concat delete droplast dropwhile duplicate enumerate
		filter filtermap flatmap flatten foldl foldr foreach join keydelete
		keyfind keymember keymerge keyreplace keysort keystore keytake last map
		mapfoldl mapfoldr max member merge min nth nthtail partition prefix
		reverse search seq sort split splitwith sublist subtract suffix sum
		takewhile uniq unzip unzip3 usort zip zip3 zipwith zipwith3
	`),
	maps: words(`
		filter filtermap find fold foreach from_keys from_list get is_key
		iterator keys map merge new next put remove size take to_list update
		update_with values with without
	`),
	proplists: words(`
		compact delete expand from_map get_all_values get_bool get_keys
		get_value is_defined lookup lookup_all normalize property split
		substitute_aliases to_map unfold
	`),
	string: words(`
		casefold chomp concat equal find is_empty join length lexemes lowercase
		pad prefix replace reverse slice split strip take titlecase to_float
		to_graphemes to_integer tokens trim uppercase
	`),
	supervisor: words(`
		count_children delete_child restart_child start_child start_link
		terminate_child which_children
	`),
	timer: words(`
		apply_after apply_interval cancel hours kill_after minutes now_diff
		seconds send_after send_interval sleep tc
	`),
};

// Additional well-known modules that are offered as `module:` completions
// without a function list.
export const otherModules = words(`
	array base64 calendar code crypto dict gen_event gen_statem logger math os
	queue rand re sets unicode
`);

export const booleans = ["true", "false"];
