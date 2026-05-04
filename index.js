const express = require('express');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  delay
} = require("@whiskeysockets/baileys");

const pino = require('pino');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

/* ================= UI ================= */
app.get('/', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>EMON-BHAI PANEL</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-slate-900 text-white flex items-center justify-center min-h-screen">

    <div class="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl text-center w-full max-w-md shadow-xl">
      
      <h1 class="text-3xl font-bold text-cyan-400 mb-2">EMON-BHAI</h1>
      <p class="text-xs text-gray-400 mb-6">WhatsApp Pair System</p>

      <input id="num" placeholder="60123456789"
        class="w-full p-4 rounded-xl bg-black/40 border border-white/10 text-center text-xl text-cyan-400 mb-4">

      <button onclick="pair()" id="btn"
        class="w-full bg-cyan-600 hover:bg-cyan-500 p-4 rounded-xl font-bold">
        GET PAIRING CODE
      </button>

      <div id="outBox" class="hidden mt-6">
        <p class="text-xs text-gray-400">Your Code</p>
        <h2 id="out" class="text-3xl tracking-widest text-cyan-400 mt-2"></h2>
      </div>

      <div class="mt-8 border-t border-white/10 pt-4 text-sm">
        <a href="https://facebook.com/facebook.EMon.BHai.FACEBOOK" target="_blank" class="text-blue-400 block">Facebook</a>
        <a href="https://wa.me/8801309991724" target="_blank" class="text-green-400 block">WhatsApp</a>
      </div>

    </div>

    <script>
      async function pair(){
        let phone = document.getElementById('num').value.replace(/[^0-9]/g,'');
        if(!phone) return alert('Enter number');

        let btn = document.getElementById('btn');
        btn.innerText = "LOADING...";
        btn.disabled = true;

        try{
          let res = await fetch('/pair',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({phone})
          });

          let data = await res.json();

          if(data.code){
            document.getElementById('outBox').classList.remove('hidden');
            document.getElementById('out').innerText = data.code;
          } else {
            alert(data.error);
          }

        }catch(e){
          alert("Server Error");
        }

        btn.innerText = "GET PAIRING CODE";
        btn.disabled = false;
      }
    </script>

  </body>
  </html>
  `);
});

/* ================= SOCKET ================= */
let sock;

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

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("🚀 EMON-BHAI SERVER RUNNING ON", PORT);
});
