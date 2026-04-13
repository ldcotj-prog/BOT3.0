// bots/vestibular.js — Bot Pré-Vestibular / ENEM
'use strict';

const zapi = require('../zapi');
const ia   = require('../ia');
const cfg  = require('../config');
const rmk  = require('../remarketing');
const { E, getSession, set, reset } = require('../storage');

const BOT  = 'vestibular';
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
  const neg = ['enem','vestibular','curso','quero','preciso','informação','preço','valor',
    'quanto','como','quando','onde','oi','olá','ola','sim','não','ok','bom dia','boa tarde'];
  return !neg.some(w => t.toLowerCase().includes(w));
}

function nomeFmt(txt) {
  return txt.trim().split(' ').slice(0, 2)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

function boasVindas() {
  return `${saudacao()}! 👋 Bem-vindo(a) ao *JARVIS — Smart Cursos Unaí*! 🤖\n\nSou especialista em pré-vestibular e ENEM. Vou te ajudar a chegar à faculdade! 🎓\n\nComo posso te chamar?`;
}

function menuPrincipal(nome) {
  return `O que você precisa, *${nome}*? 😊\n\n*1️⃣* 📚 Conhecer o *Pré-Vestibular*\n*2️⃣* 📝 Preparatório para o *ENEM*\n*3️⃣* 🎯 Preparatório para *Vestibulares Regionais*\n*4️⃣* 💰 Ver *preços e condições*\n*5️⃣* 📅 Agendar *visita presencial*\n*6️⃣* 💬 Tenho uma *dúvida*\n*7️⃣* 👤 Falar com *atendente*\n\n_Digite o número_ 👇`;
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
    reset(BOT, tel);
    set(BOT, tel, { etapa: E.AGUARDA_NOME });
    await zapi.texto(BOT, tel, boasVindas());
    rmk.agendar(BOT, tel);
    return;
  }

  switch (s.etapa) {
    case E.INICIO:       set(BOT, tel, { etapa: E.AGUARDA_NOME }); await zapi.texto(BOT, tel, boasVindas()); break;
    case E.AGUARDA_NOME: await fNome(tel, txt, s); break;
    case E.AGUARDA_CIDADE: await fCidade(tel, txt, s); break;
    case E.MENU:         await fMenu(tel, txt, s); break;
    case E.V_CURSO:      await fCurso(tel, txt, s); break;
    case E.V_INTERESSE:  await fInteresse(tel, txt, s); break;
    case E.V_AGENDAMENTO:await fAgendamento(tel, txt, s); break;
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
  await zapi.texto(BOT, tel, `Ótimo! Vamos lá, *${s.nome}*! 😊`);
  await wait(500);
  await zapi.texto(BOT, tel, menuPrincipal(s.nome));
}

async function fMenu(tel, txt, s) {
  const preVest = cfg.preVest;
  switch (txt) {
    case '1':
    case '2':
    case '3':
      set(BOT, tel, { etapa: E.V_CURSO, _opcao: txt });
      await apresentarCurso(tel, txt, s);
      break;
    case '4':
      await zapi.texto(BOT, tel,
        `💰 *Investimento — Pré-Vestibular Smart Cursos*\n\n📅 *Mensalidade (pontualidade até dia 7):*\n*${fmt(preVest.mensalidadePontual)}/mês*\n\n📅 *Mensalidade padrão:*\n*${fmt(preVest.mensalidadePadrao)}/mês*\n\nInclui: aulas + plataforma + apostilas + sala de estudos!\n\n*1* Quero me matricular\n*2* Ver mais detalhes\n*0* ← Voltar`
      );
      set(BOT, tel, { etapa: E.V_INTERESSE });
      break;
    case '5':
      set(BOT, tel, { etapa: E.V_AGENDAMENTO });
      await zapi.texto(BOT, tel,
        `📅 *Agendar Visita*\n\nÓtima decisão! Nossa equipe vai te receber e mostrar tudo pessoalmente. 😊\n\nQual o melhor *dia e horário* pra você visitar?\n\n_Seg-Sex 8h-18h | Sáb 8h-12h_`
      );
      break;
    case '6':
      set(BOT, tel, { etapa: E.LIVRE });
      await zapi.texto(BOT, tel, `Pode perguntar! 😊\n\n_(Digite *menu* pra voltar)_`);
      break;
    case '7':
      set(BOT, tel, { etapa: E.LIVRE });
      await zapi.texto(BOT, tel, `Certo! Vou avisar nossa equipe. 😊\n_Seg-Sex 8h-18h_`);
      await zapi.notificar(BOT, tel, 'Pediu atendente — Vestibular', { nome: s.nome });
      break;
    default:
      await fLivre(tel, txt, s);
  }
}

async function apresentarCurso(tel, opcao, s) {
  const preVest = cfg.preVest;
  const diferenciais = preVest.diferenciais.map(d => `✅ ${d}`).join('\n');
  const focos = {
    '1': '🎓 *Preparatório Completo — ENEM + Vestibulares*',
    '2': '📝 *Foco ENEM — As 5 Grandes Áreas*',
    '3': '🎯 *Vestibulares Regionais — UFU / UNIMONTES*',
  };
  await zapi.texto(BOT, tel,
    `${focos[opcao] || '🎓 *Pré-Vestibular Smart Cursos Unaí*'}\n\n${diferenciais}\n\n💰 A partir de *${fmt(preVest.mensalidadePontual)}/mês*\n\n*1️⃣* 💰 Ver preços e condições\n*2️⃣* 📅 Agendar visita presencial\n*3️⃣* ✅ Quero me matricular\n*4️⃣* ← Voltar`
  );
}

async function fCurso(tel, txt, s) {
  if (txt === '0' || txt === '4') { set(BOT, tel, { etapa: E.MENU }); await zapi.texto(BOT, tel, menuPrincipal(s.nome)); return; }
  if (txt === '1') { set(BOT, tel, { etapa: E.V_INTERESSE }); await zapi.texto(BOT, tel, `💰 *${fmt(cfg.preVest.mensalidadePontual)}/mês* (pontualidade)\n*${fmt(cfg.preVest.mensalidadePadrao)}/mês* (padrão)\n\n*1* Matricular | *2* Agendar visita | *0* Voltar`); return; }
  if (txt === '2') { set(BOT, tel, { etapa: E.V_AGENDAMENTO }); await zapi.texto(BOT, tel, `📅 Qual dia e horário você pode visitar?\n_Seg-Sex 8h-18h | Sáb 8h-12h_ 😊`); return; }
  if (txt === '3') { await matricular(tel, s); return; }
  await fLivre(tel, txt, s);
}

async function fInteresse(tel, txt, s) {
  if (txt === '1') { await matricular(tel, s); return; }
  if (txt === '2') { set(BOT, tel, { etapa: E.V_CURSO }); await apresentarCurso(tel, s._opcao || '1', s); return; }
  if (txt === '0') { set(BOT, tel, { etapa: E.MENU }); await zapi.texto(BOT, tel, menuPrincipal(s.nome)); return; }
  await fLivre(tel, txt, s);
}

async function fAgendamento(tel, txt, s) {
  set(BOT, tel, { etapa: E.LIVRE });
  await zapi.texto(BOT, tel, `Anotado! 📋 Vou repassar pra nossa equipe confirmar o horário com você. 😊\n\nEm breve entram em contato!`);
  await zapi.notificar(BOT, tel, `Agendamento visita: "${txt}"`, { nome: s.nome });
}

async function matricular(tel, s) {
  set(BOT, tel, { etapa: E.LIVRE });
  await zapi.texto(BOT, tel, `Que ótimo, *${s.nome}*! 🎉\n\nVou avisar nossa equipe agora. Alguém entra em contato pra finalizar sua matrícula! 😊\n_Seg-Sex 8h-18h_`);
  await zapi.notificar(BOT, tel, `✅ MATRÍCULA — Pré-vestibular`, { nome: s.nome });
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
