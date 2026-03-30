const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');
const prontuariosFile = path.join(dataDir, 'prontuarios.json');

app.use(express.json({ limit: '10mb' }));

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Default route to the welcome screen
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function ensureProntuariosStore() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(prontuariosFile)) {
        fs.writeFileSync(prontuariosFile, JSON.stringify({}, null, 2), 'utf8');
    }
}

function readProntuarios() {
    ensureProntuariosStore();

    try {
        const raw = fs.readFileSync(prontuariosFile, 'utf8');
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        console.error('Erro ao ler prontuarios:', error);
        return {};
    }
}

function writeProntuarios(prontuarios) {
    ensureProntuariosStore();
    fs.writeFileSync(prontuariosFile, JSON.stringify(prontuarios, null, 2), 'utf8');
}

app.get('/api/prontuarios/:patientId', (req, res) => {
    const patientId = String(req.params.patientId || '').trim();
    if (!patientId) {
        return res.status(400).json({ error: 'patientId obrigatorio' });
    }

    const prontuarios = readProntuarios();
    const prontuario = prontuarios[patientId] || {
        patientId,
        notes: '',
        updatedAt: null,
    };

    return res.json(prontuario);
});

app.put('/api/prontuarios/:patientId', (req, res) => {
    const patientId = String(req.params.patientId || '').trim();
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : '';

    if (!patientId) {
        return res.status(400).json({ error: 'patientId obrigatorio' });
    }

    const prontuarios = readProntuarios();
    prontuarios[patientId] = {
        patientId,
        notes,
        updatedAt: new Date().toISOString(),
    };

    writeProntuarios(prontuarios);
    return res.json(prontuarios[patientId]);
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
