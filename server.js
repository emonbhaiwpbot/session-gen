const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay } = require("@whiskeysockets/baileys");
const pino = require('pino');
const fs = require('fs-extra');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// UI - Modern Glassmorphism Design
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
            body {
                background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
                background-size: 400% 400%;
                animation: gradient 15s ease infinite;
                height: 100vh;
                display: flex; align-items: center; justify-content: center;
                font-family: 'Poppins', sans-serif;
            }
            @keyframes gradient {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            .glass {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(15px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 20px;
                padding: 40px;
                box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
                text-align: center;
                width: 100%;
                max-width: 400px;
            }
            input {
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                transition: 0.3s;
            }
            input::placeholder { color: rgba(255, 255, 255, 0.6); }
            input:focus { border-color: #fff; outline: none; background: rgba(255, 255, 255, 0.3); }
        </style>
    </head>
    <body>
        <div class="glass">
            <h1 class="text-4xl font-black text-white tracking-widest mb-2">EMON-BHAI</h1>
            <p class="text-blue-100 text-sm mb-8 font-medium">NEXT-GEN WHATSAPP PAIRING</p>
            
            <div id="input-area">
                <input type="text" id="phone" placeholder="Example: 8801XXXXXXXXX" class="w-full p-4 rounded-xl mb-4 text-lg">
                <button onclick="submitPhone()" id="btn" class="w-full bg-white text-pink-600 font-bold p-4 rounded-xl hover:scale-105 transition transform active:scale-95">
                    GET PAIRING CODE
                </button>
            </div>

            <div id="result-area" class="hidden mt-6">
                <p class="text-white text-xs mb-2">YOUR PAIRING CODE:</p>
                <div id="code" class="text-3xl font-bold text-yellow-300 tracking-widest animate-pulse"></div>
                <p class="text-white text-[10px] mt-4 opacity-70">কানেক্ট হওয়ার পর ওই নম্বরটিতেই সেশন ফাইল চলে যাবে।</p>
            </div>
        </div>

        <script>
            async function submitPhone() {
                const phone = document.getElementById('phone').value;
                if(!phone) return alert('Please enter a number with country code!');
                
                document.getElementById('btn').innerText = 'GENERATING...';
                document.getElementById('btn').disabled = true;

                try {
                    const res = await fetch('/get-code', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ phone })
                    });
                    const data = await res.json();
                    
                    if(data.code) {
                        document.getElementById('input-area').classList.add('hidden');
                        document.getElementById('result-area').classList.remove('hidden');
                        document.getElementById('code').innerText = data.code;
                    } else {
                        alert('Error generating code. Try again.');
                        location.reload();
                    }
                } catch (e) {
                    alert('Server Error!');
                    location.reload();
                }
            }
        </script>
    </body>
    </html>
    `);
});

// Pairing Logic
app.post('/get-code', async (req, res) => {
    let phone = req.body.phone.replace(/[^0-9]/g, '');
    const sessionDir = `./session_${Date.now()}`;
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["iPhone (iOS)", "Safari", "15.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    try {
        await delay(5000);
        let code = await sock.requestPairingCode(phone);
        res.json({ code: code?.match(/.{1,4}/g)?.join("-") || code });

        sock.ev.on('connection.update', async (s) => {
            if (s.connection === 'open') {
                const credsPath = `${sessionDir}/creds.json`;
                // সেশন ফাইলটি সেই ইউজারকেই পাঠিয়ে দিবে
                await sock.sendMessage(phone + "@s.whatsapp.net", { 
                    document: fs.readFileSync(credsPath), 
                    fileName: "creds.json", 
                    mimetype: "application/json",
                    caption: "✅ *EMON-BHAI FATHER BOT SESSION*\n\nআপনার সেশন ফাইল রেডি। এটি ডাউনলোড করে Wispbyte-এ আপলোড করুন।"
                });
                console.log(`Creds sent to ${phone}`);
                setTimeout(() => fs.removeSync(sessionDir), 10000);
            }
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Server Busy" });
    }
});

app.listen(PORT, () => console.log(`EMON-BHAI Bot Active on ${PORT}`));
