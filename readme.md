# Additional Language Modes for Acode

Adds CodeMirror language support for languages that are not bundled with Acode.

## Included modes

- AutoHotkey (`.ahk`, `.ah1`, `.ah2`, `.ahk1`, `.ahk2`)
- AsciiDoc (`.adoc`, `.asciidoc`, `.asc`)
- Assembly (`.asm`, `.s`, `.S`, `.nasm`)
- Zig (`.zig`, `.zon`)
- Git ignore (`.gitignore`, `.ignore`, Git exclude-style files)
- Git attributes (`.gitattributes`, Git attributes-style files)
- Git Commit Message (`^COMMIT_EDITMSG`, `^commit_editmsg`)
- JSONC (`.jsonc`)
- JSON Lines (`.jsonl`, `.ndjson`, `.jsonlines`, `.ldjson`, `.ldj`)
- YAML Enhanced (`.yaml`, `.yml`), with structural parsing and core-schema scalar highlighting
- BibTeX (`.bib`)
- Elixir (`.ex`, `.exs`, `.eex`, `.heex`, `.leex`)
- EJS (`.ejs`)
- GolfScript (`.gs`)
- GraphQL (`.graphql`, `.graphqls`, `.gql`)
- Graphviz DOT (`.dot`, `.gv`)
- HCL / Terraform (`.hcl`, `.tf`, `.tfvars`)
- J (`.ijs`)
- Janet (`.janet`)
- Pkl (`.pkl`)
- Svelte (`.svelte`)
- WGSL (`.wgsl`)
- Gleam (`.gleam`)
- Makefile (`.mk`, `.mak`, `.make`, `Makefile`, `makefile`, `GNUmakefile`)
- Solidity (`.sol`)

Community modes are registered only when Acode does not already provide a mode
with the same name. Languages already covered by Acode's
`@codemirror/language-data` registry are intentionally not duplicated.

## Adding another language

1. Create `src/languages/<language>/index.js`.
2. Export a descriptor containing `name`, `caption`, `extensions`, and a lazy
   `load()` function that returns a CodeMirror extension or `LanguageSupport`.
3. Add the descriptor to `src/languages/index.js`.

The language can use `StreamLanguage`, `LRLanguage` with a Lezer parser, or an
existing CodeMirror language package. Registration and cleanup are handled by
the shared registry.

## Build

```sh
bun install
bun run check
bun run build
```
