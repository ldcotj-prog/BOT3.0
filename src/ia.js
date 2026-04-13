// ia.js — Motor de IA por contexto de bot
const axios = require('axios');
const cfg   = require('./config');

// ─────────────────────────────────────────────────────────────
// PROMPTS POR BOT (bots especializados com fluxo fixo)
// ─────────────────────────────────────────────────────────────
const PROMPTS = {
  concursos: `Você é o JARVIS, assistente da Smart Cursos Unaí especializado em concursos públicos.
Apostilas Paracatu 2026: R$ 19,90/cargo | R$ 49,90 combo. Buritis/MG: mesmos preços.
REGRAS: NUNCA dê desconto, NUNCA peça CPF/email, NUNCA mencione envio por email. Máx 300 chars.`,

  vestibular: `Você é o JARVIS, assistente da Smart Cursos Unaí especializado em pré-vestibular e ENEM.
Pré-vestibular a partir de R$ 595,90/mês. Aulas presenciais + plataforma digital.
REGRAS: Foque no curso, NUNCA peça dados pessoais. Máx 300 chars.`,

  informatica: `Você é o JARVIS, assistente da Smart Cursos Unaí especializado em cursos de informática.
Presencial 9 meses (9x R$311,92), Empresarial 3 meses (10x R$99,79), Online (R$297,90).
REGRAS: Foque nos cursos, NUNCA peça dados pessoais. Máx 300 chars.`,

  online: `Você é o JARVIS, assistente da Smart Cursos Unaí especializado em cursos online.
Cursos: IA p/ Negócios R$397,90 | Aux. Adm. R$397,90 | Gestão R$297,90 | Química R$197,90 | Excel R$197,90 | Português R$197,90.
REGRAS: Foque nos cursos, NUNCA peça dados pessoais. Máx 300 chars.`,
};

// ─────────────────────────────────────────────────────────────
// responder — para bots especializados com prompt fixo
// ─────────────────────────────────────────────────────────────
async function responder(botId, pergunta, hist = []) {
  try {
    const msgs = [{ role: 'system', content: PROMPTS[botId] || PROMPTS.concursos }];
    for (const m of hist.slice(-6)) msgs.push({ role: m.role, content: m.content });
    msgs.push({ role: 'user', content: pergunta });

    const r = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      { model: 'gpt-3.5-turbo', max_tokens: 220, messages: msgs },
      { headers: { Authorization: `Bearer ${cfg.openai.key}`, 'Content-Type': 'application/json' } }
    );
    return r.data.choices[0].message.content;
  } catch (e) {
    console.error('[IA]', e.message);
    return 'Desculpe, tive um problema técnico. Pode repetir? 😊';
  }
}

// ─────────────────────────────────────────────────────────────
// responderCompleto — para a Secretaria (system prompt externo)
// Usa GPT-4o-mini para mais inteligência e contexto
// ─────────────────────────────────────────────────────────────
async function responderCompleto(systemPrompt, pergunta, hist = []) {
  try {
    const msgs = [{ role: 'system', content: systemPrompt }];
    for (const m of hist.slice(-12)) msgs.push({ role: m.role, content: m.content });
    msgs.push({ role: 'user', content: pergunta });

    const r = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',  // Mais inteligente para a secretaria
        max_tokens: 400,
        messages: msgs,
        temperature: 0.75,     // Um pouco mais criativo/humano
      },
      { headers: { Authorization: `Bearer ${cfg.openai.key}`, 'Content-Type': 'application/json' } }
    );
    return r.data.choices[0].message.content;
  } catch (e) {
    console.error('[IA-SECRETARIA]', e.message);
    return 'Desculpa o atraso! 😊 Pode repetir sua mensagem?';
  }
}

module.exports = { responder, responderCompleto };
