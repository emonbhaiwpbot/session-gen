const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require('pino');
const fs = require('fs-extra');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// ===== ROOT UI SAME =====

// ===== BACKEND =====
app.post('/get-code', async (req, res) => {
    const { phone, type } = req.body;

    if (!type) return res.status(400).json({ error: "Type required" });
    if (type === "pairing" && !phone) return res.status(400).json({ error: "Phone required" });

    const sessionDir = `./session_${Date.now()}`;

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            auth: state,
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        sock.ev.on('creds.update', saveCreds);

        let responded = false;

        // ===== QR MODE =====
        if (type === 'qr') {
            sock.ev.on('connection.update', async (update) => {
                if (responded) return;

                if (update.qr) {
                    responded = true;
                    const qrUrl = await QRCode.toDataURL(update.qr);
                    return res.json({ qr: qrUrl });
                }
            });
        }

        // ===== PAIRING MODE =====
        if (type === 'pairing') {
            try {
                await delay(3000);

                const cleaned = phone.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(cleaned);

                responded = true;

                return res.json({
                    code: code?.match(/.{1,4}/g)?.join("-") || code
                });

            } catch (err) {
                return res.status(500).json({ error: "Pairing failed" });
            }
        }

        // ===== SESSION SEND =====
        sock.ev.on('connection.update', async (update) => {
            if (update.connection === 'open') {
                try {
                    const credsPath = `${sessionDir}/creds.json`;

                    const target =
                        (phone || sock.authState.creds.me.id.split(':')[0]) +
                        "@s.whatsapp.net";

                    await delay(2000);

                    await sock.sendMessage(target, {
                        document: fs.readFileSync(credsPath),
                        fileName: "creds.json",
                        mimetype: "application/json",
                        caption: "✅ EMON-BHAI SESSION FILE"
                    });

                    // cleanup
                    setTimeout(() => {
                        fs.remove(sessionDir).catch(() => {});
                    }, 15000);

                } catch (e) {
                    console.log("Session send error:", e);
                }
            }
        });

        // ===== TIMEOUT FAILSAFE =====
        setTimeout(() => {
            if (!responded) {
                responded = true;
                res.status(408).json({ error: "Timeout" });
                fs.remove(sessionDir).catch(() => {});
            }
        }, 20000);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Server error" });
    }
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
