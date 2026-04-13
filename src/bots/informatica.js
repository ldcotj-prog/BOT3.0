// bots/informatica.js — Bot Cursos de Informática
'use strict';

const zapi = require('../zapi');
const ia   = require('../ia');
const cfg  = require('../config');
const rmk  = require('../remarketing');
const { E, getSession, set, reset } = require('../storage');

const BOT  = 'informatica';
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const fmt  = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;

function saudacao() {
  const h = parseInt(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }));
  return h >= 5 && h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function ehNome(txt) {
  const t = txt.trim();
  if (t.length < 2 || t.length > 25 || t.split(' ').length > 3) return false;
  if (/\d/.test(t) || /[?!,.]/.test(t) || !/^[A-ZÀ-Ú]/i.test(t)) return false;
  const neg = ['informática','computador','curso','quero','preciso','preço','valor',
    'quanto','como','quando','onde','oi','olá','ola','sim','não','ok','excel','word'];
  return !neg.some(w => t.toLowerCase().includes(w));
}

function nomeFmt(txt) {
  return txt.trim().split(' ').slice(0, 2)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

function boasVindas() {
  return `${saudacao()}! 👋 Bem-vindo(a) ao *JARVIS — Smart Cursos Unaí*! 🤖\n\nSou especialista em cursos de informática. Vou te ajudar a dominar a tecnologia! 💻\n\nComo posso te chamar?`;
}

function menuPrincipal(nome) {
  return `O que você precisa, *${nome}*? 😊\n\n*1️⃣* 🏫 *Informática Presencial* — 9 meses\n*2️⃣* 🏢 *Informática Empresarial* — 3 meses\n*3️⃣* 🌐 *Informática Online* — no seu ritmo\n*4️⃣* 🤔 Não sei qual escolher\n*5️⃣* 💬 Tenho uma dúvida\n*6️⃣* 👤 Falar com atendente\n\n_Digite o número_ 👇`;
}

async function processar(tel, dados) {
  const s = getSession(BOT, tel);
  const txt = (dados.tipo === 'texto' ? dados.conteudo : dados.caption || '').trim();
  const low = txt.toLowerCase();

  rmk.cancelar(BOT, tel);

  if (['menu','inicio','voltar','home'].includes(low)) {
    set(BOT, tel, { etapa: E.MENU });
    await zapi.texto(BOT, tel, s.nome ? menuPrincipal(s.nome) : boasVindas());
    rmk.agendar(BOT, tel);
    return;
  }
  if (['oi','olá','ola','oii','hey'].includes(low) && (!s.nome || s.etapa === E.INICIO)) {
    reset(BOT, tel); set(BOT, tel, { etapa: E.AGUARDA_NOME });
    await zapi.texto(BOT, tel, boasVindas());
    rmk.agendar(BOT, tel);
    return;
  }

  switch (s.etapa) {
    case E.INICIO:       set(BOT, tel, { etapa: E.AGUARDA_NOME }); await zapi.texto(BOT, tel, boasVindas()); break;
    case E.AGUARDA_NOME: await fNome(tel, txt, s); break;
    case E.AGUARDA_CIDADE: await fCidade(tel, txt, s); break;
    case E.MENU:         await fMenu(tel, txt, s); break;
    case E.I_MODALIDADE: await fModalidade(tel, txt, s); break;
    case E.I_DETALHES:   await fDetalhes(tel, txt, s); break;
    case E.LIVRE:        await fLivre(tel, txt, s); break;
    default: reset(BOT, tel); set(BOT, tel, { etapa: E.AGUARDA_NOME }); await zapi.texto(BOT, tel, boasVindas());
  }
  rmk.agendar(BOT, tel);
}

async function fNome(tel, txt, s) {
  if (ehNome(txt)) {
    set(BOT, tel, { nome: nomeFmt(txt), etapa: E.AGUARDA_CIDADE });
    await zapi.texto(BOT, tel, `Prazer, *${nomeFmt(txt)}*! 😊\n\nDe qual cidade você é?`);
  } else {
    set(BOT, tel, { etapa: E.AGUARDA_NOME });
    await zapi.texto(BOT, tel, `Como posso te chamar?\n_(Digite só seu primeiro nome)_ 😊`);
  }
}

async function fCidade(tel, txt, s) {
  set(BOT, tel, { cidade: nomeFmt(txt), etapa: E.MENU });
  await zapi.texto(BOT, tel, `Ótimo! 😊`);
  await wait(400);
  await zapi.texto(BOT, tel, menuPrincipal(s.nome));
}

async function fMenu(tel, txt, s) {
  const mods = cfg.informatica.modalidades;
  if (['1','2','3'].includes(txt)) {
    const mod = mods[parseInt(txt) - 1];
    set(BOT, tel, { etapa: E.I_DETALHES, _mod: mod.id });
    await apresentarModalidade(tel, mod, s.nome);
    return;
  }
  if (txt === '4') {
    set(BOT, tel, { etapa: E.LIVRE });
    await zapi.texto(BOT, tel,
      `Me conta um pouco sobre você! 😊\n\nVocê quer a informática para:\n\n*1* Uso pessoal / dia a dia\n*2* Trabalho / empresa\n*3* Concurso público\n*4* Não tenho conhecimento nenhum`
    );
    set(BOT, tel, { etapa: E.I_MODALIDADE });
    return;
  }
  if (txt === '5') { set(BOT, tel, { etapa: E.LIVRE }); await zapi.texto(BOT, tel, `Pode perguntar! 😊`); return; }
  if (txt === '6') { set(BOT, tel, { etapa: E.LIVRE }); await zapi.texto(BOT, tel, `Certo! Vou avisar nossa equipe. 😊`); await zapi.notificar(BOT, tel, 'Pediu atendente — Informática', { nome: s.nome }); return; }
  await fLivre(tel, txt, s);
}

async function apresentarModalidade(tel, mod, nome) {
  await zapi.texto(BOT, tel,
    `${mod.titulo}\n\n📋 *${mod.duracao}*\n\n📚 *Conteúdo:*\n${mod.conteudo}\n\n💰 *Investimento:*\n• Cartão: ${mod.preco.cartao}\n• À vista: ${mod.preco.avista}\n\n*1️⃣* ✅ Quero me matricular\n*2️⃣* 📅 Agendar visita\n*3️⃣* ❓ Tenho dúvidas\n*0️⃣* ← Voltar`
  );
}

async function fModalidade(tel, txt, s) {
  const sugestoes = {
    '1': 'presencial',
    '2': 'empresarial',
    '3': 'presencial',
    '4': 'presencial',
  };
  const idSugerido = sugestoes[txt] || 'presencial';
  const mod = cfg.informatica.modalidades.find(m => m.id === idSugerido);
  if (mod) {
    set(BOT, tel, { etapa: E.I_DETALHES, _mod: mod.id });
    await zapi.texto(BOT, tel, `Para o seu perfil, recomendo o *${mod.titulo}*! 😊`);
    await wait(800);
    await apresentarModalidade(tel, mod, s.nome);
  } else {
    await fLivre(tel, txt, s);
  }
}

async function fDetalhes(tel, txt, s) {
  if (txt === '0') { set(BOT, tel, { etapa: E.MENU }); await zapi.texto(BOT, tel, menuPrincipal(s.nome)); return; }
  if (txt === '1') {
    set(BOT, tel, { etapa: E.LIVRE });
    await zapi.texto(BOT, tel, `Ótimo, *${s.nome}*! 🎉\n\nVou avisar nossa equipe pra fechar sua matrícula! 😊\n_Seg-Sex 8h-18h_`);
    const mod = cfg.informatica.modalidades.find(m => m.id === s._mod);
    await zapi.notificar(BOT, tel, `✅ MATRÍCULA — ${mod?.titulo || 'Informática'}`, { nome: s.nome });
    return;
  }
  if (txt === '2') {
    set(BOT, tel, { etapa: E.V_AGENDAMENTO });
    await zapi.texto(BOT, tel, `📅 Qual dia e horário você pode visitar?\n_Seg-Sex 8h-18h | Sáb 8h-12h_ 😊`);
    return;
  }
  if (txt === '3') { set(BOT, tel, { etapa: E.LIVRE }); await zapi.texto(BOT, tel, `Pode perguntar! 😊`); return; }
  await fLivre(tel, txt, s);
}

async function fLivre(tel, txt, s) {
  const h = s.hist || [];
  h.push({ role: 'user', content: txt });
  const resp = await ia.responder(BOT, txt, h);
  h.push({ role: 'assistant', content: resp });
  set(BOT, tel, { hist: h.slice(-10), etapa: E.LIVRE });
  await zapi.texto(BOT, tel, resp);
  await wait(400);
  await zapi.texto(BOT, tel, `_Digite *menu* pra ver as opções!_ 😊`);
}

module.exports = { processar };
