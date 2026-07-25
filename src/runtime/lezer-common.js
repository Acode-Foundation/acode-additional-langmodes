import * as bundled from "@lezer/common";

/**
 * Prefer Acode's shared @lezer/common when available; otherwise use the
 * copy bundled with this plugin (older Acode did not expose this module).
 *
 * Re-export the full package surface so nested consumers (e.g. a bundled
 * @lezer/lr) can import Parser, Tree, NodeProp, etc. through this shim.
 */
function resolveCommon() {
	try {
		const host =
			typeof acode !== "undefined" && typeof acode.require === "function"
				? acode.require("@lezer/common")
				: null;
		if (host && typeof host.parseMixed === "function" && host.Parser) {
			return host;
		}
	} catch {
		// Host require failed or module missing.
	}
	return bundled;
}

const common = resolveCommon();

export const {
	DefaultBufferLength,
	IterMode,
	MountedTree,
	NodeProp,
	NodeSet,
	NodeType,
	NodeWeakMap,
	Parser,
	Tree,
	TreeBuffer,
	TreeCursor,
	TreeFragment,
	parseMixed,
} = common;
