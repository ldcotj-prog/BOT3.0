// storage.js — Sessões em memória com namespace por bot
// Chave: "botId:telefone" → garante que cada bot tem sessão separada

const sessions = new Map();

// ──────────────────────────────────────────────────────────────
// ETAPAS DO FLUXO
// ──────────────────────────────────────────────────────────────
const E = {
  // ── Gerais (todos os bots) ──────────────────────────────────
  INICIO:           'inicio',
  AGUARDA_NOME:     'aguarda_nome',
  AGUARDA_CIDADE:   'aguarda_cidade',
  MENU:             'menu',
  LIVRE:            'livre',

  // ── Pagamento ───────────────────────────────────────────────
  AGUARDA_PIX:      'aguarda_pix',      // aguardando comprovante
  PIX_ENVIADO:      'pix_enviado',      // comprovante recebido, aguarda confirmação manual

  // ── Concursos ───────────────────────────────────────────────
  CONCURSO:         'concurso',         // escolhe paracatu ou buritis
  P_AREA:           'p_area',           // menu inicial paracatu
  P_CARGO:          'p_cargo',          // seleção de área → cargo
  P_APOSTILA:       'p_apostila',       // detalhes + confirma compra
  P_COMBO:          'p_combo',          // apresentação e confirmação do combo
  B_AREA:           'b_area',           // menu inicial buritis
  B_CARGO:          'b_cargo',          // seleção de área → cargo
  B_APOSTILA:       'b_apostila',       // detalhes + confirma compra
  B_COMBO:          'b_combo',          // apresentação e confirmação do combo

  // ── Vestibular ──────────────────────────────────────────────
  V_CURSO:          'v_curso',
  V_INTERESSE:      'v_interesse',
  V_AGENDAMENTO:    'v_agendamento',

  // ── Informática ─────────────────────────────────────────────
  I_MODALIDADE:     'i_modalidade',
  I_DETALHES:       'i_detalhes',

  // ── Cursos Online ────────────────────────────────────────────
  O_CATALOGO:       'o_catalogo',
  O_DETALHES:       'o_detalhes',
};

// ──────────────────────────────────────────────────────────────
// SESSÃO INICIAL PADRÃO
// ──────────────────────────────────────────────────────────────
function sessaoInicial(botId) {
  return {
    botId,
    etapa:    E.INICIO,
    nome:     null,
    cidade:   null,
    areaId:   null,
    pedido:   null,     // { produto, valor, tipo, driveId }
    humano:   false,    // true = bot pausado, atendente assumiu
    hist:     [],       // histórico para IA (conversa livre)
    _int:     null,     // intenção pendente (demanda antes do nome)
    _mod:     null,     // modalidade de informática selecionada
    _opcao:   null,     // opção de vestibular selecionada
    _cursoId: null,     // curso online selecionado
    ts:       Date.now(),
  };
}

// ──────────────────────────────────────────────────────────────
// CRUD DE SESSÕES
// ──────────────────────────────────────────────────────────────
function key(botId, tel) { return `${botId}:${tel}`; }

function getSession(botId, tel) {
  const k = key(botId, tel);
  if (!sessions.has(k)) sessions.set(k, sessaoInicial(botId));
  return sessions.get(k);
}

function set(botId, tel, obj) {
  const s = getSession(botId, tel);
  Object.assign(s, obj, { ts: Date.now() });
}

function reset(botId, tel) {
  sessions.delete(key(botId, tel));
}

// ──────────────────────────────────────────────────────────────
// HELPERS DE ESTADO
// ──────────────────────────────────────────────────────────────
function aguardandoPagamento(etapa) {
  return etapa === E.AGUARDA_PIX || etapa === E.PIX_ENVIADO;
}

function emFluxoConcurso(etapa) {
  return [E.CONCURSO, E.P_AREA, E.P_CARGO, E.P_APOSTILA, E.P_COMBO,
          E.B_AREA, E.B_CARGO, E.B_APOSTILA, E.B_COMBO].includes(etapa);
}

function emOnboarding(etapa) {
  return [E.INICIO, E.AGUARDA_NOME, E.AGUARDA_CIDADE].includes(etapa);
}

// ──────────────────────────────────────────────────────────────
// LIMPEZA AUTOMÁTICA — sessões > 48h
// ──────────────────────────────────────────────────────────────
setInterval(() => {
  const lim = Date.now() - 172800000;
  let removidas = 0;
  for (const [k, s] of sessions) {
    if (s.ts < lim) { sessions.delete(k); removidas++; }
  }
  if (removidas > 0) console.log(`[STORAGE] 🧹 ${removidas} sessão(ões) expirada(s) removida(s)`);
}, 3600000);

// ──────────────────────────────────────────────────────────────
// DEBUG — lista sessões ativas
// ──────────────────────────────────────────────────────────────
function listarAtivas() {
  const agora = Date.now();
  const ativas = [];
  for (const [k, s] of sessions) {
    ativas.push({
      chave:          k,
      etapa:          s.etapa,
      nome:           s.nome,
      humano:         s.humano,
      temPedido:      !!s.pedido,
      minutosInativos: Math.round((agora - s.ts) / 60000),
    });
  }
  return ativas;
}

module.exports = { E, getSession, set, reset, aguardandoPagamento, emFluxoConcurso, emOnboarding, listarAtivas };
