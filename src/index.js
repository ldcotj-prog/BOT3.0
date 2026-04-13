// index.js — Servidor Multi-Bot JARVIS v5.2
require('dotenv').config();
const express = require('express');
const path    = require('path');
const cfg     = require('./config');
const tracker = require('./tracker'); // MESMO módulo importado pelo zapi.js
const { set, getSession } = require('./storage');

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

app.get('/',         (_, r) => r.redirect('/produtos'));
app.get('/produtos', (_, r) => r.sendFile(path.join(__dirname, 'landing.html')));
app.get('/health',   (_, r) => r.json({ ok: true, v: '5.2', bots: Object.keys(BOTS), ts: new Date().toISOString() }));

// ── Webhook por bot ───────────────────────────────────────────────────
app.post('/webhook/:botId', async (req, res) => {
  res.status(200).json({ ok: true });

  try {
    const botId = req.params.botId;
    const bot   = BOTS[botId];
    if (!bot) { console.warn(`[WH] botId desconhecido: ${botId}`); return; }

    const b = req.body;
    if (!b || b.isStatusReply) return;

    const tel = String(b.phone || '').replace(/\D/g, '');
    const txt = b.text?.message || b.message || '';

    console.log(`\n[${botId.toUpperCase()}] fromMe:${b.fromMe} | ${tel} | "${txt.slice(0, 60)}"`);

    // ── fromMe: mensagem saindo da instância ─────────────────────────
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

      // Foi o próprio BOT (via API) que enviou? → ignora, não pausa
      if (tel && tracker.foiBot(botId, tel)) {
        console.log(`[${botId}] 🤖 fromMe do bot ignorado → ${tel}`);
        return;
      }

      // Foi o ATENDENTE digitando manualmente → pausa o bot
      if (tel) {
        set(botId, tel, { humano: true });
        console.log(`[${botId}] 🤝 Atendente assumiu → ${tel}`);
      }
      return;
    }

    if (!tel) return;

    // ── PAUSAR / BOT ON via comando ──────────────────────────────────
    if (txt.toUpperCase().startsWith('PAUSAR ')) {
      const alvo = txt.split(' ')[1]?.trim().replace(/\D/g, '');
      if (alvo) { set(botId, alvo, { humano: true }); console.log(`[${botId}] 🔕 Pausado → ${alvo}`); }
      return;
    }

    // ── CONFIRMAR / RECUSAR pedido ───────────────────────────────────
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

    // ── Verifica se bot está pausado para esse número ────────────────
    const s = getSession(botId, tel);
    if (s.humano) {
      console.log(`[${botId}] 🔕 Ignorado (humano ativo) → ${tel}`);
      return;
    }

    // ── Extrai e processa ────────────────────────────────────────────
    const dados = extrair(b);
    if (!dados) return;

    // sec_pix_enviado: secretaria fica em silêncio total
    if (s.etapa === 'sec_pix_enviado' && dados.tipo === 'texto') {
      console.log(`[${botId}] ⏳ sec_pix_enviado → ${tel}`);
      return;
    }

    await bot.processar(tel, dados);

  } catch (e) {
    console.error('[ERR]', e.message, e.stack?.split('\n')[1]);
  }
});

// ── Webhook legado (/webhook → concursos) ────────────────────────────
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
    } else if (tel && !tracker.foiBot('concursos', tel)) {
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

// ── Extrai mensagem do payload Z-API ─────────────────────────────────
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
               || nome.includes('pix')  || nome.includes('pagamento');
    if (url) return { tipo: ehPdf ? 'comprovante_pdf' : 'documento', conteudo: url, caption: b.document.caption || '' };
    return null;
  }

  if (b.audio) return { tipo: 'texto', conteudo: '[áudio]' };
  return null;
}

// ── Servidor ─────────────────────────────────────────────────────────
app.listen(cfg.port, () => {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  🤖  JARVIS v5.2 Multi-Bot — Smart Cursos Unaí  ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Porta: ${cfg.port}                                      ║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  /webhook/concursos   → Bot Concursos            ║');
  console.log('║  /webhook/vestibular  → Bot Pré-Vestibular       ║');
  console.log('║  /webhook/informatica → Bot Informática          ║');
  console.log('║  /webhook/online      → Bot Cursos Online        ║');
  console.log('║  /webhook/secretaria  → Secretaria (principal)   ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  PAUSAR 5538X  → pausa | BOT ON 5538X → reativa ║');
  console.log('║  CONFIRMAR botId 5538X → confirma PIX manual     ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
});
