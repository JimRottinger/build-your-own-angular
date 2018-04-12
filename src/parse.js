'use strict';

function Lexer() {
  this.lex = function(text) {
    this.text = text;
    this.index = 0;
    this.ch = undefined;
    this.tokens = [];

    while (this.index < this.text.length) {
      this.ch = this.text.charAt(this.index);

      if (this.isNumber(this.ch)) {
        this.readNumber();
      } else {
        throw 'Unexpected next character: ' + this.ch;
      }
    }

    return this.tokens;
  };

  this.isNumber = function(ch) {
    return '0' <= ch && ch <= '9';
  };

  this.readNumber = function() {
    var number = '';
    while (this.index < this.text.length) {
      var ch = this.text.charAt(this.index);

      if (this.isNumber(ch)) {
        number += ch;
      } else {
        break;
      }
      this.index++;
    }

    this.tokens.push({
      text: number,
      value: Number(number)
    });
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
