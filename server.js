const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require('pino');
const fs = require('fs-extra');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ✅ ROOT FIX
app.get('/', (req, res) => {
    res.status(200).send("✅ EMON-BHAI SERVER RUNNING");
});

// ✅ HEALTH CHECK (Render friendly)
app.get('/health', (req, res) => {
    res.json({ status: "ok" });
});

// ✅ MAIN API
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

        if (type === 'pairing') {
            if (!phone) return res.status(400).json({ error: "Phone required" });

            await delay(3000);

            const code = await sock.requestPairingCode(phone.replace(/[^0-9]/g, ''));

            done = true;
            return res.json({
                code: code?.match(/.{1,4}/g)?.join("-")
            });
        }

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

        // timeout
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

app.listen(PORT, () => {
    console.log("Server running on port", PORT);
});
