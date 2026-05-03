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
const PORT = process.env.PORT || 3000;

app.use(express.json());

/* ================= PRE-MODERN UI ================= */
app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EMON-BHAI PRE-PAIR</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Poppins:wght@300;500&display=swap');

      body {
        margin: 0;
        padding: 0;
        background: linear-gradient(-45deg, #0f172a, #1e293b, #020617, #172554);
        background-size: 400% 400%;
        animation: gradientBG 15s ease infinite;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: 'Poppins', sans-serif;
        color: white;
        overflow: hidden;
      }

      @keyframes gradientBG {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      .container {
        background: rgba(255, 255, 255, 0.03);
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 25px;
        padding: 40px;
        width: 100%;
        max-width: 420px;
        box-shadow: 0 25px 45px rgba(0, 0, 0, 0.5);
        text-align: center;
      }

      h1 {
        font-family: 'Orbitron', sans-serif;
        color: #38bdf8;
        letter-spacing: 3px;
        margin-bottom: 5px;
        font-size: 28px;
        text-transform: uppercase;
      }

      .subtitle {
        font-size: 10px;
        color: #94a3b8;
        letter-spacing: 5px;
        margin-bottom: 30px;
        text-transform: uppercase;
      }

      .section-title {
        font-size: 14px;
        color: #cbd5e1;
        margin: 20px 0 10px;
        font-weight: 500;
        text-align: left;
      }

      input {
        width: 100%;
        padding: 14px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        color: #00f2fe;
        font-size: 16px;
        outline: none;
        box-sizing: border-box;
        text-align: center;
        transition: 0.3s;
      }

      input:focus {
        border-color: #38bdf8;
        background: rgba(0, 0, 0, 0.5);
      }

      button {
        width: 100%;
        padding: 14px;
        margin-top: 15px;
        background: linear-gradient(45deg, #0ea5e9, #2563eb);
        border: none;
        border-radius: 12px;
        color: white;
        font-weight: bold;
        cursor: pointer;
        transition: 0.3s;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      button:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 20px rgba(14, 165, 233, 0.3);
      }

      #code {
        margin-top: 25px;
        font-family: 'Orbitron', sans-serif;
        color: #fbbf24;
        font-size: 32px;
        letter-spacing: 4px;
        text-shadow: 0 0 15px rgba(251, 191, 36, 0.4);
      }

      #qr img {
        margin-top: 20px;
        padding: 10px;
        background: white;
        border-radius: 15px;
        box-shadow: 0 0 20px rgba(56, 189, 248, 0.5);
      }

      hr {
        border: 0;
        height: 1px;
        background: linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent);
        margin: 35px 0;
      }

      #status {
        margin-top: 20px;
        font-size: 11px;
        color: #64748b;
      }
    </style>
  </head>
  <body>

    <div class="container">
      <h1>EMON-BHAI</h1>
      <div class="subtitle">Next-Gen WhatsApp Panel</div>

      <div class="section-title">🔗 Pair with Phone Number</div>
      <input id="phone" placeholder="Example: 60123456789">
      <button onclick="pair()" id="pairBtn">Get Pairing Code</button>
      <div id="code"></div>

      <hr>

      <div class="section-title">📸 Pair with QR Scanner</div>
      <button onclick="qr()" id="qrBtn">Generate QR Code</button>
      <div id="qr"></div>

      <div id="status">Waiting for input...</div>
    </div>

    <script>
      async function pair() {
        const phone = document.getElementById('phone').value;
        if(!phone) return alert('Enter your number first!');
        
        document.getElementById('pairBtn').innerText = 'GENERATING...';
        document.getElementById('status').innerText = 'Please wait, requesting code...';

        try {
          const res = await fetch('/get-code', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ phone, type:'pairing' })
          });

          const data = await res.json();
          document.getElementById('code').innerText = data.code || '';
          if(data.error) alert(data.error);
          document.getElementById('status').innerText = data.code ? 'Enter this code in your WhatsApp' : 'Error occured';
        } catch(e) {
          document.getElementById('status').innerText = 'Server Error';
        } finally {
          document.getElementById('pairBtn').innerText = 'Get Pairing Code';
        }
      }

      async function qr() {
        document.getElementById('qrBtn').innerText = 'LOADING...';
        document.getElementById('status').innerText = 'Fetching QR from WhatsApp...';

        try {
          const res = await fetch('/get-code', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ type:'qr' })
          });

          const data = await res.json();

          if(data.qr){
            document.getElementById('qr').innerHTML = '<img src="'+data.qr+'" width="200">';
            document.getElementById('status').innerText = 'Scan the QR with Linked Devices';
          } else {
            document.getElementById('status').innerText = 'Error: ' + data.error;
          }
        } catch(e) {
          document.getElementById('status').innerText = 'Server Error';
        } finally {
          document.getElementById('qrBtn').innerText = 'Generate QR Code';
        }
      }
    </script>

  </body>
  </html>
  `);
});

/* ================= BACKEND ================= */
app.post('/get-code', async (req, res) => {
  const { phone, type } = req.body;
  if (!type) return res.status(400).json({ error: "Type required" });

  const sessionDir = `./session_${Date.now()}`;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      // Ubuntu & Chrome Identity for stability
      browser: ["Ubuntu", "Chrome", "120.0.0"],
      printQRInTerminal: false,
      connectTimeoutMs: 60000
    });

    sock.ev.on('creds.update', saveCreds);
    let done = false;

    /* ===== Pairing Code ===== */
    if (type === 'pairing') {
      if (!phone) return res.status(400).json({ error: "Phone required" });
      await delay(4000); // Wait for socket stability

      try {
        const cleaned = phone.replace(/[^0-9]/g, '');
        const code = await sock.requestPairingCode(cleaned);
        done = true;
        return res.json({ code: code?.match(/.{1,4}/g)?.join("-") || code });
      } catch (e) {
        return res.status(500).json({ error: "WhatsApp refused pairing. Try again later." });
      }
    }

    /* ===== QR Mode ===== */
    if (type === 'qr') {
      sock.ev.on('connection.update', async (u) => {
        if (done) return;
        if (u.qr) {
          done = true;
          const qr = await QRCode.toDataURL(u.qr);
          return res.json({ qr });
        }
      });
    }

    /* ===== Session Auto-Send Logic ===== */
    sock.ev.on('connection.update', async (u) => {
      if (u.connection === 'open') {
        const myID = sock.authState.creds.me.id.split(':')[0] + "@s.whatsapp.net";
        const credsPath = `${sessionDir}/creds.json`;
        
        await delay(3000);
        if (fs.existsSync(credsPath)) {
          await sock.sendMessage(myID, { 
            document: fs.readFileSync(credsPath), 
            fileName: "creds.json", 
            mimetype: "application/json",
            caption: "✅ *EMON-BHAI SESSION SUCCESS*\n\nএটি Wispbyte-এ আপলোড করুন।"
          });
        }
        setTimeout(() => { sock.logout(); fs.remove(sessionDir).catch(()=>{}); }, 10000);
      }
    });

    /* ===== Timeout Handling ===== */
    setTimeout(() => {
      if (!done) {
        done = true;
        res.status(408).json({ error: "Request Timeout. Please retry." });
        fs.remove(sessionDir).catch(() => {});
      }
    }, 40000);

  } catch (err) {
    res.status(500).json({ error: "Server logic error" });
  }
});

app.listen(PORT, () => {
  console.log("✅ EMON-BHAI Server active on port", PORT);
});
