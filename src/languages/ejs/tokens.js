import { ExternalTokenizer } from "@lezer/lr";
import { EjsComment } from "./parser.terms.js";

const lessThan = 60;
const percent = 37;
const hash = 35;
const greaterThan = 62;

export const ejsComment = new ExternalTokenizer((input) => {
  if (input.next !== lessThan || input.peek(1) !== percent || input.peek(2) !== hash) return;

  input.advance();
  input.advance();
  input.advance();

  let depth = 0;
  for (;;) {
    if (input.next < 0) {
      input.acceptToken(EjsComment);
      return;
    }

    if (input.next === lessThan && input.peek(1) === percent) {
      depth++;
      input.advance();
      input.advance();
      continue;
    }

    if (input.next === percent && input.peek(1) === greaterThan) {
      input.advance();
      input.advance();
      if (depth === 0) {
        input.acceptToken(EjsComment);
        return;
      }
      depth--;
      continue;
    }

    input.advance();
  }
});