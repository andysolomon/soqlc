import { createToken, Lexer } from "chevrotain";

export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

export const LineComment = createToken({
  name: "LineComment",
  pattern: /--[^\n\r]*/,
  group: Lexer.SKIPPED,
});

export const BlockComment = createToken({
  name: "BlockComment",
  pattern: /\/\*[\s\S]*?\*\//,
  group: Lexer.SKIPPED,
});

export const Identifier = createToken({
  name: "Identifier",
  pattern: /[A-Za-z_][A-Za-z0-9_]*/,
});

function kw(name: string, literal: string) {
  return createToken({
    name,
    pattern: new RegExp(literal, "i"),
    longer_alt: Identifier,
  });
}

// Longer keywords must come before shorter ones that share a prefix. Chevrotain
// matches tokens in array order; e.g. `Order` ("ORDER") must precede `Or` ("OR")
// or the latter will swallow the prefix.
export const Select = kw("Select", "SELECT");
export const From = kw("From", "FROM");
export const Where = kw("Where", "WHERE");
export const Order = kw("Order", "ORDER");
export const And = kw("And", "AND");
export const Or = kw("Or", "OR");
export const Nulls = kw("Nulls", "NULLS");
export const Not = kw("Not", "NOT");
export const In = kw("In", "IN");
export const Like = kw("Like", "LIKE");
export const By = kw("By", "BY");
export const Asc = kw("Asc", "ASC");
export const Desc = kw("Desc", "DESC");
export const First = kw("First", "FIRST");
export const Last = kw("Last", "LAST");
export const Group = kw("Group", "GROUP");
export const Having = kw("Having", "HAVING");
export const Limit = kw("Limit", "LIMIT");
export const Offset = kw("Offset", "OFFSET");
export const True = kw("True", "TRUE");
export const False = kw("False", "FALSE");
export const Null = kw("Null", "NULL");

const DATE_LITERAL_RE = new RegExp(
  [
    "(?:LAST|NEXT)_N_(?:DAYS|WEEKS|MONTHS|QUARTERS|YEARS|FISCAL_QUARTERS|FISCAL_YEARS):\\d+",
    "N_(?:DAYS|WEEKS|MONTHS|QUARTERS|YEARS|FISCAL_QUARTERS|FISCAL_YEARS)_AGO:\\d+",
    "LAST_(?:90|180)_DAYS",
    "TODAY",
    "YESTERDAY",
    "TOMORROW",
    "THIS_WEEK",
    "LAST_WEEK",
    "NEXT_WEEK",
    "THIS_MONTH",
    "LAST_MONTH",
    "NEXT_MONTH",
    "THIS_QUARTER",
    "LAST_QUARTER",
    "NEXT_QUARTER",
    "THIS_YEAR",
    "LAST_YEAR",
    "NEXT_YEAR",
    "THIS_FISCAL_QUARTER",
    "LAST_FISCAL_QUARTER",
    "NEXT_FISCAL_QUARTER",
    "THIS_FISCAL_YEAR",
    "LAST_FISCAL_YEAR",
    "NEXT_FISCAL_YEAR",
  ].join("|"),
  "i",
);

export const DateLiteralToken = createToken({
  name: "DateLiteralToken",
  pattern: DATE_LITERAL_RE,
  longer_alt: Identifier,
});

export const StringLiteral = createToken({
  name: "StringLiteral",
  pattern: /'(?:[^'\\]|\\.|'')*'/,
});

export const NumberLiteral = createToken({
  name: "NumberLiteral",
  pattern: /-?\d+(?:\.\d+)?/,
});

export const BindParam = createToken({
  name: "BindParam",
  pattern: /:[A-Za-z_][A-Za-z0-9_]*/,
});

export const LParen = createToken({ name: "LParen", pattern: /\(/ });
export const RParen = createToken({ name: "RParen", pattern: /\)/ });
export const Comma = createToken({ name: "Comma", pattern: /,/ });
export const Dot = createToken({ name: "Dot", pattern: /\./ });
export const Semicolon = createToken({ name: "Semicolon", pattern: /;/ });

export const NotEq = createToken({ name: "NotEq", pattern: /!=|<>/ });
export const Lte = createToken({ name: "Lte", pattern: /<=/ });
export const Gte = createToken({ name: "Gte", pattern: />=/ });
export const Lt = createToken({ name: "Lt", pattern: /</ });
export const Gt = createToken({ name: "Gt", pattern: />/ });
export const Eq = createToken({ name: "Eq", pattern: /=/ });

export const allTokens = [
  WhiteSpace,
  LineComment,
  BlockComment,
  StringLiteral,
  NumberLiteral,
  BindParam,
  DateLiteralToken,
  Select,
  From,
  Where,
  Order,
  And,
  Or,
  Nulls,
  Not,
  In,
  Like,
  By,
  Asc,
  Desc,
  First,
  Last,
  Group,
  Having,
  Limit,
  Offset,
  True,
  False,
  Null,
  Identifier,
  LParen,
  RParen,
  Comma,
  Dot,
  Semicolon,
  NotEq,
  Lte,
  Gte,
  Lt,
  Gt,
  Eq,
];

export const SoqlLexer = new Lexer(allTokens, { positionTracking: "full" });
