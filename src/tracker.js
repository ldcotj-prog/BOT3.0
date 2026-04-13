// tracker.js — Rastreia mensagens enviadas pelo bot via API
// Importado tanto pelo zapi.js (para marcar) quanto pelo index.js (para verificar)
// Node.js garante que ambos compartilham a MESMA instância do Map

const enviados = new Map(); // "botId:tel" → timestamp do último envio

// Chamado pelo zapi.js ANTES de cada axios.post
function marcar(botId, tel) {
  const k = `${botId}:${String(tel)}`;
  enviados.set(k, Date.now());
  // Limpa após 20 segundos para não acumular memória
  setTimeout(() => {
    const ts = enviados.get(k);
    if (ts && (Date.now() - ts) > 18000) enviados.delete(k);
  }, 20000);
}

// Chamado pelo index.js ao receber fromMe — retorna true se foi o BOT que enviou
function foiBot(botId, tel) {
  const ts = enviados.get(`${botId}:${String(tel)}`);
  return !!(ts && (Date.now() - ts) < 10000);
}

module.exports = { marcar, foiBot };
