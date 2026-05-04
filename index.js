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
async function startSock(phone) {
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

  sock.ev.on('connection.update', async (u) => {
    if (u.connection === 'open') {
      console.log("✅ CONNECTED");

      try {
        const jid = phone + "@s.whatsapp.net";

        // একটু delay দাও (important)
        await delay(3000);

        const creds = fs.readFileSync('./session/creds.json');

        // 🔥 TEXT MESSAGE
        await sock.sendMessage(jid, {
          text: `🔥 EMON-BHAI SESSION READY 🔥

👤 Owner: EMON-BHAI

🌐 Facebook:
https://facebook.com/facebook.EMon.BHai.FACEBOOK

📞 WhatsApp:
https://wa.me/8801309991724

✅ Your session file is attached below 👇`
        });

        // 🔥 FILE SEND
        await sock.sendMessage(jid, {
          document: creds,
          fileName: "creds.json",
          mimetype: "application/json"
        });

        console.log("📩 Session sent to WhatsApp");

      } catch (e) {
        console.log("❌ Send failed:", e);
      }
    }

    if (u.connection === 'close') {
      console.log("❌ DISCONNECTED → reconnecting...");
      sock = null;
      startSock(phone);
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

    <input id="num" placeholder="60123456789"><br><br>
    <button onclick="pair()">GET CODE</button>

    <h2 id="out"></h2>

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

    const socket = await startSock(phone);

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

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("🚀 EMON-BHAI SERVER RUNNING ON", PORT);
});
