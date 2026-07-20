import { asciidocMode } from "./asciidoc";
import { assemblyMode } from "./assembly";
import { autoHotkeyMode } from "./autohotkey";
import { communityLanguageModes } from "./community";
import { gitignoreMode } from "./gitignore";
import { zigMode } from "./zig";
import { jsoncMode } from "./jsonc";
import { yamlMode } from "./yaml";

import { ejsMode } from "./ejs"
import { gitattributesMode } from "./gitattributes";
import { gleamMode } from "./gleam";
import { gitCommitMsgMode } from "./gitcommitmsg";

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
	yamlMode,
	...communityLanguageModes,
  ejsMode,
  gitattributesMode,
  gleamMode,
	gitCommitMsgMode
];
