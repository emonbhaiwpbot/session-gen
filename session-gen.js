const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay 
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const fs = require('fs-extra');
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function generateSession() {
    // এটি স্থানীয়ভাবে 'temp_session' ফোল্ডার তৈরি করবে
    const { state, saveCreds } = await useMultiFileAuthState('./temp_session');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["iPhone (iOS)", "Safari", "15.0"],
        printQRInTerminal: false
    });

    if (!sock.authState.creds.registered) {
        console.log("------------------------------------------");
        const phoneNumber = await question('আপনার হোয়াটসঅ্যাপ নম্বরটি দিন (যেমন: 88017XXXXXXXX): ');
        const code = await sock.requestPairingCode(phoneNumber.trim());
        console.log(`\n🔥 আপনার কানেকশন কোড: ${code.match(/.{1,4}/g).join("-")}\n`);
        console.log("এই কোডটি আপনার হোয়াটসঅ্যাপে বসান।");
        console.log("------------------------------------------");
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('\n✅ কানেকশন সফল হয়েছে!');
            await delay(5000);
            console.log('এখন আপনার ফোল্ডারে "temp_session" নামে একটি ফোল্ডার তৈরি হয়েছে।');
            console.log('এই ফোল্ডারের ভেতরে "creds.json" ফাইলটি পাবেন।');
            process.exit(0);
        }
    });
}

generateSession();
