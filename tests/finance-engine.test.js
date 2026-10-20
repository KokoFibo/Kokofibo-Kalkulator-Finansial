"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const finance = require("../finance-engine.js");

function close(actual, expected, tolerance = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`
  );
}

test("calculates future value with monthly compounding", () => {
  const result = finance.futureValue({
    initial: 10_000_000,
    monthly: 0,
    annualRate: 12,
    years: 1,
    compounds: 12
  });

  close(result.futureValue, 10_000_000 * Math.pow(1.01, 12));
  close(result.totalContributions, 10_000_000);
  close(result.growth, result.futureValue - 10_000_000);
});

test("adds monthly contributions correctly", () => {
  const result = finance.futureValue({
    initial: 10_000_000,
    monthly: 1_000_000,
    annualRate: 12,
    years: 1,
    compounds: 12
  });

  close(result.totalContributions, 22_000_000);
  close(result.months, 12);
  close(result.points[result.points.length - 1].balance, result.futureValue);
});

test("handles a zero interest rate", () => {
  const result = finance.futureValue({
    initial: 10_000_000,
    monthly: 1_000_000,
    annualRate: 0,
    years: 1,
    compounds: 12
  });

  assert.equal(result.futureValue, 22_000_000);
  assert.equal(result.growth, 0);
  assert.equal(result.effectiveAnnualRate, 0);
});

test("compares monthly and annual compounding", () => {
  const monthly = finance.futureValue({
    initial: 10_000_000,
    monthly: 0,
    annualRate: 8,
    years: 10,
    compounds: 12
  });
  const annual = finance.futureValue({
    initial: 10_000_000,
    monthly: 0,
    annualRate: 8,
    years: 10,
    compounds: 1
  });

  assert.ok(monthly.futureValue > annual.futureValue);
  close(monthly.effectiveAnnualRate, Math.pow(1 + 0.08 / 12, 12) - 1);
});

test("creates yearly chart points including the final partial year", () => {
  const result = finance.futureValue({
    initial: 5_000_000,
    monthly: 500_000,
    annualRate: 6,
    years: 1.5,
    compounds: 12
  });

  assert.equal(result.months, 18);
  assert.equal(result.points[0].year, 0);
  assert.equal(result.points[result.points.length - 1].year, 1.5);
});

test("calculates present value as the inverse of future value", () => {
  const pv = finance.presentValue({
    target: 100_000_000,
    annualRate: 8,
    years: 10,
    compounds: 12
  });

  const fv = finance.futureValue({
    initial: pv.presentValue,
    monthly: 0,
    annualRate: 8,
    years: 10,
    compounds: 12
  });

  close(fv.futureValue, 100_000_000, 1e-8);
  assert.equal(pv.points[pv.points.length - 1].balance, 100_000_000);
});

test("calculates the monthly payment for a loan", () => {
  const result = finance.loan({
    principal: 120_000_000,
    annualRate: 12,
    years: 1
  });

  const monthlyRate = 0.12 / 12;
  const expected =
    (120_000_000 * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -12));

  close(result.monthlyPayment, expected);
  close(result.totalPayment, expected * 12);
  assert.equal(result.schedule.length, 1);
});

test("handles a zero-interest loan", () => {
  const result = finance.loan({
    principal: 120_000_000,
    annualRate: 0,
    years: 1
  });

  assert.equal(result.monthlyPayment, 10_000_000);
  assert.equal(result.totalPayment, 120_000_000);
  assert.equal(result.totalInterest, 0);
  close(result.schedule[0].balance, 0);
});

test("reconciles the loan amortization schedule", () => {
  const result = finance.loan({
    principal: 500_000_000,
    annualRate: 7.5,
    years: 15
  });

  const scheduledPrincipal = result.schedule.reduce(
    (total, row) => total + row.principalPaid,
    0
  );
  const scheduledInterest = result.schedule.reduce(
    (total, row) => total + row.interestPaid,
    0
  );

  close(scheduledPrincipal, 500_000_000, 1e-8);
  close(scheduledInterest, result.totalInterest, 1e-8);
  close(result.schedule[result.schedule.length - 1].balance, 0);
  assert.equal(result.schedule.length, 15);
});

test("calculates the monthly saving needed to hit a goal", () => {
  const result = finance.goal({
    target: 1_000_000_000,
    current: 100_000_000,
    annualRate: 7,
    years: 10,
    compounds: 12
  });

  const projected = finance.futureValue({
    initial: 100_000_000,
    monthly: result.monthlySaving,
    annualRate: 7,
    years: 10,
    compounds: 12
  });

  close(projected.futureValue, 1_000_000_000, 1e-8);
  close(result.totalContributions, 100_000_000 + result.monthlySaving * 120);
  assert.equal(result.points[result.points.length - 1].year, 10);
});

test("requires no monthly saving when a goal is already funded", () => {
  const result = finance.goal({
    target: 100_000_000,
    current: 150_000_000,
    annualRate: 8,
    years: 10,
    compounds: 12
  });

  assert.equal(result.monthlySaving, 0);
  assert.equal(result.progress, 100);
  assert.ok(result.projectedEnd > result.target);
});

test("rejects invalid amounts and durations", () => {
  assert.throws(
    () =>
      finance.futureValue({
        initial: -1,
        monthly: 0,
        annualRate: 8,
        years: 10,
        compounds: 12
      }),
    /tidak boleh negatif/
  );

  assert.throws(
    () =>
      finance.presentValue({
        target: 0,
        annualRate: 8,
        years: 10,
        compounds: 12
      }),
    /Target/
  );

  assert.throws(
    () =>
      finance.loan({
        principal: 100_000_000,
        annualRate: 8,
        years: 0
      }),
    /Durasi/
  );
});

test("supports negative investment returns", () => {
  const pv = finance.presentValue({
    target: 100_000_000,
    annualRate: -5,
    years: 10,
    compounds: 12
  });

  assert.ok(pv.presentValue > 100_000_000);
  assert.ok(pv.growth < 0);
});
