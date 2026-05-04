const express = require('express');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  delay
} = require("@whiskeysockets/baileys");

const pino = require('pino');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

let sock;

/* ================= SOCKET ================= */
async function startSock() {
  if (sock) return sock;

  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: state,
    browser: ["Ubuntu", "Chrome", "120.0.0"]
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (u) => {
    if (u.connection === 'open') console.log("✅ CONNECTED");
    if (u.connection === 'close') {
      console.log("❌ DISCONNECTED → reconnecting...");
      sock = null;
      startSock();
    }
  });

  return sock;
}

/* ================= UI ================= */
app.get('/', (req, res) => {
  res.send(`
  <html>
  <body style="font-family:sans-serif;text-align:center;background:#0f172a;color:white">
    
    <h1>🔥 EMON-BHAI PANEL 🔥</h1>

    <h3>Pairing Code</h3>
    <input id="num" placeholder="60123456789"><br>
    <button onclick="pair()">GET CODE</button>
    <h2 id="out"></h2>

    <br>
    <a href="/session" target="_blank" style="color:lime;">📥 Download Session File</a>

    <hr>

    <h3>Contact</h3>
    <a href="https://facebook.com/facebook.EMon.BHai.FACEBOOK" target="_blank">Facebook</a><br>
    <a href="https://wa.me/8801309991724" target="_blank">WhatsApp</a>

    <script>
      async function pair(){
        let phone = document.getElementById('num').value.replace(/[^0-9]/g,'');

        if(!phone) return alert("Enter number");

        let res = await fetch('/pair',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({phone})
        });

        let data = await res.json();

        document.getElementById('out').innerText = data.code || data.error;
      }
    </script>

  </body>
  </html>
  `);
});

/* ================= PAIR ================= */
app.post('/pair', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.json({ error: "Phone required" });

    const socket = await startSock();

    await delay(2000);

    const code = await socket.requestPairingCode(phone);

    return res.json({
      code: code?.match(/.{1,4}/g)?.join("-")
    });

  } catch (err) {
    console.log(err);
    res.json({ error: "Pairing failed" });
  }
});

/* ================= SESSION DOWNLOAD ================= */
app.get('/session', (req, res) => {
  const file = './session/creds.json';

  if (!fs.existsSync(file)) {
    return res.send("❌ Session not found. Connect first.");
  }

  res.download(file);
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("🚀 EMON-BHAI SERVER RUNNING ON", PORT);
});
