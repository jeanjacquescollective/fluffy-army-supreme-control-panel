const ws = new WebSocket("ws://localhost:8080");
const statusEl = document.getElementById("status");
const table = document.getElementById("robotTable");
const robotList = document.getElementById("robotList");
const groupsEl = document.getElementById("groups");

const robots = {};

// ===== GROUP STORAGE =====
const DEFAULT_GROUPS = {
  group1: [],
  group2: [],
  group3: [],
  group4: [],
  group5: [],
};

let groups = JSON.parse(localStorage.getItem("groups")) || DEFAULT_GROUPS;

function saveGroups() {
  localStorage.setItem("groups", JSON.stringify(groups));
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
      targets: groups[group],
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

// ===== ADD IP TO GROUP =====
function addIp(group, value) {
  expandRange(value).forEach((ip) => {
    if (!groups[group].includes(ip)) {
      groups[group].push(ip);
    }
  });
  saveGroups();
  renderGroups();
}

// ===== RENDER GROUPS =====
function renderGroups() {
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
    ${groups[group]
      .map((ip) => `<li class="group__ip-item">${ip}</li>`)
      .join("")}
  </ul>
`;

    const input = div.querySelector("input");
    div.querySelector("button").onclick = () => {
      addIp(group, input.value);
      input.value = "";
    };

    groupsEl.appendChild(div);
  });
}

// ===== RENDER TABLE =====
function renderTable() {
  table.innerHTML = "";

  Object.values(robots).forEach((r) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${r.ip}</td>
      <td>${r.battery}%</td>
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
    row.querySelector("button").onclick = () => {
      addIp(select.value, r.ip);
    };

    table.appendChild(row);
  });
}

// ===== SIDEBAR =====
function renderSidebar() {
  robotList.innerHTML = "";
  Object.keys(robots).forEach((ip) => {
    const li = document.createElement("li");
    li.textContent = ip;
    robotList.appendChild(li);
  });
}

function render() {
  renderGroups();
  renderTable();
  renderSidebar();
}

renderGroups();
