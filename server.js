const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require('pino');
const fs = require('fs-extra');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ================= UI =================
app.get('/', (req, res) => {
    res.send(`
    <html>
    <head>
        <title>EMON-BHAI PAIR PANEL</title>
        <style>
            body {
                font-family: Arial;
                text-align: center;
                margin-top: 80px;
                background: #0f172a;
                color: white;
            }
            input, button {
                padding: 12px;
                margin: 10px;
                border-radius: 8px;
                border: none;
                font-size: 16px;
            }
            input {
                width: 250px;
            }
            button {
                background: #38bdf8;
                cursor: pointer;
                font-weight: bold;
            }
            #qr img {
                margin-top: 20px;
            }
        </style>
    </head>
    <body>

        <h1>📱 EMON-BHAI WHATSAPP</h1>

        <h3>Pairing Code</h3>
        <input id="phone" placeholder="60123456789"><br>
        <button onclick="getCode()">GET PAIRING CODE</button>

        <h2 id="code"></h2>

        <hr style="margin:40px">

        <h3>QR Code</h3>
        <button onclick="getQR()">GENERATE QR</button>

        <div id="qr"></div>

        <script>
            async function getCode() {
                const phone = document.getElementById('phone').value;

                const res = await fetch('/get-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone: phone,
                        type: 'pairing'
                    })
                });

                const data = await res.json();
                document.getElementById('code').innerText = data.code || data.error;
            }

            async function getQR() {
                const res = await fetch('/get-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'qr'
                    })
                });

                const data = await res.json();

                if (data.qr) {
                    document.getElementById('qr').innerHTML =
                        '<img src="' + data.qr + '" width="250"/>';
                } else {
                    document.getElementById('qr').innerText = data.error;
                }
            }
        </script>

    </body>
    </html>
    `);
});

// ================= BACKEND =================
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
            auth: state
        });

        sock.ev.on('creds.update', saveCreds);

        let done = false;

        // ===== Pairing =====
        if (type === 'pairing') {
            if (!phone) return res.status(400).json({ error: "Phone required" });

            await delay(3000);

            const cleaned = phone.replace(/[^0-9]/g, '');
            const code = await sock.requestPairingCode(cleaned);

            done = true;

            return res.json({
                code: code?.match(/.{1,4}/g)?.join("-") || code
            });
        }

        // ===== QR =====
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

        // ===== Timeout =====
        setTimeout(() => {
            if (!done) {
                done = true;
                res.status(408).json({ error: "Timeout" });
            }
        }, 20000);

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Server error" });
    }
});

// ================= START =================
app.listen(PORT, () => {
    console.log("✅ Server running on port", PORT);
});
