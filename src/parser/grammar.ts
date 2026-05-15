import { CstParser, type CstNode, type IToken } from "chevrotain";
import {
  allTokens,
  And,
  Asc,
  BindParam,
  By,
  Comma,
  DateLiteralToken,
  Desc,
  Dot,
  Eq,
  False,
  First,
  From,
  Group,
  Gt,
  Gte,
  Having,
  Identifier,
  In,
  Last,
  Like,
  Limit,
  LParen,
  Lt,
  Lte,
  Not,
  NotEq,
  Null,
  Nulls,
  NumberLiteral,
  Offset,
  Or,
  Order,
  RParen,
  Select,
  StringLiteral,
  True,
  Where,
} from "./lexer.js";

export class SoqlParser extends CstParser {
  constructor() {
    super(allTokens, { recoveryEnabled: false });
    this.performSelfAnalysis();
  }

  public selectStatement = this.RULE("selectStatement", () => {
    this.CONSUME(Select);
    this.SUBRULE(this.selectList);
    this.CONSUME(From);
    this.CONSUME(Identifier);
    this.OPTION(() => this.SUBRULE(this.whereClause));
    this.OPTION2(() => this.SUBRULE(this.groupByClause));
    this.OPTION3(() => this.SUBRULE(this.havingClause));
    this.OPTION4(() => this.SUBRULE(this.orderByClause));
    this.OPTION5(() => this.SUBRULE(this.limitClause));
    this.OPTION6(() => this.SUBRULE(this.offsetClause));
  });

  private selectList = this.RULE("selectList", () => {
    this.SUBRULE(this.selectItem);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.SUBRULE2(this.selectItem);
    });
  });

  private selectItem = this.RULE("selectItem", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.subqueryItem) },
      { ALT: () => this.SUBRULE(this.aggregateOrField) },
    ]);
    this.OPTION(() => this.CONSUME(Identifier, { LABEL: "alias" }));
  });

  private subqueryItem = this.RULE("subqueryItem", () => {
    this.CONSUME(LParen);
    this.SUBRULE(this.selectStatement);
    this.CONSUME(RParen);
  });

  private aggregateOrField = this.RULE("aggregateOrField", () => {
    this.OR({
      DEF: [
        {
          GATE: () => this.isAggregateCall(),
          ALT: () => this.SUBRULE(this.aggregateCall),
        },
        { ALT: () => this.SUBRULE(this.fieldPath) },
      ],
    });
  });

  private isAggregateCall(): boolean {
    const next = this.LA(1);
    const after = this.LA(2);
    if (!next || next.tokenType !== Identifier) return false;
    if (!after || after.tokenType !== LParen) return false;
    const name = next.image.toUpperCase();
    return name === "COUNT" || name === "SUM" || name === "AVG" || name === "MIN" || name === "MAX";
  }

  private aggregateCall = this.RULE("aggregateCall", () => {
    this.CONSUME(Identifier, { LABEL: "fn" });
    this.CONSUME(LParen);
    this.OPTION(() => this.SUBRULE(this.fieldPath));
    this.CONSUME(RParen);
  });

  private fieldPath = this.RULE("fieldPath", () => {
    this.CONSUME(Identifier);
    this.MANY(() => {
      this.CONSUME(Dot);
      this.CONSUME2(Identifier);
    });
  });

  private whereClause = this.RULE("whereClause", () => {
    this.CONSUME(Where);
    this.SUBRULE(this.expression);
  });

  private expression = this.RULE("expression", () => {
    this.SUBRULE(this.andExpr);
    this.MANY(() => {
      this.CONSUME(Or);
      this.SUBRULE2(this.andExpr);
    });
  });

  private andExpr = this.RULE("andExpr", () => {
    this.SUBRULE(this.notExpr);
    this.MANY(() => {
      this.CONSUME(And);
      this.SUBRULE2(this.notExpr);
    });
  });

  private notExpr = this.RULE("notExpr", () => {
    this.OPTION({
      GATE: () => {
        const t = this.LA(1);
        return t.tokenType === Not && this.LA(2)?.tokenType !== In && this.LA(2)?.tokenType !== Like;
      },
      DEF: () => this.CONSUME(Not),
    });
    this.SUBRULE(this.primaryExpr);
  });

  private primaryExpr = this.RULE("primaryExpr", () => {
    this.OR([
      {
        GATE: () => this.LA(1).tokenType === LParen,
        ALT: () => {
          this.CONSUME(LParen);
          this.SUBRULE(this.expression);
          this.CONSUME(RParen);
        },
      },
      { ALT: () => this.SUBRULE(this.predicate) },
    ]);
  });

  private predicate = this.RULE("predicate", () => {
    this.SUBRULE(this.predicateLhs);
    this.OR([
      { ALT: () => this.SUBRULE(this.comparePart) },
      { ALT: () => this.SUBRULE(this.inPart) },
      { ALT: () => this.SUBRULE(this.likePart) },
    ]);
  });

  private predicateLhs = this.RULE("predicateLhs", () => {
    this.OR({
      DEF: [
        {
          GATE: () => this.isAggregateCall(),
          ALT: () => this.SUBRULE(this.aggregateCall),
        },
        { ALT: () => this.SUBRULE(this.fieldPath) },
      ],
    });
  });

  private comparePart = this.RULE("comparePart", () => {
    this.OR([
      { ALT: () => this.CONSUME(Eq) },
      { ALT: () => this.CONSUME(NotEq) },
      { ALT: () => this.CONSUME(Lte) },
      { ALT: () => this.CONSUME(Gte) },
      { ALT: () => this.CONSUME(Lt) },
      { ALT: () => this.CONSUME(Gt) },
    ]);
    this.SUBRULE(this.value);
  });

  private inPart = this.RULE("inPart", () => {
    this.OPTION(() => this.CONSUME(Not));
    this.CONSUME(In);
    this.CONSUME(LParen);
    this.OR([
      {
        // Whole-list bind form: `IN (:param)` — only when the param is the
        // single token inside the parens.
        GATE: () =>
          this.LA(1).tokenType === BindParam && this.LA(2).tokenType === RParen,
        ALT: () => this.CONSUME(BindParam),
      },
      {
        ALT: () => {
          this.SUBRULE(this.value);
          this.MANY(() => {
            this.CONSUME(Comma);
            this.SUBRULE2(this.value);
          });
        },
      },
    ]);
    this.CONSUME(RParen);
  });

  private likePart = this.RULE("likePart", () => {
    this.OPTION(() => this.CONSUME(Not));
    this.CONSUME(Like);
    this.SUBRULE(this.value);
  });

  private value = this.RULE("value", () => {
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(True) },
      { ALT: () => this.CONSUME(False) },
      { ALT: () => this.CONSUME(Null) },
      { ALT: () => this.CONSUME(DateLiteralToken) },
      { ALT: () => this.CONSUME(BindParam) },
    ]);
  });

  private groupByClause = this.RULE("groupByClause", () => {
    this.CONSUME(Group);
    this.CONSUME(By);
    this.SUBRULE(this.fieldPath);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.SUBRULE2(this.fieldPath);
    });
  });

  private havingClause = this.RULE("havingClause", () => {
    this.CONSUME(Having);
    this.SUBRULE(this.expression);
  });

  private orderByClause = this.RULE("orderByClause", () => {
    this.CONSUME(Order);
    this.CONSUME(By);
    this.SUBRULE(this.orderByItem);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.SUBRULE2(this.orderByItem);
    });
  });

  private orderByItem = this.RULE("orderByItem", () => {
    this.SUBRULE(this.fieldPath);
    this.OPTION(() =>
      this.OR([
        { ALT: () => this.CONSUME(Asc) },
        { ALT: () => this.CONSUME(Desc) },
      ]),
    );
    this.OPTION2(() => {
      this.CONSUME(Nulls);
      this.OR2([
        { ALT: () => this.CONSUME(First) },
        { ALT: () => this.CONSUME(Last) },
      ]);
    });
  });

  private limitClause = this.RULE("limitClause", () => {
    this.CONSUME(Limit);
    this.OR([
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(BindParam) },
    ]);
  });

  private offsetClause = this.RULE("offsetClause", () => {
    this.CONSUME(Offset);
    this.OR([
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(BindParam) },
    ]);
  });
}

export const soqlParser = new SoqlParser();
export const BaseVisitor = soqlParser.getBaseCstVisitorConstructor();

export type { CstNode, IToken };
