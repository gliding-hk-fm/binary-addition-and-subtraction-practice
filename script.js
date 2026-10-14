(() => {
  "use strict";

  const width = 8;
  const maxValue = (1 << width) - 1;
  const placeValues = Array.from({ length: width }, (_, index) => Math.pow(2, width - index - 1));
  const storageKeys = {
    points: "binaryPracticePoints",
    preferences: "binaryPracticePreferences",
    leaderboard: "binaryPracticeLeaderboard"
  };

  function readStoredValue(key, fallback) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function readStoredJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStoredValue(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      return false;
    }
    return true;
  }

  const savedPreferences = readStoredJson(storageKeys.preferences, {});
  const savedPoints = Number(readStoredValue(storageKeys.points, "0"));

  const elements = {
    weightingValues: document.getElementById("weightingValues"),
    aRow: document.getElementById("aRow"),
    bRow: document.getElementById("bRow"),
    complementRowContainer: document.getElementById("complementRowContainer"),
    complementRow: document.getElementById("complementRow"),
    aDecimal: document.getElementById("aDecimal"),
    bDecimal: document.getElementById("bDecimal"),
    carryRow: document.getElementById("carryRow"),
    resultRow: document.getElementById("resultRow"),
    operatorDisplay: document.getElementById("operatorDisplay"),
    answerForm: document.getElementById("answerForm"),
    answerInput: document.getElementById("answerInput"),
    answerSubmitButton: document.querySelector("#answerForm button[type='submit']"),
    answerFeedback: document.getElementById("answerFeedback"),
    answerPrompt: document.getElementById("answerPrompt"),
    answerHint: document.getElementById("answerHint"),
    problemNumber: document.getElementById("problemNumber"),
    bitWidthLabel: document.getElementById("bitWidthLabel"),
    pointsDisplay: document.getElementById("pointsDisplay"),
    newProblemButton: document.getElementById("newProblemButton"),
    instructions: document.getElementById("additionInstructions"),
    leaderboardList: document.getElementById("leaderboardList"),
    leaderboardEmpty: document.getElementById("leaderboardEmpty"),
    settingsDialog: document.getElementById("settingsDialog"),
    settingsForm: document.getElementById("settingsForm"),
    openSettingsButton: document.getElementById("openSettingsButton"),
    closeSettingsButton: document.getElementById("closeSettingsButton"),
    cancelSettingsButton: document.getElementById("cancelSettingsButton"),
    leaderboardOptIn: document.getElementById("leaderboardOptIn"),
    leaderboardName: document.getElementById("leaderboardName"),
    darkModeToggle: document.getElementById("darkModeToggle")
  };

  const state = {
    operation: "add",
    a: 0,
    b: 0,
    result: 0,
    carries: [],
    problemNumber: 0,
    points: Number.isFinite(savedPoints) ? savedPoints : 0,
    leaderboardConsent: typeof savedPreferences.leaderboardConsent === "boolean"
      ? savedPreferences.leaderboardConsent
      : null,
    leaderboardName: typeof savedPreferences.leaderboardName === "string"
      ? savedPreferences.leaderboardName
      : "Player",
    theme: savedPreferences.theme === "light" ? "light" : "dark",
    incorrectAttempts: 0,
    instructionsUsed: false,
    answered: false
  };

  function getLeaderboardEntries() {
    const entries = readStoredJson(storageKeys.leaderboard, []);
    return Array.isArray(entries)
      ? entries.filter(entry => entry && typeof entry.name === "string" && Number.isFinite(entry.points))
      : [];
  }

  function saveLeaderboardScore() {
    if (!state.leaderboardConsent) return;
    const name = state.leaderboardName.trim() || "Player";
    const entries = getLeaderboardEntries();
    const existing = entries.find(entry => entry.name.toLowerCase() === name.toLowerCase());
    if (existing) existing.points = state.points;
    else entries.push({ name, points: state.points });
    entries.sort((first, second) => second.points - first.points);
    writeStoredValue(storageKeys.leaderboard, JSON.stringify(entries.slice(0, 20)));
  }

  function renderLeaderboard() {
    const entries = state.leaderboardConsent ? getLeaderboardEntries() : [];
    elements.leaderboardList.replaceChildren();
    entries.forEach((entry, index) => {
      const item = document.createElement("li");
      const rank = document.createElement("span");
      const name = document.createElement("span");
      const points = document.createElement("strong");
      rank.textContent = String(index + 1).padStart(2, "0");
      name.textContent = entry.name;
      points.textContent = `${entry.points} pts`;
      item.append(rank, name, points);
      elements.leaderboardList.appendChild(item);
    });
    elements.leaderboardEmpty.hidden = entries.length > 0;
    elements.leaderboardEmpty.textContent = state.leaderboardConsent
      ? "No local scores yet."
      : "Opt in through Settings to add your score.";
  }

  function renderPoints() {
    elements.pointsDisplay.textContent = String(state.points);
  }

  function updatePoints(change) {
    state.points += change;
    writeStoredValue(storageKeys.points, String(state.points));
    renderPoints();
    saveLeaderboardScore();
    renderLeaderboard();
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    elements.darkModeToggle.checked = state.theme === "dark";
  }

  function savePreferences() {
    const wasOptedIn = state.leaderboardConsent;
    const previousName = state.leaderboardName;
    state.leaderboardConsent = elements.leaderboardOptIn.checked;
    state.leaderboardName = elements.leaderboardName.value.trim() || "Player";
    state.theme = elements.darkModeToggle.checked ? "dark" : "light";
    const preferences = {
      leaderboardConsent: state.leaderboardConsent,
      leaderboardName: state.leaderboardName,
      theme: state.theme
    };
    writeStoredValue(storageKeys.preferences, JSON.stringify(preferences));
    elements.leaderboardName.value = state.leaderboardName;
    applyTheme();

    if (wasOptedIn && !state.leaderboardConsent) {
      const namesToRemove = [previousName, state.leaderboardName].map(name => name.toLowerCase());
      const entries = getLeaderboardEntries().filter(entry => !namesToRemove.includes(entry.name.toLowerCase()));
      writeStoredValue(storageKeys.leaderboard, JSON.stringify(entries));
    } else if (state.leaderboardConsent) {
      saveLeaderboardScore();
    }
    renderLeaderboard();
  }

  function openSettings() {
    elements.leaderboardOptIn.checked = state.leaderboardConsent === true;
    elements.leaderboardName.value = state.leaderboardName;
    elements.darkModeToggle.checked = state.theme === "dark";
    elements.settingsDialog.showModal();
  }

  function pad(value, length = width) {
    return String(value).padStart(length, "0");
  }

  function toBits(value) {
    const normalized = ((value % (1 << width)) + (1 << width)) % (1 << width);
    return pad(normalized.toString(2), width).split("").map(Number);
  }

  function toSignedBits(value) {
    return toBits(value < 0 ? value : value);
  }

  function toDecimal(bits) {
    return bits.reduce((sum, bit, index) => sum + bit * placeValues[index], 0);
  }

  function twoComplement(value) {
    return ((1 << width) - (value % (1 << width))) % (1 << width);
  }

  function toTwoComplement(bits) {
    const inverted = bits.map(bit => bit ^ 1);
    const value = (1 << width) - toDecimal(inverted);
    return value === (1 << width) ? 0 : value;
  }

  function binaryToDecimal(value) {
    return Number.parseInt(value, 2);
  }

  function getResult() {
    if (state.operation === "add") {
      return (state.a + state.b) & maxValue;
    }

    return (state.a - state.b + (1 << width)) & maxValue;
  }

  function getCarryBits() {
    if (state.operation === "add") {
      const carries = [];
      let carry = 0;
      for (let position = 0; position < width; position += 1) {
        const sum = ((state.a >> position) & 1) + ((state.b >> position) & 1) + carry;
        carry = Math.floor(sum / 2);
        carries.push(carry);
      }
      return carries;
    }

    let borrow = 0;
    return Array.from({ length: width }, (_, position) => {
      const a = (state.a >> position) & 1;
      const b = (state.b >> position) & 1;
      const resultBorrow = a < b + borrow ? 1 : 0;
      borrow = resultBorrow;
      return borrow;
    });
  }

  function getOverflowBit() {
    return state.operation === "add"
      ? (state.a + state.b) >> width
      : Number(state.a < state.b);
  }

  function makeBit(value, weight, className = "bit", label = "", editable = false) {
    const bit = editable
      ? document.createElement("input")
      : document.createElement("div");

    bit.className = editable ? "editable-bit bit" : className;
    bit.dataset.weight = `2^${weight}`;
    bit.dataset.bit = String(value);

    if (editable) {
      bit.type = "text";
      bit.inputMode = "numeric";
      bit.maxLength = 1;
      bit.value = String(value);
      bit.setAttribute("aria-label", `${label || "bit"} at weight ${weight}: ${value}`);
    } else {
      bit.textContent = value;
      bit.setAttribute("aria-label", `${label || "bit"} ${value}, weight ${weight}`);
    }

    return bit;
  }

  function renderBits(container, bits, { className = "bit", editable = false, rowName = "", overflow = false } = {}) {
    container.replaceChildren();
    if (overflow) {
      const element = makeBit(0, "overflow", className, `${rowName} overflow bit`, editable);
      if (editable) {
        element.classList.add("overflow-bit");
        element.dataset.row = rowName;
        element.dataset.position = "overflow";
      }
      container.appendChild(element);
    }
    bits.forEach((bit, index) => {
      const weight = width - index - 1;
      const element = makeBit(bit, weight, className, `${rowName} bit`, editable);
      if (editable) {
        element.dataset.row = rowName;
        element.dataset.position = String(index);
      }
      container.appendChild(element);
    });
  }

  function renderWeighting() {
    elements.weightingValues.replaceChildren();
    placeValues.forEach((value, index) => {
      const weight = document.createElement("div");
      weight.className = "weight-value";
      const exponent = width - index - 1;
      weight.innerHTML = `<span>2<sup>${exponent}</sup></span><small>${value}</small>`;
      elements.weightingValues.appendChild(weight);
    });
  }

  function renderOperationRows() {
    const aBits = toBits(state.a);
    const bBits = toBits(state.b);
    const resultBits = toBits(state.result);
    const carryBits = getCarryBits();

    renderBits(elements.aRow, aBits, { className: "bit", editable: true, rowName: "A" });
    renderBits(elements.bRow, bBits, { className: "bit", editable: true, rowName: "B" });
    renderBits(elements.complementRow, toBits(twoComplement(state.b)), { className: "bit", editable: true, rowName: "two's complement" });
    renderBits(elements.carryRow, carryBits, { className: "bit", editable: true, rowName: "carry", overflow: true });
    renderBits(elements.resultRow, resultBits, { className: "bit", editable: true, rowName: "result", overflow: true });

    elements.complementRowContainer.hidden = state.operation === "add";
    document.querySelectorAll(".editable-bit").forEach(input => {
      input.value = "";
      input.dataset.bit = "";
      const isOverflow = input.dataset.position === "overflow";
      const weight = width - Number(input.dataset.position) - 1;
      input.setAttribute("aria-label", isOverflow ? `${input.dataset.row} overflow bit` : `${input.dataset.row} bit at weight ${weight}`);
    });

    elements.aDecimal.textContent = state.a;
    elements.bDecimal.textContent = state.b;
    elements.operatorDisplay.textContent = state.operation === "add" ? "+" : "−";
  }

  function updateBitInput(input) {
    const value = input.value.trim();
    const valid = /^[01]$/.test(value);
    input.classList.toggle("invalid", !valid);
    input.dataset.bit = valid ? value : "";
    return valid;
  }

  function updateOperandCell(input, row) {
    if (!updateBitInput(input)) return;

    const position = Number(input.dataset.position);
    const bit = Number(input.dataset.bit);
    const currentBits = row === "A" ? state.aBits : state.bBits;
    currentBits[position] = bit;

    if (row === "A") state.a = toDecimal(currentBits);
    else state.b = toDecimal(currentBits);

    state.result = getResult();
    state.carries = getCarryBits();
    elements.aDecimal.textContent = state.a;
    elements.bDecimal.textContent = state.b;
  }

  function updateWorkCell(input) {
    if (!updateBitInput(input)) return;
    const isOverflow = input.dataset.position === "overflow";
    const expected = isOverflow
      ? getOverflowBit()
      : input.dataset.row === "carry"
        ? state.carries[Number(input.dataset.position)]
        : state.result.toString(2).padStart(width, "0")[Number(input.dataset.position)];
    input.classList.toggle("incorrect", input.dataset.bit !== String(expected));
  }

  function handleEditableBitInput(event) {
    const input = event.target.closest(".editable-bit");
    if (!input) return;

    const row = input.dataset.row.toLowerCase();
    if (row === "a" || row === "b") updateOperandCell(input, row === "a" ? "A" : "B");
    else if (row === "two's complement") {
      updateBitInput(input);
      input.classList.remove("incorrect");
    } else {
      updateWorkCell(input);
    }
  }

  function bindEditableBits() {
    elements.aRow.addEventListener("input", handleEditableBitInput);
    elements.bRow.addEventListener("input", handleEditableBitInput);
    elements.complementRow.addEventListener("input", handleEditableBitInput);
    elements.carryRow.addEventListener("input", handleEditableBitInput);
    elements.resultRow.addEventListener("input", handleEditableBitInput);
    elements.aRow.addEventListener("focusout", event => {
      if (event.target.matches(".editable-bit")) updateBitInput(event.target);
    });
    elements.bRow.addEventListener("focusout", event => {
      if (event.target.matches(".editable-bit")) updateBitInput(event.target);
    });
    elements.complementRow.addEventListener("focusout", event => {
      if (event.target.matches(".editable-bit")) updateBitInput(event.target);
    });
    elements.carryRow.addEventListener("focusout", event => {
      if (event.target.matches(".editable-bit")) updateBitInput(event.target);
    });
    elements.resultRow.addEventListener("focusout", event => {
      if (event.target.matches(".editable-bit")) updateBitInput(event.target);
    });
  }

  function createProblem() {
    state.problemNumber += 1;
    state.answered = false;
    state.incorrectAttempts = 0;
    state.instructionsUsed = false;
    elements.instructions.open = false;
    state.a = getRandomInteger(0, 127);
    state.b = getRandomInteger(0, 127);

    if (state.operation === "subtract" && state.a === state.b) {
      state.b = (state.b + 1) % 128;
    }

    state.aBits = toBits(state.a);
    state.bBits = toBits(state.b);
    state.result = getResult();
    state.carries = getCarryBits();

    elements.problemNumber.textContent = pad(state.problemNumber, 2);
    elements.answerInput.value = "";
    elements.answerInput.disabled = false;
    elements.answerSubmitButton.disabled = false;
    elements.answerInput.classList.remove("invalid");
    elements.answerFeedback.textContent = "";
    elements.answerFeedback.className = "answer-feedback";
    elements.answerPrompt.textContent = "What is the binary result?";
    elements.answerHint.textContent = "Enter the full 8-bit result, including leading zeros.";
    renderOperationRows();
  }

  function getRandomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function getExpectedAnswer() {
    return state.result.toString(2).padStart(width, "0");
  }

  function checkAnswer(event) {
    event.preventDefault();
    if (state.answered) return;

    const entered = elements.answerInput.value.trim().replace(/[^01]/g, "");
    const expected = getExpectedAnswer();

    if (entered.length === 0) {
      elements.answerInput.classList.add("invalid");
      elements.answerFeedback.textContent = "Enter a binary answer using only 0 and 1.";
      elements.answerFeedback.className = "answer-feedback incorrect";
      return;
    }

    const normalized = entered.padStart(width, "0").slice(-width);
    const overflowInput = elements.resultRow.querySelector(".overflow-bit");
    const enteredOverflow = overflowInput.dataset.bit === "1" ? 1 : 0;
    const enteredValue = binaryToDecimal(normalized) + enteredOverflow * 512;
    const expectedValue = state.result + getOverflowBit() * 512;
    const isCorrect = enteredValue === expectedValue;

    if (isCorrect) {
      state.answered = true;
      elements.answerInput.disabled = true;
      elements.answerSubmitButton.disabled = true;
      updatePoints(10);
      elements.answerFeedback.textContent = `Correct — ${expected} = ${expectedValue}.`;
      elements.answerFeedback.className = "answer-feedback correct";
      elements.answerInput.classList.remove("invalid");
    } else {
      state.incorrectAttempts += 1;
      updatePoints(-2);
      elements.answerInput.classList.add("invalid");
      if (state.incorrectAttempts >= 3) {
        state.answered = true;
        elements.answerInput.disabled = true;
        elements.answerSubmitButton.disabled = true;
        const overflowText = getOverflowBit() ? " with overflow 1" : "";
        elements.answerHint.textContent = `Correct answer: ${expected}${overflowText} (${expectedValue}).`;
        elements.answerFeedback.textContent = `The correct answer is ${expected}${overflowText} (${expectedValue}).`;
      } else {
        const triesRemaining = 3 - state.incorrectAttempts;
        elements.answerFeedback.textContent = `Not quite. ${triesRemaining} ${triesRemaining === 1 ? "try" : "tries"} left.`;
      }
      elements.answerFeedback.className = "answer-feedback incorrect";
    }
  }

  function updateOperation(operation) {
    if (operation === state.operation) return;
    state.operation = operation;
    state.answered = false;
    state.incorrectAttempts = 0;
    state.instructionsUsed = false;
    elements.instructions.open = false;
    elements.instructions.hidden = operation !== "add";
    document.querySelectorAll(".operation-button").forEach(button => {
      const active = button.dataset.operation === operation;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    state.result = getResult();
    state.carries = getCarryBits();
    renderOperationRows();
    elements.answerInput.value = "";
    elements.answerInput.disabled = false;
    elements.answerSubmitButton.disabled = false;
    elements.answerHint.textContent = "Enter the full 8-bit result, including leading zeros.";
    elements.answerFeedback.textContent = "";
    elements.answerFeedback.className = "answer-feedback";
  }

  document.querySelectorAll(".operation-button").forEach(button => {
    button.addEventListener("click", () => updateOperation(button.dataset.operation));
  });

  elements.answerForm.addEventListener("submit", checkAnswer);
  elements.newProblemButton.addEventListener("click", createProblem);

  elements.instructions.addEventListener("toggle", () => {
    if (!elements.instructions.open || state.operation !== "add" || state.instructionsUsed || state.answered) return;
    state.instructionsUsed = true;
    updatePoints(-3);
  });

  elements.openSettingsButton.addEventListener("click", openSettings);
  elements.closeSettingsButton.addEventListener("click", () => elements.settingsDialog.close());
  elements.cancelSettingsButton.addEventListener("click", () => {
    if (state.leaderboardConsent === null) {
      state.leaderboardConsent = false;
      writeStoredValue(storageKeys.preferences, JSON.stringify({
        leaderboardConsent: false,
        leaderboardName: state.leaderboardName,
        theme: state.theme
      }));
      renderLeaderboard();
    }
    elements.settingsDialog.close();
  });
  elements.settingsForm.addEventListener("submit", event => {
    event.preventDefault();
    savePreferences();
    elements.settingsDialog.close();
  });

  elements.answerInput.addEventListener("input", () => {
    elements.answerInput.value = elements.answerInput.value.replace(/[^01]/g, "").toLowerCase();
    elements.answerInput.classList.remove("invalid");
    if (elements.answerFeedback.classList.contains("incorrect")) {
      elements.answerFeedback.textContent = "";
      elements.answerFeedback.className = "answer-feedback";
    }
  });

  renderWeighting();
  elements.leaderboardOptIn.checked = state.leaderboardConsent === true;
  elements.leaderboardName.value = state.leaderboardName;
  elements.instructions.hidden = state.operation !== "add";
  applyTheme();
  state.a = 13;
  state.b = 7;
  state.aBits = toBits(state.a);
  state.bBits = toBits(state.b);
  state.result = getResult();
  state.carries = getCarryBits();
  renderOperationRows();
  bindEditableBits();
  document.querySelectorAll(".editable-bit").forEach(input => {
    input.value = "";
    input.dataset.bit = "";
  });
  renderPoints();
  renderLeaderboard();

  if (state.leaderboardConsent === null) openSettings();
})();
