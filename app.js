(function () {
  "use strict";

  var Engine = window.CalculatorEngine;
  if (!Engine || !Engine.Calculator) {
    return;
  }

  var HISTORY_KEY = "calculator.history.v1";
  var THEME_KEY = "calculator.theme.v1";
  var THEME_COLORS = { dark: "#090d13", light: "#edf0f5" };
  var Calculator = Engine.Calculator;

  var elements = {
    keypad: document.getElementById("keypad"),
    display: document.getElementById("display"),
    expression: document.getElementById("expression"),
    preview: document.getElementById("preview"),
    themeToggle: document.getElementById("themeToggle"),
    themeColor: document.getElementById("themeColor"),
    historyToggle: document.getElementById("historyToggle"),
    historyPanel: document.getElementById("historyPanel"),
    historyBackdrop: document.getElementById("historyBackdrop"),
    historyList: document.getElementById("historyList"),
    historyEmpty: document.getElementById("historyEmpty"),
    historyFootnote: document.getElementById("historyFootnote"),
    historyCount: document.getElementById("historyCount"),
    clearHistory: document.getElementById("clearHistory"),
    closeHistory: document.getElementById("closeHistory")
  };

  function readStoredHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) {
        return [];
      }
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function persistHistory(history) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      /* Storage can be unavailable; the calculator still works. */
    }
  }

  var calculator = new Calculator({ history: readStoredHistory() });
  var lastState = null;
  var lastHistorySignature = null;
  var landingTimer = null;
  var shakeTimer = null;
  var mobileQuery = window.matchMedia("(max-width: 1023px)");
  var historyOpen = false;
  var previousFocus = null;

  function replayClass(element, className, timerName, duration) {
    if (timerName === "landing") {
      window.clearTimeout(landingTimer);
    } else {
      window.clearTimeout(shakeTimer);
    }

    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);

    var timer = window.setTimeout(function () {
      element.classList.remove(className);
    }, duration);

    if (timerName === "landing") {
      landingTimer = timer;
    } else {
      shakeTimer = timer;
    }
  }

  function updateDisplaySize(text) {
    var length = text.length;
    elements.display.classList.toggle("is-compact", length > 10 && length <= 14);
    elements.display.classList.toggle("is-tiny", length > 14);
  }

  function formatHistoryTime(timestamp) {
    var date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    var now = new Date();
    var sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    try {
      if (sameDay) {
        return new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit"
        }).format(date);
      }

      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric"
      }).format(date);
    } catch (error) {
      return date.toLocaleDateString();
    }
  }

  function buildHistoryItem(item, index) {
    var listItem = document.createElement("li");
    var button = document.createElement("button");
    var calculation = document.createElement("span");
    var expression = document.createElement("span");
    var time = document.createElement("span");
    var result = document.createElement("span");

    button.type = "button";
    button.className = "history-item";
    button.dataset.index = String(index);
    button.setAttribute(
      "aria-label",
      "Reuse result " + item.result + " from " + item.expression
    );

    calculation.className = "history-calculation";
    expression.className = "history-expression";
    expression.textContent = item.expression;
    time.className = "history-time";
    time.textContent = formatHistoryTime(item.timestamp);
    calculation.append(expression, time);

    result.className = "history-result";
    result.textContent = item.result;

    button.append(calculation, result);
    listItem.append(button);
    return listItem;
  }

  function renderHistory(history) {
    var signature = history
      .map(function (item) {
        return [item.timestamp, item.expression, item.result, item.value].join("|");
      })
      .join("::");

    if (signature === lastHistorySignature) {
      return;
    }

    lastHistorySignature = signature;
    var hasHistory = history.length > 0;

    elements.historyList.replaceChildren();
    if (hasHistory) {
      var fragment = document.createDocumentFragment();
      history.forEach(function (item, index) {
        fragment.append(buildHistoryItem(item, index));
      });
      elements.historyList.append(fragment);
    }

    elements.historyEmpty.hidden = hasHistory;
    elements.historyList.hidden = !hasHistory;
    elements.historyFootnote.hidden = !hasHistory;
    elements.clearHistory.disabled = !hasHistory;
    elements.historyCount.hidden = !hasHistory;
    elements.historyCount.textContent = hasHistory ? String(history.length) : "";

    persistHistory(history);
  }

  function render() {
    var state = calculator.getState();
    var hadError = Boolean(lastState && lastState.error);
    var hadResult = Boolean(lastState && lastState.justEvaluated);

    elements.display.textContent = state.display;
    elements.expression.textContent = state.error ? state.error : state.expression;
    elements.expression.classList.toggle("is-error-line", Boolean(state.error));
    elements.preview.textContent = state.preview;
    elements.preview.hidden = !state.preview;

    updateDisplaySize(state.display);
    elements.display.classList.toggle("is-error", Boolean(state.error));

    if (state.error) {
      elements.display.setAttribute("aria-label", "Error. " + state.error);
    } else {
      elements.display.removeAttribute("aria-label");
    }

    if (state.error && !hadError) {
      replayClass(elements.display, "is-shaking", "shake", 380);
    }

    if (state.justEvaluated && !hadResult) {
      replayClass(elements.display, "is-landing", "landing", 330);
    }

    renderHistory(state.history);
    updateHistoryToggleLabel();
    lastState = state;
  }

  function execute(action, value) {
    switch (action) {
      case "digit":
        calculator.inputDigit(value);
        break;
      case "decimal":
        calculator.inputDecimal();
        break;
      case "operator":
        calculator.inputOperator(value);
        break;
      case "equals":
        calculator.equals();
        break;
      case "clear":
        calculator.clear();
        break;
      case "backspace":
        calculator.backspace();
        break;
      case "percent":
        calculator.percent();
        break;
      case "sign":
        calculator.toggleSign();
        break;
      default:
        return;
    }

    render();
  }

  function findKey(action, value) {
    var keys = elements.keypad.querySelectorAll(".key");
    for (var index = 0; index < keys.length; index += 1) {
      var key = keys[index];
      if (
        key.dataset.action === action &&
        (value === undefined || key.dataset.value === value)
      ) {
        return key;
      }
    }
    return null;
  }

  function flashKey(action, value) {
    var key = findKey(action, value);
    if (!key) {
      return;
    }

    key.classList.remove("is-pressed");
    void key.offsetWidth;
    key.classList.add("is-pressed");
    window.setTimeout(function () {
      key.classList.remove("is-pressed");
    }, 125);
  }

  function setTheme(theme, persist) {
    document.documentElement.dataset.theme = theme;
    elements.themeToggle.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
    );
    elements.themeToggle.setAttribute(
      "title",
      theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
    );
    elements.themeColor.setAttribute("content", THEME_COLORS[theme] || THEME_COLORS.dark);

    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (error) {
        /* Theme persistence is optional. */
      }
    }
  }

  function updateHistoryToggleLabel() {
    var count = calculator.getState().history.length;
    var action = historyOpen ? "Close history" : "Open history";
    var countLabel =
      count > 0
        ? ", " + count + " saved calculation" + (count === 1 ? "" : "s")
        : "";
    elements.historyToggle.setAttribute("aria-label", action + countLabel);
  }

  function setHistoryOpen(open, restoreFocus) {
    if (!mobileQuery.matches) {
      historyOpen = false;
      document.body.classList.remove("history-open");
      elements.historyPanel.inert = false;
      elements.historyPanel.removeAttribute("aria-hidden");
      elements.historyToggle.setAttribute("aria-expanded", "false");
      return;
    }

    historyOpen = open;

    if (open) {
      previousFocus = document.activeElement;
      document.body.classList.add("history-open");
      elements.historyToggle.setAttribute("aria-expanded", "true");
      elements.historyPanel.inert = false;
      elements.historyPanel.removeAttribute("aria-hidden");
      updateHistoryToggleLabel();

      window.setTimeout(function () {
        if (historyOpen) {
          elements.closeHistory.focus();
        }
      }, 80);
    } else {
      document.body.classList.remove("history-open");
      elements.historyToggle.setAttribute("aria-expanded", "false");
      elements.historyPanel.inert = true;
      elements.historyPanel.setAttribute("aria-hidden", "true");
      updateHistoryToggleLabel();

      if (restoreFocus !== false) {
        var target =
          previousFocus && previousFocus.isConnected && previousFocus !== document.body
            ? previousFocus
            : elements.historyToggle;
        target.focus();
      }
    }
  }

  function syncHistoryMode() {
    if (mobileQuery.matches) {
      if (!historyOpen) {
        elements.historyPanel.inert = true;
        elements.historyPanel.setAttribute("aria-hidden", "true");
        elements.historyToggle.setAttribute("aria-expanded", "false");
        updateHistoryToggleLabel();
      }
    } else {
      historyOpen = false;
      document.body.classList.remove("history-open");
      elements.historyPanel.inert = false;
      elements.historyPanel.removeAttribute("aria-hidden");
      elements.historyToggle.setAttribute("aria-expanded", "false");
      updateHistoryToggleLabel();
    }
  }

  function actionForKey(event) {
    var key = event.key;

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return null;
    }

    if (/^\d$/.test(key)) {
      return ["digit", key];
    }

    switch (key) {
      case ".":
      case ",":
        return ["decimal"];
      case "+":
        return ["operator", "+"];
      case "-":
        return ["operator", "-"];
      case "*":
      case "x":
      case "X":
        return ["operator", "*"];
      case "/":
        return ["operator", "/"];
      case "Enter":
      case "=":
        return ["equals"];
      case "Backspace":
        return ["backspace"];
      case "Escape":
      case "Delete":
        return ["clear"];
      case "%":
        return ["percent"];
      case "F9":
        return ["sign"];
      default:
        return null;
    }
  }

  elements.keypad.addEventListener("click", function (event) {
    var key = event.target.closest(".key");
    if (!key || !elements.keypad.contains(key)) {
      return;
    }
    execute(key.dataset.action, key.dataset.value);
  });

  document.addEventListener("keydown", function (event) {
    if (event.defaultPrevented) {
      return;
    }

    if (historyOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        setHistoryOpen(false);
      }
      return;
    }

    var target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest("input, textarea, select, [contenteditable='true']")
    ) {
      return;
    }

    if (
      (event.key === "Enter" || event.key === " ") &&
      target instanceof HTMLElement &&
      target.closest("button")
    ) {
      var focusedKey = target.closest(".key");
      if (!(event.key === "Enter" && focusedKey)) {
        return;
      }
    }

    var action = actionForKey(event);
    if (!action) {
      return;
    }

    event.preventDefault();
    execute(action[0], action[1]);
    flashKey(action[0], action[1]);
  });

  elements.themeToggle.addEventListener("click", function () {
    var nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    setTheme(nextTheme, true);
  });

  elements.historyToggle.addEventListener("click", function () {
    setHistoryOpen(!historyOpen);
  });

  elements.closeHistory.addEventListener("click", function () {
    setHistoryOpen(false);
  });

  elements.historyBackdrop.addEventListener("click", function () {
    setHistoryOpen(false);
  });

  elements.historyList.addEventListener("click", function (event) {
    var item = event.target.closest(".history-item");
    if (!item) {
      return;
    }

    var index = Number(item.dataset.index);
    if (calculator.useHistory(index)) {
      render();
      if (historyOpen) {
        setHistoryOpen(false);
      }
    }
  });

  elements.clearHistory.addEventListener("click", function () {
    calculator.clearHistory();
    render();
    if (historyOpen) {
      elements.closeHistory.focus();
    }
  });

  elements.historyPanel.addEventListener("keydown", function (event) {
    if (!historyOpen || event.key !== "Tab") {
      return;
    }

    var focusable = Array.prototype.filter.call(
      elements.historyPanel.querySelectorAll("button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])"),
      function (element) {
        return element.getClientRects().length > 0;
      }
    );

    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", syncHistoryMode);
  } else if (typeof mobileQuery.addListener === "function") {
    mobileQuery.addListener(syncHistoryMode);
  }

  setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark", false);
  syncHistoryMode();
  render();
})();
