const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require('pino');
const fs = require('fs-extra');
const { Boom } = require('@hapi/boom');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// UI - Premium Glassmorphism
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>EMON-BHAI PAIRING</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            body { background: linear-gradient(-45deg, #0f172a, #1e293b, #334155, #1e293b); background-size: 400% 400%; animation: gradient 10s ease infinite; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: 'Poppins', sans-serif; overflow: hidden; }
            @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
            .glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 30px; padding: 40px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); text-align: center; width: 90%; max-width: 400px; position: relative; }
            input { background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); color: #00f2fe; transition: 0.4s; text-align: center; font-weight: bold; }
            button { background: linear-gradient(45deg, #4facfe 0%, #00f2fe 100%); transition: 0.4s; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="glass">
            <h1 class="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2 italic">EMON-BHAI</h1>
            <p class="text-gray-400 text-[10px] tracking-[4px] uppercase mb-8">System Online</p>
            <div id="input-area">
                <input type="text" id="phone" placeholder="88017XXXXXXXX" class="w-full p-4 rounded-2xl mb-5 text-xl tracking-widest">
                <button onclick="submitPhone()" id="btn" class="w-full text-white font-bold p-4 rounded-2xl text-lg uppercase tracking-wider">Generate Code</button>
            </div>
            <div id="result-area" class="hidden mt-6 bg-black/30 p-6 rounded-2xl border border-cyan-500/20 text-white">
                <p class="text-cyan-400 text-[10px] mb-3 uppercase">Your Pairing Code:</p>
                <div id="code" class="text-4xl font-black tracking-[6px] text-yellow-400 animate-pulse"></div>
                <p id="status" class="mt-4 text-xs text-gray-400">কোডটি হোয়াটসঅ্যাপে বসিয়ে অপেক্ষা করুন...</p>
            </div>
        </div>
        <script>
            async function submitPhone() {
                const phone = document.getElementById('phone').value.replace(/\\s/g, '');
                if(!phone) return alert('Number please!');
                document.getElementById('btn').innerText = 'CONNECTING...';
                const res = await fetch('/get-code', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ phone }) });
                const data = await res.json();
                if(data.code) {
                    document.getElementById('input-area').classList.add('hidden');
                    document.getElementById('result-area').classList.remove('hidden');
                    document.getElementById('code').innerText = data.code;
                } else { alert('Error! Try again.'); location.reload(); }
            }
        </script>
    </body>
    </html>
    `);
});

// Pairing Logic with Connection Monitor
app.post('/get-code', async (req, res) => {
    let phone = req.body.phone.replace(/[^0-9]/g, '');
    const sessionDir = `./session_${Date.now()}`;
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000
    });

    sock.ev.on('creds.update', saveCreds);

    try {
        await delay(5000);
        let code = await sock.requestPairingCode(phone);
        res.json({ code: code?.match(/.{1,4}/g)?.join("-") || code });

        sock.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect } = s;
            if (connection === 'open') {
                console.log(`Successfully connected with ${phone}`);
                const credsPath = `${sessionDir}/creds.json`;
                
                await delay(2000);
                await sock.sendMessage(phone + "@s.whatsapp.net", { 
                    document: fs.readFileSync(credsPath), 
                    fileName: "creds.json", 
                    mimetype: "application/json",
                    caption: "✅ *EMON-BHAI FATHER BOT SESSION*\n\nকানেকশন সফল হয়েছে! এই ফাইলটি সেভ করে Wispbyte-এ ব্যবহার করুন।"
                });
                
                setTimeout(() => { sock.logout(); fs.removeSync(sessionDir); }, 10000);
            }
            
            if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                if (reason !== DisconnectReason.loggedOut) {
                    // সেশন কানেক্ট হওয়ার আগে বন্ধ হলে এটি রিট্রাই করবে না এখানে, কারণ এটি ওয়ান-টাইম পেয়ারিং
                }
            }
        });

    } catch (e) {
        res.status(500).json({ error: "Failed" });
    }
});

app.listen(PORT, () => console.log(`Server started on ${PORT}`));
