import * as bundled from "@lezer/lr";

/**
 * Prefer Acode's shared @lezer/lr when the host exposes it (avoids
 * duplicate parser runtimes). Fall back to a copy bundled in this plugin
 * for older Acode builds that do not yet re-export @lezer/lr.
 */
function resolveLr() {
	try {
		const host =
			typeof acode !== "undefined" && typeof acode.require === "function"
				? acode.require("@lezer/lr")
				: null;
		if (
			host &&
			typeof host.LRParser === "function" &&
			typeof host.ExternalTokenizer === "function" &&
			typeof host.ContextTracker === "function"
		) {
			return host;
		}
	} catch {
		// Host require failed or module missing.
	}
	return bundled;
}

const lr = resolveLr();

export const {
	ContextTracker,
	ExternalTokenizer,
	LocalTokenGroup,
	LRParser,
} = lr;
