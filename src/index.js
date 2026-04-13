// index.js — Servidor Multi-Bot JARVIS v5.0
require('dotenv').config();
const express = require('express');
const path    = require('path');
const cfg     = require('./config');
const { set, getSession } = require('./storage');

// ────────────────────────────────────────────────────────────
// CORREÇÃO CRÍTICA: Anti-auto-pause
// O Z-API dispara fromMe:true para TODA mensagem enviada pela instância,
// incluindo as que o próprio bot envia via API.
// Sem esse tracker, o bot se pausa sozinho após cada mensagem que envia.
// ────────────────────────────────────────────────────────────
const botEnviouPara = new Map(); // "botId:tel" → timestamp

function marcarBotEnviou(botId, tel) {
  const k = `${botId}:${String(tel)}`;
  botEnviouPara.set(k, Date.now());
  setTimeout(() => botEnviouPara.delete(k), 15000); // TTL 15s
}

function botEnviouRecentemente(botId, tel) {
  const ts = botEnviouPara.get(`${botId}:${String(tel)}`);
  return !!(ts && (Date.now() - ts) < 12000);
}

// Expõe globalmente para o zapi.js registrar envios
global._marcarBotEnviou = marcarBotEnviou;

// ────────────────────────────────────────────────────────────
// BOTS
// ────────────────────────────────────────────────────────────
const botConcursos   = require('./bots/concursos');
const botVestibular  = require('./bots/vestibular');
const botInformatica = require('./bots/informatica');
const botOnline      = require('./bots/online');
const botSecretaria  = require('./bots/secretaria');

const BOTS = {
  concursos:   botConcursos,
  vestibular:  botVestibular,
  informatica: botInformatica,
  online:      botOnline,
  secretaria:  botSecretaria,
};

const app = express();
app.use(express.json({ limit: '10mb' }));

// ── Landing ───────────────────────────────────────────────────────────
app.get('/',        (_, r) => r.redirect('/produtos'));
app.get('/produtos',(_, r) => r.sendFile(path.join(__dirname, 'landing.html')));
app.get('/health',  (_, r) => r.json({ ok: true, bots: Object.keys(BOTS), ts: new Date().toISOString() }));

// ── Webhook por bot ───────────────────────────────────────────────────
app.post('/webhook/:botId', async (req, res) => {
  res.status(200).json({ ok: true }); // responde rápido para Z-API não reenviar

  try {
    const botId = req.params.botId;
    const bot   = BOTS[botId];
    if (!bot) { console.warn(`[WH] botId desconhecido: ${botId}`); return; }

    const b = req.body;
    if (!b || b.isStatusReply) return;

    const tel = String(b.phone || '').replace(/\D/g, '');
    const txt = b.text?.message || b.message || '';

    console.log(`\n[${botId.toUpperCase()}] fromMe:${b.fromMe} | ${tel} | "${txt.slice(0, 60)}"`);

    // ── Mensagem com fromMe:true ─────────────────────────────────────
    if (b.fromMe === true || b.fromMe === 'true') {

      // BOT ON — reativa o bot para um número
      if (txt.toUpperCase().startsWith('BOT ON ')) {
        const alvo = txt.split(' ')[2]?.trim().replace(/\D/g, '');
        if (alvo) {
          set(botId, alvo, { humano: false });
          console.log(`[${botId}] ✅ Bot reativado → ${alvo}`);
        }
        return;
      }

      // Se foi o próprio BOT que enviou (via API), ignora — não pausa
      if (tel && botEnviouRecentemente(botId, tel)) {
        console.log(`[${botId}] 🤖 fromMe ignorado (foi o próprio bot) → ${tel}`);
        return;
      }

      // Foi o ATENDENTE que enviou manualmente pelo WhatsApp — pausa o bot
      if (tel) {
        set(botId, tel, { humano: true });
        console.log(`[${botId}] 🤝 Bot pausado (atendente respondeu) → ${tel}`);
      }
      return;
    }

    if (!tel) return;

    // ── Comando PAUSAR (manual) ──────────────────────────────────────
    if (txt.toUpperCase().startsWith('PAUSAR ')) {
      const alvo = txt.split(' ')[1]?.trim().replace(/\D/g, '');
      if (alvo) { set(botId, alvo, { humano: true }); console.log(`[${botId}] 🔕 Pausado → ${alvo}`); }
      return;
    }

    // ── Comandos CONFIRMAR / RECUSAR ─────────────────────────────────
    if (txt.toUpperCase().startsWith('CONFIRMAR ') || txt.toUpperCase().startsWith('RECUSAR ')) {
      const partes = txt.trim().split(/\s+/);
      const acao   = partes[0].toUpperCase();
      const alvo   = (partes.length >= 3 ? partes[2] : partes[1])?.replace(/\D/g, '');
      const bAlvo  = partes.length >= 3 ? partes[1] : botId;
      if (alvo && BOTS[bAlvo]) {
        const sAlvo = getSession(bAlvo, alvo);
        if (acao === 'CONFIRMAR' && sAlvo.pedido) {
          if (BOTS[bAlvo].confirmarPedido) await BOTS[bAlvo].confirmarPedido(alvo, sAlvo);
          console.log(`[${bAlvo}] ✅ Pedido confirmado → ${alvo}`);
        } else if (acao === 'RECUSAR') {
          set(bAlvo, alvo, { etapa: 'aguarda_pix' });
          if (BOTS[bAlvo].recusarPedido) await BOTS[bAlvo].recusarPedido(alvo, sAlvo);
          console.log(`[${bAlvo}] ❌ Pedido recusado → ${alvo}`);
        }
      }
      return;
    }

    // ── Bot pausado para este número ─────────────────────────────────
    const s = getSession(botId, tel);
    if (s.humano) {
      console.log(`[${botId}] 🔕 Ignorado (humano ativo) → ${tel}`);
      return;
    }

    // ── PIX_ENVIADO — aguarda confirmação manual ─────────────────────
    const dados = extrair(b);
    if (!dados) return;

    if (s.etapa === 'sec_pix_enviado' && dados.tipo === 'texto') {
      console.log(`[${botId}] ⏳ PIX_ENVIADO — aguardando confirmação → ${tel}`);
      return;
    }

    // ── Processa ─────────────────────────────────────────────────────
    await bot.processar(tel, dados);

  } catch (e) {
    console.error('[ERR]', e.message, e.stack?.split('\n')[1]);
  }
});

// ── Webhook legado (redireciona para concursos) ───────────────────────
app.post('/webhook', async (req, res) => {
  res.status(200).json({ ok: true });
  const b = req.body;
  if (!b || b.isStatusReply) return;
  const tel = String(b.phone || '').replace(/\D/g, '');
  const txt = b.text?.message || b.message || '';
  if (b.fromMe === true || b.fromMe === 'true') {
    if (txt.toUpperCase().startsWith('BOT ON ')) {
      const alvo = txt.split(' ')[2]?.trim().replace(/\D/g, '');
      if (alvo) set('concursos', alvo, { humano: false });
    } else if (tel && !botEnviouRecentemente('concursos', tel)) {
      set('concursos', tel, { humano: true });
    }
    return;
  }
  if (!tel) return;
  const s = getSession('concursos', tel);
  if (s.humano) return;
  const dados = extrair(b);
  if (!dados) return;
  await botConcursos.processar(tel, dados);
});

// ── Extrai dados da mensagem Z-API ────────────────────────────────────
function extrair(b) {
  if (b.text?.message) return { tipo: 'texto', conteudo: b.text.message };

  if (b.image) {
    const url = b.image.imageUrl || b.image.url || b.image.downloadUrl
             || b.image.mediaUrl || b.image.link || '';
    if (!url) { console.warn('[WH] imagem sem URL'); return null; }
    return { tipo: 'imagem', conteudo: url, caption: b.image.caption || '' };
  }

  if (b.document) {
    const url  = b.document.documentUrl || b.document.url
              || b.document.downloadUrl || b.document.mediaUrl || '';
    const nome = (b.document.fileName || b.document.name || '').toLowerCase();
    const ehPdf = nome.endsWith('.pdf') || nome.includes('comprovante')
               || nome.includes('pix') || nome.includes('pagamento');
    if (ehPdf && url) return { tipo: 'comprovante_pdf', conteudo: url, caption: b.document.caption || '' };
    // Qualquer documento quando estiver aguardando PIX → trata como comprovante
    if (url) return { tipo: 'documento', conteudo: url, caption: b.document.caption || '' };
    return null;
  }

  if (b.audio) return { tipo: 'texto', conteudo: '[áudio]' };
  return null;
}

// ── Servidor ─────────────────────────────────────────────────────────
app.listen(cfg.port, () => {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  🤖  JARVIS v5.1 Multi-Bot — Smart Cursos Unaí  ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Porta: ${cfg.port}                                      ║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  Webhooks Z-API:                                 ║');
  console.log('║  /webhook/concursos   → Bot Concursos            ║');
  console.log('║  /webhook/vestibular  → Bot Pré-Vestibular       ║');
  console.log('║  /webhook/informatica → Bot Informática          ║');
  console.log('║  /webhook/online      → Bot Cursos Online        ║');
  console.log('║  /webhook/secretaria  → Secretaria (principal)   ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  Comandos (envie pelo WhatsApp do bot):          ║');
  console.log('║  PAUSAR 5538XXXXX  → pausa para um número       ║');
  console.log('║  BOT ON 5538XXXXX  → reativa para um número     ║');
  console.log('║  CONFIRMAR concursos 5538XXXXX → confirma PIX   ║');
  console.log('║  RECUSAR  concursos 5538XXXXX  → recusa PIX     ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
});
