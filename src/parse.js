'use strict';

function Lexer() {
  this.lex = function(text) {
    this.text = text;
    this.index = 0;
    this.ch = undefined;
    this.tokens = [];

    while (this.index < this.text.length) {
      this.ch = this.text.charAt(this.index);

      if (
        this.isNumber(this.ch) ||
        (this.ch === '-' && (this.isNumber(this.peek()) || this.peek() === '.')) ||
        (this.ch === '.' && this.isNumber(this.peek()))
      ) {
        this.readNumber();
      } else {
        throw 'Unexpected next character: ' + this.ch;
      }
    }

    return this.tokens;
  };

  this.peek = function() {
    return this.index < this.text.length - 1 ?
      this.text.charAt(this.index + 1) :
      false;
  };

  this.isNumber = function(ch) {
    return '0' <= ch && ch <= '9';
  };

  this.readNumber = function() {
    var number = '';
    while (this.index < this.text.length) {
      var ch = this.text.charAt(this.index).toLowerCase();

      if (ch === '.' || this.isNumber(ch)) {
        number += ch;
      } else {
        var nextCh = this.peek();
        var prevCh = number.charAt(number.length - 1);

        //negative integer or float
        if (
          ch === '-' && (this.isNumber(nextCh) || nextCh === '.') &&
          (!prevCh || (!this.isNumber(prevCh) && prevCh !== 'e'))
        ) {
          number += ch;
        }
        //scientific notation
        else if (ch === 'e' && this.isExpOperator(nextCh)) {
          number += ch;
        } else if (
          this.isExpOperator(ch) && prevCh === 'e' &&
          nextCh && this.isNumber(nextCh)
        ) {
          number += ch;
        }
        //scientifc notation must be follow by a number
        else if (
          this.isExpOperator(ch) && prevCh === 'e' &&
          (!nextCh || !this.isNumber(nextCh))
        ) {
          throw 'Invalid exponent';
        } else {
          break;
        }
      }
      this.index++;
    }

    this.tokens.push({
      text: number,
      value: Number(number)
    });
  };

  this.isExpOperator = function(ch) {
    return ch === '-' || ch === '+' || this.isNumber(ch);
  };
}

function AST(lexer) {
  this.lexer = lexer;

  AST.Literal = 'Literal';
  AST.Program = 'Program';

  this.program = function() {
    return { type: AST.Program, body: this.constant() };
  };

  this.constant = function() {
    return { type: AST.Literal, value: this.tokens[0].value };
  };

  this.ast = function(text) {
    this.tokens = this.lexer.lex(text);
    return this.program();
  };
}

function ASTCompiler(astBuilder) {
  this.astBuilder = astBuilder;

  this.compile = function(text) {
    var ast = this.astBuilder.ast(text);
    this.state = {body: []};
    this.recurse(ast);
    /* jshint -W054 */
    return new Function(this.state.body.join(''));
    /* jshint +W054 */
  };

  this.recurse = function (ast) {
    switch (ast.type) {
      case AST.Program:
        this.state.body.push('return ', this.recurse(ast.body), ';');
        break;
      case AST.Literal:
        return ast.value;
    }
  };
}

function Parser(lexer) {
  this.lexer = lexer;
  this.ast = new AST(this.lexer);
  this.ASTCompiler = new ASTCompiler(this.ast);

  this.parse = function(text) {
    return this.ASTCompiler.compile(text);
  };
}

function parse(expr) {
  var lexer = new Lexer();
  var parser = new Parser(lexer);
  return parser.parse(expr);
}

module.exports = parse;
