(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CalculatorEngine = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var OPERATORS = ["+", "-", "*", "/"];
  var PRECEDENCE = { "+": 1, "-": 1, "*": 2, "/": 2 };
  var DISPLAY_OPERATORS = { "+": "+", "-": "\u2212", "*": "\u00d7", "/": "\u00f7" };
  var MAX_ENTRY_LENGTH = 18;
  var MAX_HISTORY = 24;

  function isOperator(value) {
    return OPERATORS.indexOf(value) !== -1;
  }

  function CalculatorError(message) {
    this.name = "CalculatorError";
    this.message = message;
  }
  CalculatorError.prototype = Object.create(Error.prototype);
  CalculatorError.prototype.constructor = CalculatorError;

  function apply(a, b, operator) {
    var value;

    switch (operator) {
      case "+":
        value = a + b;
        break;
      case "-":
        value = a - b;
        break;
      case "*":
        value = a * b;
        break;
      case "/":
        if (b === 0) {
          throw new CalculatorError("Cannot divide by zero");
        }
        value = a / b;
        break;
      default:
        throw new CalculatorError("Unknown operator");
    }

    if (!Number.isFinite(value)) {
      throw new CalculatorError("Number is too large");
    }

    return value;
  }

  function evaluate(tokens) {
    if (!Array.isArray(tokens) || tokens.length === 0 || tokens.length % 2 === 0) {
      throw new CalculatorError("Incomplete expression");
    }

    var values = [];
    var operators = [];

    function collapse() {
      var operator = operators.pop();
      var right = values.pop();
      var left = values.pop();
      values.push(apply(left, right, operator));
    }

    for (var index = 0; index < tokens.length; index += 1) {
      var token = tokens[index];

      if (index % 2 === 0) {
        var number = Number(token);
        if (!Number.isFinite(number)) {
          throw new CalculatorError("Invalid number");
        }
        values.push(number);
      } else {
        if (!isOperator(token)) {
          throw new CalculatorError("Invalid expression");
        }
        while (
          operators.length > 0 &&
          PRECEDENCE[operators[operators.length - 1]] >= PRECEDENCE[token]
        ) {
          collapse();
        }
        operators.push(token);
      }
    }

    while (operators.length > 0) {
      collapse();
    }

    var result = values[0];
    if (!Number.isFinite(result)) {
      throw new CalculatorError("Result is out of range");
    }
    return result;
  }

  function cleanResult(number) {
    if (Object.is(number, -0)) {
      return 0;
    }
    if (number !== 0 && (Math.abs(number) >= 1e15 || Math.abs(number) < 1e-9)) {
      return number;
    }
    return parseFloat(number.toPrecision(12));
  }

  function numberToInput(number) {
    number = cleanResult(number);

    if (Object.is(number, -0)) {
      return "0";
    }
    if (!Number.isFinite(number)) {
      return "0";
    }

    if (number !== 0 && (Math.abs(number) >= 1e15 || Math.abs(number) < 1e-9)) {
      return number
        .toExponential(9)
        .replace(/(\.\d*?[1-9])0+e/, "$1e")
        .replace(/\.0+e/, "e")
        .replace(/e\+/, "e");
    }

    return String(number);
  }

  function groupDigits(raw) {
    var sign = "";
    var value = raw;

    if (value.charAt(0) === "-") {
      sign = "-";
      value = value.slice(1);
    }

    var exponentParts = value.split("e");
    var mantissa = exponentParts[0];
    var exponent = exponentParts.length > 1 ? "e" + exponentParts[1] : "";
    var parts = mantissa.split(".");
    var integer = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    var fraction = parts.length > 1 ? "." + parts[1] : "";

    return sign + integer + fraction + exponent;
  }

  function formatEntry(entry) {
    return groupDigits(entry).replace(/^-/, "\u2212");
  }

  function formatNumber(number) {
    return groupDigits(numberToInput(number)).replace(/^-/, "\u2212");
  }

  function prettyTokens(tokens) {
    return tokens
      .map(function (token, index) {
        if (index % 2 === 1) {
          return DISPLAY_OPERATORS[token] || token;
        }
        return formatEntry(token);
      })
      .join(" ");
  }

  function normalizeHistory(items) {
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .filter(function (item) {
        return (
          item &&
          typeof item.expression === "string" &&
          typeof item.result === "string" &&
          typeof item.value === "number" &&
          Number.isFinite(item.value)
        );
      })
      .slice(0, MAX_HISTORY)
      .map(function (item) {
        return {
          expression: item.expression,
          result: item.result,
          value: item.value,
          timestamp: typeof item.timestamp === "string" ? item.timestamp : new Date().toISOString()
        };
      });
  }

  function Calculator(options) {
    options = options || {};
    this.tokens = [];
    this.entry = "0";
    this.entryActive = false;
    this.justEvaluated = false;
    this.result = null;
    this.lastExpression = null;
    this.error = null;
    this.history = normalizeHistory(options.history);
  }

  Calculator.prototype._resetComputation = function () {
    this.tokens = [];
    this.entry = "0";
    this.entryActive = false;
    this.justEvaluated = false;
    this.result = null;
    this.lastExpression = null;
    this.error = null;
  };

  Calculator.prototype._recoverFromError = function () {
    if (this.error) {
      this._resetComputation();
      return true;
    }
    return false;
  };

  Calculator.prototype._startNewEntry = function (value) {
    this.tokens = [];
    this.entry = value;
    this.entryActive = true;
    this.justEvaluated = false;
    this.lastExpression = null;
    this.result = null;
    this.error = null;
  };

  Calculator.prototype._useResultAsEntry = function () {
    if (this.result === null) {
      return;
    }
    var value = numberToInput(this.result);
    this.tokens = [];
    this.entry = value;
    this.entryActive = true;
    this.justEvaluated = false;
    this.lastExpression = null;
    this.result = null;
    this.error = null;
  };

  Calculator.prototype.inputDigit = function (digit) {
    if (!/^\d$/.test(digit)) {
      return;
    }

    this._recoverFromError();

    if (this.justEvaluated) {
      this._startNewEntry(digit);
      return;
    }

    if (!this.entryActive) {
      this.entry = digit;
      this.entryActive = true;
      return;
    }

    var digitCount = this.entry.replace(/\D/g, "").length;
    if (digitCount >= MAX_ENTRY_LENGTH) {
      return;
    }

    if (this.entry === "0") {
      this.entry = digit;
    } else if (this.entry === "-0") {
      this.entry = "-" + digit;
    } else {
      this.entry += digit;
    }
  };

  Calculator.prototype.inputDecimal = function () {
    this._recoverFromError();

    if (this.justEvaluated) {
      this._startNewEntry("0.");
      return;
    }

    if (!this.entryActive) {
      this.entry = "0.";
      this.entryActive = true;
      return;
    }

    if (this.entry.indexOf(".") === -1 && this.entry.length < MAX_ENTRY_LENGTH) {
      this.entry += ".";
    }
  };

  Calculator.prototype.inputOperator = function (operator) {
    if (!isOperator(operator) || this.error) {
      return;
    }

    if (this.justEvaluated) {
      var result = this.result;
      this.tokens = [numberToInput(result)];
      this.entry = this.tokens[0];
      this.entryActive = false;
      this.justEvaluated = false;
      this.lastExpression = null;
      this.result = null;
    }

    if (!this.entryActive) {
      if (this.tokens.length > 0 && isOperator(this.tokens[this.tokens.length - 1])) {
        this.tokens[this.tokens.length - 1] = operator;
      } else if (this.tokens.length > 0) {
        this.tokens.push(operator);
      }
      return;
    }

    this.tokens.push(this.entry);
    this.tokens.push(operator);
    this.entryActive = false;
  };

  Calculator.prototype.backspace = function () {
    if (this._recoverFromError()) {
      return;
    }

    if (this.justEvaluated) {
      if (this.result === null) {
        return;
      }
      this._useResultAsEntry();
    }

    if (!this.entryActive) {
      if (this.tokens.length > 0 && isOperator(this.tokens[this.tokens.length - 1])) {
        this.tokens.pop();
        if (this.tokens.length > 0) {
          this.entry = this.tokens.pop();
          this.entryActive = true;
        } else {
          this.entry = "0";
          this.entryActive = false;
        }
      }
      return;
    }

    if (this.entry.length <= 1 || (this.entry.charAt(0) === "-" && this.entry.length === 2)) {
      this.entry = "0";
    } else {
      this.entry = this.entry.slice(0, -1);
    }

    if (this.entry === "-") {
      this.entry = "0";
    }
  };

  Calculator.prototype.clear = function () {
    this._resetComputation();
  };

  Calculator.prototype.toggleSign = function () {
    if (this._recoverFromError()) {
      return;
    }

    if (this.justEvaluated) {
      this._useResultAsEntry();
    }

    if (!this.entryActive) {
      if (this.tokens.length > 0 && isOperator(this.tokens[this.tokens.length - 1])) {
        this.entry = "-0";
        this.entryActive = true;
      }
      return;
    }

    if (this.entry.charAt(0) === "-") {
      this.entry = this.entry.slice(1);
    } else {
      this.entry = "-" + this.entry;
    }
  };

  Calculator.prototype.percent = function () {
    if (this._recoverFromError()) {
      return;
    }

    if (this.justEvaluated) {
      this._useResultAsEntry();
    }

    if (!this.entryActive) {
      return;
    }

    var value = Number(this.entry);
    var next = value / 100;
    var lastOperator =
      this.tokens.length > 0 ? this.tokens[this.tokens.length - 1] : null;

    if (
      (lastOperator === "+" || lastOperator === "-") &&
      this.tokens.length >= 2
    ) {
      try {
        var base = evaluate(this.tokens.slice(0, -1));
        next = (base * value) / 100;
      } catch (error) {
        if (error instanceof CalculatorError) {
          this.error = error.message;
          return;
        }
        throw error;
      }
    }

    if (!Number.isFinite(next)) {
      this.error = "Number is too large";
      this.entryActive = false;
      return;
    }

    this.entry = numberToInput(next);
    this.entryActive = true;
  };

  Calculator.prototype.equals = function () {
    if (this.error || this.justEvaluated || !this.entryActive) {
      return;
    }

    var fullExpression = this.tokens.concat([this.entry]);

    try {
      var result = evaluate(fullExpression);

      this.result = result;
      this.entry = numberToInput(result);
      this.entryActive = false;
      this.justEvaluated = true;

      if (fullExpression.length > 1) {
        this.tokens = fullExpression;
        this.lastExpression = fullExpression.slice();

        var historyItem = {
          expression: prettyTokens(fullExpression),
          result: formatNumber(result),
          value: result,
          timestamp: new Date().toISOString()
        };

        this.history.unshift(historyItem);
        this.history = this.history.slice(0, MAX_HISTORY);
      } else {
        this.tokens = [];
        this.lastExpression = null;
      }
    } catch (error) {
      if (error instanceof CalculatorError) {
        this.error = error.message;
        this.entryActive = false;
        this.justEvaluated = false;
      } else {
        throw error;
      }
    }
  };

  Calculator.prototype.useHistory = function (index) {
    var item = this.history[index];
    if (!item) {
      return false;
    }

    this._resetComputation();
    this.entry = numberToInput(item.value);
    this.entryActive = true;
    return true;
  };

  Calculator.prototype.clearHistory = function () {
    this.history = [];
  };

  Calculator.prototype.getState = function () {
    var expression = "";
    var preview = "";
    var display;
    var liveTokens = null;
    var hasActiveExpression = this.tokens.length > 0;

    if (this.error) {
      display = "Error";
      if (this.lastExpression) {
        expression = prettyTokens(this.lastExpression) + " =";
      }
    } else if (this.justEvaluated) {
      display = formatNumber(this.result);
      if (this.lastExpression) {
        expression = prettyTokens(this.lastExpression) + " =";
      }
    } else {
      display = formatEntry(this.entry);

      if (hasActiveExpression) {
        liveTokens = this.tokens.slice();
        if (this.entryActive) {
          liveTokens.push(this.entry);
        }
        expression = prettyTokens(liveTokens);
      }
    }

    if (
      !this.error &&
      !this.justEvaluated &&
      this.entryActive &&
      this.tokens.length >= 2 &&
      isOperator(this.tokens[this.tokens.length - 1])
    ) {
      try {
        var liveResult = evaluate(this.tokens.concat([this.entry]));
        preview = "= " + formatNumber(liveResult);
      } catch (error) {
        if (!(error instanceof CalculatorError)) {
          throw error;
        }
      }
    }

    var value = null;
    if (!this.error) {
      value = this.justEvaluated ? this.result : Number(this.entry);
    }

    return {
      display: display,
      expression: expression,
      preview: preview,
      value: value,
      error: this.error,
      justEvaluated: this.justEvaluated,
      entryActive: this.entryActive,
      history: this.history.slice()
    };
  };

  Calculator.prototype.press = function (key) {
    if (/^\d$/.test(key)) {
      this.inputDigit(key);
      return;
    }

    switch (key) {
      case ".":
        this.inputDecimal();
        break;
      case "+":
      case "-":
      case "*":
      case "/":
        this.inputOperator(key);
        break;
      case "=":
      case "Enter":
        this.equals();
        break;
      case "Backspace":
        this.backspace();
        break;
      case "Escape":
      case "Delete":
        this.clear();
        break;
      case "%":
        this.percent();
        break;
      case "sign":
        this.toggleSign();
        break;
      default:
        break;
    }
  };

  return {
    Calculator: Calculator,
    evaluate: evaluate,
    formatNumber: formatNumber,
    numberToInput: numberToInput
  };
});
