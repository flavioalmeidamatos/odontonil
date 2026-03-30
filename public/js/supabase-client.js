/**
 * Odontonil - Supabase Client
 * Gerenciamento centralizado de dados de pacientes via Supabase
 */

const SUPABASE_URL = 'https://bwxerrewhylsadfnehxa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3eGVycmV3aHlsc2FkZm5laHhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTA0MDIsImV4cCI6MjA5MDQ2NjQwMn0.150B71cGTjunWYT2HsIBo4puJdbljcj185xUfRfA2bU';
const STORAGE_KEY = 'odontonilPatients';

/**
 * Faz requisição autenticada à API REST do Supabase
 */
async function supabaseRequest(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': options.prefer || 'return=representation',
    ...options.headers,
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Supabase erro [${response.status}]: ${error}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

/**
 * Mapeia objeto local → formato da tabela Supabase
 */
function toSupabase(p) {
  return {
    id: p.id,
    nome: p.name,
    data_nascimento: p.birthDate || null,
    cep: p.cep || null,
    endereco: p.endereco || null,
    numero: p.numero || null,
    bairro: p.bairro || null,
    cidade: p.cidade || null,
    uf: p.uf || null,
    complemento: p.complemento || null,
    foto: p.photo || null,
    atualizado_em: new Date().toISOString(),
  };
}

/**
 * Mapeia objeto do Supabase → formato local
 */
function fromSupabase(row) {
  return {
    id: row.id,
    name: row.nome,
    birthDate: row.data_nascimento || '',
    cep: row.cep || '',
    endereco: row.endereco || '',
    numero: row.numero || '',
    bairro: row.bairro || '',
    cidade: row.cidade || '',
    uf: row.uf || '',
    complemento: row.complemento || '',
    photo: row.foto || '',
    updatedAt: row.atualizado_em,
  };
}

/**
 * Busca todos os pacientes do Supabase (com fallback para localStorage)
 */
async function getPacientes() {
  try {
    const rows = await supabaseRequest('pacientes?order=criado_em.desc');
    const patients = rows.map(fromSupabase);
    // Sincroniza cache local
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
    return patients;
  } catch (err) {
    console.warn('Supabase indisponível, usando cache local:', err.message);
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }
}

/**
 * Salva ou atualiza um paciente no Supabase
 */
async function salvarPacienteSupabase(patient) {
  const payload = toSupabase(patient);
  try {
    await supabaseRequest('pacientes', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(payload),
    });
    // Atualiza cache local
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const idx = cached.findIndex(p => p.id === patient.id);
    if (idx >= 0) cached[idx] = patient; else cached.unshift(patient);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    return true;
  } catch (err) {
    console.warn('Falha ao salvar no Supabase, salvando localmente:', err.message);
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const idx = cached.findIndex(p => p.id === patient.id);
    if (idx >= 0) cached[idx] = patient; else cached.unshift(patient);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    return false;
  }
}

/**
 * Exclui um paciente do Supabase
 */
async function excluirPacienteSupabase(patientId) {
  try {
    await supabaseRequest(`pacientes?id=eq.${encodeURIComponent(patientId)}`, {
      method: 'DELETE',
      prefer: 'return=minimal',
      headers: { 'Prefer': 'return=minimal' },
    });
    // Remove do cache local
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached.filter(p => p.id !== patientId)));
    return true;
  } catch (err) {
    console.warn('Falha ao excluir no Supabase:', err.message);
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached.filter(p => p.id !== patientId)));
    return false;
  }
}
