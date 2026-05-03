const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay } = require("@whiskeysockets/baileys");
const pino = require('pino');
const fs = require('fs-extra');
const { Boom } = require('@hapi/boom');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// UI সরাসরি ব্রাউজারে দেখাবে
app.get('/', (req, res) => {
    res.send(`<html><body style="background:#0f172a;color:white;text-align:center;font-family:sans-serif;padding-top:50px;">
    <h2>EMon-BHai Father Bot</h2>
    <input type="text" id="n" placeholder="88017XXXXXXXX" style="padding:10px;border-radius:5px;border:none;"><br><br>
    <button onclick="g()" style="padding:10px 20px;background:#38bdf8;border:none;color:white;cursor:pointer;border-radius:5px;">Get Code</button>
    <h3 id="c" style="color:#fbbf24;margin-top:30px;"></h3>
    <script>async function g(){const n=document.getElementById('n').value;if(!n)return alert('Number?');document.getElementById('c').innerText='Loading...';const r=await fetch('/get-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:n})});const d=await response.json();document.getElementById('c').innerText=d.code;}</script>
    </body></html>`);
});

app.post('/get-code', async (req, res) => {
    let phone = req.body.phone.replace(/[^0-9]/g, '');
    if (!phone) return res.status(400).json({ error: "Invalid Phone" });

    // Render-এ ফাইল রাইটিং পারমিশন ফিক্স
    const sessionDir = `./session_${Date.now()}`;
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["Mac OS", "Chrome", "10.15.7"]
    });

    sock.ev.on('creds.update', saveCreds);

    try {
        await delay(5000);
        let code = await sock.requestPairingCode(phone);
        res.json({ code: code?.match(/.{1,4}/g)?.join("-") || code });

        // সেশন কানেক্ট হলে অটো ফাইল পাঠানোর লজিক
        sock.ev.on('connection.update', async (s) => {
            if (s.connection === 'open') {
                const credsPath = `${sessionDir}/creds.json`;
                await sock.sendMessage(phone + "@s.whatsapp.net", { 
                    document: fs.readFileSync(credsPath), 
                    fileName: "creds.json", 
                    mimetype: "application/json",
                    caption: "✅ Father Bot Creds Ready! Download and upload to Wispbyte."
                });
                console.log("Creds sent!");
                // টেম্পোরারি ফাইল ডিলিট (Render-এর জায়গা বাঁচাতে)
                setTimeout(() => fs.removeSync(sessionDir), 10000);
            }
        });

    } catch (e) {
        res.status(500).json({ error: "Server Busy" });
    }
});

app.listen(PORT, () => console.log(`Active on Port ${PORT}`));
