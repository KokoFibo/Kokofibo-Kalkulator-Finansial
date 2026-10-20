(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FinanceEngine = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var SUPPORTED_FREQUENCIES = [1, 4, 12];
  var MAX_YEARS = 100;

  function FinanceError(message) {
    this.name = "FinanceError";
    this.message = message;
  }
  FinanceError.prototype = Object.create(Error.prototype);
  FinanceError.prototype.constructor = FinanceError;

  function finite(value, message) {
    if (!Number.isFinite(value)) {
      throw new FinanceError(message || "Angka tidak valid.");
    }
    return value;
  }

  function amount(value, label, options) {
    options = options || {};
    var parsed = Number(value);
    var minimum = options.allowZero === false ? Number.MIN_VALUE : 0;

    if (!Number.isFinite(parsed)) {
      throw new FinanceError(label + " tidak valid.");
    }
    if (parsed < minimum) {
      throw new FinanceError(label + " tidak boleh negatif.");
    }
    return parsed;
  }

  function rate(value) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new FinanceError("Suku bunga tidak valid.");
    }
    if (parsed <= -100) {
      throw new FinanceError("Suku bunga harus lebih besar dari -100%.");
    }
    if (parsed > 100) {
      throw new FinanceError("Suku bunga maksimal 100%.");
    }
    return parsed;
  }

  function monthsFromYears(value) {
    var years = Number(value);
    if (!Number.isFinite(years) || years <= 0) {
      throw new FinanceError("Durasi harus lebih dari 0 tahun.");
    }
    if (years > MAX_YEARS) {
      throw new FinanceError("Durasi maksimal " + MAX_YEARS + " tahun.");
    }

    var months = Math.round(years * 12);
    if (months < 1) {
      throw new FinanceError("Durasi minimal 1 bulan.");
    }
    return months;
  }

  function getFrequency(value) {
    var compounds = Number(value);
    if (SUPPORTED_FREQUENCIES.indexOf(compounds) === -1) {
      throw new FinanceError("Frekuensi bunga tidak didukung.");
    }
    return compounds;
  }

  function monthlyEquivalentRate(annualRatePercent, compoundsPerYear) {
    var annual = rate(annualRatePercent);
    var compounds = getFrequency(compoundsPerYear);
    var periodicFactor = 1 + annual / 100 / compounds;

    if (periodicFactor <= 0) {
      throw new FinanceError("Suku bunga terlalu rendah untuk frekuensi ini.");
    }

    return Math.pow(periodicFactor, compounds / 12) - 1;
  }

  function effectiveAnnualRate(monthlyRate) {
    return Math.pow(1 + monthlyRate, 12) - 1;
  }

  function pushPoint(points, month, totalMonths, balance, contributed) {
    if (month % 12 === 0 || month === totalMonths) {
      points.push({
        year: Math.round((month / 12) * 10000) / 10000,
        balance: balance,
        contributed: contributed
      });
    }
  }

  function futureValue(input) {
    input = input || {};
    var initial = amount(input.initial, "Dana awal");
    var monthly = amount(input.monthly, "Setoran bulanan");
    var months = monthsFromYears(input.years);
    var monthlyRate = monthlyEquivalentRate(input.annualRate, input.compounds);
    var balance = initial;
    var contributed = initial;
    var points = [{ year: 0, balance: initial, contributed: initial }];

    for (var month = 1; month <= months; month += 1) {
      balance *= 1 + monthlyRate;
      balance += monthly;
      contributed += monthly;

      if (!Number.isFinite(balance)) {
        throw new FinanceError("Hasil perhitungan terlalu besar.");
      }

      pushPoint(points, month, months, balance, contributed);
    }

    return {
      futureValue: finite(balance, "Hasil perhitungan tidak valid."),
      totalContributions: contributed,
      growth: balance - contributed,
      months: months,
      years: months / 12,
      monthlyRate: monthlyRate,
      effectiveAnnualRate: effectiveAnnualRate(monthlyRate),
      points: points
    };
  }

  function presentValue(input) {
    input = input || {};
    var target = amount(input.target, "Target dana", { allowZero: false });
    var months = monthsFromYears(input.years);
    var monthlyRate = monthlyEquivalentRate(input.annualRate, input.compounds);
    var factor = Math.pow(1 + monthlyRate, months);

    if (!Number.isFinite(factor) || factor <= 0) {
      throw new FinanceError("Hasil perhitungan tidak valid.");
    }

    var value = target / factor;
    var points = [{ year: 0, balance: value, contributed: null }];
    var balance = value;

    for (var month = 1; month <= months; month += 1) {
      balance *= 1 + monthlyRate;
      if (month % 12 === 0 || month === months) {
        points.push({
          year: Math.round((month / 12) * 10000) / 10000,
          balance: balance,
          contributed: null
        });
      }
    }

    points[points.length - 1].balance = target;

    return {
      presentValue: finite(value, "Nilai sekarang tidak valid."),
      target: target,
      growth: target - value,
      months: months,
      years: months / 12,
      monthlyRate: monthlyRate,
      effectiveAnnualRate: effectiveAnnualRate(monthlyRate),
      points: points
    };
  }

  function goal(input) {
    input = input || {};
    var target = amount(input.target, "Target dana", { allowZero: false });
    var current = amount(input.current, "Dana saat ini");
    var months = monthsFromYears(input.years);
    var monthlyRate = monthlyEquivalentRate(input.annualRate, input.compounds);
    var factor = Math.pow(1 + monthlyRate, months);
    var futureFromCurrent = current * factor;
    var monthlySaving = 0;

    if (target > futureFromCurrent) {
      if (Math.abs(monthlyRate) < 1e-12) {
        monthlySaving = (target - current) / months;
      } else {
        monthlySaving = ((target - futureFromCurrent) * monthlyRate) / (factor - 1);
      }
    }

    if (!Number.isFinite(monthlySaving) || monthlySaving < 0) {
      throw new FinanceError("Setoran yang dibutuhkan tidak valid.");
    }
    if (monthlySaving < 1e-9) {
      monthlySaving = 0;
    }

    var balance = current;
    var contributed = current;
    var points = [{ year: 0, balance: current, contributed: current }];

    for (var month = 1; month <= months; month += 1) {
      balance *= 1 + monthlyRate;
      balance += monthlySaving;
      contributed += monthlySaving;

      if (!Number.isFinite(balance)) {
        throw new FinanceError("Hasil perhitungan terlalu besar.");
      }

      pushPoint(points, month, months, balance, contributed);
    }

    var progress = Math.min(100, Math.max(0, (current / target) * 100));

    return {
      monthlySaving: monthlySaving,
      totalContributions: contributed,
      growth: balance - contributed,
      projectedEnd: balance,
      target: target,
      current: current,
      progress: progress,
      months: months,
      years: months / 12,
      monthlyRate: monthlyRate,
      effectiveAnnualRate: effectiveAnnualRate(monthlyRate),
      points: points
    };
  }

  function loan(input) {
    input = input || {};
    var principal = amount(input.principal, "Pokok pinjaman", { allowZero: false });
    var annualRate = rate(input.annualRate);
    var months = monthsFromYears(input.years);
    var monthlyRate = annualRate / 100 / 12;

    if (annualRate < 0) {
      throw new FinanceError("Bunga pinjaman tidak boleh negatif.");
    }

    var monthlyPayment;
    if (monthlyRate === 0) {
      monthlyPayment = principal / months;
    } else {
      monthlyPayment = (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
    }

    if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0) {
      throw new FinanceError("Angsuran tidak dapat dihitung.");
    }

    var balance = principal;
    var totalPayment = 0;
    var totalInterest = 0;
    var yearPrincipal = 0;
    var yearInterest = 0;
    var schedule = [];
    var points = [{ year: 0, balance: principal, contributed: null }];

    for (var month = 1; month <= months; month += 1) {
      var interest = balance * monthlyRate;
      var payment = monthlyPayment;

      if (payment > balance + interest) {
        payment = balance + interest;
      }

      var principalPart = payment - interest;
      balance = Math.max(0, balance - principalPart);
      totalPayment += payment;
      totalInterest += interest;
      yearPrincipal += principalPart;
      yearInterest += interest;

      if (month === months && balance < 0.01) {
        balance = 0;
      }

      if (month % 12 === 0 || month === months) {
        schedule.push({
          year: Math.ceil(month / 12),
          principalPaid: yearPrincipal,
          interestPaid: yearInterest,
          payment: yearPrincipal + yearInterest,
          balance: balance
        });
        points.push({
          year: Math.round((month / 12) * 10000) / 10000,
          balance: balance,
          contributed: null
        });
        yearPrincipal = 0;
        yearInterest = 0;
      }
    }

    return {
      principal: principal,
      monthlyPayment: monthlyPayment,
      totalPayment: totalPayment,
      totalInterest: totalInterest,
      months: months,
      years: months / 12,
      monthlyRate: monthlyRate,
      effectiveAnnualRate: effectiveAnnualRate(monthlyRate),
      schedule: schedule,
      points: points
    };
  }

  return {
    FinanceError: FinanceError,
    FREQUENCIES: SUPPORTED_FREQUENCIES,
    monthlyEquivalentRate: monthlyEquivalentRate,
    futureValue: futureValue,
    presentValue: presentValue,
    goal: goal,
    loan: loan
  };
});
