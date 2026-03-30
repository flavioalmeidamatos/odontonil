const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Default route to the welcome screen (now root index.html in public)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const open = require('open');

app.listen(port, () => {
    console.log(`
    ==================================================
    🚀 CLINICA ODONTONIL - SISTEMA INICIADO
    💻 Servidor rodando em: http://localhost:${port}
    📱 Pronto para Mobile, Tablet e Desktop
    ==================================================
    `);
    
    // Open the browser automatically
    open(`http://localhost:${port}`);
});
