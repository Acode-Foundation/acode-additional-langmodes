function normalizeName(name) {
	return String(name || "")
		.trim()
		.toLowerCase();
}

export class LanguageModeRegistry {
	constructor(editorLanguages) {
		this.editorLanguages = editorLanguages;
		this.registeredNames = [];
	}

	registerAll(modes) {
		for (const mode of modes) {
			this.register(mode);
		}
	}

	register(mode) {
		let name = normalizeName(mode?.name);
		if (!name || typeof mode?.load !== "function") {
			throw new TypeError("Invalid language mode descriptor.");
		}

		let caption = mode.caption || name;
		// Replacement modes coexist with an existing Acode mode of the same
		// name under an "-enhanced" name, and take the canonical name once
		// Acode no longer ships its own.
		if (mode.replaces && this.editorLanguages.get?.(name)) {
			name = `${name}-enhanced`;
			caption = `${caption} (Enhanced)`;
		}

		// Do not shadow a language that a future Acode release may bundle.
		if (this.editorLanguages.get?.(name)) {
			console.info(`[${name}] Language support is already available.`);
			return false;
		}

		const extensions = [...new Set(mode.extensions || [])];
		this.editorLanguages.register(name, extensions, caption, mode.load);
		this.registeredNames.push(name);
		return true;
	}

	unregisterAll() {
		for (const name of this.registeredNames.reverse()) {
			this.editorLanguages.unregister(name);
		}
		this.registeredNames = [];
	}
}
