const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fontkit = require('fontkit');
const { PDFDocument, rgb } = require('pdf-lib');

const app = express();
const port = process.env.PORT || 3000;
const dataDir = path.join(__dirname, 'data');
const prontuariosFile = path.join(dataDir, 'prontuarios.json');
const medicacoesFile = path.join(dataDir, 'medicacoes.json');
const tiposUsoFile = path.join(dataDir, 'tipos-uso.json');
const dosagensFile = path.join(dataDir, 'dosagens.json');
const administracoesFile = path.join(dataDir, 'administracoes.json');
const receitaTemplateFile = path.join(__dirname, 'public', 'RECEITA RAPHAEL.pdf');
const generatedReceitasDir = path.join(__dirname, 'public', 'receitas-geradas');
const arialFontPath = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arial.ttf');
const patientNamePlaceholders = ['\u00abnome_do_paciente\u00bb', '\u00abnome do paciente\u00bb'];
const patientAddressPlaceholders = ['\u00abendere\u00e7o_do_paciente\u00bb'];
const prescriptionAnchors = ['Prescri\u00e7\u00e3o:'];
const dateAnchors = ['Data'];
const replacementFontSize = 12.6;

let pdfJsModulePromise = null;

app.use(express.json({ limit: '10mb' }));

app.use(express.static(path.join(__dirname, 'public')));

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

function ensureListStore(filePath, initialItems = []) {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(initialItems, null, 2), 'utf8');
    }
}

function normalizeCatalogItem(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ');
}

function sortCatalogList(list) {
    return [...list].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}

function readListStore(filePath, initialItems = []) {
    ensureListStore(filePath, initialItems);

    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) {
            return [];
        }

        const uniqueItems = [];
        const seen = new Set();

        parsed.forEach((item) => {
            const normalizedName = normalizeCatalogItem(item);
            if (!normalizedName) {
                return;
            }

            const dedupeKey = normalizedName.toLocaleLowerCase('pt-BR');
            if (seen.has(dedupeKey)) {
                return;
            }

            seen.add(dedupeKey);
            uniqueItems.push(normalizedName);
        });

        return sortCatalogList(uniqueItems);
    } catch (error) {
        console.error(`Erro ao ler catalogo ${path.basename(filePath)}:`, error);
        return [];
    }
}

function writeListStore(filePath, items, initialItems = []) {
    ensureListStore(filePath, initialItems);
    const normalizedList = (Array.isArray(items) ? items : [])
        .map(normalizeCatalogItem)
        .filter(Boolean);

    const uniqueItems = [];
    const seen = new Set();

    normalizedList.forEach((item) => {
        const dedupeKey = item.toLocaleLowerCase('pt-BR');
        if (seen.has(dedupeKey)) {
            return;
        }

        seen.add(dedupeKey);
        uniqueItems.push(item);
    });

    fs.writeFileSync(filePath, JSON.stringify(sortCatalogList(uniqueItems), null, 2), 'utf8');
}

function readMedicacoes() {
    return readListStore(medicacoesFile, []);
}

function writeMedicacoes(medicacoes) {
    writeListStore(medicacoesFile, medicacoes, []);
}

function readTiposUso() {
    return readListStore(tiposUsoFile, ['Uso Interno Oral', 'Via Intramuscular']);
}

function writeTiposUso(tiposUso) {
    writeListStore(tiposUsoFile, tiposUso, ['Uso Interno Oral', 'Via Intramuscular']);
}

function readDosagens() {
    return readListStore(dosagensFile, []);
}

function writeDosagens(dosagens) {
    writeListStore(dosagensFile, dosagens, []);
}

function readAdministracoes() {
    return readListStore(administracoesFile, ['Comprimido', 'C\u00e1psulas']);
}

function writeAdministracoes(administracoes) {
    writeListStore(administracoesFile, administracoes, ['Comprimido', 'C\u00e1psulas']);
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

function ensureGeneratedReceitasStore() {
    if (!fs.existsSync(generatedReceitasDir)) {
        fs.mkdirSync(generatedReceitasDir, { recursive: true });
    }
}

function sanitizeFileSegment(value) {
    return String(value || '')
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
        .replace(/\s+/g, ' ')
        .slice(0, 120) || 'receita';
}

function toTitleCase(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function buildPatientAddressForPdf(address, number, complemento, bairro, cidade, uf, cep) {
    const normalizedAddress = String(address || '').trim();
    const normalizedNumber = String(number || '').trim();
    const normalizedComplemento = String(complemento || '').trim();
    const normalizedBairro = String(bairro || '').trim();
    const normalizedCidade = String(cidade || '').trim();
    const normalizedUf = String(uf || '').trim();
    const normalizedCep = String(cep || '').trim();

    const firstLineParts = [];
    const secondLineParts = [];

    if (normalizedAddress) {
        firstLineParts.push(normalizedAddress);
    }
    if (normalizedNumber) {
        firstLineParts.push(`n\u00ba: ${normalizedNumber}`);
    }
    if (normalizedComplemento) {
        firstLineParts.push(`Complemento: ${normalizedComplemento}`);
    }
    if (normalizedBairro) {
        firstLineParts.push(`Bairro: ${normalizedBairro}`);
    }
    if (normalizedCidade) {
        secondLineParts.push(`Cidade: ${normalizedCidade}`);
    }
    if (normalizedUf) {
        secondLineParts.push(`UF: ${normalizedUf}`);
    }
    if (normalizedCep) {
        secondLineParts.push(`CEP: ${normalizedCep}`);
    }

    return {
        firstLine: firstLineParts.join(' - '),
        secondLine: secondLineParts.join(' - '),
    };
}

function normalizeNotesForPdf(notes) {
    return String(notes || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();
}

function formatCurrentDateBr() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear());
    return `${day}/${month}/${year}`;
}

function buildTextLineGroups(items) {
    const groups = [];

    items.forEach((item) => {
        const rawY = Number(item?.transform?.[5]);
        const rawX = Number(item?.transform?.[4]);
        const height = Number(item?.height) || Math.abs(Number(item?.transform?.[3])) || Math.abs(Number(item?.transform?.[0])) || 12;
        const width = Number(item?.width) || 0;

        if (!Number.isFinite(rawY) || !Number.isFinite(rawX)) {
            return;
        }

        const normalizedItem = {
            ...item,
            rawX,
            rawY,
            width,
            height,
        };

        const group = groups.find((entry) => Math.abs(entry.y - rawY) <= 2.5);
        if (group) {
            group.items.push(normalizedItem);
            group.y = rawY;
            return;
        }

        groups.push({
            y: rawY,
            items: [normalizedItem],
        });
    });

    return groups.map((group) => ({
        ...group,
        items: group.items.sort((a, b) => a.rawX - b.rawX),
    }));
}

function findPlaceholderMatches(items, placeholders) {
    const matches = [];
    const groups = buildTextLineGroups(items);

    groups.forEach((group) => {
        let lineText = '';
        const segments = group.items.map((item) => {
            const start = lineText.length;
            lineText += String(item.str || '');
            return {
                item,
                start,
                end: lineText.length,
            };
        });

        placeholders.forEach((placeholder) => {
            let searchIndex = 0;

            while (searchIndex < lineText.length) {
                const foundAt = lineText.indexOf(placeholder, searchIndex);
                if (foundAt === -1) {
                    break;
                }

                const matchEnd = foundAt + placeholder.length;
                const coveredSegments = segments.filter((segment) => (
                    segment.end > foundAt &&
                    segment.start < matchEnd &&
                    String(segment.item.str || '').trim() !== ''
                ));

                if (coveredSegments.length > 0) {
                    const x = Math.min(...coveredSegments.map((segment) => segment.item.rawX));
                    const endX = Math.max(...coveredSegments.map((segment) => segment.item.rawX + segment.item.width));
                    const y = Math.min(...coveredSegments.map((segment) => segment.item.rawY));
                    const height = Math.max(...coveredSegments.map((segment) => segment.item.height));

                    matches.push({
                        x,
                        y,
                        width: Math.max(endX - x, 40),
                        height: Math.max(height, 12),
                    });
                }

                searchIndex = matchEnd;
            }
        });
    });

    return matches;
}

function findAnchorMatches(items, anchors) {
    return items
        .filter((item) => anchors.includes(String(item.str || '').trim()))
        .map((item) => ({
            x: Number(item?.transform?.[4]) || 0,
            y: Number(item?.transform?.[5]) || 0,
            width: Number(item?.width) || 0,
            height: Number(item?.height) || replacementFontSize,
        }));
}

async function getPdfJsModule() {
    if (!pdfJsModulePromise) {
        pdfJsModulePromise = import('pdfjs-dist/legacy/build/pdf.mjs');
    }

    return pdfJsModulePromise;
}

function drawReplacementText(page, font, match, replacementText) {
    page.drawRectangle({
        x: match.x - 10,
        y: match.y - 7,
        width: match.width + 20,
        height: Math.max(match.height + 14, replacementFontSize + 14),
        color: rgb(1, 1, 1),
    });

    if (replacementText) {
        page.drawText(replacementText, {
            x: match.x,
            y: match.y,
            size: replacementFontSize,
            font,
            color: rgb(0, 0, 0),
        });
    }
}

function drawAddressReplacementText(page, font, match, replacementText) {
    const fieldWidth = 470;
    const lineHeight = 15.4;
    const firstLine = replacementText?.firstLine || '';
    const secondLine = replacementText?.secondLine || '';

    page.drawRectangle({
        x: match.x - 10,
        y: match.y - 24,
        width: fieldWidth,
        height: Math.max(match.height + 31, replacementFontSize + 29),
        color: rgb(1, 1, 1),
    });

    if (firstLine) {
        page.drawText(firstLine, {
            x: match.x,
            y: match.y,
            size: replacementFontSize,
            font,
            color: rgb(0, 0, 0),
        });
    }

    if (secondLine) {
        page.drawText(secondLine, {
            x: match.x,
            y: match.y - lineHeight,
            size: replacementFontSize,
            font,
            color: rgb(0, 0, 0),
        });
    }
}

function selectDateMatches(matches) {
    const preferredMatches = matches
        .filter((match) => match.y >= 100)
        .sort((a, b) => a.x - b.x)
        .slice(0, 2);

    if (preferredMatches.length > 0) {
        return preferredMatches;
    }

    return matches
        .sort((a, b) => a.x - b.x)
        .slice(0, 2);
}

function drawDateAboveAnchor(page, font, match, dateText) {
    const x = match.x - 15;
    const y = match.y + 14;
    const width = 72;
    const height = 18;

    page.drawRectangle({
        x: x - 2,
        y: y - 4,
        width,
        height,
        color: rgb(1, 1, 1),
    });

    page.drawText(dateText, {
        x,
        y,
        size: replacementFontSize,
        font,
        color: rgb(0, 0, 0),
    });
}

function wrapTextToWidth(text, font, size, maxWidth) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return [''];
    }

    const lines = [];
    let currentLine = '';

    words.forEach((word) => {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !currentLine) {
            currentLine = candidate;
            return;
        }

        lines.push(currentLine);
        currentLine = word;
    });

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
}

function buildPrescriptionRenderLines(notes, font, width) {
    const paragraphs = normalizeNotesForPdf(notes).split('\n');
    const lines = [];

    paragraphs.forEach((paragraph) => {
        if (!paragraph.trim()) {
            lines.push('');
            return;
        }

        wrapTextToWidth(paragraph, font, replacementFontSize, width).forEach((line) => {
            lines.push(line);
        });
    });

    return lines;
}

function drawPrescriptionBlock(page, font, anchor, notes) {
    const x = anchor.x;
    const topY = anchor.y - 18;
    const width = 255;
    const height = 205;
    const lineHeight = 15.4;

    page.drawRectangle({
        x: x - 2,
        y: topY - height + 10,
        width: width + 4,
        height,
        color: rgb(1, 1, 1),
    });

    const lines = buildPrescriptionRenderLines(notes, font, width);
    let currentY = topY;

    lines.forEach((line) => {
        if (currentY < topY - height + 16) {
            return;
        }

        if (line) {
            page.drawText(line, {
                x,
                y: currentY,
                size: replacementFontSize,
                font,
                color: rgb(0, 0, 0),
            });
        }

        currentY -= lineHeight;
    });
}

async function generateReceitaPdf(patientId, patientName, patientAddress, patientNumber, patientComplemento, patientBairro, patientCidade, patientUf, patientCep, notes) {
    if (!fs.existsSync(receitaTemplateFile)) {
        throw new Error('Modelo de receita nao encontrado.');
    }

    if (!fs.existsSync(arialFontPath)) {
        throw new Error('Fonte Arial nao encontrada no sistema.');
    }

    ensureGeneratedReceitasStore();

    const templateBytes = fs.readFileSync(receitaTemplateFile);
    const fontBytes = fs.readFileSync(arialFontPath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(fontBytes);
    const pdfJsLib = await getPdfJsModule();
    const pdfJsDoc = await pdfJsLib.getDocument({ data: new Uint8Array(templateBytes) }).promise;
    const formattedPatientName = toTitleCase(patientName);
    const formattedPatientAddress = buildPatientAddressForPdf(
        patientAddress,
        patientNumber,
        patientComplemento,
        patientBairro,
        patientCidade,
        patientUf,
        patientCep
    );
    const currentDateBr = formatCurrentDateBr();
    const normalizedNotes = normalizeNotesForPdf(notes);

    if (!formattedPatientName) {
        throw new Error('Nome do paciente obrigatorio para gerar a receita.');
    }

    let replacedCount = 0;
    let nameMatchCount = 0;
    let prescriptionMatchCount = 0;
    const pages = pdfDoc.getPages();

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        const textPage = await pdfJsDoc.getPage(pageIndex + 1);
        const textContent = await textPage.getTextContent();
        const page = pages[pageIndex];

        const nameMatches = findPlaceholderMatches(textContent.items, patientNamePlaceholders);
        const addressMatches = findPlaceholderMatches(textContent.items, patientAddressPlaceholders);
        const prescriptionMatches = findAnchorMatches(textContent.items, prescriptionAnchors);
        const foundDateMatches = findAnchorMatches(textContent.items, dateAnchors);
        const selectedDateMatches = selectDateMatches(foundDateMatches);

        nameMatchCount += nameMatches.length;
        prescriptionMatchCount += prescriptionMatches.length;

        nameMatches.forEach((match) => {
            drawReplacementText(page, font, match, formattedPatientName);
            replacedCount += 1;
        });

        addressMatches.forEach((match) => {
            drawAddressReplacementText(page, font, match, formattedPatientAddress);
            replacedCount += 1;
        });

        prescriptionMatches.forEach((match) => {
            drawPrescriptionBlock(page, font, {
                x: match.x,
                y: match.y,
            }, normalizedNotes);
            replacedCount += 1;
        });

        selectedDateMatches.forEach((match) => {
            drawDateAboveAnchor(page, font, match, currentDateBr);
            replacedCount += 1;
        });
    }

    if (nameMatchCount === 0) {
        throw new Error('Tag nome_do_paciente nao encontrada no PDF modelo.');
    }

    if (prescriptionMatchCount === 0) {
        throw new Error('Area de prescricao nao encontrada no PDF modelo.');
    }

    if (replacedCount === 0) {
        throw new Error('Nenhuma tag do PDF modelo foi encontrada para substituicao.');
    }

    const safePatientId = sanitizeFileSegment(patientId);
    const fileName = `${safePatientId}.pdf`;
    const outputPath = path.join(generatedReceitasDir, fileName);
    const generatedBytes = await pdfDoc.save();

    fs.writeFileSync(outputPath, generatedBytes);

    return {
        fileName,
        filePath: outputPath,
        pdfUrl: `/receitas-geradas/${encodeURIComponent(fileName)}`,
        replacedCount,
    };
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

app.get('/api/medicacoes', (req, res) => {
    return res.json({
        items: readMedicacoes(),
    });
});

app.post('/api/medicacoes', (req, res) => {
    const medicationName = normalizeCatalogItem(req.body?.name);

    if (!medicationName) {
        return res.status(400).json({ error: 'name obrigatorio' });
    }

    const medicacoes = readMedicacoes();
    const existingMedication = medicacoes.find((item) => item.localeCompare(medicationName, 'pt-BR', { sensitivity: 'base' }) === 0);

    if (existingMedication) {
        return res.status(409).json({
            error: 'Medicacao ja cadastrada.',
            item: existingMedication,
            items: medicacoes,
        });
    }

    medicacoes.push(medicationName);
    writeMedicacoes(medicacoes);

    return res.status(201).json({
        item: medicationName,
        items: readMedicacoes(),
    });
});

app.delete('/api/medicacoes/:medicationName', (req, res) => {
    const medicationName = normalizeCatalogItem(req.params.medicationName);

    if (!medicationName) {
        return res.status(400).json({ error: 'medicationName obrigatorio' });
    }

    const medicacoes = readMedicacoes();
    const medicationIndex = medicacoes.findIndex((item) => item.localeCompare(medicationName, 'pt-BR', { sensitivity: 'base' }) === 0);

    if (medicationIndex === -1) {
        return res.status(404).json({ error: 'Medicacao nao encontrada.' });
    }

    const [removedMedication] = medicacoes.splice(medicationIndex, 1);
    writeMedicacoes(medicacoes);

    return res.json({
        item: removedMedication,
        items: readMedicacoes(),
    });
});

app.get('/api/tipos-uso', (req, res) => {
    return res.json({
        items: readTiposUso(),
    });
});

app.post('/api/tipos-uso', (req, res) => {
    const usageTypeName = normalizeCatalogItem(req.body?.name);

    if (!usageTypeName) {
        return res.status(400).json({ error: 'name obrigatorio' });
    }

    const tiposUso = readTiposUso();
    const existingUsageType = tiposUso.find((item) => item.localeCompare(usageTypeName, 'pt-BR', { sensitivity: 'base' }) === 0);

    if (existingUsageType) {
        return res.status(409).json({
            error: 'Tipo de uso ja cadastrado.',
            item: existingUsageType,
            items: tiposUso,
        });
    }

    tiposUso.push(usageTypeName);
    writeTiposUso(tiposUso);

    return res.status(201).json({
        item: usageTypeName,
        items: readTiposUso(),
    });
});

app.delete('/api/tipos-uso/:usageTypeName', (req, res) => {
    const usageTypeName = normalizeCatalogItem(req.params.usageTypeName);

    if (!usageTypeName) {
        return res.status(400).json({ error: 'usageTypeName obrigatorio' });
    }

    const tiposUso = readTiposUso();
    const usageTypeIndex = tiposUso.findIndex((item) => item.localeCompare(usageTypeName, 'pt-BR', { sensitivity: 'base' }) === 0);

    if (usageTypeIndex === -1) {
        return res.status(404).json({ error: 'Tipo de uso nao encontrado.' });
    }

    const [removedUsageType] = tiposUso.splice(usageTypeIndex, 1);
    writeTiposUso(tiposUso);

    return res.json({
        item: removedUsageType,
        items: readTiposUso(),
    });
});

app.get('/api/dosagens', (req, res) => {
    return res.json({
        items: readDosagens(),
    });
});

app.post('/api/dosagens', (req, res) => {
    const dosageName = normalizeCatalogItem(req.body?.name);

    if (!dosageName) {
        return res.status(400).json({ error: 'name obrigatorio' });
    }

    const dosagens = readDosagens();
    const existingDosage = dosagens.find((item) => item.localeCompare(dosageName, 'pt-BR', { sensitivity: 'base' }) === 0);

    if (existingDosage) {
        return res.status(409).json({
            error: 'Dosagem ja cadastrada.',
            item: existingDosage,
            items: dosagens,
        });
    }

    dosagens.push(dosageName);
    writeDosagens(dosagens);

    return res.status(201).json({
        item: dosageName,
        items: readDosagens(),
    });
});

app.delete('/api/dosagens/:dosageName', (req, res) => {
    const dosageName = normalizeCatalogItem(req.params.dosageName);

    if (!dosageName) {
        return res.status(400).json({ error: 'dosageName obrigatorio' });
    }

    const dosagens = readDosagens();
    const dosageIndex = dosagens.findIndex((item) => item.localeCompare(dosageName, 'pt-BR', { sensitivity: 'base' }) === 0);

    if (dosageIndex === -1) {
        return res.status(404).json({ error: 'Dosagem nao encontrada.' });
    }

    const [removedDosage] = dosagens.splice(dosageIndex, 1);
    writeDosagens(dosagens);

    return res.json({
        item: removedDosage,
        items: readDosagens(),
    });
});

app.get('/api/administracoes', (req, res) => {
    return res.json({
        items: readAdministracoes(),
    });
});

app.post('/api/administracoes', (req, res) => {
    const administrationName = normalizeCatalogItem(req.body?.name);

    if (!administrationName) {
        return res.status(400).json({ error: 'name obrigatorio' });
    }

    const administracoes = readAdministracoes();
    const existingAdministration = administracoes.find((item) => item.localeCompare(administrationName, 'pt-BR', { sensitivity: 'base' }) === 0);

    if (existingAdministration) {
        return res.status(409).json({
            error: 'Administracao ja cadastrada.',
            item: existingAdministration,
            items: administracoes,
        });
    }

    administracoes.push(administrationName);
    writeAdministracoes(administracoes);

    return res.status(201).json({
        item: administrationName,
        items: readAdministracoes(),
    });
});

app.delete('/api/administracoes/:administrationName', (req, res) => {
    const administrationName = normalizeCatalogItem(req.params.administrationName);

    if (!administrationName) {
        return res.status(400).json({ error: 'administrationName obrigatorio' });
    }

    const administracoes = readAdministracoes();
    const administrationIndex = administracoes.findIndex((item) => item.localeCompare(administrationName, 'pt-BR', { sensitivity: 'base' }) === 0);

    if (administrationIndex === -1) {
        return res.status(404).json({ error: 'Administracao nao encontrada.' });
    }

    const [removedAdministration] = administracoes.splice(administrationIndex, 1);
    writeAdministracoes(administracoes);

    return res.json({
        item: removedAdministration,
        items: readAdministracoes(),
    });
});

app.post('/api/prontuarios/:patientId/receita-pdf', async (req, res) => {
    const patientId = String(req.params.patientId || '').trim();
    const patientName = typeof req.body?.patientName === 'string' ? req.body.patientName.trim() : '';
    const patientAddress = typeof req.body?.patientAddress === 'string' ? req.body.patientAddress.trim() : '';
    const patientNumber = typeof req.body?.patientNumber === 'string' ? req.body.patientNumber.trim() : '';
    const patientComplemento = typeof req.body?.patientComplemento === 'string' ? req.body.patientComplemento.trim() : '';
    const patientBairro = typeof req.body?.patientBairro === 'string' ? req.body.patientBairro.trim() : '';
    const patientCidade = typeof req.body?.patientCidade === 'string' ? req.body.patientCidade.trim() : '';
    const patientUf = typeof req.body?.patientUf === 'string' ? req.body.patientUf.trim() : '';
    const patientCep = typeof req.body?.patientCep === 'string' ? req.body.patientCep.trim() : '';
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : '';

    if (!patientId) {
        return res.status(400).json({ error: 'patientId obrigatorio' });
    }

    if (!patientName) {
        return res.status(400).json({ error: 'patientName obrigatorio' });
    }

    try {
        const result = await generateReceitaPdf(
            patientId,
            patientName,
            patientAddress,
            patientNumber,
            patientComplemento,
            patientBairro,
            patientCidade,
            patientUf,
            patientCep,
            notes
        );
        return res.json(result);
    } catch (error) {
        console.error('Erro ao gerar receita PDF:', error);
        return res.status(500).json({
            error: 'Falha ao gerar a receita PDF.',
            details: error.message,
        });
    }
});

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
    ODONTONIL - SISTEMA ONLINE (MODO REDE)
    ==================================================
    ACESSO NO COMPUTADOR:
       http://localhost:${port}

    ACESSO NO CELULAR (OPCOES):`);

    if (ips.length === 0) {
        console.log('       [Nenhum IP de rede detectado]');
    } else {
        ips.forEach((ip) => {
            console.log(`       http://${ip.address}:${port}  (${ip.name})`);
        });
    }

    console.log(`
    ==================================================
    DICA: Se estiver no Wi-Fi, use o IP "192.168.x.x".
    Certifique-se de que o celular e o PC estao
    conectados na mesma rede Wi-Fi.
    ==================================================
    `);

    open(`http://localhost:${port}`);
});
