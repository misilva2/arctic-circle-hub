const STORAGE_KEY = "arctic-hub-state-v4";
const LEGACY_STORAGE_KEYS = ["arctic-hub-state-v3", "arctic-hub-state-v2", "northshift-state-v1"];
const TASK_SCHEMA_VERSION = 3;

// ── Firebase Cloud Sync ───────────────────────────────────────────────────────
// To enable real-time sync across all devices:
//   1. Go to https://console.firebase.google.com and create a project.
//   2. Click "Add app" > Web, register the app, and copy the firebaseConfig values.
//   3. Paste the values into FIREBASE_CONFIG below.
//   4. In Firebase console: Build > Firestore Database > Create database.
//      Choose "Start in test mode" so the team can read/write without login.
//   5. Reload the app on any device — changes sync in real time automatically.
//
// Leave apiKey as "" to stay in local-storage-only mode.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCp4q7XFt2MIq10OHkAaUZEVESUAFwXnKM",
  authDomain: "arctichub-8c80e.firebaseapp.com",
  projectId: "arctichub-8c80e",
  storageBucket: "arctichub-8c80e.firebasestorage.app",
  messagingSenderId: "674375887667",
  appId: "1:674375887667:web:24819bfed7757adba5ec46",
  measurementId: "G-SDTGZE68GV"
};

const FIRESTORE_PATH = { collection: "arctic-hub", doc: "state" };
let db = null;
let cloudWriteInFlight = false;
// ─────────────────────────────────────────────────────────────────────────────

const ROSTER = [
  { name: "Michaela Silva", role: "Manager" },
  { name: "Krysta Rodriguez", role: "Chef" },
  { name: "Max Hawthrone", role: "Service" },
  { name: "Landyn Silva", role: "Service" },
  { name: "Olivia Garcia", role: "Service" }
];

const ADMIN_NAME = "Michaela Silva";
const ADMIN_PASSCODE = "arctic-admin";
const EDITABLE_ROLES = ["Chef", "Prep", "Service", "Off"];

const STANDARD_RATE = 15;
const INVENTORY_REMINDER = "Reminder: Notify the manager when inventory is low.";
const CHEF_TASKS = [
  "Close: Clean grill",
  "Close: Take inventory",
  "Help prep with closing tasks"
];
const PREP_TASKS = [
  "Morning: Prep ingredients and stations",
  "Close: Label and store remaining prep",
  "Support service restock and handoff"
];
const SERVICE_TASKS = [
  "Morning and Close: Wipe down all surfaces",
  "Morning and Close: Sweep and mop front",
  "Morning and Close: Restock"
];
const ROLE_TASKS = {
  Manager: [INVENTORY_REMINDER],
  Chef: [...CHEF_TASKS, INVENTORY_REMINDER],
  Prep: [...PREP_TASKS, INVENTORY_REMINDER],
  Service: [...SERVICE_TASKS, INVENTORY_REMINDER],
  Off: []
};

const ON_TIME_XP = 50;
const TASK_XP_DEFAULT = 20;
const DEFAULT_TASK_XP_BY_TEXT = {
  "Close: Clean grill": 35,
  "Close: Take inventory": 45,
  "Help prep with closing tasks": 25,
  "Morning: Prep ingredients and stations": 30,
  "Close: Label and store remaining prep": 25,
  "Support service restock and handoff": 20,
  "Morning and Close: Wipe down all surfaces": 20,
  "Morning and Close: Sweep and mop front": 30,
  "Morning and Close: Restock": 30,
  "Reminder: Notify the manager when inventory is low.": 10
};

const defaultState = createDefaultState();

const session = {
  isAdminSignedIn: false,
  signedInEmployeeId: null
};

const state = loadState();

const refs = {
  todayDate: document.getElementById("todayDate"),
  liveClockIns: document.getElementById("liveClockIns"),
  employeeList: document.getElementById("employeeList"),
  clockEmployee: document.getElementById("clockEmployee"),
  clockPin: document.getElementById("clockPin"),
  clockInBtn: document.getElementById("clockInBtn"),
  clockOutBtn: document.getElementById("clockOutBtn"),
  entryTableBody: document.getElementById("entryTableBody"),
  summaryCards: document.getElementById("summaryCards"),
  procedureList: document.getElementById("procedureList"),
  procedureTemplate: document.getElementById("procedureTemplate"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  addTimeForm: document.getElementById("addTimeForm"),
  addTimeEmployee: document.getElementById("addTimeEmployee"),
  addTimeIn: document.getElementById("addTimeIn"),
  addTimeOut: document.getElementById("addTimeOut"),
  adminTimeForm: document.getElementById("adminTimeForm"),
  adminPasscode: document.getElementById("adminPasscode"),
  adminSignInBtn: document.getElementById("adminSignInBtn"),
  adminSignOutBtn: document.getElementById("adminSignOutBtn"),
  adminStatus: document.getElementById("adminStatus"),
  unavailForm: document.getElementById("unavailForm"),
  unavailEmployee: document.getElementById("unavailEmployee"),
  unavailPin: document.getElementById("unavailPin"),
  unavailCalendar: document.getElementById("unavailCalendar"),
  unavailMonthLabel: document.getElementById("unavailMonthLabel"),
  unavailNotes: document.getElementById("unavailNotes"),
  unavailSubmitBtn: document.getElementById("unavailSubmitBtn"),
  unavailStatus: document.getElementById("unavailStatus"),
  leaderboardList: document.getElementById("leaderboardList"),
  adminScheduleForm: document.getElementById("adminScheduleForm"),
  scheduleForm: document.getElementById("scheduleForm"),
  scheduleEmployee: document.getElementById("scheduleEmployee"),
  scheduleDate: document.getElementById("scheduleDate"),
  scheduleStart: document.getElementById("scheduleStart"),
  scheduleEnd: document.getElementById("scheduleEnd"),
  scheduleNotes: document.getElementById("scheduleNotes"),
  scheduleList: document.getElementById("scheduleList"),
  adminXpConfig: document.getElementById("adminXpConfig"),
  xpConfigForm: document.getElementById("xpConfigForm"),
  xpConfigList: document.getElementById("xpConfigList"),
  weeklyWinnersList: document.getElementById("weeklyWinnersList"),
  celebrationModal: document.getElementById("celebrationModal"),
  celebrationMessage: document.getElementById("celebrationMessage"),
  closeCelebrationBtn: document.getElementById("closeCelebrationBtn")
};

const syncStatusEl = document.getElementById("syncStatus");

bindEvents();
renderAll();
initFirebase();

function bindEvents() {
  refs.clockInBtn.addEventListener("click", clockIn);
  refs.clockOutBtn.addEventListener("click", clockOut);
  refs.exportCsvBtn.addEventListener("click", exportCsv);
  refs.addTimeForm.addEventListener("submit", addManualEntry);
  refs.scheduleForm.addEventListener("submit", addScheduleEntry);
  refs.xpConfigForm.addEventListener("submit", saveXpConfig);
  refs.closeCelebrationBtn.addEventListener("click", closeCelebration);
  refs.adminSignInBtn.addEventListener("click", signInAdmin);
  refs.unavailForm.addEventListener("submit", submitUnavailability);
  refs.adminSignOutBtn.addEventListener("click", signOutAdmin);
}

function signInAdmin() {
  const passcode = refs.adminPasscode.value.trim();
  if (passcode !== ADMIN_PASSCODE) {
    window.alert("Incorrect admin passcode.");
    return;
  }

  session.isAdminSignedIn = true;
  refs.adminPasscode.value = "";
  renderAll();
}

function signOutAdmin() {
  session.isAdminSignedIn = false;
  refs.adminPasscode.value = "";
  renderAll();
}

function clockIn() {
  const employeeId = refs.clockEmployee.value;
  const pin = refs.clockPin.value.trim();

  if (!employeeId || !pin) {
    window.alert("Select employee and enter PIN.");
    return;
  }

  const employee = state.employees.find((e) => e.id === employeeId);
  if (!employee || pin !== employee.pin) {
    window.alert("Incorrect PIN.");
    refs.clockPin.value = "";
    return;
  }

  const openEntry = state.entries.find(
    (entry) => entry.employeeId === employeeId && !entry.clockOut
  );
  if (openEntry) {
    window.alert("This employee is already clocked in.");
    refs.clockPin.value = "";
    return;
  }

  const now = new Date();
  state.entries.push({
    id: crypto.randomUUID(),
    employeeId,
    clockIn: now.toISOString(),
    clockOut: null
  });

  if (now.getHours() === 10) {
    awardXp(employeeId, ON_TIME_XP, "On-time clock-in at 10:00", now.toISOString());
  }

  refs.clockPin.value = "";
  persistAndRender();
}

function clockOut() {
  const employeeId = refs.clockEmployee.value;
  const pin = refs.clockPin.value.trim();

  if (!employeeId || !pin) {
    window.alert("Select employee and enter PIN.");
    return;
  }

  const employee = state.employees.find((e) => e.id === employeeId);
  if (!employee || pin !== employee.pin) {
    window.alert("Incorrect PIN.");
    refs.clockPin.value = "";
    return;
  }

  const openEntry = [...state.entries]
    .reverse()
    .find((entry) => entry.employeeId === employeeId && !entry.clockOut);

  if (!openEntry) {
    window.alert("No open shift found for this employee.");
    refs.clockPin.value = "";
    return;
  }

  const now = new Date();
  openEntry.clockOut = now.toISOString();

  maybeAnnounceWeeklyWinner(employeeId, now);
  refs.clockPin.value = "";
  persistAndRender();
}

function toggleProcedure(procedureId) {
  const procedure = state.procedures.find((item) => item.id === procedureId);
  if (!procedure) {
    return;
  }

  if (!canUpdateProcedure()) {
    window.alert("You can only update your own tasks unless signed in as admin.");
    return;
  }

  const nextDone = !procedure.done;
  procedure.done = nextDone;

  if (nextDone) {
    procedure.completedAt = new Date().toISOString();
    if (!procedure.xpAwarded) {
      const xp = getTaskXp(procedure.text);
      awardXp(procedure.employeeId, xp, `Task completed: ${procedure.text}`);
      procedure.xpAwarded = true;
    }
  }

  persistAndRender();
}

function canUpdateProcedure() {
  return session.isAdminSignedIn;
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
  renderAdminTimeForm();
  renderEntries();
  renderProcedures();
  renderSummary();
  renderLeaderboard();
  renderSchedule();
  renderXpConfig();
  updateLiveClockIns();
  renderTaskAccess();
  renderUnavailForm();
}

function renderEmployees() {
  refs.employeeList.textContent = "";
  for (const employee of state.employees) {
    const li = document.createElement("li");
    li.className = "employee-item";

    const details = document.createElement("span");
    details.textContent = `${employee.name} — ${employee.role}`;
    li.append(details);

    if (isAdmin(employee)) {
      const adminBadge = document.createElement("span");
      adminBadge.className = "admin-badge";
      adminBadge.textContent = "Admin";
      li.append(adminBadge);
    } else {
      // Role change
      const roleSelect = document.createElement("select");
      roleSelect.className = "role-select";
      roleSelect.setAttribute("aria-label", `Change role for ${employee.name}`);
      for (const role of EDITABLE_ROLES) {
        const option = document.createElement("option");
        option.value = role;
        option.textContent = role;
        roleSelect.append(option);
      }
      roleSelect.value = employee.role;
      roleSelect.disabled = !session.isAdminSignedIn;

      const roleBtn = document.createElement("button");
      roleBtn.type = "button";
      roleBtn.className = "outline role-btn";
      roleBtn.textContent = "Change Role";
      roleBtn.disabled = !session.isAdminSignedIn;
      roleBtn.addEventListener("click", () => {
        changeEmployeeRole(employee.id, roleSelect.value);
      });

      if (session.isAdminSignedIn) {
        // PIN values are only visible while admin is signed in.
        const pinInput = document.createElement("input");
        pinInput.type = "text";
        pinInput.value = employee.pin;
        pinInput.maxLength = 10;
        pinInput.className = "pin-input";
        pinInput.setAttribute("aria-label", `PIN for ${employee.name}`);

        const pinBtn = document.createElement("button");
        pinBtn.type = "button";
        pinBtn.className = "outline role-btn";
        pinBtn.textContent = "Change PIN";
        pinBtn.addEventListener("click", () => {
          changeEmployeePin(employee.id, pinInput.value);
        });

        li.append(roleSelect, roleBtn, pinInput, pinBtn);
      } else {
        const pinHiddenBadge = document.createElement("span");
        pinHiddenBadge.className = "admin-badge";
        pinHiddenBadge.textContent = "PIN hidden";
        li.append(roleSelect, roleBtn, pinHiddenBadge);
      }
    }

    refs.employeeList.append(li);
  }

  if (state.employees.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No employees available.";
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
    : "No employees available";
  refs.clockEmployee.append(emptyOption);

  for (const employee of state.employees) {
    const option = document.createElement("option");
    option.value = employee.id;
    option.textContent = employee.name;
    refs.clockEmployee.append(option);
  }

  refs.clockEmployee.value = current;
}

function renderAdminTimeForm() {
  if (!refs.adminTimeForm) {
    return;
  }

  refs.adminTimeForm.hidden = !session.isAdminSignedIn;

  if (!session.isAdminSignedIn) {
    return;
  }

  const current = refs.addTimeEmployee.value;
  refs.addTimeEmployee.textContent = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "Select employee";
  refs.addTimeEmployee.append(emptyOption);

  for (const employee of state.employees) {
    const option = document.createElement("option");
    option.value = employee.id;
    option.textContent = employee.name;
    refs.addTimeEmployee.append(option);
  }

  const hasCurrent = state.employees.some((employee) => employee.id === current);
  refs.addTimeEmployee.value = hasCurrent ? current : "";
}

function addManualEntry(event) {
  event.preventDefault();

  if (!session.isAdminSignedIn) {
    return;
  }

  const employeeId = refs.addTimeEmployee.value;
  const clockInValue = refs.addTimeIn.value;
  const clockOutValue = refs.addTimeOut.value;

  if (!employeeId || !clockInValue) {
    window.alert("Employee and Clock In time are required.");
    return;
  }

  state.entries.push({
    id: crypto.randomUUID(),
    employeeId,
    clockIn: new Date(clockInValue).toISOString(),
    clockOut: clockOutValue ? new Date(clockOutValue).toISOString() : null
  });

  refs.addTimeForm.reset();
  persistAndRender();
}

function changeEmployeePin(employeeId, newPin) {
  if (!session.isAdminSignedIn) {
    return;
  }

  const trimmed = String(newPin ?? "").trim();
  if (!trimmed) {
    window.alert("PIN cannot be empty.");
    return;
  }

  const employee = state.employees.find((item) => item.id === employeeId);
  if (!employee) {
    return;
  }

  employee.pin = trimmed;
  persistAndRender();
}

function renderEntries() {
  refs.entryTableBody.textContent = "";

  if (state.entries.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="6">No time entries yet.</td>';
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
    refs.entryTableBody.append(buildEntryRow(entry, employee));
  }
}

function buildEntryRow(entry, employee) {
  const row = document.createElement("tr");
  row.dataset.entryId = entry.id;

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "outline role-btn";
  editBtn.textContent = "Edit";
  editBtn.disabled = !session.isAdminSignedIn;
  editBtn.addEventListener("click", () => startEditEntry(entry.id));

  row.innerHTML = `
    <td>${employee.name}</td>
    <td>${employee.role}</td>
    <td>${formatDateTime(entry.clockIn)}</td>
    <td>${entry.clockOut ? formatDateTime(entry.clockOut) : "Open"}</td>
    <td>${calculateHours(entry.clockIn, entry.clockOut)}</td>
    <td></td>
  `;
  row.querySelector("td:last-child").append(editBtn);
  return row;
}

function startEditEntry(entryId) {
  if (!session.isAdminSignedIn) {
    return;
  }

  const entry = state.entries.find((item) => item.id === entryId);
  const employee = state.employees.find((item) => item.id === entry?.employeeId);
  if (!entry || !employee) {
    return;
  }

  const row = refs.entryTableBody.querySelector(`[data-entry-id="${entryId}"]`);
  if (!row) {
    return;
  }

  const toInputValue = (iso) => {
    if (!iso) {
      return "";
    }
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const inInput = document.createElement("input");
  inInput.type = "datetime-local";
  inInput.value = toInputValue(entry.clockIn);
  inInput.required = true;

  const outInput = document.createElement("input");
  outInput.type = "datetime-local";
  outInput.value = toInputValue(entry.clockOut);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", () => saveEditEntry(entryId, inInput.value, outInput.value));

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "outline";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => renderEntries());

  row.textContent = "";

  const nameTd = document.createElement("td");
  nameTd.textContent = employee.name;

  const roleTd = document.createElement("td");
  roleTd.textContent = employee.role;

  const inTd = document.createElement("td");
  inTd.append(inInput);

  const outTd = document.createElement("td");
  outTd.append(outInput);

  const hoursTd = document.createElement("td");
  hoursTd.textContent = "-";

  const actionTd = document.createElement("td");
  const btnRow = document.createElement("div");
  btnRow.className = "button-row";
  btnRow.append(saveBtn, cancelBtn);
  actionTd.append(btnRow);

  row.append(nameTd, roleTd, inTd, outTd, hoursTd, actionTd);
}

function saveEditEntry(entryId, clockInValue, clockOutValue) {
  if (!clockInValue) {
    window.alert("Clock In time is required.");
    return;
  }

  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry) {
    return;
  }

  entry.clockIn = new Date(clockInValue).toISOString();
  entry.clockOut = clockOutValue ? new Date(clockOutValue).toISOString() : null;
  persistAndRender();
}

function renderProcedures() {
  refs.procedureList.textContent = "";

  const sortedProcedures = [...state.procedures].sort((a, b) => {
    const aEmployee = state.employees.find((item) => item.id === a.employeeId);
    const bEmployee = state.employees.find((item) => item.id === b.employeeId);
    const aName = aEmployee?.name ?? "";
    const bName = bEmployee?.name ?? "";
    return aName.localeCompare(bName) || a.text.localeCompare(b.text);
  });

  for (const procedure of sortedProcedures) {
    const node = refs.procedureTemplate.content.firstElementChild.cloneNode(true);
    const checkbox = node.querySelector("input[type='checkbox']");
    const text = node.querySelector(".procedure-text");
    const removeBtn = node.querySelector("button");
    const assignee = state.employees.find((employee) => employee.id === procedure.employeeId);
    const assigneeText = assignee
      ? `${assignee.name} (${assignee.role}) - ${procedure.text}`
      : `${procedure.role} - ${procedure.text}`;

    checkbox.checked = procedure.done;
    checkbox.disabled = !canUpdateProcedure(procedure);
    removeBtn.style.display = "none";
    text.textContent = assigneeText;
    node.classList.toggle("done", procedure.done);

    checkbox.addEventListener("change", () => toggleProcedure(procedure.id));

    refs.procedureList.append(node);
  }

  if (state.procedures.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No tasks assigned yet.";
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

function renderLeaderboard() {
  refs.leaderboardList.textContent = "";
  refs.weeklyWinnersList.textContent = "";

  const now = new Date();
  const totals = state.employees
    .map((employee) => ({
      employee,
      weeklyXp: getWeeklyXp(employee.id, now),
      totalXp: getTotalXp(employee.id)
    }))
    .sort((a, b) => b.weeklyXp - a.weeklyXp || b.totalXp - a.totalXp || a.employee.name.localeCompare(b.employee.name));

  if (totals.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No leaderboard data yet.";
    refs.leaderboardList.append(li);
    const archiveLi = document.createElement("li");
    archiveLi.textContent = "No archived winners yet.";
    refs.weeklyWinnersList.append(archiveLi);
    return;
  }

  for (const [index, item] of totals.entries()) {
    const li = document.createElement("li");
    li.className = "leaderboard-item";
    li.innerHTML = `
      <span class="leaderboard-rank">#${index + 1}</span>
      <span>
        ${item.employee.name}
        <div class="leaderboard-meta">Weekly: ${item.weeklyXp} XP | Total: ${item.totalXp} XP</div>
      </span>
      <span class="leaderboard-xp">${item.weeklyXp} XP</span>
    `;
    refs.leaderboardList.append(li);
  }

  const winners = [...state.weeklyWinners].sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  if (winners.length === 0) {
    const archiveLi = document.createElement("li");
    archiveLi.textContent = "No archived winners yet.";
    refs.weeklyWinnersList.append(archiveLi);
  } else {
    for (const winner of winners) {
      const li = document.createElement("li");
      li.textContent = `${winner.weekKey}: ${winner.name} (${winner.xp} XP)`;
      refs.weeklyWinnersList.append(li);
    }
  }
}

function renderSchedule() {
  refs.adminScheduleForm.hidden = !session.isAdminSignedIn;
  refs.scheduleList.textContent = "";

  if (session.isAdminSignedIn) {
    renderScheduleEmployeeOptions();
  }

  const sorted = [...state.schedule].sort((a, b) => {
    return `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`);
  });

  if (sorted.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No schedule shifts added yet.";
    refs.scheduleList.append(li);
    return;
  }

  for (const shift of sorted) {
    const employee = state.employees.find((item) => item.id === shift.employeeId);
    const li = document.createElement("li");

    const details = document.createElement("span");
    details.className = "schedule-meta";
    details.textContent = `${shift.date} ${shift.start}-${shift.end} | ${employee?.name ?? "Unknown"}${shift.notes ? ` | ${shift.notes}` : ""}`;
    li.append(details);

    if (session.isAdminSignedIn) {
      const actions = document.createElement("div");
      actions.className = "schedule-actions";
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "outline role-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => removeScheduleEntry(shift.id));
      actions.append(removeBtn);
      li.append(actions);
    }

    refs.scheduleList.append(li);
  }
}

function renderScheduleEmployeeOptions() {
  const current = refs.scheduleEmployee.value;
  refs.scheduleEmployee.textContent = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "Select employee";
  refs.scheduleEmployee.append(emptyOption);

  for (const employee of state.employees) {
    const option = document.createElement("option");
    option.value = employee.id;
    option.textContent = employee.name;
    refs.scheduleEmployee.append(option);
  }

  refs.scheduleEmployee.value = current;
}

function addScheduleEntry(event) {
  event.preventDefault();
  if (!session.isAdminSignedIn) {
    return;
  }

  const employeeId = refs.scheduleEmployee.value;
  const date = refs.scheduleDate.value;
  const start = refs.scheduleStart.value;
  const end = refs.scheduleEnd.value;
  const notes = refs.scheduleNotes.value.trim();

  if (!employeeId || !date || !start || !end) {
    window.alert("Employee, date, start, and end are required.");
    return;
  }

  state.schedule.push({
    id: crypto.randomUUID(),
    employeeId,
    date,
    start,
    end,
    notes
  });

  refs.scheduleForm.reset();
  persistAndRender();
}

function renderXpConfig() {
  refs.adminXpConfig.hidden = !session.isAdminSignedIn;
  if (!session.isAdminSignedIn) {
    return;
  }

  refs.xpConfigList.textContent = "";
  const tasks = Object.keys(state.xpConfig).sort((a, b) => a.localeCompare(b));

  for (const taskText of tasks) {
    const row = document.createElement("label");
    row.className = "xp-config-row";

    const label = document.createElement("span");
    label.textContent = taskText;

    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.step = "1";
    input.value = String(state.xpConfig[taskText]);
    input.dataset.taskText = taskText;

    row.append(label, input);
    refs.xpConfigList.append(row);
  }
}

function saveXpConfig(event) {
  event.preventDefault();
  if (!session.isAdminSignedIn) {
    return;
  }

  const inputs = refs.xpConfigList.querySelectorAll("input[data-task-text]");
  const next = {};

  for (const input of inputs) {
    const taskText = input.dataset.taskText;
    const value = Number(input.value);
    next[taskText] = Number.isFinite(value) && value > 0 ? Math.round(value) : TASK_XP_DEFAULT;
  }

  state.xpConfig = next;
  persistAndRender();
}

function removeScheduleEntry(shiftId) {
  if (!session.isAdminSignedIn) {
    return;
  }
  state.schedule = state.schedule.filter((shift) => shift.id !== shiftId);
  persistAndRender();
}

function awardXp(employeeId, xp, reason, timestamp = new Date().toISOString()) {
  state.xpEvents.push({
    id: crypto.randomUUID(),
    employeeId,
    xp,
    reason,
    timestamp
  });
}

function getTaskXp(taskText) {
  if (Object.hasOwn(state.xpConfig, taskText)) {
    return state.xpConfig[taskText];
  }
  return TASK_XP_DEFAULT;
}

function getTotalXp(employeeId) {
  return state.xpEvents
    .filter((event) => event.employeeId === employeeId)
    .reduce((sum, event) => sum + Number(event.xp || 0), 0);
}

function getWeeklyXp(employeeId, now) {
  const weekStart = getWeekStart(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return state.xpEvents
    .filter((event) => {
      if (event.employeeId !== employeeId) {
        return false;
      }
      const stamp = new Date(event.timestamp);
      return stamp >= weekStart && stamp < weekEnd;
    })
    .reduce((sum, event) => sum + Number(event.xp || 0), 0);
}

function getWeekStart(date) {
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + diff);
  return base;
}

function getWeekKey(date) {
  return getWeekStart(date).toISOString().slice(0, 10);
}

function getWeeklyLeader(now) {
  const weekStart = getWeekStart(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const weeklyTotals = new Map();
  for (const event of state.xpEvents) {
    const stamp = new Date(event.timestamp);
    if (stamp >= weekStart && stamp < weekEnd) {
      weeklyTotals.set(event.employeeId, (weeklyTotals.get(event.employeeId) ?? 0) + Number(event.xp || 0));
    }
  }

  let winner = null;
  for (const employee of state.employees) {
    const xp = weeklyTotals.get(employee.id) ?? 0;
    if (!winner || xp > winner.xp) {
      winner = { id: employee.id, name: employee.name, xp };
    }
  }

  if (!winner || winner.xp <= 0) {
    return null;
  }

  return winner;
}

function maybeAnnounceWeeklyWinner(clockOutEmployeeId, now) {
  if (now.getDay() !== 0) {
    return;
  }

  const weekKey = getWeekKey(now);
  if (state.lastCelebrationWeekKey === weekKey) {
    return;
  }

  const leader = getWeeklyLeader(now);
  if (!leader || leader.id !== clockOutEmployeeId) {
    return;
  }

  state.lastCelebrationWeekKey = weekKey;
  state.weeklyWinners.push({
    weekKey,
    employeeId: leader.id,
    name: leader.name,
    xp: leader.xp,
    announcedAt: now.toISOString()
  });

  showCelebration(`Celebration! ${leader.name} leads this week with ${leader.xp} XP!`);
}

function showCelebration(message) {
  refs.celebrationMessage.textContent = message;
  refs.celebrationModal.hidden = false;
}

function closeCelebration() {
  refs.celebrationModal.hidden = true;
}

function updateLiveClockIns() {
  const count = state.entries.filter((entry) => !entry.clockOut).length;
  refs.liveClockIns.textContent = String(count);
}

function renderTaskAccess() {
  refs.adminStatus.textContent = session.isAdminSignedIn
    ? `Signed in as ${ADMIN_NAME}. You can manage tasks, roles, PINs, and time entries.`
    : `Admin controls are locked. Sign in as ${ADMIN_NAME} to make changes.`;
  refs.adminSignInBtn.disabled = session.isAdminSignedIn;
  refs.adminSignOutBtn.disabled = !session.isAdminSignedIn;
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
  const stored = getStoredState();
  if (!stored) {
    return structuredClone(defaultState);
  }

  try {
    const parsed = JSON.parse(stored);
    const parsedEmployees = Array.isArray(parsed.employees) ? parsed.employees : [];
    const employees = createRosterEmployees(parsedEmployees);
    const useExistingProcedures = parsed.taskSchemaVersion === TASK_SCHEMA_VERSION;
    const parsedProcedures = useExistingProcedures && Array.isArray(parsed.procedures)
      ? parsed.procedures
      : [];
    return {
      employees,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      procedures: createRoleBasedTasks(employees, parsedProcedures),
      schedule: Array.isArray(parsed.schedule) ? parsed.schedule : [],
      xpEvents: Array.isArray(parsed.xpEvents) ? parsed.xpEvents : [],
      lastCelebrationWeekKey: parsed.lastCelebrationWeekKey ?? null,
      weeklyWinners: Array.isArray(parsed.weeklyWinners) ? parsed.weeklyWinners : [],
      xpConfig: normalizeXpConfig(parsed.xpConfig)
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function persistAndRender() {
  const payload = { ...state, taskSchemaVersion: TASK_SCHEMA_VERSION };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

  if (db) {
    pushStateToCloud();
  }

  renderAll();
}

function changeEmployeeRole(employeeId, nextRole) {
  if (!session.isAdminSignedIn) {
    window.alert("Admin sign-in required to change roles.");
    return;
  }

  const employee = state.employees.find((item) => item.id === employeeId);
  if (!employee) {
    return;
  }

  if (isAdmin(employee) || nextRole === "Manager") {
    window.alert("Only the manager can be admin.");
    return;
  }

  if (!EDITABLE_ROLES.includes(nextRole)) {
    return;
  }

  employee.role = nextRole;
  employee.hourlyRate = getHourlyRate();
  reassignEmployeeRoleTasks(employee.id, nextRole);
  persistAndRender();
}

function reassignEmployeeRoleTasks(employeeId, nextRole) {
  const existingGeneratedTasks = state.procedures.filter(
    (task) => task.employeeId === employeeId
  );
  const doneByText = new Map(existingGeneratedTasks.map((task) => [task.text, task.done]));

  state.procedures = state.procedures.filter((task) => task.employeeId !== employeeId);

  const nextTasks = getTasksForRole(nextRole).map((text) => ({
    id: crypto.randomUUID(),
    text,
    done: doneByText.get(text) ?? false,
    employeeId,
    role: nextRole,
    custom: false,
    xpAwarded: false,
    completedAt: null
  }));

  state.procedures.push(...nextTasks);
}

function createDefaultState() {
  const employees = createRosterEmployees();
  return {
    employees,
    entries: [],
    procedures: createRoleBasedTasks(employees),
    schedule: [],
    xpEvents: [],
    lastCelebrationWeekKey: null,
    weeklyWinners: [],
    xpConfig: { ...DEFAULT_TASK_XP_BY_TEXT }
  };
}

function normalizeXpConfig(config) {
  const merged = { ...DEFAULT_TASK_XP_BY_TEXT };
  if (!config || typeof config !== "object") {
    return merged;
  }

  for (const [taskText, xp] of Object.entries(config)) {
    const value = Number(xp);
    if (Number.isFinite(value) && value > 0) {
      merged[taskText] = Math.round(value);
    }
  }

  return merged;
}

function createRosterEmployees(existingEmployees = []) {
  return ROSTER.map((employee, index) => {
    const existing = existingEmployees.find((item) => item.name === employee.name);
    const role = resolveRole(employee, existing?.role);
    return {
      id: existing?.id ?? crypto.randomUUID(),
      name: employee.name,
      role,
      pin: normalizePin(existing?.pin, index),
      hourlyRate: getHourlyRate()
    };
  });
}

function normalizePin(existingPin, index) {
  const nextPin = String(index + 1);
  if (typeof existingPin !== "string") {
    return nextPin;
  }

  const trimmed = existingPin.trim();
  return trimmed || nextPin;
}

function resolveRole(rosterEmployee, existingRole) {
  if (rosterEmployee.name === ADMIN_NAME) {
    return "Manager";
  }

  if (EDITABLE_ROLES.includes(existingRole)) {
    return existingRole;
  }

  return rosterEmployee.role;
}

function isAdmin(employee) {
  return employee.name === ADMIN_NAME && employee.role === "Manager";
}

function getHourlyRate() {
  return STANDARD_RATE;
}

function createRoleBasedTasks(employees, existingProcedures = []) {
  const normalizedExisting = existingProcedures.map((task) => ({
    id: task.id,
    text: task.text,
    done: Boolean(task.done),
    employeeId: task.employeeId,
    role: task.role,
    xpAwarded: Boolean(task.xpAwarded),
    completedAt: task.completedAt ?? null
  }));

  const tasks = [];

  for (const employee of employees) {
    const employeeExisting = normalizedExisting.filter(
      (task) => task.employeeId === employee.id
    );
    const generatedByText = new Map(employeeExisting.map((task) => [task.text, task]));

    for (const text of getTasksForRole(employee.role)) {
      const existing = generatedByText.get(text);
      tasks.push({
        id: existing?.id ?? crypto.randomUUID(),
        text,
        done: existing?.done ?? false,
        employeeId: employee.id,
        role: employee.role,
        custom: false,
        xpAwarded: existing?.xpAwarded ?? false,
        completedAt: existing?.completedAt ?? null
      });
    }
  }

  return tasks;
}

function getTasksForRole(role) {
  return ROLE_TASKS[role] ?? ROLE_TASKS.Service;
}

// ── Unavailability ──────────────────────────────────────────────────────────

const MANAGER_EMAIL = "silva.freelance.marketingandmore@gmail.com";

function renderUnavailForm() {
  // Populate employee dropdown
  const current = refs.unavailEmployee.value;
  refs.unavailEmployee.textContent = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select your name";
  refs.unavailEmployee.append(placeholder);

  for (const employee of state.employees) {
    if (isAdmin(employee)) {
      continue; // manager doesn't fill this out
    }
    const option = document.createElement("option");
    option.value = employee.id;
    option.textContent = employee.name;
    refs.unavailEmployee.append(option);
  }

  const hasCurrent = state.employees.some((e) => e.id === current);
  refs.unavailEmployee.value = hasCurrent ? current : "";

  // Build calendar for next month
  const today = new Date();
  const targetYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
  const targetMonth = (today.getMonth() + 1) % 12; // 0-based next month
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" })
    .format(new Date(targetYear, targetMonth, 1));
  refs.unavailMonthLabel.textContent = monthName;

  // Only rebuild calendar if it's empty (preserve selections across re-renders)
  if (refs.unavailCalendar.childElementCount === 0) {
    buildUnavailCalendar(targetYear, targetMonth);
  }

}

function daysUntilFirst(today) {
  const nextFirst = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return Math.round((nextFirst - today) / 86400000);
}

function buildUnavailCalendar(year, month) {
  refs.unavailCalendar.textContent = "";
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Only show Fri (5), Sat (6), Sun (0) — operating days
  const OPERATING_DAYS = new Set([0, 5, 6]); // Sun, Fri, Sat
  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Day-of-week header
  for (const name of dayNames) {
    const hdr = document.createElement("span");
    hdr.className = "cal-header";
    hdr.textContent = name;
    refs.unavailCalendar.append(hdr);
  }

  // Blank leading cells
  const firstDow = new Date(year, month, 1).getDay();
  for (let i = 0; i < firstDow; i++) {
    const blank = document.createElement("span");
    blank.className = "cal-blank";
    refs.unavailCalendar.append(blank);
  }

  // Date cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay();
    const isOperating = OPERATING_DAYS.has(dow);

    const cell = document.createElement("button");
    cell.type = "button";
    cell.dataset.date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    if (isOperating) {
      cell.className = "cal-day";
      cell.textContent = d;
      cell.addEventListener("click", () => cell.classList.toggle("cal-day--selected"));
    } else {
      cell.className = "cal-day cal-day--closed";
      cell.textContent = d;
      cell.disabled = true;
      cell.setAttribute("aria-label", "Closed");
    }

    refs.unavailCalendar.append(cell);
  }
}

function submitUnavailability(event) {
  event.preventDefault();

  const employeeId = refs.unavailEmployee.value;
  const pin = refs.unavailPin.value.trim();
  const employee = state.employees.find((e) => e.id === employeeId);

  if (!employee) {
    showUnavailStatus("Please select your name.", "error");
    return;
  }

  if (pin !== employee.pin) {
    showUnavailStatus("Incorrect PIN. Please try again.", "error");
    return;
  }

  const selectedDates = [...refs.unavailCalendar.querySelectorAll(".cal-day--selected")]
    .map((cell) => {
      const d = new Date(cell.dataset.date + "T12:00:00");
      return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    });

  const notes = refs.unavailNotes.value.trim();
  const today = new Date();
  const targetYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
  const targetMonth = (today.getMonth() + 1) % 12;
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" })
    .format(new Date(targetYear, targetMonth, 1));

  const subject = encodeURIComponent(
    `Unavailability Submission — ${employee.name} — ${monthName}`
  );

  const body = encodeURIComponent(
    [
      `Employee: ${employee.name}`,
      `Role: ${employee.role}`,
      `Submitting for: ${monthName}`,
      `Submitted on: ${today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
      "",
      selectedDates.length
        ? `Unavailable dates:\n${selectedDates.map((d) => `  • ${d}`).join("\n")}`
        : "No specific dates selected (fully available).",
      "",
      notes ? `Notes:\n${notes}` : ""
    ]
      .filter((line) => line !== undefined)
      .join("\n")
      .trimEnd()
  );

  window.location.href = `mailto:${MANAGER_EMAIL}?subject=${subject}&body=${body}`;

  refs.unavailPin.value = "";
  showUnavailStatus(
    `Email prepared for ${monthName}. Your mail app should open — hit Send to complete the submission.`,
    "success"
  );
}

function showUnavailStatus(message, type) {
  refs.unavailStatus.textContent = message;
  refs.unavailStatus.className = `panel-note unavail-status-msg unavail-status-msg--${type}`;
}

// ── Firebase backend storage ─────────────────────────────────────────────────

function initFirebase() {
  if (!FIREBASE_CONFIG.apiKey || !FIREBASE_CONFIG.projectId) {
    setSyncStatus("local");
    return;
  }

  if (typeof window.firebase === "undefined") {
    setSyncStatus("error");
    console.error("Firebase SDK is not loaded.");
    return;
  }

  try {
    if (window.firebase.apps.length === 0) {
      window.firebase.initializeApp(FIREBASE_CONFIG);
    }

    db = window.firebase.firestore();
    setSyncStatus("connecting");

    db.collection(FIRESTORE_PATH.collection)
      .doc(FIRESTORE_PATH.doc)
      .onSnapshot(
        (docSnap) => {
          if (!docSnap.exists) {
            // First cloud write: push current local state up.
            pushStateToCloud();
            return;
          }

          if (cloudWriteInFlight) {
            // Ignore immediate echo of this client's own write.
            return;
          }

          applyCloudState(docSnap.data());
          setSyncStatus("synced");
        },
        (error) => {
          setSyncStatus("error");
          console.error("Firestore listener error:", error);
        }
      );
  } catch (error) {
    setSyncStatus("error");
    console.error("Firebase init failed:", error);
  }
}

function pushStateToCloud() {
  if (!db) {
    return;
  }

  cloudWriteInFlight = true;
  setSyncStatus("syncing");

  const payload = { ...state, taskSchemaVersion: TASK_SCHEMA_VERSION };
  db.collection(FIRESTORE_PATH.collection)
    .doc(FIRESTORE_PATH.doc)
    .set(JSON.parse(JSON.stringify(payload)))
    .then(() => {
      cloudWriteInFlight = false;
      setSyncStatus("synced");
    })
    .catch((error) => {
      cloudWriteInFlight = false;
      setSyncStatus("error");
      console.error("Firestore write failed:", error);
    });
}

function applyCloudState(parsed) {
  const parsedEmployees = Array.isArray(parsed.employees) ? parsed.employees : [];
  const employees = createRosterEmployees(parsedEmployees);
  const useExistingProcedures = parsed.taskSchemaVersion === TASK_SCHEMA_VERSION;
  const parsedProcedures = useExistingProcedures && Array.isArray(parsed.procedures)
    ? parsed.procedures
    : [];

  state.employees = employees;
  state.entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  state.procedures = createRoleBasedTasks(employees, parsedProcedures);
  state.schedule = Array.isArray(parsed.schedule) ? parsed.schedule : [];
  state.xpEvents = Array.isArray(parsed.xpEvents) ? parsed.xpEvents : [];
  state.lastCelebrationWeekKey = parsed.lastCelebrationWeekKey ?? null;
  state.weeklyWinners = Array.isArray(parsed.weeklyWinners) ? parsed.weeklyWinners : [];
  state.xpConfig = normalizeXpConfig(parsed.xpConfig);

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...state, taskSchemaVersion: TASK_SCHEMA_VERSION })
  );

  renderAll();
}

function setSyncStatus(status) {
  if (!syncStatusEl) {
    return;
  }

  const map = {
    local: { text: "Connection failed", className: "sync-badge sync--error" },
    connecting: { text: "Connecting...", className: "sync-badge sync--connecting" },
    syncing: { text: "Syncing...", className: "sync-badge sync--syncing" },
    synced: { text: "Connected", className: "sync-badge sync--synced" },
    error: { text: "Connection failed", className: "sync-badge sync--error" }
  };

  const next = map[status] ?? map.local;
  syncStatusEl.textContent = next.text;
  syncStatusEl.className = next.className;
}

// ── Storage ──────────────────────────────────────────────────────────────────

function getStoredState() {
  const current = localStorage.getItem(STORAGE_KEY);
  if (current) {
    return current;
  }

  for (const key of LEGACY_STORAGE_KEYS) {
    const legacy = localStorage.getItem(key);
    if (legacy) {
      return legacy;
    }
  }

  return null;
}
