// zapi.js — Z-API com suporte multi-instância
const axios   = require('axios');
const cfg     = require('./config');
const tracker = require('./tracker'); // rastreamento anti-autopause

const BOT_NOTIF = () => cfg.BOTS.concursos.instanceId ? 'concursos' : Object.keys(cfg.BOTS)[0];

// ── Envia texto para um cliente ───────────────────────────────────────
async function texto(botId, tel, msg) {
  if (!msg || !tel || !botId) return;
  // Marca ANTES do envio — garante que fromMe seja ignorado
  tracker.marcar(botId, tel);
  try {
    await axios.post(
      `${cfg.zapiUrl(botId)}/send-text`,
      { phone: String(tel), message: String(msg) },
      { headers: cfg.zapiHeaders(botId) }
    );
    console.log(`[ZAPI:${botId}] ✅ → ${tel}`);
  } catch (e) {
    console.error(`[ZAPI:${botId}] ❌`, e.response?.data || e.message);
  }
}

// ── Envia link de apostila (Google Drive) ─────────────────────────────
async function apostila(botId, tel, driveId, titulo, nome) {
  const url = cfg.driveLink(driveId);
  await texto(botId, tel,
    `📄 *${titulo}*\n\n📥 Acesse sua apostila:\n${url}\n\nBons estudos, *${nome || 'aluno(a)'}*! 🎓\n_Smart Cursos Unaí_`
  );
}

// ── Notificação direta ao atendente (38999313182) ─────────────────────
async function notificarAtendente(msg) {
  const bot = BOT_NOTIF();
  tracker.marcar(bot, cfg.atendente);
  try {
    await axios.post(
      `${cfg.zapiUrl(bot)}/send-text`,
      { phone: String(cfg.atendente), message: String(msg) },
      { headers: cfg.zapiHeaders(bot) }
    );
    console.log(`[ZAPI] 🔔 Notificação → ${cfg.atendente}`);
  } catch (e) {
    console.error('[ZAPI] notificarAtendente ERR:', e.response?.data || e.message);
  }
}

// ── Notifica lead ao atendente ────────────────────────────────────────
async function notificar(botId, tel, origem, extra) {
  const hora = new Date().toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
  });
  const msg =
`🔔 *LEAD — ${(cfg.BOTS[botId]?.nome || botId).toUpperCase()}*

👤 *${extra?.nome || 'não informado'}*
📱 ${tel}
📍 ${origem}
🕐 ${hora}

_Clique no número pra responder!_ 👆`;
  await notificarAtendente(msg);
}

// ── Comprovante para confirmação manual ───────────────────────────────
async function comprovante(botId, tel, nome, produto, imgUrl) {
  const msg =
`📨 *COMPROVANTE PARA CONFIRMAR*

👤 *${nome || '?'}*
📱 ${tel}
🛒 ${produto}

✅ CONFIRMAR ${botId} ${tel}
❌ RECUSAR  ${botId} ${tel}`;
  await notificarAtendente(msg);
  if (imgUrl) {
    const bot = BOT_NOTIF();
    tracker.marcar(bot, cfg.atendente);
    try {
      await axios.post(`${cfg.zapiUrl(bot)}/send-image`,
        { phone: String(cfg.atendente), image: imgUrl, caption: `Comprovante de ${nome || tel}` },
        { headers: cfg.zapiHeaders(bot) }
      ).catch(() => {});
    } catch {}
  }
}

module.exports = { texto, apostila, notificar, notificarAtendente, comprovante };
