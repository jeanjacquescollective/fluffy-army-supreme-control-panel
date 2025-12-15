const net = require("net");
const dgram = require("dgram");
const WebSocket = require("ws");

/* ================= CONFIG ================= */

const WS_PORT = 8080;
const UDP_DISCOVERY_PORT = 9000;
const TCP_PORT = 9100;

/* ESP COMMAND BYTES */
const COMMANDS = {
  TURN_ON: 0,
  TURN_OFF: 1,
  ENABLE_LEDS: 2,
  DISABLE_LEDS: 3
};

/* ================= STATE ================= */

const robots = new Map(); // ip -> tcp socket

/* ================= WEBSOCKET ================= */

const wss = new WebSocket.Server({ port: WS_PORT });

wss.on("connection", ws => {
  console.log("🌐 Web client connected");

  ws.on("message", raw => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.action !== "command") return;

    const cmd = COMMANDS[msg.command];
    if (cmd === undefined) return;

    msg.targets.forEach(ip => {
      const socket = robots.get(ip);
      if (socket && !socket.destroyed) {
        socket.write(Buffer.from([cmd]));
      }
    });
  });

  ws.on("close", () => {
    console.log("🌐 Web client disconnected");
  });
});

function broadcastToWeb(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(msg);
    }
  });
}

/* ================= TCP SERVER ================= */

const tcpServer = net.createServer(socket => {
  const ip = socket.remoteAddress.replace("::ffff:", "");
  console.log(`🤖 Robot connected: ${ip}`);

  robots.set(ip, socket);

  socket.on("data", data => {
    if (data.length < 9) return;

    const battery = data[1];
    const flags = data[8];

    broadcastToWeb({
      type: "state",
      ip,
      battery,
      is_on: !!(flags & 0x02),
      leds: !!(flags & 0x01)
    });
  });

  socket.on("close", () => {
    console.log(`❌ Robot disconnected: ${ip}`);
    robots.delete(ip);
  });

  socket.on("error", err => {
    console.error(`⚠ Robot error (${ip}):`, err.message);
    robots.delete(ip);
  });
});

tcpServer.listen(TCP_PORT, () => {
  console.log(`📡 TCP server listening on ${TCP_PORT}`);
});

/* ================= UDP DISCOVERY ================= */

const udp = dgram.createSocket("udp4");

udp.bind(() => {
  udp.setBroadcast(true);
});

function sendDiscovery() {
  const buf = Buffer.alloc(2);
  buf.writeUInt16BE(TCP_PORT, 0);

  udp.send(buf, 0, buf.length, UDP_DISCOVERY_PORT, "255.255.255.255");
  console.log("📢 Sent UDP discovery");
}

setInterval(sendDiscovery, 1000);

/* ================= STARTUP ================= */

console.log(`🌍 WebSocket running on ws://localhost:${WS_PORT}`);
console.log(`📢 Broadcasting discovery on UDP ${UDP_DISCOVERY_PORT}`);
