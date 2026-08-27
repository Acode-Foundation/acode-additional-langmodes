import { asciidocMode } from "./asciidoc";
import { assemblyMode } from "./assembly";
import { autoHotkeyMode } from "./autohotkey";
import { communityLanguageModes } from "./community";
import { gitignoreMode } from "./gitignore";
import { zigMode } from "./zig";
import { jsoncMode } from "./jsonc";
import { jsonlMode } from "./jsonl";
import { yamlMode } from "./yaml";

import { ejsMode } from "./ejs"
import { gitattributesMode } from "./gitattributes";
import { gleamMode } from "./gleam";
import { gitCommitMsgMode } from "./gitcommitmsg";
import { makefileMode } from "./makefile";
import { solidityMode } from "./solidity";

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
	jsonlMode,
	yamlMode,
	...communityLanguageModes,
  ejsMode,
  gitattributesMode,
  gleamMode,
	gitCommitMsgMode,
	makefileMode,
	solidityMode,
];
