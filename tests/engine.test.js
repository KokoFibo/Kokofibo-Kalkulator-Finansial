"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { Calculator } = require("../engine.js");

function run(keys, options) {
  const calculator = new Calculator(options);
  for (const key of keys) {
    calculator.press(key);
  }
  return calculator;
}

test("adds two numbers", () => {
  const calculator = run(["1", "2", "+", "7", "="]);
  const state = calculator.getState();

  assert.equal(state.display, "19");
  assert.equal(state.expression, "12 + 7 =");
  assert.equal(state.value, 19);
});

test("shows a live preview before equals", () => {
  const calculator = run(["1", "2", "+", "7", "*", "3"]);
  const state = calculator.getState();

  assert.equal(state.expression, "12 + 7 \u00d7 3");
  assert.equal(state.preview, "= 33");
  assert.equal(state.display, "3");
});

test("respects operator precedence", () => {
  const calculator = run(["1", "2", "+", "7", "*", "3", "="]);
  assert.equal(calculator.getState().display, "33");
});

test("rounds away floating point artifacts", () => {
  const calculator = run(["0", ".", "1", "+", "0", ".", "2", "="]);
  assert.equal(calculator.getState().display, "0.3");
});

test("replaces a repeated operator", () => {
  const calculator = run(["5", "+", "*", "2", "="]);
  assert.equal(calculator.getState().display, "10");
});

test("handles division by zero", () => {
  const calculator = run(["8", "/", "0", "="]);
  const state = calculator.getState();

  assert.equal(state.display, "Error");
  assert.equal(state.error, "Cannot divide by zero");
});

test("recovers from an error when typing a new number", () => {
  const calculator = run(["8", "/", "0", "=", "5", "+", "2", "="]);
  assert.equal(calculator.getState().display, "7");
});

test("adds a context-aware percentage", () => {
  const calculator = run(["2", "0", "0", "+", "1", "0", "%", "="]);
  assert.equal(calculator.getState().display, "220");
});

test("subtracts a context-aware percentage", () => {
  const calculator = run(["2", "0", "0", "-", "1", "0", "%", "="]);
  assert.equal(calculator.getState().display, "180");
});

test("uses a plain fraction for multiplication percentages", () => {
  const calculator = run(["2", "0", "0", "*", "1", "0", "%", "="]);
  assert.equal(calculator.getState().display, "20");
});

test("handles decimals and leading zeroes", () => {
  const calculator = run(["0", "0", "0", "5", ".", ".", "5"]);
  assert.equal(calculator.getState().display, "5.5");
});

test("toggles the sign of the current entry", () => {
  const calculator = run(["4", "2", "sign", "+", "2", "="]);
  assert.equal(calculator.getState().display, "\u221240");
});

test("starts a negative number after an operator", () => {
  const calculator = run(["5", "+", "sign", "3", "="]);
  assert.equal(calculator.getState().display, "2");
});

test("backspace removes digits", () => {
  const calculator = run(["1", "2", "3", "Backspace"]);
  assert.equal(calculator.getState().display, "12");
});

test("backspace removes an operator and restores the operand", () => {
  const calculator = run(["1", "2", "+", "Backspace"]);
  const state = calculator.getState();

  assert.equal(state.display, "12");
  assert.equal(state.expression, "");
});

test("continues calculating with a previous result", () => {
  const calculator = run(["5", "+", "5", "=", "+", "3", "="]);
  assert.equal(calculator.getState().display, "13");
});

test("starts fresh when typing a number after equals", () => {
  const calculator = run(["5", "+", "5", "=", "7"]);
  const state = calculator.getState();

  assert.equal(state.display, "7");
  assert.equal(state.expression, "");
});

test("formats thousands", () => {
  const calculator = run(["1", "0", "0", "0", "+", "2", "3", "4", "5", "="]);
  assert.equal(calculator.getState().display, "3,345");
});

test("stores completed calculations in history", () => {
  const calculator = run(["6", "*", "7", "="]);
  const state = calculator.getState();

  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].expression, "6 \u00d7 7");
  assert.equal(state.history[0].result, "42");
  assert.equal(state.history[0].value, 42);
});

test("does not add a lone number to history", () => {
  const calculator = run(["9", "="]);
  assert.equal(calculator.getState().history.length, 0);
});

test("reuses a value from history", () => {
  const calculator = run(["6", "*", "7", "="]);
  assert.equal(calculator.useHistory(0), true);
  assert.equal(calculator.getState().display, "42");

  calculator.press("+");
  calculator.press("8");
  calculator.press("=");
  assert.equal(calculator.getState().display, "50");
});

test("restores history passed into the constructor", () => {
  const calculator = new Calculator({
    history: [
      {
        expression: "2 + 2",
        result: "4",
        value: 4,
        timestamp: "2026-01-01T00:00:00.000Z"
      }
    ]
  });

  assert.equal(calculator.getState().history.length, 1);
});

test("clears history without clearing the current calculation", () => {
  const calculator = run(["3", "+", "4", "="]);
  calculator.clearHistory();
  assert.equal(calculator.getState().history.length, 0);
  assert.equal(calculator.getState().display, "7");
});
