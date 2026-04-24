const STORAGE_KEY = "northshift-state-v1";

const defaultState = {
  employees: [],
  entries: [],
  procedures: [
    { id: crypto.randomUUID(), text: "Daily safety walk", done: false },
    { id: crypto.randomUUID(), text: "Cash drawer count", done: false },
    { id: crypto.randomUUID(), text: "Equipment shutdown check", done: false }
  ]
};

const state = loadState();

const refs = {
  todayDate: document.getElementById("todayDate"),
  liveClockIns: document.getElementById("liveClockIns"),
  employeeForm: document.getElementById("employeeForm"),
  employeeName: document.getElementById("employeeName"),
  employeeRole: document.getElementById("employeeRole"),
  employeeList: document.getElementById("employeeList"),
  clockEmployee: document.getElementById("clockEmployee"),
  clockInBtn: document.getElementById("clockInBtn"),
  clockOutBtn: document.getElementById("clockOutBtn"),
  entryTableBody: document.getElementById("entryTableBody"),
  summaryCards: document.getElementById("summaryCards"),
  procedureForm: document.getElementById("procedureForm"),
  procedureInput: document.getElementById("procedureInput"),
  procedureList: document.getElementById("procedureList"),
  procedureTemplate: document.getElementById("procedureTemplate"),
  exportCsvBtn: document.getElementById("exportCsvBtn")
};

bindEvents();
renderAll();

function bindEvents() {
  refs.employeeForm.addEventListener("submit", addEmployee);
  refs.clockInBtn.addEventListener("click", clockIn);
  refs.clockOutBtn.addEventListener("click", clockOut);
  refs.procedureForm.addEventListener("submit", addProcedure);
  refs.exportCsvBtn.addEventListener("click", exportCsv);
}

function addEmployee(event) {
  event.preventDefault();
  const name = refs.employeeName.value.trim();
  const role = refs.employeeRole.value.trim();
  if (!name || !role) {
    return;
  }

  state.employees.push({
    id: crypto.randomUUID(),
    name,
    role
  });

  refs.employeeForm.reset();
  persistAndRender();
}

function clockIn() {
  const employeeId = refs.clockEmployee.value;
  if (!employeeId) {
    return;
  }

  const openEntry = state.entries.find(
    (entry) => entry.employeeId === employeeId && !entry.clockOut
  );
  if (openEntry) {
    window.alert("This employee is already clocked in.");
    return;
  }

  state.entries.push({
    id: crypto.randomUUID(),
    employeeId,
    clockIn: new Date().toISOString(),
    clockOut: null
  });

  persistAndRender();
}

function clockOut() {
  const employeeId = refs.clockEmployee.value;
  if (!employeeId) {
    return;
  }

  const openEntry = [...state.entries]
    .reverse()
    .find((entry) => entry.employeeId === employeeId && !entry.clockOut);

  if (!openEntry) {
    window.alert("No open shift found for this employee.");
    return;
  }

  openEntry.clockOut = new Date().toISOString();
  persistAndRender();
}

function addProcedure(event) {
  event.preventDefault();
  const text = refs.procedureInput.value.trim();
  if (!text) {
    return;
  }

  state.procedures.push({ id: crypto.randomUUID(), text, done: false });
  refs.procedureForm.reset();
  persistAndRender();
}

function toggleProcedure(procedureId) {
  const procedure = state.procedures.find((item) => item.id === procedureId);
  if (!procedure) {
    return;
  }

  procedure.done = !procedure.done;
  persistAndRender();
}

function removeProcedure(procedureId) {
  state.procedures = state.procedures.filter((item) => item.id !== procedureId);
  persistAndRender();
}

function renderAll() {
  refs.todayDate.textContent = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date());

  renderEmployees();
  renderClockEmployeeOptions();
  renderEntries();
  renderProcedures();
  renderSummary();
  updateLiveClockIns();
}

function renderEmployees() {
  refs.employeeList.textContent = "";
  for (const employee of state.employees) {
    const li = document.createElement("li");
    li.textContent = `${employee.name} - ${employee.role}`;
    refs.employeeList.append(li);
  }

  if (state.employees.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No employees yet.";
    refs.employeeList.append(li);
  }
}

function renderClockEmployeeOptions() {
  const current = refs.clockEmployee.value;
  refs.clockEmployee.textContent = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = state.employees.length
    ? "Select employee"
    : "Add an employee first";
  refs.clockEmployee.append(emptyOption);

  for (const employee of state.employees) {
    const option = document.createElement("option");
    option.value = employee.id;
    option.textContent = employee.name;
    refs.clockEmployee.append(option);
  }

  refs.clockEmployee.value = current;
}

function renderEntries() {
  refs.entryTableBody.textContent = "";

  if (state.entries.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="5">No time entries yet.</td>';
    refs.entryTableBody.append(row);
    return;
  }

  const sortedEntries = [...state.entries].sort(
    (a, b) => new Date(b.clockIn) - new Date(a.clockIn)
  );

  for (const entry of sortedEntries) {
    const employee = state.employees.find((item) => item.id === entry.employeeId);
    if (!employee) {
      continue;
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${employee.name}</td>
      <td>${employee.role}</td>
      <td>${formatDateTime(entry.clockIn)}</td>
      <td>${entry.clockOut ? formatDateTime(entry.clockOut) : "Open"}</td>
      <td>${calculateHours(entry.clockIn, entry.clockOut)}</td>
    `;
    refs.entryTableBody.append(row);
  }
}

function renderProcedures() {
  refs.procedureList.textContent = "";

  for (const procedure of state.procedures) {
    const node = refs.procedureTemplate.content.firstElementChild.cloneNode(true);
    const checkbox = node.querySelector("input[type='checkbox']");
    const text = node.querySelector(".procedure-text");
    const removeBtn = node.querySelector("button");

    checkbox.checked = procedure.done;
    text.textContent = procedure.text;
    node.classList.toggle("done", procedure.done);

    checkbox.addEventListener("change", () => toggleProcedure(procedure.id));
    removeBtn.addEventListener("click", () => removeProcedure(procedure.id));

    refs.procedureList.append(node);
  }

  if (state.procedures.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No procedures added.";
    refs.procedureList.append(li);
  }
}

function renderSummary() {
  refs.summaryCards.textContent = "";

  if (state.employees.length === 0) {
    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = "<p>Add employees to view summary.</p>";
    refs.summaryCards.append(card);
    return;
  }

  for (const employee of state.employees) {
    const hours = state.entries
      .filter((entry) => entry.employeeId === employee.id)
      .reduce((total, entry) => {
        if (!entry.clockOut) {
          return total;
        }
        return total + calcDurationHours(entry.clockIn, entry.clockOut);
      }, 0);

    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `
      <p>${employee.name}</p>
      <strong>${hours.toFixed(2)} h</strong>
    `;
    refs.summaryCards.append(card);
  }
}

function updateLiveClockIns() {
  const count = state.entries.filter((entry) => !entry.clockOut).length;
  refs.liveClockIns.textContent = String(count);
}

function calculateHours(clockIn, clockOut) {
  if (!clockOut) {
    return "-";
  }
  return `${calcDurationHours(clockIn, clockOut).toFixed(2)} h`;
}

function calcDurationHours(clockIn, clockOut) {
  const ms = new Date(clockOut) - new Date(clockIn);
  return Math.max(ms / 3600000, 0);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function exportCsv() {
  const rows = [["Employee", "Role", "Clock In", "Clock Out", "Total Hours"]];

  for (const entry of state.entries) {
    const employee = state.employees.find((item) => item.id === entry.employeeId);
    if (!employee) {
      continue;
    }

    rows.push([
      employee.name,
      employee.role,
      formatDateTime(entry.clockIn),
      entry.clockOut ? formatDateTime(entry.clockOut) : "Open",
      entry.clockOut ? calcDurationHours(entry.clockIn, entry.clockOut).toFixed(2) : ""
    ]);
  }

  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "timesheet-export.csv";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  const safe = String(value ?? "").replaceAll('"', '""');
  return `"${safe}"`;
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return structuredClone(defaultState);
  }

  try {
    const parsed = JSON.parse(stored);
    return {
      employees: Array.isArray(parsed.employees) ? parsed.employees : [],
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      procedures: Array.isArray(parsed.procedures)
        ? parsed.procedures
        : structuredClone(defaultState.procedures)
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function persistAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
}
