// Calculator Application State
const state = {
    expression: "",
    result: "0",
    isEvaluated: false,
    angleUnit: "DEG", // DEG or RAD
    memory: 0,
    history: JSON.parse(localStorage.getItem("calc_history")) || [],
    theme: localStorage.getItem("calc_theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    mode: "standard" // standard or scientific
};

// DOM Elements
const elements = {
    displayContainer: document.querySelector(".calculator-container"),
    expressionDisplay: document.getElementById("expression-display"),
    resultDisplay: document.getElementById("display"),
    angleIndicator: document.getElementById("angle-indicator"),
    memoryIndicator: document.getElementById("memory-indicator"),
    btnAngle: document.getElementById("btn-angle"),
    btnTheme: document.getElementById("theme-toggle-btn"),
    btnStdMode: document.getElementById("mode-std-btn"),
    btnSciMode: document.getElementById("mode-sci-btn"),
    scientificKeypad: document.getElementById("scientific-keypad"),
    btnHistoryToggle: document.getElementById("history-toggle-btn"),
    historyDrawer: document.getElementById("history-drawer"),
    drawerBackdrop: document.getElementById("drawer-backdrop"),
    closeHistoryBtn: document.getElementById("close-history-btn"),
    clearHistoryBtn: document.getElementById("clear-history-btn"),
    historyList: document.getElementById("history-list")
};

// Initialize Calculator
function init() {
    applyTheme(state.theme);
    updateDisplay();
    renderHistory();
    setupEventListeners();
    updateMemoryIndicator();
}

// Theme Management
function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("calc_theme", theme);
}

function toggleTheme() {
    const nextTheme = state.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
}

// Mode Switching (Standard / Scientific)
function setMode(mode) {
    state.mode = mode;
    if (mode === "scientific") {
        elements.displayContainer.classList.add("mode-scientific");
        elements.scientificKeypad.classList.remove("hidden");
        elements.btnSciMode.classList.add("active");
        elements.btnStdMode.classList.remove("active");
    } else {
        elements.displayContainer.classList.remove("mode-scientific");
        elements.scientificKeypad.classList.add("hidden");
        elements.btnStdMode.classList.add("active");
        elements.btnSciMode.classList.remove("active");
    }
}

// Angle Unit Toggle (DEG / RAD)
function toggleAngleUnit() {
    state.angleUnit = state.angleUnit === "DEG" ? "RAD" : "DEG";
    elements.angleIndicator.textContent = state.angleUnit;
    elements.btnAngle.textContent = state.angleUnit;
    // Refresh live evaluation if any
    updateDisplay();
}

// Factorial Helper
function factorial(n) {
    if (n < 0 || !Number.isInteger(n)) return NaN;
    if (n === 0 || n === 1) return 1;
    if (n > 170) return Infinity;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
}

// Format numbers nicely without floating point glitches (e.g. 0.1 + 0.2 = 0.3)
function formatResult(val) {
    if (typeof val !== "number") return "Error";
    if (isNaN(val)) return "Invalid format";
    if (!isFinite(val)) return "Cannot divide by 0";

    // Near zero cleanup for trigonometry (e.g. cos(90 deg))
    if (Math.abs(val) < 1e-14 && Math.abs(val) > 0) {
        val = 0;
    }

    // Convert with high precision and strip trailing zeros
    const rounded = parseFloat(val.toPrecision(12));
    const str = rounded.toString();

    // Check if result is exponentially large or small
    if (Math.abs(rounded) >= 1e14 || (Math.abs(rounded) > 0 && Math.abs(rounded) < 1e-6)) {
        return rounded.toExponential(6).replace(/\.?0+e/, "e");
    }

    return str;
}

// Preprocess and Sanitize Expression String for Safe Evaluation
function sanitizeExpression(exprStr) {
    if (!exprStr || !exprStr.trim()) return "";

    let san = exprStr.trim();

    // Standardize unicode symbols
    san = san
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/−/g, "-")
        .replace(/π/g, "Math.PI")
        .replace(/e/g, "Math.E");

    // Remove trailing incomplete operators
    san = san.replace(/[\+\-\*\/^\s]+$/, "");

    // Contextual Percentage Handling:
    // Case 1: A + B% => A + (A * (B / 100))
    // Case 2: A - B% => A - (A * (B / 100))
    // Case 3: A * B% or A / B% => A * (B / 100)
    // Case 4: Standalone B% => (B / 100)
    san = san.replace(/(\d+(\.\d+)?)\s*([\+\-])\s*(\d+(\.\d+)?)%/g, "($1 $3 ($1 * $4 * 0.01))");
    san = san.replace(/(\d+(\.\d+)?)\s*([\*\/])\s*(\d+(\.\d+)?)%/g, "($1 $3 ($4 * 0.01))");
    san = san.replace(/(\d+(\.\d+)?)%/g, "($1 * 0.01)");
    san = san.replace(/\)%/g, ") * 0.01");

    // Handle powers: x^2, x^3, x^y
    san = san.replace(/\^2/g, "**2");
    san = san.replace(/\^3/g, "**3");
    san = san.replace(/\^/g, "**");

    // Handle factorials: e.g. 5! or (3+2)!
    san = san.replace(/(\d+(\.\d+)?|\([^\(\)]+\))!/g, "factorial($1)");

    // Insert implicit multiplications:
    // e.g. 5(2) -> 5*(2), (2)(3) -> (2)*(3), 5Math.PI -> 5*Math.PI
    san = san.replace(/(\d|\))\s*(Math\.PI|Math\.E)/g, "$1*$2");
    san = san.replace(/(Math\.PI|Math\.E)\s*(\d|\()/g, "$1*$2");
    san = san.replace(/(\d)\s*\(/g, "$1*(");
    san = san.replace(/\)\s*(\d)/g, ")*$1");
    san = san.replace(/\)\s*\(/g, ")*(");

    // Implicit multiplication before functions: e.g. 5sin( -> 5*sin(
    san = san.replace(/(\d|\))\s*(sin|cos|tan|asin|acos|atan|log|ln|sqrt|cbrt)\(/g, "$1*$2(");

    // Auto-close open parentheses
    let openCount = (san.match(/\(/g) || []).length;
    let closeCount = (san.match(/\)/g) || []).length;
    while (openCount > closeCount) {
        san += ")";
        closeCount++;
    }

    // Trigonometric and Math functions setup
    san = san.replace(/asin\(/g, "asinFn(");
    san = san.replace(/acos\(/g, "acosFn(");
    san = san.replace(/atan\(/g, "atanFn(");
    san = san.replace(/sin\(/g, "sinFn(");
    san = san.replace(/cos\(/g, "cosFn(");
    san = san.replace(/tan\(/g, "tanFn(");
    san = san.replace(/log\(/g, "logFn(");
    san = san.replace(/ln\(/g, "lnFn(");
    san = san.replace(/sqrt\(/g, "sqrtFn(");
    san = san.replace(/cbrt\(/g, "cbrtFn(");

    return san;
}

// Safe Mathematical Evaluator
function evaluateExpression(exprStr) {
    if (!exprStr || !exprStr.trim()) return "0";

    const san = sanitizeExpression(exprStr);
    if (!san) return "0";

    try {
        const isDeg = state.angleUnit === "DEG";
        const degToRad = (deg) => (deg * Math.PI) / 180;
        const radToDeg = (rad) => (rad * 180) / Math.PI;

        const sinFn = (x) => {
            if (isDeg) {
                const norm = ((x % 360) + 360) % 360;
                if (norm === 0 || norm === 180) return 0;
                if (norm === 90) return 1;
                if (norm === 270) return -1;
                return Math.sin(degToRad(x));
            }
            return Math.sin(x);
        };

        const cosFn = (x) => {
            if (isDeg) {
                const norm = ((x % 360) + 360) % 360;
                if (norm === 90 || norm === 270) return 0;
                if (norm === 0) return 1;
                if (norm === 180) return -1;
                return Math.cos(degToRad(x));
            }
            return Math.cos(x);
        };

        const tanFn = (x) => {
            if (isDeg) {
                const norm = ((x % 360) + 360) % 360;
                if (norm === 90 || norm === 270) return NaN;
                if (norm === 0 || norm === 180) return 0;
                if (norm === 45 || norm === 225) return 1;
                return Math.tan(degToRad(x));
            }
            return Math.tan(x);
        };

        const asinFn = (x) => (isDeg ? radToDeg(Math.asin(x)) : Math.asin(x));
        const acosFn = (x) => (isDeg ? radToDeg(Math.acos(x)) : Math.acos(x));
        const atanFn = (x) => (isDeg ? radToDeg(Math.atan(x)) : Math.atan(x));
        const logFn = (x) => (x <= 0 ? NaN : Math.log10(x));
        const lnFn = (x) => (x <= 0 ? NaN : Math.log(x));
        const sqrtFn = (x) => (x < 0 ? NaN : Math.sqrt(x));
        const cbrtFn = (x) => Math.cbrt(x);

        const evaluator = new Function(
            "sinFn", "cosFn", "tanFn", "asinFn", "acosFn", "atanFn",
            "logFn", "lnFn", "sqrtFn", "cbrtFn", "factorial",
            `"use strict"; return (${san});`
        );

        const val = evaluator(
            sinFn, cosFn, tanFn, asinFn, acosFn, atanFn,
            logFn, lnFn, sqrtFn, cbrtFn, factorial
        );

        return formatResult(val);
    } catch (e) {
        return "Error";
    }
}

// Display Update & Real-Time Calculation Preview
function updateDisplay() {
    elements.expressionDisplay.textContent = state.expression;

    if (state.expression.length === 0) {
        elements.resultDisplay.value = "0";
    } else if (state.isEvaluated) {
        elements.resultDisplay.value = state.result;
    } else {
        // Real-time live evaluation preview
        const liveResult = evaluateExpression(state.expression);
        if (liveResult !== "Error" && liveResult !== "Invalid format" && liveResult !== "Cannot divide by 0" && liveResult !== "") {
            elements.resultDisplay.value = liveResult;
        }
    }
}

// Helper: Get the current number token at the end of expression
function getCurrentNumberToken() {
    const parts = state.expression.split(/[\+\−\-\×\*\÷\/\^\(\)]/);
    return parts[parts.length - 1] || "";
}

// Helper: Check if string ends with an operator
function isLastCharOperator() {
    const trimmed = state.expression.trim();
    if (!trimmed) return false;
    const lastChar = trimmed.slice(-1);
    return ["+", "−", "-", "×", "*", "÷", "/", "^"].includes(lastChar);
}

// User Actions Handler
function handleInput(action, value) {
    // Handling actions when a calculation was previously evaluated
    if (state.isEvaluated && action !== "equals") {
        if (action === "number" || action === "func" || action === "constant") {
            // New calculation start
            state.expression = "";
        } else if (action === "decimal") {
            state.expression = "0";
        } else if (action === "op" || action === "percent") {
            // Chaining previous result!
            if (state.result !== "Error" && state.result !== "Cannot divide by 0" && state.result !== "Invalid format") {
                state.expression = state.result;
            } else {
                state.expression = "0";
            }
        }
        state.isEvaluated = false;
    }

    switch (action) {
        case "number":
            // Avoid leading multiple zeros like "00"
            if (state.expression === "0" && value !== ".") {
                state.expression = value;
            } else {
                state.expression += value;
            }
            break;

        case "constant":
            if (state.expression === "0") {
                state.expression = value;
            } else {
                state.expression += value;
            }
            break;

        case "decimal":
            const currentToken = getCurrentNumberToken();
            if (!currentToken.includes(".")) {
                if (currentToken === "" || isLastCharOperator() || state.expression.endsWith("(") || state.expression === "") {
                    state.expression += "0.";
                } else {
                    state.expression += ".";
                }
            }
            break;

        case "op":
            if (state.expression === "") {
                if (value === "−" || value === "-") {
                    state.expression = "−";
                } else {
                    state.expression = "0 " + value + " ";
                }
            } else if (isLastCharOperator()) {
                // Replace the previous trailing operator cleanly
                const trimmed = state.expression.trim();
                const withoutLastOp = trimmed.slice(0, -1).trim();
                if (value === "−" && !trimmed.endsWith("−") && (trimmed.endsWith("×") || trimmed.endsWith("÷"))) {
                    // Allow negative sign after multiply or divide (e.g. 5 × −2)
                    state.expression = trimmed + " −";
                } else {
                    state.expression = withoutLastOp ? withoutLastOp + " " + value + " " : value === "−" ? "−" : "0 " + value + " ";
                }
            } else {
                state.expression += " " + value + " ";
            }
            break;

        case "percent":
            if (state.expression !== "" && !isLastCharOperator()) {
                state.expression += "%";
            }
            break;

        case "paren":
            if (value === "(") {
                if (state.expression === "0") {
                    state.expression = "(";
                } else {
                    state.expression += "(";
                }
            } else {
                const openCount = (state.expression.match(/\(/g) || []).length;
                const closeCount = (state.expression.match(/\)/g) || []).length;
                if (openCount > closeCount && !isLastCharOperator()) {
                    state.expression += ")";
                }
            }
            break;

        case "func":
            if (state.expression === "0") {
                state.expression = value;
            } else {
                state.expression += value;
            }
            break;

        case "reciprocal":
            if (state.isEvaluated && state.result !== "Error") {
                state.expression = `1/(${state.result})`;
            } else if (state.expression.trim()) {
                state.expression = `1/(${state.expression.trim()})`;
            } else {
                state.expression = "1/(";
            }
            break;

        case "toggle-sign":
            if (state.isEvaluated && state.result !== "Error") {
                if (state.result.startsWith("-") || state.result.startsWith("−")) {
                    state.result = state.result.slice(1);
                } else if (state.result !== "0") {
                    state.result = "−" + state.result;
                }
                state.expression = state.result;
            } else {
                const parts = state.expression.split(" ");
                const last = parts[parts.length - 1];
                if (last) {
                    if (last.startsWith("−") || last.startsWith("-")) {
                        parts[parts.length - 1] = last.slice(1);
                    } else if (last !== "0" && last !== "") {
                        parts[parts.length - 1] = "−" + last;
                    }
                    state.expression = parts.join(" ");
                } else {
                    state.expression = "−";
                }
            }
            break;

        case "delete":
            if (state.isEvaluated) {
                state.expression = "";
                state.result = "0";
                state.isEvaluated = false;
            } else if (state.expression.length > 0) {
                // Check if deleting a multi-char token like 'sin(', 'sqrt(', 'log(', etc.
                const funcMatches = ["asin(", "acos(", "atan(", "cbrt(", "sqrt(", "sin(", "cos(", "tan(", "log(", "ln(", "1/("];
                let matchedFunc = funcMatches.find(fn => state.expression.endsWith(fn));
                if (matchedFunc) {
                    state.expression = state.expression.slice(0, -matchedFunc.length);
                } else if (state.expression.endsWith(" ")) {
                    // Remove trailing spaced operator
                    state.expression = state.expression.trimEnd().slice(0, -1).trimEnd();
                } else {
                    state.expression = state.expression.slice(0, -1);
                }
            }
            break;

        case "clear":
            state.expression = "";
            state.result = "0";
            state.isEvaluated = false;
            break;

        case "equals":
            if (!state.expression.trim()) return;
            const finalResult = evaluateExpression(state.expression);
            state.result = finalResult;
            state.isEvaluated = true;
            if (finalResult !== "Error" && finalResult !== "Cannot divide by 0" && finalResult !== "Invalid format") {
                saveHistory(state.expression, finalResult);
            }
            break;
    }

    updateDisplay();
}

// Memory Operations
function handleMemory(type) {
    let currentVal = 0;
    if (state.isEvaluated) {
        currentVal = parseFloat(state.result) || 0;
    } else {
        const evalVal = evaluateExpression(state.expression);
        currentVal = parseFloat(evalVal) || 0;
    }

    switch (type) {
        case "mc":
            state.memory = 0;
            break;
        case "mr":
            if (state.isEvaluated) {
                state.expression = state.memory.toString();
                state.isEvaluated = false;
            } else {
                state.expression += state.memory.toString();
            }
            break;
        case "m-plus":
            state.memory += currentVal;
            break;
        case "m-minus":
            state.memory -= currentVal;
            break;
    }
    updateMemoryIndicator();
    updateDisplay();
}

function updateMemoryIndicator() {
    if (state.memory !== 0) {
        elements.memoryIndicator.classList.remove("hidden");
    } else {
        elements.memoryIndicator.classList.add("hidden");
    }
}

// History Panel Drawer Operations
function saveHistory(expr, res) {
    const item = { expr, res, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    state.history.unshift(item);
    if (state.history.length > 30) state.history.pop();
    localStorage.setItem("calc_history", JSON.stringify(state.history));
    renderHistory();
}

function renderHistory() {
    if (state.history.length === 0) {
        elements.historyList.innerHTML = `<div class="empty-history">No history yet</div>`;
        return;
    }

    elements.historyList.innerHTML = state.history
        .map(
            (item, index) => `
        <div class="history-item" data-index="${index}">
            <div class="history-expr">${escapeHtml(item.expr)} =</div>
            <div class="history-res">${escapeHtml(item.res)}</div>
        </div>
    `
        )
        .join("");

    // Add click event to populate expression from history item
    document.querySelectorAll(".history-item").forEach((el) => {
        el.addEventListener("click", () => {
            const idx = el.getAttribute("data-index");
            const item = state.history[idx];
            state.expression = item.res;
            state.isEvaluated = true;
            state.result = item.res;
            updateDisplay();
            toggleHistoryDrawer(false);
        });
    });
}

function clearHistory() {
    state.history = [];
    localStorage.removeItem("calc_history");
    renderHistory();
}

function toggleHistoryDrawer(open) {
    const isOpen = open !== undefined ? open : !elements.historyDrawer.classList.contains("open");
    if (isOpen) {
        elements.historyDrawer.classList.add("open");
        if (elements.drawerBackdrop) elements.drawerBackdrop.classList.add("active");
    } else {
        elements.historyDrawer.classList.remove("open");
        if (elements.drawerBackdrop) elements.drawerBackdrop.classList.remove("active");
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Event Listeners Setup
function setupEventListeners() {
    // Mode Buttons
    elements.btnStdMode.addEventListener("click", () => setMode("standard"));
    elements.btnSciMode.addEventListener("click", () => setMode("scientific"));

    // Theme Toggle
    elements.btnTheme.addEventListener("click", toggleTheme);

    // Angle Unit Toggle
    elements.btnAngle.addEventListener("click", toggleAngleUnit);

    // Memory Buttons
    document.getElementById("btn-mc").addEventListener("click", () => handleMemory("mc"));
    document.getElementById("btn-mr").addEventListener("click", () => handleMemory("mr"));
    document.getElementById("btn-m-plus").addEventListener("click", () => handleMemory("m-plus"));
    document.getElementById("btn-m-minus").addEventListener("click", () => handleMemory("m-minus"));

    // History Toggle & Actions
    elements.btnHistoryToggle.addEventListener("click", () => toggleHistoryDrawer());
    elements.closeHistoryBtn.addEventListener("click", () => toggleHistoryDrawer(false));
    if (elements.drawerBackdrop) {
        elements.drawerBackdrop.addEventListener("click", () => toggleHistoryDrawer(false));
    }
    elements.clearHistoryBtn.addEventListener("click", clearHistory);

    // Click Delegation on Calculator Keypads
    document.querySelector(".keypad-wrapper").addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const action = btn.getAttribute("data-action");
        const value = btn.getAttribute("data-value");

        if (action) {
            handleInput(action, value);
        }
    });

    // Keyboard Shortcuts Support
    document.addEventListener("keydown", (e) => {
        if (e.target.tagName === "INPUT" && e.target !== elements.resultDisplay) return;

        let key = e.key;

        // Visual keypress animation trigger
        highlightButton(key);

        if (key >= "0" && key <= "9") {
            handleInput("number", key);
        } else if (key === ".") {
            handleInput("decimal", ".");
        } else if (key === "+") {
            handleInput("op", "+");
        } else if (key === "-") {
            handleInput("op", "−");
        } else if (key === "*") {
            handleInput("op", "×");
        } else if (key === "/") {
            e.preventDefault();
            handleInput("op", "÷");
        } else if (key === "%") {
            handleInput("percent", "%");
        } else if (key === "(" || key === ")") {
            handleInput("paren", key);
        } else if (key === "^") {
            handleInput("op", "^");
        } else if (key === "Enter" || key === "=") {
            e.preventDefault();
            handleInput("equals");
        } else if (key === "Backspace") {
            handleInput("delete");
        } else if (key === "Escape" || key.toLowerCase() === "c") {
            handleInput("clear");
        }
    });
}

// Highlight button on physical keyboard press
function highlightButton(key) {
    let selector = null;
    if (key >= "0" && key <= "9") {
        const numIds = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
        selector = `#${numIds[parseInt(key)]}`;
    } else if (key === "+") selector = "#plus";
    else if (key === "-") selector = "#minus";
    else if (key === "*") selector = "#multiply";
    else if (key === "/") selector = "#divide";
    else if (key === "Enter" || key === "=") selector = "#equals";
    else if (key === "Backspace") selector = "#delete";
    else if (key === "Escape" || key.toLowerCase() === "c") selector = "#clear";
    else if (key === ".") selector = "#decimal";
    else if (key === "%") selector = "#percent";
    else if (key === "(") selector = "#paren-open";
    else if (key === ")") selector = "#paren-close";

    if (selector) {
        const btn = document.querySelector(selector);
        if (btn) {
            btn.classList.add("keyboard-active");
            setTimeout(() => btn.classList.remove("keyboard-active"), 120);
        }
    }
}

// Start application when DOM is ready
document.addEventListener("DOMContentLoaded", init);