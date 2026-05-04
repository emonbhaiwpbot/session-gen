const express = require('express');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const pino = require('pino');
const fs = require('fs-extra');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

// ================= ROOT UI =================
app.get('/', (req, res) => {
  res.send(`
  <html>
  <head>
    <title>EMON-BHAI PANEL</title>
    <style>
      body {
        font-family: Arial;
        text-align: center;
        background: #0f172a;
        color: white;
        margin-top: 60px;
      }
      input, button {
        padding: 12px;
        margin: 10px;
        border-radius: 8px;
        border: none;
      }
      button {
        background: #38bdf8;
        font-weight: bold;
        cursor: pointer;
      }
      a {
        color: #38bdf8;
        display:block;
        margin-top:10px;
      }
    </style>
  </head>
  <body>

    <h1>🔥 EMON-BHAI WHATSAPP PANEL 🔥</h1>

    <h3>Pairing Code</h3>
    <input id="phone" placeholder="60123456789"><br>
    <button onclick="pair()">GET CODE</button>
    <h2 id="code"></h2>

    <hr>

    <h3>QR Code</h3>
    <button onclick="qr()">GENERATE QR</button>
    <div id="qr"></div>

    <hr>

    <h3>📞 Contact</h3>
    <a href="https://facebook.com/facebook.EMon.BHai.FACEBOOK" target="_blank">Facebook Profile</a>
    <a href="https://wa.me/8801309991724" target="_blank">WhatsApp Contact</a>

    <script>
      async function pair() {
        const phone = document.getElementById('phone').value;

        const res = await fetch('/pair', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ phone })
        });

        const data = await res.json();
        document.getElementById('code').innerText = data.code || data.error;
      }

      async function qr() {
        const res = await fetch('/qr');
        const data = await res.json();

        if(data.qr){
          document.getElementById('qr').innerHTML =
            '<img src="'+data.qr+'" width="250">';
        } else {
          document.getElementById('qr').innerText = data.error;
        }
      }
    </script>

  </body>
  </html>
  `);
});

// ================= PAIR =================
app.post('/pair', async (req, res) => {
  const { phone } = req.body;

  if (!phone) return res.json({ error: "Phone required" });

  const sessionDir = './session_' + Date.now();

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      browser: ["Ubuntu", "Chrome", "120.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    await delay(2000);

    const code = await sock.requestPairingCode(
      phone.replace(/[^0-9]/g, '')
    );

    return res.json({
      code: code?.match(/.{1,4}/g)?.join("-")
    });

  } catch (err) {
    console.log(err);
    res.json({ error: "Pairing failed" });
  }
});

// ================= QR =================
app.get('/qr', async (req, res) => {
  const sessionDir = './session_' + Date.now();

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u) => {
      if (u.qr) {
        const qr = await QRCode.toDataURL(u.qr);
        return res.json({ qr });
      }
    });

    setTimeout(() => {
      res.json({ error: "Timeout" });
    }, 20000);

  } catch (err) {
    res.json({ error: "QR failed" });
  }
});

// ================= START =================
app.listen(PORT, () => {
  console.log("🚀 EMON-BHAI Server Running on", PORT);
});
