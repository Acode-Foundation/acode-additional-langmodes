import { asciidocMode } from "./asciidoc";
import { assemblyMode } from "./assembly";
import { autoHotkeyMode } from "./autohotkey";
import { communityLanguageModes } from "./community";
import { gitignoreMode } from "./gitignore";
import { zigMode } from "./zig";
import { jsoncMode } from "./jsonc";

import { ejsMode } from "./ejs"

/**
 * Add future language descriptors here. Each descriptor owns its metadata and
 * lazy CodeMirror loader, so adding a mode doesn't require changing plugin
 * lifecycle code.
 */
export const languageModes = [
	asciidocMode,
	assemblyMode,
	autoHotkeyMode,
	zigMode,
	gitignoreMode,
	jsoncMode,
	...communityLanguageModes,
  ejsMode,
];
