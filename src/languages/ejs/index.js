import { completeFromList, snippetCompletion } from "@codemirror/autocomplete";
import { html } from "@codemirror/lang-html";
import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";
import { Prec, EditorState } from "@codemirror/state";
import {
  foldInside,
  foldNodeProp,
  foldService,
  indentNodeProp,
  indentService,
  LRLanguage,
  LanguageSupport,
  syntaxTree,
} from "@codemirror/language";
import { parseMixed } from "@lezer/common";
import { styleTags, tags as t } from "@lezer/highlight";
import { parser } from "./parser";

// Follows the Codemirror Language Pattern.
// Uses the following grammars (with certain modifications to support other things):
// 1. https://github.com/dannyhw/ejs-language-tools/blob/main/syntaxes/js-ejs-injection.tmLanguage.json
// 2. https://github.com/Digitalbrainstem/ejs-grammar/blob/master/syntaxes/ejs.json
// other things such as html comments inside ejs block, ejs comments special cases, and ...
// Eyes on Javascript Highlighting, html autocompletion inside ejs blocks.
// Written by [UnschooledGamer](https://github.com/UnschooledGamer) & Handled by Acode-Foundation.
// Under the Same License as Project's License File at https://github.com/Acode-Foundation/acode-additional-langmodes.

const htmlSupport = html({ matchClosingTags: false });
const javascriptSupport = javascript();

function tagIndent(context) {
  return /^\s*%>/.test(context.textAfter)
    ? context.baseIndent
    : context.baseIndent + context.unit;
}

function foldDelimitedToken(openLength, closeLength) {
  return (node, state) => {
    const from = node.from + openLength;
    const to = node.to - closeLength;
    return state.doc.lineAt(from).number < state.doc.lineAt(to).number
      ? { from, to }
      : null;
  };
}

const foldEjsComment = foldDelimitedToken(3, 2);
const foldHtmlComment = foldDelimitedToken(4, 3);

function ejsBlockContent(state, node) {
  const content = node.getChild("Content");
  return content ? state.sliceDoc(content.from, content.to).trim() : "";
}

function braceStats(source) {
  let opens = 0;
  let closes = 0;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === "{") opens++;
    else if (char === "}") closes++;
  }
  return { opens, closes, delta: opens - closes };
}

function isClosingBlock(source) {
  return /^(?:}|else\b|catch\b|finally\b)/.test(source);
}

function ejsBlocks(state) {
  const blocks = [];
  const cursor = syntaxTree(state).cursor();

  do {
    if (cursor.name !== "EjsBlock") continue;
    const node = cursor.node;
    const content = ejsBlockContent(state, node);
    const stats = braceStats(content);
    blocks.push({
      from: node.from,
      to: node.to,
      lineFrom: state.doc.lineAt(node.from).from,
      lineTo: state.doc.lineAt(node.to).to,
      content,
      opens: stats.opens,
      closesCount: stats.closes,
      delta: stats.delta,
      closes: isClosingBlock(content),
    });
  } while (cursor.next());

  return blocks;
}

function columnAt(state, pos) {
  const line = state.doc.lineAt(pos);
  let column = 0;
  for (const char of line.text.slice(0, pos - line.from)) {
    column += char === "\t" ? state.tabSize - (column % state.tabSize) : 1;
  }
  return column;
}

function pushOpenBlocks(stack, block) {
  for (let count = 0; count < block.opens; count++) stack.push(block);
}

function applyBlockToStack(stack, block) {
  for (let count = 0; count < block.closesCount; count++) stack.pop();
  pushOpenBlocks(stack, block);
}

function ejsIndentAt(state, pos, simulatedBreak) {
  const line = state.doc.lineAt(pos);
  const before = simulatedBreak ?? line.from;
  const blocks = ejsBlocks(state);
  const stack = [];

  for (const block of blocks) {
    if (block.from >= before) break;
    applyBlockToStack(stack, block);
  }

  const firstBlock = blocks.find((block) => block.lineFrom === line.from);
  if (firstBlock?.closes) {
    const opener = stack[stack.length - 1];
    return opener ? columnAt(state, opener.from) : 0;
  }

  const opener = stack[stack.length - 1];
  return opener ? columnAt(state, opener.from + 2) : 0;
}

function ejsFold(state, lineStart, lineEnd) {
  const blocks = ejsBlocks(state);
  const startIndex = blocks.findIndex((block) => {
    return block.lineFrom === lineStart && block.delta > 0;
  });
  if (startIndex < 0) return null;

  let depth = 0;
  for (let index = startIndex; index < blocks.length; index++) {
    const block = blocks[index];
    depth += block.delta;
    if (depth <= 0 && index > startIndex) {
      return block.lineFrom > lineEnd ? { from: lineEnd, to: block.lineFrom } : null;
    }
  }

  return null;
}

const ejsIndentService = indentService.of((context, pos) => {
  return ejsIndentAt(context.state, pos, context.simulatedBreak);
});
const ejsFoldService = foldService.of(ejsFold);

function containsHtmlMarkup(input, from, to) {
  return /<\/?[A-Za-z][\w:-]*(?:\s|\/?>)|<!--|<!doctype/i.test(input.read(from, to));
}


function startsInHtmlComment(state, pos, side) {
  const line = state.doc.lineAt(pos);
  const firstNonSpace = line.from + (/^\s*/.exec(line.text)[0].length);
  const target = Math.max(pos, firstNonSpace);
  let node = syntaxTree(state).resolveInner(target, side);

  for (let current = node; current; current = current.parent) {
    if (current.name === "HtmlComment") return true;
    if (current.name === "Template") break;
  }

  return false;
}

function tagNameAround(state, pos) {
  const tree = syntaxTree(state);
  for (const side of [-1, 1]) {
    let node = tree.resolveInner(pos, side);
    for (let current = node; current; current = current.parent) {
      if (current.name === "TagName") return current;
      if (current.name === "Template") break;
    }
  }
  return null;
}

function matchingTagName(state, tagName) {
  const tag = tagName.parent;
  const element = tag?.parent;
  if (!tag || !element?.getChild) return null;

  const open = element.getChild("OpenTag");
  const close = element.getChild("CloseTag");
  if (!open || !close) return null;

  const peer = tag.name === "OpenTag" ? close.getChild("TagName") :
    tag.name === "CloseTag" ? open.getChild("TagName") : null;
  if (!peer) return null;

  const name = state.sliceDoc(tagName.from, tagName.to);
  const peerName = state.sliceDoc(peer.from, peer.to);
  return name === peerName ? peer : null;
}

function changesTouch(changes, from, to) {
  let touched = false;
  changes.iterChanges((fromA, toA) => {
    if (fromA <= to && toA >= from) touched = true;
  });
  return touched;
}

const htmlTagNameSync = EditorState.transactionFilter.of((transaction) => {
  if (!transaction.docChanged) return transaction;

  const mirrored = [];
  transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (inserted.length > 1 || fromA === toA && inserted.length === 0) return;

    const tagName = tagNameAround(transaction.startState, fromA);
    if (!tagName || fromA < tagName.from || toA > tagName.to) return;

    const peer = matchingTagName(transaction.startState, tagName);
    if (!peer || changesTouch(transaction.changes, peer.from, peer.to)) return;

    const fromOffset = fromA - tagName.from;
    const toOffset = toA - tagName.from;
    mirrored.push({
      from: peer.from + fromOffset,
      to: peer.from + toOffset,
      insert: inserted.toString(),
    });
  });

  return mirrored.length ? [transaction, { changes: mirrored }] : transaction;
});

const htmlCommentTokens = Prec.highest(EditorState.languageData.of((state, pos, side) => {
  return startsInHtmlComment(state, pos, side)
    ? [{ commentTokens: { block: { open: "<!--", close: "-->" } } }]
    : [];
}));

function ejsContentScriptRanges(input, from, to) {
  const source = input.read(from, to);
  const openBraces = [];
  const excluded = new Set();

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === "{") {
      openBraces.push(index);
    } else if (char === "}") {
      if (openBraces.length) openBraces.pop();
      else excluded.add(index);
    }
  }

  for (const index of openBraces) excluded.add(index);
  if (!excluded.size) return [{ from, to }];

  const ranges = [];
  let start = 0;
  for (let index = 0; index < source.length; index++) {
    if (!excluded.has(index)) continue;
    if (start < index) ranges.push({ from: from + start, to: from + index });
    start = index + 1;
  }
  if (start < source.length) ranges.push({ from: from + start, to });
  return ranges.filter((range) => /\S/.test(input.read(range.from, range.to)));
}

/**
 * EJS Language Definition for Lezer
 *
 * Patterns:
 * - <%# ... %> : Comments
 * - <%= ... %> : Output (escaped)
 * - <%-  ... %>: Output (unescaped)
 * - <% ... %>  : Code blocks
 * - <%%       : Literal <%
 */

export const ejsLanguage = LRLanguage.define({
  name: "ejs",
  parser: parser.configure({
    wrap: parseMixed((node, input) => {
      if (node.name === "Template") {
        return {
          parser: htmlSupport.language.parser,
          overlay: (overlayNode) => {
            return overlayNode.name === "Text" &&
              containsHtmlMarkup(input, overlayNode.from, overlayNode.to);
          },
        };
      }

      if (node.name === "Content" && node.node.parent.name !== "EjsComment") {
        const overlay = ejsContentScriptRanges(input, node.from, node.to);
        return overlay.length ? { parser: javascriptLanguage.parser, overlay } : null;
      }

      return null;
    }),
    props: [
      styleTags({
        "EjsComment HtmlComment": t.comment,
        "ExprStart BlockStart TagEnd": t.keyword,
        LiteralStart: t.string,
        EscapedTag: t.string,
      }),
      indentNodeProp.add({
        EjsExpression: tagIndent,
        EjsBlock: tagIndent,
      }),
      foldNodeProp.add({
        EjsExpression: foldInside,
        EjsBlock: foldInside,
        EjsComment: foldEjsComment,
        HtmlComment: foldHtmlComment,
      })
    ]
  }),
  languageData: {
    commentTokens: {
      block: { open: "<%#", close: "%>" }
    },
    indentOnInput: /^\s*(?:else|catch|finally)\b/,
  }
});

/**
 * EJS Language Support for CodeMirror
 */
export function ejs() {
  return new LanguageSupport(ejsLanguage, [
    ejsIndentService,
    ejsFoldService,
    htmlTagNameSync,
    htmlCommentTokens,
    htmlSupport.support,
    javascriptSupport.support,
    ejsLanguage.data.of({ autocomplete: ejsCompletionSource })
  ]);
}

/**
 * Autocomplete suggestions for EJS tags
 */
const ejsAutocomplete = [
  snippetCompletion("<% ${} %>", { label: "<% %>", type: "keyword", boost: 99 }),
  snippetCompletion("<%= ${} %>", { label: "<%= %>", type: "keyword", boost: 98 }),
  snippetCompletion("<%- ${} %>", { label: "<%- %>", type: "keyword", boost: 97 }),
  snippetCompletion("<%# ${} %>", { label: "<%# %>", type: "comment", boost: 96 }),
  snippetCompletion("<% for (const ${item} of ${items}) { %>\n\t${}\n<% } %>", {
    label: "for",
    type: "keyword",
    detail: "EJS loop",
    boost: 95,
  }),
  snippetCompletion("<% if (${condition}) { %>\n\t${}\n<% } %>", {
    label: "if",
    type: "keyword",
    detail: "EJS if statement",
    boost: 94,
  }),
  snippetCompletion("<% if (${condition}) { %>\n\t${}\n<% } else { %>\n\t${}\n<% } %>", {
    label: "ifelse",
    type: "keyword",
    detail: "EJS if-else statement",
    boost: 93,
  }),
  snippetCompletion("<% } else { %>", {
    label: "else",
    type: "keyword",
    detail: "EJS else block",
    boost: 92,
  }),
  snippetCompletion("<% } else if (${condition}) { %>", {
    label: "elseif",
    type: "keyword",
    detail: "EJS else-if block",
    boost: 91,
  }),
  snippetCompletion("<% ${items}.forEach((${item}) => { %>\n\t${}\n<% }) %>", {
    label: "foreach",
    type: "keyword",
    detail: "EJS forEach loop",
    boost: 90,
  }),
  snippetCompletion("<% while (${condition}) { %>\n\t${}\n<% } %>", {
    label: "while",
    type: "keyword",
    detail: "EJS while loop",
    boost: 89,
  }),
  snippetCompletion("<%- include('${path}') %>", {
    label: "include",
    type: "keyword",
    detail: "EJS include",
    boost: 88,
  }),
];

const ejsSnippetCompletions = completeFromList(ejsAutocomplete);

function insideEjsTag(state, pos) {
  for (let node = syntaxTree(state).resolveInner(pos, -1); node; node = node.parent) {
    if (node.name === "EjsExpression" || node.name === "EjsBlock" || node.name === "EjsComment") return true;
    if (node.name === "Template") break;
  }
  return false;
}

function ejsCompletionSource(context) {
  return insideEjsTag(context.state, context.pos) ? null : ejsSnippetCompletions(context);
}

export const ejsMode = {
  name: "ejs",
  caption: "EJS",
  extensions: ["ejs"],
  load: ejs,
};
