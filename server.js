sock.ev.on('connection.update', async (update) => {
    const { connection } = update;
    if (connection === 'open') {
        const path = `./session/creds.json`; // আপনার সেশন ফাইল
        const myNumber = phone + "@s.whatsapp.net";
        
        // আপনার হোয়াটসঅ্যাপে ফাইলটি পাঠিয়ে দিবে
        await sock.sendMessage(myNumber, { 
            document: fs.readFileSync(path), 
            fileName: "creds.json", 
            mimetype: "application/json",
            caption: "✅ আপনার সেশন ফাইলটি রেডি! এটি ডাউনলোড করে server-এ আপলোড করুন।"
        });
        console.log("Session file sent to user!");
    }
});
