const express = require('express');
const path = require('path');
const os = require('os');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Default route to the welcome screen
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper to get ALL local IPs for mobile testing
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push({ name, address: iface.address });
            }
        }
    }
    return addresses;
}

const ips = getLocalIPs();
const open = require('open');

app.listen(port, '0.0.0.0', () => {
    console.log(`
    ==================================================
    🚀 ODONTONIL - SISTEMA ONLINE (MODO REDE)
    ==================================================
    💻 ACESSO NO COMPUTADOR: 
       http://localhost:${port}
    
    📱 ACESSO NO CELULAR (OPÇÕES):`);
    
    if (ips.length === 0) {
        console.log("       [Nenhum IP de rede detectado]");
    } else {
        ips.forEach(ip => {
            console.log(`       http://${ip.address}:${port}  (${ip.name})`);
        });
    }

    console.log(`
    ==================================================
    💡 DICA: Se estiver no Wi-Fi, use o IP "192.168.x.x".
    ⚠️ Certifique-se de que o Celular e o PC estão 
       conectados na MESMA REDE WI-FI.
    ==================================================
    `);
    
    // Open the browser automatically ONLY on local
    open(`http://localhost:${port}`);
});
