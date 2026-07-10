import { ExternalTokenizer } from "@lezer/lr";
import {
  MessageNormal,
  MessageWarn,
  MessageIllegal,
  CommentWhole,
  CommentMarker,
  StatusChanged,
  StatusInserted,
  StatusDeleted,
  FileType,
  CommentColon,
  CommentValue,
  DiffGitLine,
  DiffHunkHeader,
  DiffMetaLine,
  DiffAddedLine,
  DiffRemovedLine,
  DiffContextLine,
} from "./parser.terms.js";

const COMMIT_LINE_WARM_LENGTH = 50;
const COMMIT_LINE_MAX_LENGTH = 72;

const HASH = 35; // '#'
const PLUS = 43; // '+'
const MINUS = 45; // '-'
const NEWLINE = 10; // '\n'

const metadataChangedOrRenamed = /^#\t((?:modified|renamed):.*)$/;
const metadataNewFile = /^#\t(new file:.*)$/;
const metadataDeleted = /^#\t(deleted.*)$/;
const metadataGeneric = /^#\t([^:]+)(:\s*)(.*)$/;

const diffHunkHeader = /^@@.*@@/;
const diffMetaLine = /^(index |--- |\+\+\+ )/;

function findLineEnd(input, from) {
  let i = 0;
  const start = from === undefined ? 0 : from - input.pos;
  for (;;) {
    const ch = input.peek(start + i);
    if (ch < 0 || ch === NEWLINE) return input.pos + start + i;
    i++;
  }
}

function findLineStart(input) {
  let i = 0;
  for (;;) {
    const ch = input.peek(-i - 1);
    if (ch < 0 || ch === NEWLINE) return input.pos - i;
    i++;
  }
}

function matchPrefix(input, prefix, offset) {
  const base = offset || 0;
  for (let i = 0; i < prefix.length; i++) {
    if (input.peek(base + i) !== prefix.charCodeAt(i)) return false;
  }
  return true;
}

function planMetadataLine(line) {
  let m = metadataChangedOrRenamed.exec(line);
  if (m) {
    return [
      { len: 2, term: CommentMarker },
      { len: m[1].length, term: StatusChanged },
    ];
  }

  m = metadataNewFile.exec(line);
  if (m) {
    return [
      { len: 2, term: CommentMarker },
      { len: m[1].length, term: StatusInserted },
    ];
  }

  m = metadataDeleted.exec(line);
  if (m) {
    return [
      { len: 2, term: CommentMarker },
      { len: m[1].length, term: StatusDeleted },
    ];
  }

  m = metadataGeneric.exec(line);
  if (m) {
    const [, fileType, separator, filename] = m;
    return [
      { len: 2, term: CommentMarker },
      { len: fileType.length, term: FileType },
      { len: separator.length, term: CommentColon },
      { len: filename.length, term: CommentValue },
    ];
  }

  return [{ len: line.length, term: CommentWhole }];
}

export const diffGitLineTokenizer = new ExternalTokenizer((input) => {
  if (input.pos !== findLineStart(input)) return; // only valid at sol
  if (!matchPrefix(input, "diff --git")) return;
  const lineEnd = findLineEnd(input);
  input.acceptToken(DiffGitLine, lineEnd - input.pos);
});

export const preambleTokenizer = new ExternalTokenizer((input) => {
  const c0 = input.peek(0);
  if (c0 < 0) return;

  const lineStart = findLineStart(input);

  if (input.pos === lineStart) {
    if (matchPrefix(input, "diff --git")) return;

    if (c0 === HASH) {
      classifyCommentSegment(input, lineStart);
      return;
    }

    classifyMessageSegment(input, lineStart);
    return;
  }

  const firstChar = input.peek(lineStart - input.pos);
  if (firstChar === HASH) {
    classifyCommentSegment(input, lineStart);
  } else {
    classifyMessageSegment(input, lineStart);
  }
});

function classifyCommentSegment(input, lineStart) {
  const lineEnd = findLineEnd(input, lineStart);
  const line = input.read(lineStart, lineEnd);
  const plan = planMetadataLine(line);
  const offset = input.pos - lineStart;

  let cum = 0;
  for (const seg of plan) {
    if (cum === offset) {
      if (seg.len > 0) input.acceptToken(seg.term, seg.len);
      return;
    }
    cum += seg.len;
  }
}

function classifyMessageSegment(input, lineStart) {
  const lineEnd = findLineEnd(input, lineStart);
  const lineLen = lineEnd - lineStart;
  const col = input.pos - lineStart;
  if (lineLen === 0 || col >= lineLen) return;

  if (col < COMMIT_LINE_WARM_LENGTH) {
    const segLen = Math.min(COMMIT_LINE_WARM_LENGTH, lineLen) - col;
    if (segLen > 0) input.acceptToken(MessageNormal, segLen);
    return;
  }

  if (col < COMMIT_LINE_MAX_LENGTH) {
    const segLen = Math.min(COMMIT_LINE_MAX_LENGTH, lineLen) - col;
    if (segLen > 0) input.acceptToken(MessageWarn, segLen);
    return;
  }

  const segLen = lineLen - col;
  if (segLen > 0) input.acceptToken(MessageIllegal, segLen);
}

export const diffContentTokenizer = new ExternalTokenizer((input) => {
  const c0 = input.peek(0);
  if (c0 < 0) return;
  if (matchPrefix(input, "diff --git")) return;

  const lineEnd = findLineEnd(input);
  const lineLen = lineEnd - input.pos;
  if (lineLen === 0) return;

  const line = input.read(input.pos, lineEnd);

  if (diffHunkHeader.test(line)) {
    input.acceptToken(DiffHunkHeader, lineLen);
    return;
  }

  if (diffMetaLine.test(line)) {
    input.acceptToken(DiffMetaLine, lineLen);
    return;
  }

  if (c0 === PLUS) {
    input.acceptToken(DiffAddedLine, lineLen);
    return;
  }

  if (c0 === MINUS) {
    input.acceptToken(DiffRemovedLine, lineLen);
    return;
  }

  input.acceptToken(DiffContextLine, lineLen);
});
