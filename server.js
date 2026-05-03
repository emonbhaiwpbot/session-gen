const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require('pino');
const fs = require('fs-extra');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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
            .glass::before { content: ''; position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; background: linear-gradient(45deg, #00f2fe, #4facfe); z-index: -1; border-radius: 32px; opacity: 0.3; }
            input { background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); color: #00f2fe; transition: 0.4s; text-align: center; font-weight: bold; }
            input:focus { border-color: #00f2fe; outline: none; box-shadow: 0 0 15px rgba(0, 242, 254, 0.2); }
            button { background: linear-gradient(45deg, #4facfe 0%, #00f2fe 100%); transition: 0.4s; }
            button:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0, 242, 254, 0.3); }
        </style>
    </head>
    <body>
        <div class="glass">
            <h1 class="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2 italic">EMON-BHAI</h1>
            <p class="text-gray-400 text-[10px] tracking-[4px] uppercase mb-8">Next-Gen Bot Connector</p>
            
            <div id="input-area">
                <input type="text" id="phone" placeholder="88017XXXXXXXX" class="w-full p-4 rounded-2xl mb-5 text-xl tracking-widest">
                <button onclick="submitPhone()" id="btn" class="w-full text-white font-bold p-4 rounded-2xl text-lg uppercase tracking-wider">
                    Generate Link Code
                </button>
            </div>

            <div id="result-area" class="hidden mt-6 bg-black/30 p-6 rounded-2xl border border-cyan-500/20">
                <p class="text-cyan-400 text-[10px] mb-3 uppercase tracking-widest">Success! Link with this code:</p>
                <div id="code" class="text-4xl font-black text-white tracking-[6px]"></div>
                <div class="mt-6 flex justify-center gap-2">
                    <span class="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"></span>
                    <span class="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span class="w-2 h-2 bg-cyan-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
                <p class="text-gray-500 text-[9px] mt-4 italic">ফাইলটি অটোমেটিক আপনার হোয়াটসঅ্যাপে চলে যাবে।</p>
            </div>
        </div>

        <script>
            async function submitPhone() {
                const phone = document.getElementById('phone').value.replace(/\\s/g, '');
                if(!phone || phone.length < 10) return alert('Enter valid number with country code!');
                
                document.getElementById('btn').innerText = 'SECURE PAIRING...';
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
                        alert(data.error || 'Connection Failed! Try again.');
                        location.reload();
                    }
                } catch (e) {
                    alert('Server Timeout! Try again.');
                    location.reload();
                }
            }
        </script>
    </body>
    </html>
    `);
});

app.post('/get-code', async (req, res) => {
    let phone = req.body.phone.replace(/[^0-9]/g, '');
    const sessionDir = `./session_${Date.now()}`;
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    try {
        // টাইম-আউট সমস্যা এড়াতে সকেট রেডি হওয়ার জন্য অল্প সময় অপেক্ষা
        await delay(3000);
        let code = await sock.requestPairingCode(phone);
        res.json({ code: code?.match(/.{1,4}/g)?.join("-") || code });

        sock.ev.on('connection.update', async (s) => {
            const { connection } = s;
            if (connection === 'open') {
                const credsPath = `${sessionDir}/creds.json`;
                await sock.sendMessage(phone + "@s.whatsapp.net", { 
                    document: fs.readFileSync(credsPath), 
                    fileName: "creds.json", 
                    mimetype: "application/json",
                    caption: "✅ *EMON-BHAI FATHER BOT*\n\nআপনার সেশন ফাইল সফলভাবে জেনারেট হয়েছে। এটি Wispbyte-এ আপলোড করুন।"
                });
                // সেশন পাঠানোর পর ডিলিট করে দেওয়া (সার্ভার ক্লিন রাখতে)
                setTimeout(() => fs.removeSync(sessionDir), 5000);
            }
        });

    } catch (e) {
        res.status(500).json({ error: "WhatsApp Server Blocked Request. Wait 1 minute." });
    }
});

app.listen(PORT, () => console.log(`Active on ${PORT}`));
