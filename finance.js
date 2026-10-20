(function () {
  "use strict";

  var Finance = window.FinanceEngine;
  if (!Finance) {
    return;
  }

  var THEME_KEY = "kokofibo.theme.v1";
  var LEGACY_THEME_KEY = "tumbuh.theme.v1";

  var moneyFormatter = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0
  });
  var decimalFormatter = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 1
  });
  var compactFormatter = new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1
  });

  var toolUI = {
    future: {
      prefix: "fv",
      formId: "fv-form",
      periodId: "fv-period",
      captionId: "fv-caption",
      badgeId: "fv-badge",
      liveId: "fv-effective",
      moneyIds: ["fv-total", "fv-growth"],
      textIds: ["fv-ratio", "fv-effective-stat"],
      chartId: "fv-chart"
    },
    present: {
      prefix: "pv",
      formId: "pv-form",
      periodId: "pv-period",
      captionId: "pv-caption",
      badgeId: "pv-badge",
      liveId: "pv-effective",
      moneyIds: ["pv-growth", "pv-target-result"],
      textIds: ["pv-ratio", "pv-effective-stat"],
      chartId: "pv-chart"
    },
    loan: {
      prefix: "loan",
      formId: "loan-form",
      periodId: "loan-period",
      captionId: "loan-caption",
      badgeId: "loan-badge",
      liveId: "loan-effective",
      moneyIds: [
        "loan-total",
        "loan-interest",
        "loan-principal-result",
        "loan-legend-principal",
        "loan-legend-interest"
      ],
      textIds: ["loan-ratio"],
      chartId: "loan-donut"
    },
    goal: {
      prefix: "goal",
      formId: "goal-form",
      periodId: "goal-period",
      captionId: "goal-caption",
      liveId: "goal-effective",
      moneyIds: ["goal-total", "goal-growth", "goal-current-result"],
      textIds: ["goal-progress-stat"],
      chartId: "goal-chart"
    }
  };

  var chartElements = {
    future: document.getElementById("fv-chart"),
    present: document.getElementById("pv-chart"),
    loan: document.getElementById("loan-donut"),
    goal: document.getElementById("goal-chart")
  };

  var chartState = {
    future: null,
    present: null,
    loan: null,
    goal: null
  };

  var tabs = Array.prototype.slice.call(document.querySelectorAll("[role='tab']"));
  var panels = Array.prototype.slice.call(document.querySelectorAll("[role='tabpanel']"));
  var chartCounter = 0;
  var activeTool = "future";

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    var element = byId(id);
    if (element) {
      element.textContent = text;
    }
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function formatMoney(value) {
    var rounded = Math.round(Number(value) || 0);
    var sign = rounded < 0 ? "−" : "";
    return sign + "Rp\u00a0" + moneyFormatter.format(Math.abs(rounded));
  }

  function formatPercent(value, digits) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      numeric = 0;
    }
    if (Math.abs(numeric) < 0.0005) {
      numeric = 0;
    }
    return (
      new Intl.NumberFormat("id-ID", {
        maximumFractionDigits: digits == null ? 2 : digits
      }).format(numeric) + "%"
    );
  }

  function formatYears(years) {
    return decimalFormatter.format(years) + " tahun";
  }

  function formatAxis(value) {
    if (Math.abs(value) < 0.5) {
      return "0";
    }
    return compactFormatter.format(value);
  }

  function parseMoneyInput(input) {
    var digits = input.value.replace(/\D/g, "").slice(0, 15);
    return digits ? Number(digits) : 0;
  }

  function readNumber(input) {
    var raw = input.value.trim().replace(",", ".");
    if (raw === "") {
      return null;
    }
    var value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  function formatMoneyInput(input) {
    var raw = input.value;
    var caret = input.selectionStart == null ? raw.length : input.selectionStart;
    var digitsBefore = (raw.slice(0, caret).match(/\d/g) || []).length;
    var digits = raw.replace(/\D/g, "").slice(0, 15).replace(/^0+(?=\d)/, "");
    var formatted = digits ? moneyFormatter.format(Number(digits)) : "";

    input.value = formatted;

    if (document.activeElement !== input) {
      return;
    }

    if (digitsBefore === 0) {
      input.setSelectionRange(0, 0);
      return;
    }

    var digitsSeen = 0;
    var position = formatted.length;
    for (var index = 0; index < formatted.length; index += 1) {
      if (/\d/.test(formatted.charAt(index))) {
        digitsSeen += 1;
      }
      if (digitsSeen >= digitsBefore) {
        position = index + 1;
        break;
      }
    }
    input.setSelectionRange(position, position);
  }

  function clearFieldError(input) {
    var field = input.closest(".field");
    if (!field) {
      return;
    }
    field.classList.remove("has-error");
    input.removeAttribute("aria-invalid");
    var error = field.querySelector(".field-error");
    if (error) {
      error.textContent = "";
    }
  }

  function setFieldError(input, message) {
    var field = input.closest(".field");
    if (!field) {
      return;
    }
    field.classList.add("has-error");
    input.setAttribute("aria-invalid", "true");
    var error = field.querySelector(".field-error");
    if (error) {
      error.textContent = message;
    }
  }

  function clearErrors(form) {
    Array.prototype.forEach.call(form.querySelectorAll("input, select"), function (input) {
      clearFieldError(input);
    });
  }

  function clearFormAlert(form) {
    var alert = form.querySelector(".form-alert");
    if (alert) {
      alert.textContent = "";
      alert.hidden = true;
    }
  }

  function showFormAlert(form, message) {
    var alert = form.querySelector(".form-alert");
    if (!alert) {
      alert = document.createElement("p");
      alert.className = "form-alert";
      alert.setAttribute("role", "alert");
      var grid = form.querySelector(".form-grid");
      if (grid && grid.parentNode) {
        grid.parentNode.insertBefore(alert, grid.nextSibling);
      } else {
        form.appendChild(alert);
      }
    }
    alert.hidden = false;
    alert.textContent = message;
  }

  function validateRate(input, minimum, maximum) {
    var value = readNumber(input);
    if (value == null) {
      setFieldError(input, "Bunga wajib diisi.");
      return null;
    }
    if (value < minimum || value > maximum) {
      setFieldError(
        input,
        "Masukkan bunga antara " +
          formatPercent(minimum, 1) +
          " dan " +
          formatPercent(maximum, 1) +
          "."
      );
      return null;
    }
    return value;
  }

  function validateYears(input, minimum, maximum) {
    var value = readNumber(input);
    if (value == null) {
      setFieldError(input, "Durasi wajib diisi.");
      return null;
    }
    if (value < minimum || value > maximum) {
      setFieldError(
        input,
        "Masukkan durasi antara " +
          decimalFormatter.format(minimum) +
          " dan " +
          decimalFormatter.format(maximum) +
          " tahun."
      );
      return null;
    }
    return value;
  }

  function validatePositiveMoney(input, label) {
    var value = parseMoneyInput(input);
    if (value <= 0) {
      setFieldError(input, "Masukkan " + label + " lebih dari 0.");
      return null;
    }
    return value;
  }

  function setHeroMoney(prefix, value) {
    var hero = byId(prefix + "-hero-number");
    var valueElement = byId(prefix + "-value");
    if (!hero || !valueElement) {
      return;
    }

    var numeric = Number(value) || 0;
    var rounded = Math.round(numeric);
    var formatted = moneyFormatter.format(Math.abs(rounded));
    var currency = hero.querySelector(".hero-currency");

    if (currency) {
      currency.textContent = rounded < 0 ? "−Rp" : "Rp";
    }
    valueElement.textContent = formatted;
    hero.classList.toggle(
      "is-compact",
      formatted.length > 14 || Math.abs(rounded) >= 1e12
    );
  }

  function setHeroPlaceholder(prefix) {
    var hero = byId(prefix + "-hero-number");
    var valueElement = byId(prefix + "-value");
    if (hero) {
      hero.classList.remove("is-compact");
      var currency = hero.querySelector(".hero-currency");
      if (currency) {
        currency.textContent = "Rp";
      }
    }
    if (valueElement) {
      valueElement.textContent = "—";
    }
  }

  function setLiveState(tool, text, invalid) {
    var config = toolUI[tool];
    var element = byId(config.liveId);
    if (!element) {
      return;
    }
    element.textContent = text;
    var wrapper = element.closest(".form-live");
    if (wrapper) {
      wrapper.classList.toggle("is-invalid", Boolean(invalid));
    }
  }

  function announce(message) {
    var region = byId("liveSummary");
    if (!region) {
      return;
    }
    region.textContent = "";
    window.setTimeout(function () {
      region.textContent = message;
    }, 40);
  }

  function setChart(tool, state) {
    chartState[tool] = state;
    drawChart(tool);
  }

  function renderUnavailable(tool) {
    var config = toolUI[tool];
    setHeroPlaceholder(config.prefix);
    setText(config.periodId, "—");
    setText(config.captionId, "Periksa kembali asumsi yang ditandai.");
    if (config.badgeId) {
      setText(config.badgeId, "—");
    }

    config.moneyIds.forEach(function (id) {
      setText(id, "—");
    });
    config.textIds.forEach(function (id) {
      setText(id, "—");
    });

    if (tool === "loan") {
      var schedule = byId("loan-schedule");
      if (schedule) {
        schedule.innerHTML =
          '<tr class="empty-row"><td colspan="5">Lengkapi detail pinjaman untuk melihat jadwal.</td></tr>';
      }
    }

    if (tool === "goal") {
      setText("goal-progress-label", "—");
      var bar = byId("goal-progress-bar");
      if (bar) {
        bar.style.width = "0%";
      }
      var track = bar && bar.parentElement;
      if (track) {
        track.removeAttribute("role");
        track.removeAttribute("aria-valuemin");
        track.removeAttribute("aria-valuemax");
        track.removeAttribute("aria-valuenow");
      }
    }

    setLiveState(tool, "Lengkapi asumsi untuk melihat hasil.", true);
    chartState[tool] = null;
    drawChart(tool);
  }

  function handleEngineError(tool, form, error) {
    showFormAlert(
      form,
      error && error.message
        ? error.message
        : "Perhitungan tidak dapat dilakukan. Periksa kembali asumsi."
    );
    renderUnavailable(tool);
  }

  function updateFuture() {
    var form = byId("fv-form");
    clearErrors(form);
    clearFormAlert(form);

    var initial = parseMoneyInput(form.elements.initial);
    var monthly = parseMoneyInput(form.elements.monthly);
    var rate = validateRate(form.elements.rate, -20, 100);
    var years = validateYears(form.elements.years, 0.5, 60);
    var compounds = Number(form.elements.compounds.value);

    if (rate == null || years == null) {
      renderUnavailable("future");
      return;
    }

    var result;
    try {
      result = Finance.futureValue({
        initial: initial,
        monthly: monthly,
        annualRate: rate,
        years: years,
        compounds: compounds
      });
    } catch (error) {
      handleEngineError("future", form, error);
      return;
    }

    var effective = result.effectiveAnnualRate * 100;
    var ratio =
      result.totalContributions > 0
        ? (result.growth / result.totalContributions) * 100
        : 0;
    var shareOfEnd =
      result.futureValue > 0 ? (result.growth / result.futureValue) * 100 : 0;

    setHeroMoney("fv", result.futureValue);
    setText("fv-period", formatYears(result.years));
    setText(
      "fv-caption",
      "Setoran " +
        formatMoney(monthly) +
        " per bulan dengan dana awal " +
        formatMoney(initial) +
        "."
    );
    setText("fv-badge", "Bunga efektif " + formatPercent(effective, 2) + " per tahun");
    setText("fv-total", formatMoney(result.totalContributions));
    setText("fv-growth", formatMoney(result.growth));
    setText("fv-ratio", formatPercent(ratio, 1));
    setText("fv-effective-stat", formatPercent(effective, 2));
    setLiveState("future", "Bunga efektif " + formatPercent(effective, 2) + " per tahun", false);

    var growthElement = byId("fv-growth");
    if (growthElement) {
      growthElement.classList.toggle("stat-value--warm", result.growth < 0);
    }

    var insight = byId("fv-insight");
    if (insight) {
      if (result.growth >= 0) {
        insight.innerHTML =
          "Dari total dana akhir, <strong>" +
          formatPercent(shareOfEnd, 1) +
          "</strong> berasal dari hasil investasi. Sisanya adalah setoran.";
      } else {
        insight.innerHTML =
          "Dengan asumsi ini, nilai akhir lebih rendah " +
          "<strong>" +
          formatMoney(Math.abs(result.growth)) +
          "</strong> dari total setoran.";
      }
    }

    setChart("future", {
      type: "growth",
      points: result.points,
      targetLine: null,
      showContributions: true,
      ariaLabel:
        "Grafik pertumbuhan dana dari " +
        formatMoney(initial) +
        " menjadi " +
        formatMoney(result.futureValue) +
        " dalam " +
        formatYears(result.years) +
        ". Total setoran " +
        formatMoney(result.totalContributions) +
        "."
    });

    announce(
      "Nilai masa depan " +
        formatMoney(result.futureValue) +
        " dalam " +
        formatYears(result.years) +
        ". Total setoran " +
        formatMoney(result.totalContributions) +
        ", hasil investasi " +
        formatMoney(result.growth) +
        "."
    );
  }

  function updatePresent() {
    var form = byId("pv-form");
    clearErrors(form);
    clearFormAlert(form);

    var target = validatePositiveMoney(form.elements.target, "target dana");
    var rate = validateRate(form.elements.rate, -20, 100);
    var years = validateYears(form.elements.years, 0.5, 60);
    var compounds = Number(form.elements.compounds.value);

    if (target == null || rate == null || years == null) {
      renderUnavailable("present");
      return;
    }

    var result;
    try {
      result = Finance.presentValue({
        target: target,
        annualRate: rate,
        years: years,
        compounds: compounds
      });
    } catch (error) {
      handleEngineError("present", form, error);
      return;
    }

    var effective = result.effectiveAnnualRate * 100;
    var ratio = result.target > 0 ? (result.growth / result.target) * 100 : 0;

    setHeroMoney("pv", result.presentValue);
    setText("pv-period", formatYears(result.years));
    setText(
      "pv-caption",
      "Modal awal untuk mencapai " +
        formatMoney(target) +
        " dalam " +
        formatYears(result.years) +
        "."
    );
    setText("pv-badge", "Bunga efektif " + formatPercent(effective, 2) + " per tahun");
    setText("pv-growth", formatMoney(result.growth));
    setText("pv-ratio", formatPercent(ratio, 1));
    setText("pv-target-result", formatMoney(result.target));
    setText("pv-effective-stat", formatPercent(effective, 2));
    setLiveState("present", "Bunga efektif " + formatPercent(effective, 2) + " per tahun", false);

    var growthElement = byId("pv-growth");
    if (growthElement) {
      growthElement.classList.toggle("stat-value--warm", result.growth < 0);
    }

    var insight = byId("pv-insight");
    if (insight) {
      if (result.growth >= 0) {
        insight.innerHTML =
          "Selisih <strong>" +
          formatMoney(result.growth) +
          "</strong> adalah pertumbuhan yang membantu mencapai target. Modal awal hari ini cukup untuk menutup sisanya.";
      } else {
        insight.innerHTML =
          "Dengan asumsi ini, modal awal harus lebih besar dari target karena nilai investasi menyusut.";
      }
    }

    setChart("present", {
      type: "growth",
      points: result.points,
      targetLine: null,
      showContributions: false,
      ariaLabel:
        "Grafik pertumbuhan nilai investasi dari " +
        formatMoney(result.presentValue) +
        " menjadi " +
        formatMoney(result.target) +
        " dalam " +
        formatYears(result.years) +
        "."
    });

    announce(
      "Nilai sekarang yang dibutuhkan " +
        formatMoney(result.presentValue) +
        " untuk mencapai target " +
        formatMoney(result.target) +
        " dalam " +
        formatYears(result.years) +
        "."
    );
  }

  function updateLoan() {
    var form = byId("loan-form");
    clearErrors(form);
    clearFormAlert(form);

    var principal = validatePositiveMoney(form.elements.principal, "pokok pinjaman");
    var rate = validateRate(form.elements.rate, 0, 100);
    var years = validateYears(form.elements.years, 1, 40);

    if (principal == null || rate == null || years == null) {
      renderUnavailable("loan");
      return;
    }

    var result;
    try {
      result = Finance.loan({
        principal: principal,
        annualRate: rate,
        years: years
      });
    } catch (error) {
      handleEngineError("loan", form, error);
      return;
    }

    var effective = result.effectiveAnnualRate * 100;
    var interestRatio =
      result.totalPayment > 0 ? (result.totalInterest / result.totalPayment) * 100 : 0;

    setHeroMoney("loan", result.monthlyPayment);
    setText("loan-period", result.months + " bulan");
    setText(
      "loan-caption",
      "Angsuran tetap selama " +
        result.months +
        " bulan hingga pinjaman lunas."
    );
    setText(
      "loan-badge",
      "Bunga " + formatPercent(interestRatio, 1) + " dari total pembayaran"
    );
    setText("loan-total", formatMoney(result.totalPayment));
    setText("loan-interest", formatMoney(result.totalInterest));
    setText("loan-ratio", formatPercent(interestRatio, 1));
    setText("loan-principal-result", formatMoney(result.principal));
    setText("loan-legend-principal", formatMoney(result.principal));
    setText("loan-legend-interest", formatMoney(result.totalInterest));
    setLiveState(
      "loan",
      "Angsuran tetap dengan bunga efektif " + formatPercent(effective, 2) + " per tahun",
      false
    );

    var insight = byId("loan-insight");
    if (insight) {
      insight.innerHTML =
        "Dari total pembayaran, <strong>" +
        formatPercent(interestRatio, 1) +
        "</strong> adalah bunga. Porsi bunga menurun setiap bulan seiring berkurangnya sisa pokok.";
    }

    var schedule = byId("loan-schedule");
    if (schedule) {
      schedule.innerHTML = result.schedule
        .map(function (row) {
          return (
            "<tr>" +
            "<td>Tahun " +
            row.year +
            "</td>" +
            "<td>" +
            formatMoney(row.principalPaid) +
            "</td>" +
            "<td>" +
            formatMoney(row.interestPaid) +
            "</td>" +
            "<td>" +
            formatMoney(row.payment) +
            "</td>" +
            "<td>" +
            formatMoney(row.balance) +
            "</td>" +
            "</tr>"
          );
        })
        .join("");
    }

    setChart("loan", {
      type: "donut",
      principal: result.principal,
      interest: result.totalInterest,
      ariaLabel:
        "Komposisi pembayaran: pokok " +
        formatMoney(result.principal) +
        " dan bunga " +
        formatMoney(result.totalInterest) +
        " dari total " +
        formatMoney(result.totalPayment) +
        "."
    });

    announce(
      "Angsuran per bulan " +
        formatMoney(result.monthlyPayment) +
        " selama " +
        result.months +
        " bulan. Total bunga " +
        formatMoney(result.totalInterest) +
        "."
    );
  }

  function updateGoal() {
    var form = byId("goal-form");
    clearErrors(form);
    clearFormAlert(form);

    var target = validatePositiveMoney(form.elements.target, "target dana");
    var current = parseMoneyInput(form.elements.current);
    var rate = validateRate(form.elements.rate, -20, 100);
    var years = validateYears(form.elements.years, 0.5, 60);
    var compounds = Number(form.elements.compounds.value);

    if (target == null || rate == null || years == null) {
      renderUnavailable("goal");
      return;
    }

    var result;
    try {
      result = Finance.goal({
        target: target,
        current: current,
        annualRate: rate,
        years: years,
        compounds: compounds
      });
    } catch (error) {
      handleEngineError("goal", form, error);
      return;
    }

    var effective = result.effectiveAnnualRate * 100;
    var progress = clamp(result.progress, 0, 100);

    setHeroMoney("goal", result.monthlySaving);
    setText("goal-period", formatYears(result.years));
    setText(
      "goal-caption",
      result.monthlySaving > 0
        ? "Sisihkan setiap bulan selama " +
            formatYears(result.years) +
            " untuk mencapai target."
        : "Dana saat ini sudah cukup untuk mencapai target."
    );
    setText("goal-total", formatMoney(result.totalContributions));
    setText("goal-growth", formatMoney(result.growth));
    setText("goal-current-result", formatMoney(result.current));
    setText("goal-progress-stat", formatPercent(progress, 1));
    setText("goal-progress-label", formatPercent(progress, 1));
    setLiveState("goal", "Bunga efektif " + formatPercent(effective, 2) + " per tahun", false);

    var growthElement = byId("goal-growth");
    if (growthElement) {
      growthElement.classList.toggle("stat-value--warm", result.growth < 0);
    }

    var bar = byId("goal-progress-bar");
    if (bar) {
      bar.style.width = progress.toFixed(2) + "%";
      var track = bar.parentElement;
      if (track) {
        track.setAttribute("role", "progressbar");
        track.setAttribute("aria-label", "Progres dana saat ini terhadap target");
        track.setAttribute("aria-valuemin", "0");
        track.setAttribute("aria-valuemax", "100");
        track.setAttribute("aria-valuenow", progress.toFixed(1));
      }
    }

    var insight = byId("goal-insight");
    if (insight) {
      if (result.monthlySaving > 0) {
        insight.innerHTML =
          "Dengan setoran <strong>" +
          formatMoney(result.monthlySaving) +
          "</strong> per bulan, target " +
          formatMoney(result.target) +
          " tercapai dalam " +
          formatYears(result.years) +
          ".";
      } else {
        insight.innerHTML =
          "Dana saat ini diproyeksikan menjadi <strong>" +
          formatMoney(result.projectedEnd) +
          "</strong> dalam " +
          formatYears(result.years) +
          ", melampaui target.";
      }
    }

    setChart("goal", {
      type: "growth",
      points: result.points,
      targetLine: result.target,
      showContributions: false,
      ariaLabel:
        "Grafik proyeksi dana dari " +
        formatMoney(result.current) +
        " menjadi " +
        formatMoney(result.projectedEnd) +
        " dengan target " +
        formatMoney(result.target) +
        "."
    });

    announce(
      result.monthlySaving > 0
        ? "Setoran bulanan yang dibutuhkan " +
            formatMoney(result.monthlySaving) +
            " untuk mencapai target " +
            formatMoney(result.target) +
            " dalam " +
            formatYears(result.years) +
            "."
        : "Dana saat ini sudah cukup untuk mencapai target " +
            formatMoney(result.target) +
            "."
    );
  }

  var updateFunctions = {
    future: updateFuture,
    present: updatePresent,
    loan: updateLoan,
    goal: updateGoal
  };

  function updateTool(tool) {
    var update = updateFunctions[tool];
    if (update) {
      update();
    }
  }

  function activateTool(tool, options) {
    options = options || {};
    if (!toolUI[tool]) {
      tool = "future";
    }

    activeTool = tool;

    tabs.forEach(function (tab) {
      var isActive = tab.getAttribute("data-tool") === tool;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
      tab.setAttribute("tabindex", isActive ? "0" : "-1");
    });

    panels.forEach(function (panel) {
      var isActive = panel.id === "panel-" + tool;
      panel.hidden = !isActive;
    });

    if (options.updateHash !== false) {
      try {
        window.history.replaceState(null, "", "#" + tool);
      } catch (error) {
        /* Ignore restricted history environments. */
      }
    }

    window.requestAnimationFrame(function () {
      if (activeTool === tool) {
        updateTool(tool);
      }
    });
  }

  function toolFromHash() {
    var hash = window.location.hash.replace("#", "");
    return toolUI[hash] ? hash : "future";
  }

  function bindTabs() {
    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () {
        activateTool(tab.getAttribute("data-tool"));
      });

      tab.addEventListener("keydown", function (event) {
        var nextIndex = null;

        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          nextIndex = (index + 1) % tabs.length;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          nextIndex = (index - 1 + tabs.length) % tabs.length;
        } else if (event.key === "Home") {
          nextIndex = 0;
        } else if (event.key === "End") {
          nextIndex = tabs.length - 1;
        }

        if (nextIndex != null) {
          event.preventDefault();
          tabs[nextIndex].focus();
          activateTool(tabs[nextIndex].getAttribute("data-tool"));
        }
      });
    });

    window.addEventListener("hashchange", function () {
      activateTool(toolFromHash(), { updateHash: false });
    });
  }

  function bindForms() {
    Object.keys(toolUI).forEach(function (tool) {
      var form = byId(toolUI[tool].formId);
      if (!form) {
        return;
      }

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        updateTool(tool);
      });

      form.addEventListener("input", function (event) {
        if (event.target.matches("[data-money]")) {
          formatMoneyInput(event.target);
        }
        updateTool(tool);
      });

      form.addEventListener("change", function (event) {
        if (event.target.tagName === "SELECT") {
          updateTool(tool);
        }
      });

      form.addEventListener(
        "focusout",
        function (event) {
          if (event.target.matches("[data-money]") && event.target.value === "") {
            event.target.value = "0";
            updateTool(tool);
          }
        },
        true
      );
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-reset]"), function (button) {
      button.addEventListener("click", function () {
        var form = byId(button.getAttribute("data-reset"));
        if (!form) {
          return;
        }
        form.reset();
        clearErrors(form);
        clearFormAlert(form);
        var tool = Object.keys(toolUI).find(function (key) {
          return toolUI[key].formId === form.id;
        });
        if (tool) {
          updateTool(tool);
        }
      });
    });
  }

  function bindMoneyInputs() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-money]"), function (input) {
      if (input.value) {
        input.value = moneyFormatter.format(parseMoneyInput(input));
      }
    });
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    var button = byId("themeToggle");
    var meta = byId("themeColor");

    if (button) {
      button.setAttribute(
        "aria-label",
        theme === "dark" ? "Ganti ke tema terang" : "Ganti ke tema gelap"
      );
    }
    if (meta) {
      meta.setAttribute("content", theme === "dark" ? "#08110d" : "#f3efe6");
    }
  }

  function bindTheme() {
    var button = byId("themeToggle");
    var initial = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    applyTheme(initial);

    try {
      var legacy = localStorage.getItem(LEGACY_THEME_KEY);
      if (legacy && !localStorage.getItem(THEME_KEY)) {
        localStorage.setItem(THEME_KEY, legacy);
      }
    } catch (error) {
      /* Storage may be unavailable in private contexts. */
    }

    if (!button) {
      return;
    }

    button.addEventListener("click", function () {
      var current = document.documentElement.dataset.theme;
      var next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (error) {
        /* Storage may be unavailable in private contexts. */
      }
    });

    try {
      var media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", function (event) {
        if (
          !localStorage.getItem(THEME_KEY) &&
          !localStorage.getItem(LEGACY_THEME_KEY)
        ) {
          applyTheme(event.matches ? "dark" : "light");
        }
      });
    } catch (error) {
      /* Older browsers can skip live theme preference updates. */
    }
  }

  function niceMax(value) {
    if (value <= 0) {
      return 1;
    }
    var rawStep = value / 4;
    var power = Math.pow(10, Math.floor(Math.log10(rawStep)));
    var normalized = rawStep / power;
    var step;
    if (normalized <= 1) {
      step = 1;
    } else if (normalized <= 2) {
      step = 2;
    } else if (normalized <= 2.5) {
      step = 2.5;
    } else if (normalized <= 5) {
      step = 5;
    } else {
      step = 10;
    }
    step *= power;
    return Math.ceil(value / step) * step;
  }

  function smoothPath(points) {
    if (!points.length) {
      return "";
    }
    if (points.length === 1) {
      return "M " + points[0].x + " " + points[0].y;
    }

    var path = "M " + points[0].x + " " + points[0].y;
    for (var index = 0; index < points.length - 1; index += 1) {
      var p0 = points[index - 1] || points[index];
      var p1 = points[index];
      var p2 = points[index + 1];
      var p3 = points[index + 2] || p2;
      var c1x = p1.x + (p2.x - p0.x) / 6;
      var c1y = p1.y + (p2.y - p0.y) / 6;
      var c2x = p2.x - (p3.x - p1.x) / 6;
      var c2y = p2.y - (p3.y - p1.y) / 6;
      path +=
        " C " +
        c1x.toFixed(2) +
        " " +
        c1y.toFixed(2) +
        ", " +
        c2x.toFixed(2) +
        " " +
        c2y.toFixed(2) +
        ", " +
        p2.x.toFixed(2) +
        " " +
        p2.y.toFixed(2);
    }
    return path;
  }

  function buildGrowthChart(width, state) {
    var height = width < 480 ? 214 : 246;
    var padding = {
      top: 20,
      right: width < 440 ? 10 : 16,
      bottom: 28,
      left: width < 440 ? 45 : 55
    };
    var plotWidth = Math.max(40, width - padding.left - padding.right);
    var plotHeight = height - padding.top - padding.bottom;
    var points = state.points || [];
    var lastPoint = points[points.length - 1];
    var maxYear = lastPoint ? lastPoint.year : 1;
    var values = points.map(function (point) {
      return point.balance;
    });
    if (state.targetLine != null) {
      values.push(state.targetLine);
    }
    var maximum = Math.max.apply(null, values.concat([0]));
    var domainMax = niceMax(maximum * 1.08);
    var baseline = padding.top + plotHeight;
    var xFor = function (year) {
      return padding.left + (year / maxYear) * plotWidth;
    };
    var yFor = function (value) {
      return padding.top + plotHeight - (value / domainMax) * plotHeight;
    };

    var chartPoints = points.map(function (point) {
      return { x: xFor(point.year), y: yFor(point.balance) };
    });
    var linePath = smoothPath(chartPoints);
    var areaPath =
      linePath +
      " L " +
      chartPoints[chartPoints.length - 1].x.toFixed(2) +
      " " +
      baseline.toFixed(2) +
      " L " +
      chartPoints[0].x.toFixed(2) +
      " " +
      baseline.toFixed(2) +
      " Z";

    var gradientId = "growthGradient" + (chartCounter += 1);
    var svg = [];
    svg.push(
      '<svg viewBox="0 0 ' +
        width +
        " " +
        height +
        '" width="' +
        width +
        '" height="' +
        height +
        '" aria-hidden="true" focusable="false">'
    );
    svg.push(
      "<defs><linearGradient id=\"" +
        gradientId +
        '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" class="chart-grad-start"></stop>' +
        '<stop offset="100%" class="chart-grad-end"></stop>' +
        "</linearGradient></defs>"
    );

    for (var tick = 0; tick <= 4; tick += 1) {
      var value = (domainMax / 4) * tick;
      var y = yFor(value);
      svg.push(
        '<line class="chart-grid-line" x1="' +
          padding.left +
          '" y1="' +
          y.toFixed(2) +
          '" x2="' +
          (width - padding.right) +
          '" y2="' +
          y.toFixed(2) +
          '"></line>'
      );
      svg.push(
        '<text class="chart-axis" x="' +
          (padding.left - 9) +
          '" y="' +
          (y + 3.5).toFixed(2) +
          '" text-anchor="end">' +
          formatAxis(value) +
          "</text>"
      );
    }

    var labelCount = width < 440 ? 4 : 6;
    var count = Math.min(labelCount, points.length);
    var labelIndices = [];
    for (var labelIndex = 0; labelIndex < count; labelIndex += 1) {
      labelIndices.push(
        count === 1
          ? 0
          : Math.round((labelIndex * (points.length - 1)) / (count - 1))
      );
    }
    labelIndices = labelIndices.filter(function (item, index) {
      return labelIndices.indexOf(item) === index;
    });

    labelIndices.forEach(function (index) {
      var point = points[index];
      var anchor = "middle";
      if (index === 0) {
        anchor = "start";
      } else if (index === points.length - 1) {
        anchor = "end";
      }
      svg.push(
        '<text class="chart-axis" x="' +
          xFor(point.year).toFixed(2) +
          '" y="' +
          (height - 8) +
          '" text-anchor="' +
          anchor +
          '">' +
          decimalFormatter.format(point.year) +
          "</text>"
      );
    });

    svg.push(
      '<path d="' +
        areaPath +
        '" fill="url(#' +
        gradientId +
        ')" class="chart-area"></path>'
    );

    if (state.targetLine != null && state.targetLine > 0) {
      var targetY = yFor(state.targetLine);
      svg.push(
        '<line class="chart-target-line" x1="' +
          padding.left +
          '" y1="' +
          targetY.toFixed(2) +
          '" x2="' +
          (width - padding.right) +
          '" y2="' +
          targetY.toFixed(2) +
          '"></line>'
      );
      svg.push(
        '<text class="chart-target-label" x="' +
          (width - padding.right) +
          '" y="' +
          Math.max(11, targetY - 5).toFixed(2) +
          '" text-anchor="end">Target</text>'
      );
    }

    if (
      state.showContributions &&
      points.length > 1 &&
      points.every(function (point) {
        return Number.isFinite(point.contributed);
      })
    ) {
      var contributionPoints = points.map(function (point) {
        return { x: xFor(point.year), y: yFor(point.contributed) };
      });
      svg.push(
        '<path d="' +
          smoothPath(contributionPoints) +
          '" class="chart-line chart-line--base"></path>'
      );
    }

    svg.push('<path d="' + linePath + '" class="chart-line"></path>');

    points.forEach(function (point, index) {
      var x = xFor(point.year);
      var y = yFor(point.balance);
      var label =
        "Tahun " +
        decimalFormatter.format(point.year) +
        ": " +
        formatMoney(point.balance);
      if (index === 0) {
        label = "Awal: " + formatMoney(point.balance);
      }
      svg.push(
        '<g class="chart-group" tabindex="-1">' +
          '<circle cx="' +
          x.toFixed(2) +
          '" cy="' +
          y.toFixed(2) +
          '" r="10" fill="transparent"></circle>' +
          '<circle class="chart-point" cx="' +
          x.toFixed(2) +
          '" cy="' +
          y.toFixed(2) +
          '" r="4"></circle>' +
          "<title>" +
          label +
          "</title>" +
          "</g>"
      );
    });

    if (chartPoints.length) {
      var endPoint = chartPoints[chartPoints.length - 1];
      svg.push(
        '<circle class="chart-dot" cx="' +
          endPoint.x.toFixed(2) +
          '" cy="' +
          endPoint.y.toFixed(2) +
          '" r="4.5"></circle>'
      );
    }

    svg.push("</svg>");
    return svg.join("");
  }

  function buildDonutChart(size, state) {
    var center = size / 2;
    var stroke = Math.max(16, Math.round(size * 0.087));
    var radius = center - stroke / 2 - 8;
    var circumference = 2 * Math.PI * radius;
    var total = state.principal + state.interest;
    var interestShare = total > 0 ? state.interest / total : 0;
    var principalShare = 1 - interestShare;
    var principalLength = circumference * principalShare;
    var interestLength = circumference * interestShare;
    var percent = Math.round(interestShare * 100);

    return (
      '<svg viewBox="0 0 ' +
      size +
      " " +
      size +
      '" width="' +
      size +
      '" height="' +
      size +
      '" aria-hidden="true" focusable="false">' +
      '<circle class="donut-track" cx="' +
      center +
      '" cy="' +
      center +
      '" r="' +
      radius.toFixed(2) +
      '"></circle>' +
      '<g transform="rotate(-90 ' +
      center +
      " " +
      center +
      ')">' +
      '<circle class="donut-segment donut-segment--principal" cx="' +
      center +
      '" cy="' +
      center +
      '" r="' +
      radius.toFixed(2) +
      '" stroke-dasharray="' +
      principalLength.toFixed(2) +
      " " +
      circumference.toFixed(2) +
      '"></circle>' +
      "</g>" +
      '<g transform="rotate(' +
      (-90 + principalShare * 360).toFixed(2) +
      " " +
      center +
      " " +
      center +
      ')">' +
      '<circle class="donut-segment donut-segment--interest" cx="' +
      center +
      '" cy="' +
      center +
      '" r="' +
      radius.toFixed(2) +
      '" stroke-dasharray="' +
      interestLength.toFixed(2) +
      " " +
      circumference.toFixed(2) +
      '"></circle>' +
      "</g>" +
      '<text class="donut-kicker" x="' +
      center +
      '" y="' +
      (center - 15) +
      '" text-anchor="middle">BUNGA</text>' +
      '<text class="donut-value" x="' +
      center +
      '" y="' +
      (center + 13) +
      '" text-anchor="middle">' +
      percent +
      "%</text>" +
      '<text class="donut-note" x="' +
      center +
      '" y="' +
      (center + 31) +
      '" text-anchor="middle">dari total</text>' +
      "</svg>"
    );
  }

  function drawChart(tool) {
    var container = chartElements[tool];
    if (!container) {
      return;
    }

    var state = chartState[tool];
    if (!state) {
      container.setAttribute("aria-label", "Grafik belum tersedia.");
      container.innerHTML =
        '<div class="chart-placeholder"><span>Grafik belum tersedia</span><small>Lengkapi asumsi untuk melihat proyeksi.</small></div>';
      return;
    }

    var width = Math.floor(container.clientWidth);
    if (width < 170) {
      return;
    }

    container.setAttribute("aria-label", state.ariaLabel || "Grafik finansial");
    if (state.type === "donut") {
      var donutSize = Math.min(212, Math.max(170, width));
      container.innerHTML = buildDonutChart(donutSize, state);
    } else {
      container.innerHTML = buildGrowthChart(width, state);
    }
  }

  function bindChartResize() {
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", function () {
        drawChart(activeTool);
      });
      return;
    }

    var observer = new ResizeObserver(function (entries) {
      entries.forEach(function (entry) {
        Object.keys(chartElements).forEach(function (tool) {
          if (chartElements[tool] === entry.target) {
            drawChart(tool);
          }
        });
      });
    });

    Object.keys(chartElements).forEach(function (tool) {
      if (chartElements[tool]) {
        observer.observe(chartElements[tool]);
      }
    });
  }

  function init() {
    bindMoneyInputs();
    bindTabs();
    bindForms();
    bindTheme();
    bindChartResize();

    var copyrightYear = byId("copyrightYear");
    if (copyrightYear) {
      copyrightYear.textContent = String(new Date().getFullYear());
    }

    var initialTool = toolFromHash();
    activateTool(initialTool, { updateHash: false });
    try {
      window.history.replaceState(null, "", "#" + initialTool);
    } catch (error) {
      /* Ignore restricted history environments. */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
