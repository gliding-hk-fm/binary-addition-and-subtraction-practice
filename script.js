(() => {
  "use strict";

  const width = 8;
  const maxValue = (1 << width) - 1;
  const placeValues = Array.from({ length: width }, (_, index) => Math.pow(2, width - index - 1));

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
    answerFeedback: document.getElementById("answerFeedback"),
    answerPrompt: document.getElementById("answerPrompt"),
    answerHint: document.getElementById("answerHint"),
    problemNumber: document.getElementById("problemNumber"),
    bitWidthLabel: document.getElementById("bitWidthLabel"),
    sessionScore: document.getElementById("sessionScore"),
    newProblemButton: document.getElementById("newProblemButton")
  };

  const state = {
    operation: "add",
    a: 0,
    b: 0,
    result: 0,
    carries: [],
    problemNumber: 0,
    correct: 0,
    attempted: 0,
    answered: false
  };

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

  function renderBits(container, bits, { className = "bit", editable = false, rowName = "" } = {}) {
    container.replaceChildren();
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
    renderBits(elements.carryRow, carryBits, { className: "bit", editable: true, rowName: "carry" });
    renderBits(elements.resultRow, resultBits, { className: "bit", editable: true, rowName: "result" });

    elements.complementRowContainer.hidden = state.operation === "add";
    document.querySelectorAll(".editable-bit").forEach(input => {
      input.value = "";
      input.dataset.bit = "";
      const weight = width - Number(input.dataset.position) - 1;
      input.setAttribute("aria-label", `${input.dataset.row} bit at weight ${weight}`);
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
    const expected = input.dataset.row === "carry"
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
    state.attempted += 1;

    if (entered.length === 0) {
      elements.answerInput.classList.add("invalid");
      elements.answerFeedback.textContent = "Enter a binary answer using only 0 and 1.";
      elements.answerFeedback.className = "answer-feedback incorrect";
      return;
    }

    const normalized = entered.padStart(width, "0").slice(-width);
    const isCorrect = normalized === expected;

    if (isCorrect) {
      state.correct += 1;
      state.answered = true;
      elements.answerFeedback.textContent = `Correct — ${expected} = ${state.result}.`;
      elements.answerFeedback.className = "answer-feedback correct";
      elements.answerInput.classList.remove("invalid");
    } else {
      elements.answerInput.classList.add("invalid");
      elements.answerFeedback.textContent = "Not quite. Check your work and try again.";
      elements.answerFeedback.className = "answer-feedback incorrect";
    }

    updateSessionScore();
  }

  function updateSessionScore() {
    elements.sessionScore.textContent = `${state.correct} / ${state.attempted}`;
  }

  function updateOperation(operation) {
    if (operation === state.operation) return;
    state.operation = operation;
    document.querySelectorAll(".operation-button").forEach(button => {
      const active = button.dataset.operation === operation;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    state.result = getResult();
    state.carries = getCarryBits();
    renderOperationRows();
    elements.answerInput.value = "";
    elements.answerFeedback.textContent = "";
    elements.answerFeedback.className = "answer-feedback";
  }

  document.querySelectorAll(".operation-button").forEach(button => {
    button.addEventListener("click", () => updateOperation(button.dataset.operation));
  });

  elements.answerForm.addEventListener("submit", checkAnswer);
  elements.newProblemButton.addEventListener("click", createProblem);

  elements.answerInput.addEventListener("input", () => {
    elements.answerInput.value = elements.answerInput.value.replace(/[^01]/g, "").toLowerCase();
    elements.answerInput.classList.remove("invalid");
    if (elements.answerFeedback.classList.contains("incorrect")) {
      elements.answerFeedback.textContent = "";
      elements.answerFeedback.className = "answer-feedback";
    }
  });

  renderWeighting();
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
  updateSessionScore();
})();
