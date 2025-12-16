const ws = new WebSocket("ws://localhost:8080");
const statusEl = document.getElementById("status") ?? null;
const table = document.getElementById("robotTable") ?? null;
const robotList = document.getElementById("robotList") ?? null;
const groupsEl = document.getElementById("groups") ?? null;

const robots = {};
const groups = JSON.parse(localStorage.getItem("groups")) ?? {};
const queues = JSON.parse(localStorage.getItem("queues")) ?? {};

let activeQueueIndex = -1;

// ===== STORAGE =====
function saveGroups() {
  localStorage.setItem("groups", JSON.stringify(groups));
}

function saveQueues() {
  localStorage.setItem("queues", JSON.stringify(queues));
}

function queueNames() {
  return Object.keys(queues);
}

// ===== WS =====
ws.onopen = () => {
  statusEl.textContent = "Connected";
  statusEl.classList.add("connected");
};

ws.onclose = () => {
  statusEl.textContent = "Disconnected";
  statusEl.classList.remove("connected");
};

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "state") {
    robots[msg.ip] = msg;
    render();
  }
};

// ===== COMMAND SEND =====
function sendGroup(group, command) {
  ws.send(
    JSON.stringify({
      action: "command",
      command,
      targets: groups[group] ?? [],
    })
  );
}

// ===== IP RANGE EXPAND =====
function expandRange(input) {
  if (!input.includes("-")) return [input];
  const [base, end] = input.split("-");
  const parts = base.split(".");
  const start = parseInt(parts[3], 10);
  const endNum = parseInt(end, 10);
  return Array.from(
    { length: endNum - start + 1 },
    (_, i) => `${parts[0]}.${parts[1]}.${parts[2]}.${start + i}`
  );
}

// ===== GROUP MANAGEMENT =====
function addIp(group, value) {
  if (!groups[group]) groups[group] = [];
  expandRange(value).forEach((ip) => {
    if (!groups[group].includes(ip)) groups[group].push(ip);
  });
  saveGroups();
  renderGroups();
}

// ===== SEQUENCE CONTROL =====
function activateQueue(index) {
  const names = queueNames();
  if (!names.length) return;
  if (index < 0) index = names.length - 1;
  if (index >= names.length) index = 0;

  const prevQueue =
    activeQueueIndex >= 0 ? queues[names[activeQueueIndex]] ?? [] : [];
  const nextQueue = queues[names[index]] ?? [];

  prevQueue.forEach((group) => {
    if (!nextQueue.includes(group)) sendGroup(group, "TURN_OFF");
  });
  nextQueue.forEach((group) => sendGroup(group, "TURN_ON"));

  activeQueueIndex = index;
  updateActiveQueueLabel();
}

function stopAllGroups() {
  Object.keys(groups).forEach((group) => sendGroup(group, "TURN_OFF"));
  activeQueueIndex = -1;
  updateActiveQueueLabel();
}

function addGroupToQueue(queue, group) {
  if (!queues[queue]) queues[queue] = [];
  if (!queues[queue].includes(group)) {
    queues[queue].push(group);
    saveQueues();
    renderQueues();
  }
}

function removeGroupFromQueue(queue, group) {
  if (queues[queue]) {
    queues[queue] = queues[queue].filter((g) => g !== group);
    saveQueues();
    renderQueues();
  }
}

function updateActiveQueueLabel() {
  const label = document.getElementById("activeQueue") ?? {};
  const names = queueNames();
  label.textContent =
    activeQueueIndex >= 0
      ? `Active: ${names[activeQueueIndex]}`
      : "Active: none";
}

// ===== RENDER =====
function renderGroups() {
  if (!groupsEl) return;
  groupsEl.innerHTML = "";
  Object.keys(groups).forEach((group) => {
    const div = document.createElement("div");
    div.className = "group";
    div.innerHTML = `
      <h3 class="group__title">${group}</h3>
      <input class="group__input" placeholder="IP or range (e.g. 192.168.0.10-20)" />
      <button class="group__add-btn">Add</button><br><br>
      <button onclick="sendGroup('${group}','TURN_ON')">ON</button>
      <button onclick="sendGroup('${group}','TURN_OFF')">OFF</button>
      <button onclick="sendGroup('${group}','ENABLE_LEDS')">LED ON</button>
      <button onclick="sendGroup('${group}','DISABLE_LEDS')">LED OFF</button>
      <ul class="group__ip-list">
        ${(groups[group] || [])
          .map((ip) => `<li class="group__ip-item">${ip}</li>`)
          .join("")}
      </ul>
    `;
    const input = div.querySelector("input");
    div.querySelector("button").onclick = () => {
      addIp(group, input.value);
      input.value = "";
    };
    try {
      if (groupsEl != {}) {
        groupsEl.appendChild(div);
      }
    } catch (e) {
      console.log(e);
    }
  });
}

function renderTable() {
  if (!table) return;
  try {
    table.innerHTML = "";
    Object.values(robots).forEach((r) => {
      const row = document.createElement("tr");
      row.innerHTML = `
      <td>${r.ip}</td>
      <td>${r.battery ?? 0}%</td>
      <td>${r.is_on ? "ON" : "OFF"}</td>
      <td>${r.leds ? "ON" : "OFF"}</td>
      <td>
        <select>
          ${Object.keys(groups)
            .map((g) => `<option>${g}</option>`)
            .join("")}
        </select>
        <button>Add</button>
      </td>
    `;
      const select = row.querySelector("select");
      row.querySelector("button").onclick = () => addIp(select.value, r.ip);

      table.appendChild(row);
    });
  } catch (e) {
    console.log(e);
  }
}

function renderSidebar() {
  robotList.innerHTML = "";
  Object.keys(robots).forEach((ip) => {
    const li = document.createElement("li");
    li.textContent = ip;
    robotList.appendChild(li);
  });
}

function renderQueues() {
  const container = document.getElementById("queues") ?? null;
  if (!container) return;

  container.innerHTML = "";
  const groupOptions = Object.keys(groups)
    .map((g) => `<option value="${g}">${g}</option>`)
    .join("");

  Object.keys(queues).forEach((queue) => {
    const div = document.createElement("div");
    div.className = "queue";
    div.innerHTML = `
      <h3>${queue}</h3>
      <div class="queue__controls">
        <select>
          <option value="">Add group…</option>
          ${groupOptions}
        </select>
        <button class="btn" onclick="activateQueue(${queueNames().indexOf(
          queue
        )})">▶ Activate</button>
      </div>
      <ul class="queue__groups">
        ${(queues[queue] || [])
          .map(
            (g) => `
          <li>
            ${g}
            <button onclick="removeGroupFromQueue('${queue}','${g}')">✕</button>
          </li>`
          )
          .join("")}
      </ul>
    `;
    div.querySelector("select").onchange = (e) => {
      if (e.target.value) {
        addGroupToQueue(queue, e.target.value);
        e.target.value = "";
      }
    };
    if (container != {}) {
      container.appendChild(div);
    }
  });
}

function render() {
  renderGroups();
  renderTable();
  renderSidebar();
}

// ===== EVENT LISTENERS =====
const nextQueueBtn = document.getElementById("nextQueue");
if (nextQueueBtn)
  nextQueueBtn.onclick = () => activateQueue(activeQueueIndex + 1);

const prevQueueBtn = document.getElementById("prevQueue");
if (prevQueueBtn)
  prevQueueBtn.onclick = () => activateQueue(activeQueueIndex - 1);

const stopAllBtn = document.getElementById("stopAll");
if (stopAllBtn) stopAllBtn.onclick = stopAllGroups;

const addQueueBtn = document.getElementById("addQueueBtn");
if (addQueueBtn)
  addQueueBtn.addEventListener("click", () => {
    const name = prompt("Queue name:");
    if (name && !queues[name]) {
      queues[name] = [];
      saveQueues();
      renderQueues();
    }
  });

// ===== INIT =====
updateActiveQueueLabel();
renderQueues();
renderGroups();
