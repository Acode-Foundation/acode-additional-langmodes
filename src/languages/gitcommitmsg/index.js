import {
  foldInside,
  foldNodeProp,
  LanguageSupport,
  LRLanguage,
} from "@codemirror/language";
import { parser } from "./parser";
import { styleTags, tags } from "@lezer/highlight";

const configuredParser = parser.configure({
  props: [
    styleTags({
      MessageNormal: tags.content,
      MessageWarn: tags.invalid,
      MessageIllegal: tags.invalid,

      CommentWhole: tags.comment,
      CommentMarker: tags.comment,
      CommentColon: tags.comment,
      StatusChanged: tags.changed,
      StatusInserted: tags.inserted,
      StatusDeleted: tags.deleted,
      FileType: tags.keyword,
      CommentValue: tags.string,

      DiffGitLine: tags.heading,
      DiffMetaLine: tags.meta,
      DiffHunkHeader: tags.meta,
      DiffAddedLine: tags.inserted,
      DiffRemovedLine: tags.deleted,
    }),
    foldNodeProp.add({
      DiffBlock(node) {
        const header = node.firstChild;
        if (!header || header.to >= node.to) return null;
        return { from: header.to, to: node.to };
      },
    }),
  ],
});

const gitCommitMsgLanguage = LRLanguage.define({
  name: "gitcommitmsg",
  parser: configuredParser,
  languageData: {
    commentTokens: {
      line: "#",
    },
  },
});

export function gitCommitMsg() {
  return new LanguageSupport(gitCommitMsgLanguage);
}

export const gitCommitMsgMode = {
  name: "gitcommitmsg",
  caption: "Git Commit Message",
  extensions: ["^COMMIT_EDITMSG", "^commit_editmsg"],
  load: gitCommitMsg,
};
