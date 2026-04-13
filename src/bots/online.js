// bots/online.js — Bot Cursos Online
'use strict';

const zapi = require('../zapi');
const ia   = require('../ia');
const cfg  = require('../config');
const rmk  = require('../remarketing');
const { E, getSession, set, reset } = require('../storage');

const BOT  = 'online';
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
  const neg = ['curso','quero','preciso','preço','valor','quanto','como','quando',
    'onde','oi','olá','ola','sim','não','ok','online','certificado'];
  return !neg.some(w => t.toLowerCase().includes(w));
}

function nomeFmt(txt) {
  return txt.trim().split(' ').slice(0, 2)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

function boasVindas() {
  return `${saudacao()}! 👋 Bem-vindo(a) ao *JARVIS — Smart Cursos Unaí*! 🤖\n\nTemos cursos online com certificado pra impulsionar sua carreira! 🚀\n\nComo posso te chamar?`;
}

function menuCatalogo(nome) {
  const cursos = cfg.cursosOnline;
  const lista = cursos.map((c, i) => `*${i+1}️⃣* ${c.titulo}\n   💰 ${fmt(c.valor)}\n   📝 ${c.desc}`).join('\n\n');
  return `Catálogo de Cursos Online, *${nome}*! 📚\n\n${lista}\n\n*7️⃣* 💬 Tenho uma dúvida\n*8️⃣* 👤 Falar com atendente\n\n_Digite o número do curso!_ 👇`;
}

async function processar(tel, dados) {
  const s = getSession(BOT, tel);
  const txt = (dados.tipo === 'texto' ? dados.conteudo : dados.caption || '').trim();
  const low = txt.toLowerCase();

  rmk.cancelar(BOT, tel);

  if (['menu','inicio','voltar','home'].includes(low)) {
    set(BOT, tel, { etapa: E.MENU });
    await zapi.texto(BOT, tel, s.nome ? menuCatalogo(s.nome) : boasVindas());
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
    case E.MENU:
    case E.O_CATALOGO:   await fCatalogo(tel, txt, s); break;
    case E.O_DETALHES:   await fDetalhes(tel, txt, s); break;
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
    await zapi.texto(BOT, tel, `Como posso te chamar?\n_(Só seu primeiro nome)_ 😊`);
  }
}

async function fCidade(tel, txt, s) {
  set(BOT, tel, { cidade: nomeFmt(txt), etapa: E.O_CATALOGO });
  await zapi.texto(BOT, tel, `Ótimo, *${s.nome}*! 😊 Veja nossos cursos disponíveis:`);
  await wait(500);
  await zapi.texto(BOT, tel, menuCatalogo(s.nome));
}

async function fCatalogo(tel, txt, s) {
  const cursos = cfg.cursosOnline;
  const idx = parseInt(txt) - 1;

  if (txt === '7') { set(BOT, tel, { etapa: E.LIVRE }); await zapi.texto(BOT, tel, `Pode perguntar! 😊`); return; }
  if (txt === '8') {
    set(BOT, tel, { etapa: E.LIVRE });
    await zapi.texto(BOT, tel, `Certo! Vou avisar nossa equipe. 😊`);
    await zapi.notificar(BOT, tel, 'Pediu atendente — Cursos Online', { nome: s.nome });
    return;
  }

  if (idx >= 0 && idx < cursos.length) {
    const curso = cursos[idx];
    set(BOT, tel, { etapa: E.O_DETALHES, _cursoId: curso.id });
    await zapi.texto(BOT, tel,
      `🎓 *${curso.titulo}*\n\n📝 ${curso.desc}\n\n✅ Certificado incluso\n✅ Acesso por 12 meses\n✅ Estude no seu ritmo\n✅ Suporte via WhatsApp\n\n💰 *${fmt(curso.valor)}*\n   ou em até *10x no cartão*\n\n*1️⃣* ✅ Quero esse curso\n*2️⃣* ❓ Tenho uma dúvida\n*3️⃣* 🔙 Ver outros cursos`
    );
    return;
  }

  // Busca por nome
  const found = cursos.find(c => c.titulo.toLowerCase().includes(txt.toLowerCase()) || c.id.includes(txt.toLowerCase()));
  if (found) {
    const idx2 = cursos.indexOf(found);
    await fCatalogo(tel, String(idx2 + 1), s);
    return;
  }

  await fLivre(tel, txt, s);
}

async function fDetalhes(tel, txt, s) {
  if (txt === '1') {
    const curso = cfg.cursosOnline.find(c => c.id === s._cursoId);
    set(BOT, tel, { etapa: E.LIVRE });
    await zapi.texto(BOT, tel, `Ótima escolha, *${s.nome}*! 🎉\n\n*${curso?.titulo || 'Curso'}*\n\nVou avisar nossa equipe pra liberar seu acesso! 😊\nEm breve entram em contato!`);
    await zapi.notificar(BOT, tel, `✅ INTERESSE: ${curso?.titulo}`, { nome: s.nome });
    return;
  }
  if (txt === '2') { set(BOT, tel, { etapa: E.LIVRE }); await zapi.texto(BOT, tel, `Pode perguntar! 😊`); return; }
  if (txt === '3') { set(BOT, tel, { etapa: E.O_CATALOGO }); await zapi.texto(BOT, tel, menuCatalogo(s.nome)); return; }
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
  await zapi.texto(BOT, tel, `_Digite *menu* pra ver os cursos!_ 😊`);
}

module.exports = { processar };
