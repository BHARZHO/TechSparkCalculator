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
}

// Factorial Helper
function factorial(n) {
    if (n < 0) return NaN;
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= Math.min(n, 170); i++) res *= i;
    return res;
}

// Safe Mathematical Evaluator
function evaluateExpression(exprStr) {
    if (!exprStr.trim()) return "0";

    try {
        let san = exprStr
            .replace(/×/g, "*")
            .replace(/÷/g, "/")
            .replace(/−/g, "-")
            .replace(/π/g, "Math.PI")
            .replace(/e/g, "Math.E")
            .replace(/%/g, "*0.01");

        // Handle powers like x^y
        san = san.replace(/(\d+(\.\d+)?)\^(\d+(\.\d+)?)/g, "Math.pow($1,$3)");

        // Handle square & cube exponents
        san = san.replace(/\^2/g, "**2");
        san = san.replace(/\^3/g, "**3");

        // Handle factorials (e.g. 5!)
        san = san.replace(/(\d+)!/g, "factorial($1)");

        // Trigonometric Functions setup according to DEG/RAD
        const isDeg = state.angleUnit === "DEG";
        const sinFn = (x) => Math.sin(isDeg ? (x * Math.PI) / 180 : x);
        const cosFn = (x) => Math.cos(isDeg ? (x * Math.PI) / 180 : x);
        const tanFn = (x) => Math.tan(isDeg ? (x * Math.PI) / 180 : x);
        const asinFn = (x) => (isDeg ? (Math.asin(x) * 180) / Math.PI : Math.asin(x));
        const acosFn = (x) => (isDeg ? (Math.acos(x) * 180) / Math.PI : Math.acos(x));
        const atanFn = (x) => (isDeg ? (Math.atan(x) * 180) / Math.PI : Math.atan(x));
        const logFn = (x) => Math.log10(x);
        const lnFn = (x) => Math.log(x);
        const sqrtFn = (x) => Math.sqrt(x);
        const cbrtFn = (x) => Math.cbrt(x);

        // Replace trigonometric string tokens
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

        // Create scope with math functions
        const evaluator = new Function(
            "sinFn", "cosFn", "tanFn", "asinFn", "acosFn", "atanFn",
            "logFn", "lnFn", "sqrtFn", "cbrtFn", "factorial",
            `return ${san};`
        );

        let val = evaluator(
            sinFn, cosFn, tanFn, asinFn, acosFn, atanFn,
            logFn, lnFn, sqrtFn, cbrtFn, factorial
        );

        if (typeof val === "number") {
            if (!isFinite(val)) return "Error";
            // Clean up float rounding issues like 0.1 + 0.2
            return Number(Math.round(val + "e12") + "e-12").toString();
        }
        return "Error";
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
        if (liveResult !== "Error" && liveResult !== "") {
            elements.resultDisplay.value = liveResult;
        }
    }
}

// User Actions Handler
function handleInput(action, value) {
    if (state.isEvaluated && action !== "equals") {
        if (action === "number" || action === "insert" || action === "func") {
            // Start fresh if user presses number/func after result evaluation
            state.expression = "";
        }
        state.isEvaluated = false;
    }

    switch (action) {
        case "number":
        case "insert":
            state.expression += value;
            break;

        case "func":
            state.expression += value;
            break;

        case "op":
            state.expression += value;
            break;

        case "clear":
            state.expression = "";
            state.result = "0";
            state.isEvaluated = false;
            break;

        case "delete":
            if (state.expression.length > 0) {
                state.expression = state.expression.slice(0, -1);
            }
            break;

        case "toggle-sign":
            if (state.expression.startsWith("-")) {
                state.expression = state.expression.slice(1);
            } else {
                state.expression = "-" + state.expression;
            }
            break;

        case "equals":
            if (!state.expression.trim()) return;
            const finalResult = evaluateExpression(state.expression);
            if (finalResult !== "Error") {
                state.result = finalResult;
                state.isEvaluated = true;
                saveHistory(state.expression, finalResult);
            } else {
                state.result = "Error";
                state.isEvaluated = true;
            }
            break;
    }

    updateDisplay();
}

// Memory Operations
function handleMemory(type) {
    const currentVal = parseFloat(elements.resultDisplay.value) || 0;
    switch (type) {
        case "mc":
            state.memory = 0;
            break;
        case "mr":
            state.expression += state.memory.toString();
            state.isEvaluated = false;
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
    if (open === undefined) {
        elements.historyDrawer.classList.toggle("open");
    } else if (open) {
        elements.historyDrawer.classList.add("open");
    } else {
        elements.historyDrawer.classList.remove("open");
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
            handleInput("insert", ".");
        } else if (key === "+") {
            handleInput("insert", "+");
        } else if (key === "-") {
            handleInput("insert", "−");
        } else if (key === "*") {
            handleInput("insert", "×");
        } else if (key === "/") {
            e.preventDefault();
            handleInput("insert", "÷");
        } else if (key === "%") {
            handleInput("insert", "%");
        } else if (key === "(" || key === ")") {
            handleInput("insert", key);
        } else if (key === "^") {
            handleInput("op", "^");
        } else if (key === "Enter" || key === "=") {
            e.preventDefault();
            handleInput("equals");
        } else if (key === "Backspace") {
            handleInput("delete");
        } else if (key === "Escape" || key === "c" || key === "C") {
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