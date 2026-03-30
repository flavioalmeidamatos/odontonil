/**
 * Odontonil - Supabase Client
 * Gerenciamento centralizado de dados de pacientes via Supabase
 */

const SUPABASE_URL = 'https://bwxerrewhylsadfnehxa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3eGVycmV3aHlsc2FkZm5laHhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTA0MDIsImV4cCI6MjA5MDQ2NjQwMn0.150B71cGTjunWYT2HsIBo4puJdbljcj185xUfRfA2bU';
const STORAGE_KEY = 'odontonilPatients';
const REALTIME_CHANNEL_NAME = 'odontonil-pacientes-sync';

let realtimeClient = null;
let realtimeChannel = null;
let realtimeReloadTimeoutId = null;

function readCachedPatients() {
  try {
    const cachedPatients = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return cachedPatients.map((patient) => ({
      ...patient,
      id: formatPatientId(patient.id),
      name: normalizePatientName(patient.name),
    }));
  } catch {
    return [];
  }
}

function writeCachedPatients(patients) {
  const normalizedPatients = patients.map((patient) => ({
    ...patient,
    id: formatPatientId(patient.id),
    name: normalizePatientName(patient.name),
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedPatients));
}

function normalizePatientName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function formatPatientId(patientId) {
  const normalizedId = String(patientId || '').trim();
  return normalizedId || 'Nao informado';
}

function setSyncState(source, errorMessage = '') {
  window.odontonilSyncState = {
    source,
    errorMessage,
    updatedAt: new Date().toISOString(),
  };
}

function markLocalMutation() {
  window.odontonilLastLocalMutationAt = Date.now();
}

function shouldSkipRealtimeReload() {
  if (window.odontonilDisableRealtimeReload) {
    return true;
  }

  const lastLocalMutationAt = window.odontonilLastLocalMutationAt || 0;
  return Date.now() - lastLocalMutationAt < 2000;
}

function scheduleRealtimeReload(delayMs = 350) {
  if (shouldSkipRealtimeReload()) {
    return;
  }

  clearTimeout(realtimeReloadTimeoutId);
  realtimeReloadTimeoutId = window.setTimeout(() => {
    if (shouldSkipRealtimeReload()) {
      return;
    }

    window.location.reload();
  }, delayMs);
}

function getRealtimeClient() {
  if (realtimeClient) {
    return realtimeClient;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.warn('Supabase Realtime indisponivel: SDK nao carregado na pagina.');
    return null;
  }

  realtimeClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return realtimeClient;
}

function subscribeToPacientesRealtime(options = {}) {
  const {
    reload = false,
    delayMs = 350,
    onChange = null,
  } = options;

  const client = getRealtimeClient();
  if (!client) {
    return null;
  }

  if (!realtimeChannel) {
    realtimeChannel = client
      .channel(REALTIME_CHANNEL_NAME)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pacientes',
        },
        (payload) => {
          window.odontonilLastRealtimeEvent = payload;

          if (typeof onChange === 'function') {
            onChange(payload);
          }

          if (reload) {
            scheduleRealtimeReload(delayMs);
          }
        }
      )
      .subscribe((status) => {
        window.odontonilRealtimeStatus = status;
      });
  }

  return realtimeChannel;
}

/**
 * Faz requisicao autenticada a API REST do Supabase
 */
async function supabaseRequest(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Prefer: options.prefer || 'return=representation',
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
 * Mapeia objeto local para o formato da tabela Supabase
 */
function toSupabase(patient) {
  return {
    id: formatPatientId(patient.id),
    nome: normalizePatientName(patient.name),
    data_nascimento: patient.birthDate || null,
    cep: patient.cep || null,
    endereco: patient.endereco || null,
    numero: patient.numero || null,
    bairro: patient.bairro || null,
    cidade: patient.cidade || null,
    uf: patient.uf || null,
    complemento: patient.complemento || null,
    foto: patient.photo || null,
    atualizado_em: new Date().toISOString(),
  };
}

/**
 * Mapeia objeto do Supabase para o formato local
 */
function fromSupabase(row) {
  return {
    id: formatPatientId(row.id),
    name: normalizePatientName(row.nome),
    birthDate: row.data_nascimento || '',
    cep: row.cep || '',
    endereco: row.endereco || '',
    numero: row.numero || '',
    bairro: row.bairro || '',
    cidade: row.cidade || '',
    uf: row.uf || '',
    complemento: row.complemento || '',
    photo: row.foto || '',
    createdAt: row.criado_em || '',
    updatedAt: row.atualizado_em,
  };
}

/**
 * Busca todos os pacientes do Supabase. Se o banco falhar, usa apenas o cache ja existente.
 */
async function getPacientes() {
  try {
    const rows = await supabaseRequest('pacientes?order=criado_em.desc');
    const patients = rows.map(fromSupabase);
    writeCachedPatients(patients);
    setSyncState('remote');
    return patients;
  } catch (error) {
    console.warn('Supabase indisponivel, usando cache local:', error.message);
    setSyncState('cache', error.message);
    return readCachedPatients();
  }
}

async function getPatients() {
  return getPacientes();
}

/**
 * Salva ou atualiza um paciente no Supabase.
 * Se a chamada falhar, a operacao nao fica mascarada como salva localmente.
 */
async function salvarPacienteSupabase(patient) {
  const payload = toSupabase(patient);

  await supabaseRequest('pacientes', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload),
  });

  const cached = readCachedPatients();
  const existingIndex = cached.findIndex((item) => item.id === patient.id);
  if (existingIndex >= 0) {
    cached[existingIndex] = patient;
  } else {
    cached.unshift(patient);
  }

  writeCachedPatients(cached);
  setSyncState('remote');
  markLocalMutation();
  return true;
}

/**
 * Exclui um paciente do Supabase.
 */
async function excluirPacienteSupabase(patientId) {
  await supabaseRequest(`pacientes?id=eq.${encodeURIComponent(patientId)}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
    headers: { Prefer: 'return=minimal' },
  });

  const cached = readCachedPatients();
  writeCachedPatients(cached.filter((patient) => patient.id !== patientId));
  setSyncState('remote');
  markLocalMutation();
  return true;
}
