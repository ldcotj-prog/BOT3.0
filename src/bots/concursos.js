// bots/concursos.js — Bot de Concursos Públicos
'use strict';

const zapi = require('../zapi');
const ia   = require('../ia');
const pix  = require('../pagamento');
const cfg  = require('../config');
const rmk  = require('../remarketing');
const { E, getSession, set, reset } = require('../storage');

const BOT  = 'concursos';
const fmt  = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function saudacao() {
  const h = parseInt(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }));
  return h >= 5 && h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function ehNome(txt) {
  const t = txt.trim();
  if (t.length < 2 || t.length > 25 || t.split(' ').length > 3) return false;
  if (/\d/.test(t) || /[?!,.]/.test(t) || !/^[A-ZÀ-Ú]/i.test(t)) return false;
  const neg = ['apostila','concurso','paracatu','buritis','cargo','quero','preciso','informação',
    'informatica','curso','enem','vestibular','preço','valor','quanto','como','material',
    'comprar','oi','olá','ola','tudo','bem','bom dia','boa tarde','boa noite','sim','não','ok'];
  return !neg.some(w => t.toLowerCase().includes(w));
}

function nomeFmt(txt) {
  return txt.trim().split(' ').slice(0, 2)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

function msgPix(produto, valor) {
  return `✅ Para garantir seu material, faça o pagamento:\n\n🏷 *${produto}*\n💰 *${fmt(valor)}*\n\n📲 *Chave PIX (CNPJ):*\n\`${cfg.pix}\`\n\nApós pagar, envie o *print do comprovante* aqui! 📸`;
}

function menuPrincipal(nome) {
  return `Como posso te ajudar, *${nome}*? 😊\n\n*1️⃣* 📄 Apostilas *Paracatu 2026*\n*2️⃣* 📄 Apostilas *Buritis/MG*\n*3️⃣* ❓ Não sei meu cargo — me ajuda\n*4️⃣* 💬 Tenho uma dúvida\n*5️⃣* 👤 Falar com atendente\n\n_Digite o número_ 👇`;
}

async function processar(tel, dados) {
  const s = getSession(BOT, tel);
  const txt = (dados.tipo === 'texto' ? dados.conteudo : dados.caption || '').trim();
  const low = txt.toLowerCase();

  rmk.cancelar(BOT, tel);

  // ── Comprovante: imagem OU PDF ────────────────────────────
  if ((dados.tipo === 'imagem' || dados.tipo === 'comprovante_pdf') && s.etapa === E.AGUARDA_PIX) {
    await processarPix(tel, dados.conteudo, s);
    rmk.agendar(BOT, tel);
    return;
  }

  // ── PDF genérico enviado no estado AGUARDA_PIX ─────────────
  // (qualquer documento quando está aguardando pagamento = tratar como comprovante)
  if (dados.tipo === 'documento' && s.etapa === E.AGUARDA_PIX && dados.conteudo) {
    await processarPix(tel, dados.conteudo, s);
    rmk.agendar(BOT, tel);
    return;
  }

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
    case E.CONCURSO:     await fConcurso(tel, txt, s); break;
    case E.P_AREA:       await fPArea(tel, txt, s); break;
    case E.P_CARGO:      await fPCargo(tel, txt, s); break;
    case E.P_APOSTILA:   await fPApostila(tel, txt, s); break;
    case E.P_COMBO:      await fPCombo(tel, txt, s); break;
    case E.B_AREA:       await fBArea(tel, txt, s); break;
    case E.B_CARGO:      await fBCargo(tel, txt, s); break;
    case E.B_APOSTILA:   await fBApostila(tel, txt, s); break;
    case E.B_COMBO:      await fBCombo(tel, txt, s); break;

    // ── AGUARDANDO PIX — não entra em loop ──────────────────
    case E.AGUARDA_PIX:
      // Só repete o PIX se a pessoa digitar algo
      // Não repete se for áudio, figurinha, etc.
      if (dados.tipo === 'texto' && txt.length > 0) {
        await zapi.texto(BOT, tel,
          `Ainda aguardando o comprovante! 😊\n\nChave PIX: *${cfg.pix}*\nValor: *${fmt(s.pedido?.valor || 19.90)}*\n\nApós pagar, envie o *print ou PDF* do comprovante aqui! 📸`
        );
      }
      break;

    case E.LIVRE: await fLivre(tel, txt, s); break;
    default: reset(BOT, tel); set(BOT, tel, { etapa: E.AGUARDA_NOME }); await zapi.texto(BOT, tel, boasVindas());
  }
  rmk.agendar(BOT, tel);
}

function boasVindas() {
  return `${saudacao()}! 👋 Bem-vindo(a) ao *JARVIS — Smart Cursos Unaí*! 🤖\n\nSou especialista em apostilas para concursos públicos. Vou te ajudar a se preparar pra aprovação! 🏆\n\nComo posso te chamar?`;
}

async function fNome(tel, txt, s) {
  if (ehNome(txt)) {
    set(BOT, tel, { nome: nomeFmt(txt), etapa: E.AGUARDA_CIDADE });
    await zapi.texto(BOT, tel, `Prazer, *${nomeFmt(txt)}*! 😊\n\nDe qual cidade você é?`);
  } else {
    set(BOT, tel, { etapa: E.AGUARDA_NOME, _int: txt });
    await zapi.texto(BOT, tel, `Entendido! 😊\n\nMas antes, como posso te chamar?\n_(Digite só seu primeiro nome)_`);
  }
}

async function fCidade(tel, txt, s) {
  const cidade = nomeFmt(txt);
  set(BOT, tel, { cidade, etapa: E.MENU });
  await zapi.texto(BOT, tel, `Ótimo, *${cidade}*! Vamos lá! 😊`);
  await wait(500);
  // Detecta intenção pendente
  const int = s._int || '';
  set(BOT, tel, { _int: null });
  if (/paracatu/i.test(int)) { set(BOT, tel, { etapa: E.P_AREA }); await zapi.texto(BOT, tel, menuParacatu()); return; }
  if (/buritis/i.test(int))  { set(BOT, tel, { etapa: E.B_AREA }); await zapi.texto(BOT, tel, menuBuritis()); return; }
  await zapi.texto(BOT, tel, menuPrincipal(s.nome || cidade));
}

async function fMenu(tel, txt, s) {
  if (txt === '1') { set(BOT, tel, { etapa: E.P_AREA }); await zapi.texto(BOT, tel, menuParacatu()); return; }
  if (txt === '2') { set(BOT, tel, { etapa: E.B_AREA }); await zapi.texto(BOT, tel, menuBuritis()); return; }
  if (txt === '3') { set(BOT, tel, { etapa: E.LIVRE }); await zapi.texto(BOT, tel, `Me conta sua área de atuação que te indico o cargo certo! 😊`); return; }
  if (txt === '4') { set(BOT, tel, { etapa: E.LIVRE }); await zapi.texto(BOT, tel, `Pode perguntar! 😊\n\n_(Digite *menu* pra voltar)_`); return; }
  if (txt === '5') { set(BOT, tel, { etapa: E.LIVRE }); await zapi.texto(BOT, tel, `Certo! Vou avisar nossa equipe. 😊\n_Seg-Sex 8h-18h_`); await zapi.notificar(BOT, tel, 'Pediu atendente', { nome: s.nome }); return; }
  // Texto livre
  if (/paracatu/i.test(txt)) { set(BOT, tel, { etapa: E.P_AREA }); await zapi.texto(BOT, tel, menuParacatu()); return; }
  if (/buritis/i.test(txt))  { set(BOT, tel, { etapa: E.B_AREA }); await zapi.texto(BOT, tel, menuBuritis()); return; }
  await fLivre(tel, txt, s);
}

// ── PARACATU ─────────────────────────────────────────────────
function menuParacatu() {
  return `📄 *Apostilas — Paracatu 2026*\nIBGP | 272 vagas | Prova: 23/08\n\n*1️⃣* 🎯 Apostila do meu cargo\n*2️⃣* 🔥 COMBO completo — R$ 49,90\n*3️⃣* ❓ Não sei meu cargo\n\n*0️⃣* ← Voltar`;
}

async function fPArea(tel, txt, s) {
  if (txt === '0') { set(BOT, tel, { etapa: E.MENU }); await zapi.texto(BOT, tel, menuPrincipal(s.nome)); return; }
  if (txt === '2') { set(BOT, tel, { etapa: E.P_COMBO }); await comboParacatu(tel, s.nome); return; }
  if (txt === '3') { set(BOT, tel, { etapa: E.LIVRE }); await zapi.texto(BOT, tel, `Me conta sua área de atuação! 😊`); return; }
  if (txt === '1') {
    set(BOT, tel, { etapa: E.P_CARGO, areaId: null });
    const l = cfg.paracatu.areas.map((a, i) => `*${i+1}️⃣* ${a.emoji} ${a.titulo}`).join('\n');
    await zapi.texto(BOT, tel, `Qual é a sua área? 👇\n\n${l}\n\n*0️⃣* ← Voltar`);
    return;
  }
  await zapi.texto(BOT, tel, menuParacatu());
}

async function fPCargo(tel, txt, s) {
  if (txt === '0') {
    if (!s.areaId) { set(BOT, tel, { etapa: E.P_AREA }); await zapi.texto(BOT, tel, menuParacatu()); }
    else { set(BOT, tel, { areaId: null }); const l = cfg.paracatu.areas.map((a, i) => `*${i+1}️⃣* ${a.emoji} ${a.titulo}`).join('\n'); await zapi.texto(BOT, tel, `Qual área?\n\n${l}\n\n*0️⃣* ← Voltar`); }
    return;
  }
  if (!s.areaId) {
    const area = cfg.paracatu.areas[parseInt(txt) - 1];
    if (!area) { const l = cfg.paracatu.areas.map((a, i) => `*${i+1}️⃣* ${a.emoji} ${a.titulo}`).join('\n'); await zapi.texto(BOT, tel, `Opção inválida:\n\n${l}\n\n*0️⃣* ← Voltar`); return; }
    set(BOT, tel, { areaId: area.id });
    const l = area.cargos.map((c, i) => `*${i+1}️⃣* ${c.titulo}`).join('\n');
    await zapi.texto(BOT, tel, `${area.emoji} *${area.titulo}*\n\nQual é o seu cargo? 👇\n\n${l}\n\n*0️⃣* ← Voltar\n\n_COMBO completo: R$ 49,90! 😉_`);
    return;
  }
  const area = cfg.paracatu.areas.find(a => a.id === s.areaId);
  if (!area) { set(BOT, tel, { etapa: E.P_AREA }); await zapi.texto(BOT, tel, menuParacatu()); return; }
  const cargo = area.cargos[parseInt(txt) - 1];
  if (!cargo) { const l = area.cargos.map((c, i) => `*${i+1}️⃣* ${c.titulo}`).join('\n'); await zapi.texto(BOT, tel, `Opção inválida:\n\n${l}\n\n*0️⃣* ← Voltar`); return; }
  set(BOT, tel, { etapa: E.P_APOSTILA, pedido: { produto: `Apostila ${cargo.titulo} — Paracatu 2026`, valor: cfg.paracatu.precoCargo, tipo: 'cargo_paracatu', driveId: cargo.drive } });
  await zapi.texto(BOT, tel,
    `📘 *Apostila ${cargo.titulo}*\nParacatu 2026 — IBGP\n\n📄 *${cargo.pags} páginas*\n\n📦 *Módulos Base:*\nLP • Raciocínio Lógico • Informática • Conhecimentos Gerais\n\n🎯 *Específico:*\n${cargo.esp}\n\n💰 *R$ 19,90* — PIX, acesso imediato\n\n*1️⃣* ✅ Comprar\n*2️⃣* 🔥 COMBO — R$ 49,90\n*3️⃣* 🔄 Outro cargo`
  );
}

async function fPApostila(tel, txt, s) {
  if (txt === '1') { set(BOT, tel, { etapa: E.AGUARDA_PIX }); await zapi.texto(BOT, tel, msgPix(s.pedido.produto, s.pedido.valor)); return; }
  if (txt === '2') { set(BOT, tel, { etapa: E.P_COMBO }); await comboParacatu(tel, s.nome); return; }
  if (txt === '3') { set(BOT, tel, { etapa: E.P_CARGO, areaId: null }); const l = cfg.paracatu.areas.map((a, i) => `*${i+1}️⃣* ${a.emoji} ${a.titulo}`).join('\n'); await zapi.texto(BOT, tel, `Qual área?\n\n${l}\n\n*0️⃣* ← Voltar`); return; }
  await fLivre(tel, txt, s);
}

async function comboParacatu(tel, nome) {
  const total = (cfg.paracatu.precoCargo * 27).toFixed(2).replace('.', ',');
  const eco   = (cfg.paracatu.precoCargo * 27 - cfg.paracatu.precoCombo).toFixed(2).replace('.', ',');
  const n = nome ? `*${nome}*` : 'você';
  await zapi.texto(BOT, tel, `${n}, olha o que faz sentido... 👀`);
  await wait(1200);
  await zapi.texto(BOT, tel, `🔥 *COMBO — Paracatu 2026*\n\n27 apostilas completas:\n🏥 7 Saúde | 📚 6 Educação\n🗂 6 Adm. | ⚖ 4 Jurídica | ⚙ 4 Técnica\n\n✅ Conteúdo conforme edital IBGP\n✅ Questões comentadas em cada uma`);
  await wait(1500);
  await zapi.texto(BOT, tel, `💡 Separado: *R$ ${total}*\nCOMBO: *R$ ${fmt(cfg.paracatu.precoCombo)}*\n\n💰 Economia de *R$ ${eco}*! 🎁\n\n*1️⃣* ✅ Quero o COMBO — R$ 49,90\n*2️⃣* 🔍 Ver por cargo\n*3️⃣* ← Voltar`);
}

async function fPCombo(tel, txt, s) {
  if (txt === '1') { set(BOT, tel, { etapa: E.AGUARDA_PIX, pedido: { produto: 'COMBO Paracatu 2026 — 27 apostilas', valor: cfg.paracatu.precoCombo, tipo: 'combo_paracatu' } }); await zapi.texto(BOT, tel, msgPix('COMBO Paracatu 2026', cfg.paracatu.precoCombo)); return; }
  if (txt === '2') { set(BOT, tel, { etapa: E.P_CARGO, areaId: null }); const l = cfg.paracatu.areas.map((a, i) => `*${i+1}️⃣* ${a.emoji} ${a.titulo}`).join('\n'); await zapi.texto(BOT, tel, `Qual área?\n\n${l}\n\n*0️⃣* ← Voltar`); return; }
  if (txt === '3') { set(BOT, tel, { etapa: E.MENU }); await zapi.texto(BOT, tel, menuPrincipal(s.nome)); return; }
  await zapi.texto(BOT, tel, `Digite *1* pro COMBO, *2* por cargo ou *3* pra voltar! 😊`);
}

// ── BURITIS ──────────────────────────────────────────────────
function menuBuritis() {
  return `📄 *Apostilas — Buritis/MG*\n\n*1️⃣* 🎯 Apostila do meu cargo\n*2️⃣* 🔥 COMBO completo — R$ 49,90\n\n*0️⃣* ← Voltar`;
}

async function fBArea(tel, txt, s) {
  if (txt === '0') { set(BOT, tel, { etapa: E.MENU }); await zapi.texto(BOT, tel, menuPrincipal(s.nome)); return; }
  if (txt === '2') { set(BOT, tel, { etapa: E.B_COMBO }); await comboBuritis(tel, s.nome); return; }
  if (txt === '1') {
    set(BOT, tel, { etapa: E.B_CARGO, areaId: null });
    const l = cfg.buritis.areas.map((a, i) => `*${i+1}️⃣* ${a.emoji} ${a.titulo} (${a.qtd} cargos)`).join('\n');
    await zapi.texto(BOT, tel, `Qual é a sua área? 👇\n\n${l}\n\n*0️⃣* ← Voltar`);
    return;
  }
  await zapi.texto(BOT, tel, menuBuritis());
}

async function fBCargo(tel, txt, s) {
  if (txt === '0') {
    if (!s.areaId) { set(BOT, tel, { etapa: E.B_AREA }); await zapi.texto(BOT, tel, menuBuritis()); }
    else { set(BOT, tel, { areaId: null }); const l = cfg.buritis.areas.map((a, i) => `*${i+1}️⃣* ${a.emoji} ${a.titulo}`).join('\n'); await zapi.texto(BOT, tel, `Qual área?\n\n${l}\n\n*0️⃣* ← Voltar`); }
    return;
  }
  if (!s.areaId) {
    const area = cfg.buritis.areas[parseInt(txt) - 1];
    if (!area) { const l = cfg.buritis.areas.map((a, i) => `*${i+1}️⃣* ${a.emoji} ${a.titulo}`).join('\n'); await zapi.texto(BOT, tel, `Opção inválida:\n\n${l}`); return; }
    set(BOT, tel, { areaId: area.id });
    const cargos = cfg.buritis.cargos[area.id] || [];
    let l = cargos.slice(0, 20).map((c, i) => `*${i+1}️⃣* ${c}`).join('\n');
    if (cargos.length > 20) l += `\n\n_+${cargos.length - 20} cargos. Digite o número ou nome._`;
    await zapi.texto(BOT, tel, `${area.emoji} *${area.titulo}*\n\n${l}\n\n*0️⃣* ← Voltar`);
    return;
  }
  const cargos = cfg.buritis.cargos[s.areaId] || [];
  const idx = parseInt(txt) - 1;
  const cargo = (!isNaN(idx) && idx >= 0 && idx < cargos.length) ? cargos[idx]
    : cargos.find(c => c.toLowerCase().includes(txt.toLowerCase()));
  if (!cargo) { await zapi.texto(BOT, tel, `Não encontrei. Digite o *número* ou parte do *nome* do cargo! 😊`); return; }
  set(BOT, tel, { etapa: E.B_APOSTILA, pedido: { produto: `Apostila ${cargo} — Buritis/MG`, valor: cfg.buritis.precoCargo, tipo: 'cargo_buritis' } });
  await zapi.texto(BOT, tel, `📘 *Apostila ${cargo}*\nBuritis/MG\n\n📦 Módulos Base + Conteúdo Específico\n✅ Questões comentadas\n\n💰 *R$ 19,90* — PIX\n📲 Material enviado pelo WhatsApp\n\n*1️⃣* ✅ Comprar\n*2️⃣* 🔥 COMBO — R$ 49,90\n*3️⃣* 🔄 Outro cargo`);
}

async function fBApostila(tel, txt, s) {
  if (txt === '1') { set(BOT, tel, { etapa: E.AGUARDA_PIX }); await zapi.texto(BOT, tel, msgPix(s.pedido.produto, s.pedido.valor)); return; }
  if (txt === '2') { set(BOT, tel, { etapa: E.B_COMBO }); await comboBuritis(tel, s.nome); return; }
  if (txt === '3') { set(BOT, tel, { etapa: E.B_CARGO, areaId: null }); const l = cfg.buritis.areas.map((a, i) => `*${i+1}️⃣* ${a.emoji} ${a.titulo}`).join('\n'); await zapi.texto(BOT, tel, `Qual área?\n\n${l}`); return; }
  await fLivre(tel, txt, s);
}

async function comboBuritis(tel, nome) {
  const n = nome ? `*${nome}*` : 'você';
  await zapi.texto(BOT, tel, `🔥 *COMBO Buritis/MG*\n\n🏥 35 Saúde | 🤝 20 Social | 📚 9 Educação\n\nSeparado: mais de *R$ 1.200,00*\nCOMBO: *R$ 49,90* 🎁\n\n*1️⃣* ✅ Quero o COMBO\n*2️⃣* 🔍 Ver por cargo\n*3️⃣* ← Voltar`);
}

async function fBCombo(tel, txt, s) {
  if (txt === '1') { set(BOT, tel, { etapa: E.AGUARDA_PIX, pedido: { produto: 'COMBO Buritis/MG', valor: cfg.buritis.precoCombo, tipo: 'combo_buritis' } }); await zapi.texto(BOT, tel, msgPix('COMBO Buritis/MG', cfg.buritis.precoCombo)); return; }
  if (txt === '2') { set(BOT, tel, { etapa: E.B_CARGO, areaId: null }); const l = cfg.buritis.areas.map((a, i) => `*${i+1}️⃣* ${a.emoji} ${a.titulo}`).join('\n'); await zapi.texto(BOT, tel, `Qual área?\n\n${l}`); return; }
  if (txt === '3') { set(BOT, tel, { etapa: E.MENU }); await zapi.texto(BOT, tel, menuPrincipal(s.nome)); return; }
  await zapi.texto(BOT, tel, `Digite *1* pro COMBO, *2* por cargo ou *3* pra voltar! 😊`);
}

// ── PIX ──────────────────────────────────────────────────────
async function processarPix(tel, urlArquivo, s) {
  await zapi.texto(BOT, tel, `🔍 Recebi seu comprovante! Verificando...`);

  const pedido = s.pedido;
  if (!pedido) { await zapi.texto(BOT, tel, `Não encontrei seu pedido. Digite *menu* pra recomeçar! 😊`); return; }

  // PDF não pode ser analisado pela IA de visão → vai direto para confirmação manual
  const ehPdf = urlArquivo?.toLowerCase().includes('.pdf')
    || urlArquivo?.toLowerCase().includes('pdf');

  let resultado;
  if (ehPdf) {
    console.log(`[PIX] PDF recebido — encaminhando para confirmação manual`);
    resultado = { ok: null, motivo: 'pdf_manual' };
  } else {
    resultado = await pix.validar(urlArquivo, pedido.valor);
  }

  if (resultado.ok === true) {
    await zapi.texto(BOT, tel, `✅ *Pagamento confirmado!*\n\nObrigado, *${s.nome}*! 🎉`);
    await wait(800);
    await liberarProduto(tel, pedido, s.nome);
    set(BOT, tel, { etapa: E.MENU, pedido: null });
    rmk.cancelar(BOT, tel);

  } else if (resultado.ok === false) {
    if (resultado.motivo === 'valor_errado') {
      await zapi.texto(BOT, tel,
        `Hmm, o comprovante mostra *${fmt(resultado.valorPago)}* mas o pedido é *${fmt(pedido.valor)}* 🤔\n\nVerifica se foi o valor correto e envia novamente!`
      );
    } else if (resultado.motivo === 'nao_pix') {
      await zapi.texto(BOT, tel,
        `Não consegui identificar um comprovante PIX nessa imagem 🤔\n\nPode enviar um *print mais nítido*? 📸\n\nOu se pagou por PDF, pode enviar o arquivo! 📄`
      );
    } else {
      await zapi.texto(BOT, tel, `Não consegui verificar. Nossa equipe vai confirmar em breve! 😊`);
      await zapi.comprovante(BOT, tel, s.nome, pedido.produto, urlArquivo);
      set(BOT, tel, { etapa: E.MENU, pedido: null });
      rmk.cancelar(BOT, tel);
    }

  } else {
    // ok === null → confirmação manual (PDF ou erro de IA)
    await zapi.texto(BOT, tel,
      `Recebi seu comprovante! 📨\n\nNossa equipe vai confirmar e *enviar seu material em breve*, *${s.nome}*! ⏱️\n\n_Seg-Sex 8h-18h | Sáb 8h-12h_`
    );
    await zapi.comprovante(BOT, tel, s.nome, pedido.produto, urlArquivo);
    // PIX_ENVIADO = bot para de responder até atendente confirmar manualmente
    set(BOT, tel, { etapa: E.PIX_ENVIADO });
    rmk.cancelar(BOT, tel);
  }
}

async function liberarProduto(tel, pedido, nome) {
  const n = nome || 'aluno(a)';
  const hora = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

  // ── BURITIS — entrega manual pela equipe ─────────────────────
  if (pedido.tipo === 'cargo_buritis' || pedido.tipo === 'combo_buritis') {
    await zapi.texto(BOT, tel,
`✅ *Pagamento confirmado com sucesso!*

Obrigado pela confiança, *${n}*! 🙏

📋 *Resumo do seu pedido:*
${pedido.produto}
💰 ${fmt(pedido.valor)} — Pago ✔️

📲 *Nossa equipe já recebeu o seu pedido e enviará o material aqui pelo WhatsApp o mais rápido possível!*

_Atendimento: Seg-Sex 8h-18h | Sáb 8h-12h_ ⏱️

Qualquer dúvida é só chamar! Bons estudos! 💪🎓`
    );
    // Notifica o atendente para envio manual
    await zapi.notificarAtendente(
`📦 *ENVIO MANUAL NECESSÁRIO*

🛒 ${pedido.produto}
💰 ${fmt(pedido.valor)} — Pago ✔️
👤 *${nome || 'não informado'}*
📱 ${tel}
🕐 ${hora}

_Envie o material para esse número no WhatsApp!_ 👆`
    );
    set(BOT, tel, { etapa: E.PIX_ENVIADO });
    rmk.cancelar(BOT, tel);
    return;
  }

  // ── PARACATU — link automático por Drive ─────────────────────
  if (pedido.tipo === 'cargo_paracatu' && pedido.driveId) {
    await zapi.apostila(BOT, tel, pedido.driveId, pedido.produto, n);
    await wait(600);
    await zapi.texto(BOT, tel,
      `🎉 Material enviado com sucesso, *${n}*!\n\nBons estudos e boa sorte na prova de *23 de agosto*! 💪🏆\n\nQualquer dúvida sobre o conteúdo, pode chamar! 😊`
    );
    // Notifica o atendente — confirmação de venda
    await zapi.notificarAtendente(
`💰 *VENDA REALIZADA — PARACATU*

🛒 ${pedido.produto}
💰 ${fmt(pedido.valor)}
👤 *${nome || 'não informado'}*
📱 ${tel}
🕐 ${hora}

✅ _Apostila entregue automaticamente!_`
    );
    return;
  }

  // ── PARACATU — COMBO (todos os links) ────────────────────────
  if (pedido.tipo === 'combo_paracatu') {
    await zapi.texto(BOT, tel, `📦 Enviando todas as 27 apostilas... aguarda alguns minutos! ⏳`);
    for (const area of cfg.paracatu.areas) {
      for (const cargo of area.cargos) {
        if (cargo.drive) {
          await zapi.apostila(BOT, tel, cargo.drive, `Apostila ${cargo.titulo}`, n);
          await wait(3000);
        }
      }
    }
    await zapi.texto(BOT, tel,
      `✅ *Todas as apostilas enviadas!*\n\nBons estudos, *${n}*! Você tem o material completo pra arrasar na prova! 💪🏆`
    );
    // Notifica o atendente — confirmação de venda
    await zapi.notificarAtendente(
`💰 *VENDA REALIZADA — COMBO PARACATU*

🛒 ${pedido.produto}
💰 ${fmt(pedido.valor)}
👤 *${nome || 'não informado'}*
📱 ${tel}
🕐 ${hora}

✅ _27 apostilas entregues automaticamente!_`
    );
    return;
  }

  // Fallback
  await zapi.texto(BOT, tel,
    `✅ Pedido confirmado! Nossa equipe enviará seu material em breve, *${n}*! 😊`
  );
  await zapi.notificarAtendente(
`📦 *PEDIDO A ENVIAR*

🛒 ${pedido.produto}
💰 ${fmt(pedido.valor)}
👤 *${nome || 'não informado'}*
📱 ${tel}
🕐 ${hora}`
  );
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

// ── Confirmação manual pelo atendente ────────────────────────
async function confirmarPedido(tel, s) {
  const pedido = s.pedido;
  if (!pedido) {
    console.warn(`[${BOT}] confirmarPedido: sem pedido na sessão de ${tel}`);
    return;
  }
  // Usa o liberarProduto que já tem toda a lógica de Buritis e Paracatu
  await liberarProduto(tel, pedido, s.nome);
  // Só limpa o pedido e volta ao menu se não for Buritis
  // (Buritis já entra em PIX_ENVIADO dentro do liberarProduto)
  if (pedido.tipo !== 'cargo_buritis' && pedido.tipo !== 'combo_buritis') {
    set(BOT, tel, { etapa: E.MENU, pedido: null });
  }
  rmk.cancelar(BOT, tel);
}

async function recusarPedido(tel, s) {
  set(BOT, tel, { etapa: E.AGUARDA_PIX });
  await zapi.texto(BOT, tel,
    `Hmm, não conseguimos confirmar seu pagamento 😔\n\nPode enviar o comprovante novamente?\n\nChave PIX: *${cfg.pix}*\nValor: *${fmt(s.pedido?.valor || 19.90)}*`
  );
}

module.exports = { processar, confirmarPedido, recusarPedido };
