'use strict';

var _ = require('lodash');

var ESCAPES = {'n':'\n', 'f':'\f', 'r':'\r', 't':'\t', 'v':'\v', '\'':'\'', '"':'"'};

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
      } else if (this.ch === '\'' || this.ch === '"') {
        this.readString(this.ch);
      } else if (this.isIdent(this.ch)) {
        this.readIdent();
      } else if (this.isWhitespace(this.ch)) {
        this.index++;
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

  this.readString = function(endChar) {
    this.index++;
    var string = '';
    var escape = false;
    while (this.index < this.text.length) {
      var ch = this.text.charAt(this.index);

      if (escape) {
        if (ch === 'u') {
          var hex = this.text.substring(this.index + 1, this.index + 5);
          if (!hex.match(/[\da-f]{4}/i)) {
            throw 'Invalid unicode escape';
          }
          this.index += 4;
          string += String.fromCharCode(parseInt(hex, 16));
        } else {
          var replacement = ESCAPES[ch];
          if (replacement) {
            string += replacement;
          } else {
            string += ch;
          }
        }
        escape = false;
      } else if (ch === endChar) {
        this.index++;
        this.tokens.push({
          text: string,
          value: string
        });
        return;
      } else if (ch === '\\') {
        escape = true;
      } else {
        string+= ch;
      }
      this.index++;
    }
    throw 'Unmatched quote';
  };

  this.isIdent = function(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';
  };

  this.readIdent = function() {
    var text = '';
    while (this.index < this.text.length) {
      var ch = this.text.charAt(this.index);
      if (this.isIdent(ch) || this.isNumber(ch)) {
        text += ch;
      } else {
        break;
      }
      this.index++;
    }

    var token = {text: text};
    this.tokens.push(token);
  };

  this.isWhitespace = function(ch) {
    return ch === ' ' || ch === '\r' || ch === '\t' || ch === '\n' || ch === '\v' || ch === '\u00A0';
  };
}

function AST(lexer) {
  this.lexer = lexer;

  AST.Literal = 'Literal';
  AST.Program = 'Program';

  AST.constants = {
    'null': { type: AST.Literal, value: null },
    'true': { type: AST.Literal, value: true },
    'false': { type: AST.Literal, value: false }
  };

  this.program = function() {
    return {type: AST.Program, body: this.primary()};
  };

  this.primary = function() {
    if (AST.constants.hasOwnProperty(this.tokens[0].text)) {
      return AST.constants[this.tokens[0].text];
    } else {
      return this.constant();
    }
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
        return this.escape(ast.value);
    }
  };

  this.stringEscapeRegex = /[^ a-zA-Z0-9]/g;
  this.stringEscapeFn = function(c) {
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
  };
  this.escape = function(value) {
    if (_.isString(value)) {
      return '\'' + value.replace(this.stringEscapeRegex, this.stringEscapeFn) + '\'';
    } else if (_.isNull(value)) {
      return 'null';
    } else {
      return value;
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
