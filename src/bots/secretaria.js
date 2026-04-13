// bots/secretaria.js — JARVIS Unificado v2
// Atende TUDO: perguntas gerais, matrículas, apostilas, dúvidas
// IA como motor principal + fluxo estruturado para compra de apostilas
'use strict';

const zapi = require('../zapi');
const ia   = require('../ia');
const pix  = require('../pagamento');
const cfg  = require('../config');
const rmk  = require('../remarketing');
const { getSession, set, reset } = require('../storage');

const BOT  = 'secretaria';
const fmt  = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────
// ETAPAS INTERNAS
// ─────────────────────────────────────────────────────────────
const S = {
  LIVRE:       'sec_livre',
  CONFIRMA:    'sec_confirma',
  AGUARDA_PIX: 'sec_aguarda_pix',
  CONCLUIDO:   'sec_concluido',   // compra finalizada — sem remarketing
};

// ─────────────────────────────────────────────────────────────
// SYSTEM PROMPT — IA Secretaria
// ─────────────────────────────────────────────────────────────
const PROMPT = `Você é a JARVIS, secretária virtual inteligente da Smart Cursos Unaí (Unaí-MG).

PERSONALIDADE:
- Carismática, receptiva, humana — nunca parece um robô
- Consultiva: entende a dor do cliente antes de oferecer algo
- Respostas curtas e naturais (WhatsApp) — 1 a 3 linhas no máximo
- Emojis com moderação, linguagem próxima e acolhedora
- Cria urgência e valor de forma natural, sem pressão

MISSÃO: Receber qualquer tipo de mensagem, entender a demanda e conduzir para a solução ideal — sempre aumentando a conversão.

━━━━━ PRODUTOS ━━━━━

APOSTILAS DIGITAIS — PARACATU 2026 (IBGP | 272 vagas | Prova 23/08/2026)
Entrega: automática via link Google Drive após PIX
Preços: R$ 19,90/cargo | R$ 49,90 COMBO (27 apostilas)
Cargos: Enfermagem, Farmácia, Radiologia, Odontologia, Fisioterapia, Análises Clínicas,
Vigilância Sanitária, PEB, PEB Arte, PEB História, Supervisor Escolar, Educador de Creche,
Bibliotecário, Oficial Administrativo, Auxiliar de Secretaria, Administração/Aux.Adm.,
Almoxarifado, Assistente Social, Contabilidade, Advogado, GCM, Psicologia, Vigia,
Engenharia Elétrica vol.1, Engenharia Elétrica vol.2, Engenheiro Ambiental, Motorista

APOSTILAS DIGITAIS — BURITIS/MG (Processo Seletivo)
Entrega: manual pela equipe via WhatsApp
Preços: R$ 19,90/cargo | R$ 49,90 COMBO
Áreas: Saúde (35 cargos), Assistência Social (20 cargos), Educação (9 cargos)

PRÉ-VESTIBULAR / ENEM
R$ 595,90/mês (pontualidade) | R$ 745,00 padrão
Aulas presenciais + plataforma digital + apostilas + sala de estudos 8h-22h

INFORMÁTICA
Presencial 9 meses (9x R$ 311,92) | Empresarial 3 meses (10x R$ 99,79) | Online (R$ 297,90)

CURSOS ONLINE (com certificado)
IA p/ Negócios R$ 397,90 | Aux. Administrativo R$ 397,90 | Gestão R$ 297,90
Química R$ 197,90 | Excel R$ 197,90 | Português e Redação R$ 197,90

━━━━━ REGRAS ABSOLUTAS ━━━━━
1. NUNCA peça CPF, RG, email ou dados pessoais
2. NUNCA dê desconto em apostilas (R$ 19,90 e R$ 49,90 são preços fixos)
3. NUNCA mencione envio por email — tudo pelo WhatsApp
4. NUNCA gere link de pagamento — apenas informe PIX: 31.852.681/0001-40
5. Quando identificar intenção clara de comprar apostila, inclua no final da resposta: [COMPRA: nome do cargo e concurso]
   Exemplos: [COMPRA: Enfermagem Paracatu] [COMPRA: COMBO Paracatu] [COMPRA: Monitor Buritis] [COMPRA: COMBO Buritis]
6. Quando quiser transferir para atendente humano, inclua: [ATENDENTE]`;

// ─────────────────────────────────────────────────────────────
// PROCESSADOR PRINCIPAL
// ─────────────────────────────────────────────────────────────
async function processar(tel, dados) {
  const s = getSession(BOT, tel);
  const { tipo, conteudo, caption } = dados;
  const txt = (tipo === 'texto' ? conteudo : caption || '').trim();

  rmk.cancelar(BOT, tel);
  console.log(`[SEC] ${tel} | etapa:${s.etapa} | tipo:${tipo} | "${txt.slice(0, 60)}"`);

  // ── Comprovante (imagem ou PDF) ────────────────────────────
  if (['imagem', 'comprovante_pdf', 'documento'].includes(tipo) && s.etapa === S.AGUARDA_PIX) {
    await processarComprovante(tel, conteudo, s);
    rmk.agendar(BOT, tel);
    return;
  }

  // ── Comprovante chegou fora do fluxo PIX (pessoa mandou antes de confirmar cargo)
  if (['imagem', 'comprovante_pdf'].includes(tipo) && s.pedido && s.etapa !== S.CONCLUIDO) {
    set(BOT, tel, { etapa: S.AGUARDA_PIX });
    await processarComprovante(tel, conteudo, { ...s, etapa: S.AGUARDA_PIX });
    rmk.agendar(BOT, tel);
    return;
  }

  // ── Silêncio após compra Buritis (aguarda entrega manual) ──
  if (s.etapa === S.CONCLUIDO) {
    // Responde minimamente sem reativar o fluxo
    await zapi.texto(BOT, tel,
      `Oi! 😊 Seu pedido já está registrado — nossa equipe enviará o material em breve!\n\nQualquer outra dúvida pode perguntar!`
    );
    rmk.cancelar(BOT, tel); // nunca agenda após concluído
    return;
  }

  // ── Aguardando PIX — cliente mandou texto ──────────────────
  if (s.etapa === S.AGUARDA_PIX && tipo === 'texto') {
    // Responde humanamente mas não abandona o contexto do PIX
    const temComprovante = /paguei|pago|fiz|mandei|enviei|já paguei|comprovante/i.test(txt);
    if (temComprovante) {
      await zapi.texto(BOT, tel,
        `Boa! 😊 Agora é só me enviar o *print ou PDF* do comprovante que libero na hora! 📸`
      );
    } else {
      await zapi.texto(BOT, tel,
        `Ainda aguardando o comprovante! 😊\n\nChave PIX: *${cfg.pix}*\nValor: *${fmt(s.pedido?.valor || 19.90)}*\n\nManda o print ou PDF aqui! 📸`
      );
    }
    rmk.agendar(BOT, tel);
    return;
  }

  // ── Confirmação de cargo antes do PIX ─────────────────────
  if (s.etapa === S.CONFIRMA) {
    await processarConfirmacao(tel, txt, s);
    rmk.agendar(BOT, tel);
    return;
  }

  // ── Motor principal: IA ────────────────────────────────────
  await motorIA(tel, txt, s);
  rmk.agendar(BOT, tel);
}

// ─────────────────────────────────────────────────────────────
// MOTOR IA
// ─────────────────────────────────────────────────────────────
async function motorIA(tel, txt, s) {
  if (!s.etapa) set(BOT, tel, { etapa: S.LIVRE });

  const hist = s.hist || [];
  hist.push({ role: 'user', content: txt });

  const resposta = await ia.responderCompleto(PROMPT, txt, hist.slice(-14));
  hist.push({ role: 'assistant', content: resposta });
  set(BOT, tel, { hist: hist.slice(-20), etapa: S.LIVRE });

  // Detecta marcador de compra
  const matchCompra = resposta.match(/\[COMPRA:\s*(.+?)\]/i);
  const matchAtend  = /\[ATENDENTE\]/i.test(resposta);

  // Remove marcadores da resposta antes de enviar
  const respostaLimpa = resposta
    .replace(/\[COMPRA:[^\]]+\]/gi, '')
    .replace(/\[ATENDENTE\]/gi, '')
    .trim();

  if (respostaLimpa) await zapi.texto(BOT, tel, respostaLimpa);

  if (matchAtend) {
    await wait(500);
    await zapi.notificar(BOT, tel, 'Pediu atendente — Secretaria', { nome: s.nome });
    return;
  }

  if (matchCompra) {
    const cargoDetectado = matchCompra[1].trim();
    await wait(600);
    await iniciarCompra(tel, cargoDetectado, s);
  }
}

// ─────────────────────────────────────────────────────────────
// INÍCIO DO FLUXO DE COMPRA
// ─────────────────────────────────────────────────────────────
async function iniciarCompra(tel, cargoTexto, s) {
  const low = cargoTexto.toLowerCase();
  const ehBuritis  = low.includes('buritis');
  const ehCombo    = low.includes('combo') || low.includes('todas') || low.includes('completo');

  // COMBO Paracatu
  if (!ehBuritis && ehCombo) {
    const total = (cfg.paracatu.precoCargo * 27).toFixed(2).replace('.', ',');
    set(BOT, tel, {
      etapa: S.CONFIRMA,
      pedido: { produto: 'COMBO Completo Paracatu 2026 — 27 apostilas', valor: cfg.paracatu.precoCombo, tipo: 'combo_paracatu' },
      _confirmando: 'pronto',
    });
    await zapi.texto(BOT, tel,
`🔥 *COMBO Paracatu 2026 — 27 apostilas*

Separado seriam *R$ ${total}*... no COMBO você paga só *R$ 49,90*! 🎁
Acesso imediato após o PIX.

Posso gerar o pagamento? *1* Sim | *2* Não`
    );
    return;
  }

  // COMBO Buritis
  if (ehBuritis && ehCombo) {
    set(BOT, tel, {
      etapa: S.CONFIRMA,
      pedido: { produto: 'COMBO Completo Buritis/MG — todos os cargos', valor: cfg.buritis.precoCombo, tipo: 'combo_buritis' },
      _confirmando: 'pronto',
    });
    await zapi.texto(BOT, tel,
`🔥 *COMBO Buritis/MG — 64 cargos*

Saúde, Social e Educação num pacote só — *R$ 49,90*!
Material enviado pela equipe via WhatsApp.

Confirma? *1* Sim | *2* Não`
    );
    return;
  }

  // Apostila Buritis (cargo específico)
  if (ehBuritis) {
    const nomeCargo = cargoTexto.replace(/buritis/gi,'').replace(/apostila/gi,'').trim();
    set(BOT, tel, {
      etapa: S.CONFIRMA,
      pedido: { produto: `Apostila ${nomeCargo} — Buritis/MG`, valor: cfg.buritis.precoCargo, tipo: 'cargo_buritis' },
      _confirmando: 'pronto',
    });
    await zapi.texto(BOT, tel,
`📘 *Apostila ${nomeCargo} — Buritis/MG*

💰 *R$ 19,90* — material enviado pelo WhatsApp após confirmação.

Posso gerar o PIX? *1* Sim | *2* Não`
    );
    return;
  }

  // Apostila Paracatu (cargo específico) — busca no catálogo
  let cargoEncontrado = null;
  for (const area of cfg.paracatu.areas) {
    for (const cargo of area.cargos) {
      const tituloLow = cargo.titulo.toLowerCase();
      // Verifica palavras significativas (> 4 letras)
      const palavras = low.split(/\s+/).filter(w => w.length > 4);
      if (palavras.some(w => tituloLow.includes(w)) || tituloLow.includes(low.replace(/apostila|paracatu/gi,'').trim())) {
        cargoEncontrado = cargo;
        break;
      }
    }
    if (cargoEncontrado) break;
  }

  if (cargoEncontrado) {
    set(BOT, tel, {
      etapa: S.CONFIRMA,
      pedido: {
        produto: `Apostila ${cargoEncontrado.titulo} — Paracatu 2026`,
        valor:   cfg.paracatu.precoCargo,
        tipo:    'cargo_paracatu',
        driveId: cargoEncontrado.drive,
      },
      _confirmando: 'pronto',
    });
    await zapi.texto(BOT, tel,
`📘 *Apostila ${cargoEncontrado.titulo}*
Paracatu 2026 — IBGP | ${cargoEncontrado.pags} páginas

📦 LP • Raciocínio Lógico • Informática • Conhecimentos Gerais
🎯 ${cargoEncontrado.esp}

💰 *R$ 19,90* — link enviado na hora via PIX

*1* Garantir agora! | *2* Ver o COMBO (R$ 49,90)`
    );
    return;
  }

  // Cargo não identificado — pede confirmação
  set(BOT, tel, { etapa: S.CONFIRMA, _confirmando: 'identificar' });
  await zapi.texto(BOT, tel,
    `Qual é o cargo exato que você vai concorrer? Me diz o nome que eu já localizo a apostila certa! 😊`
  );
}

// ─────────────────────────────────────────────────────────────
// CONFIRMAÇÃO ANTES DO PIX
// ─────────────────────────────────────────────────────────────
async function processarConfirmacao(tel, txt, s) {
  // Precisa identificar o cargo primeiro
  if (s._confirmando === 'identificar') {
    set(BOT, tel, { etapa: S.LIVRE, _confirmando: null });
    await iniciarCompra(tel, txt, s);
    return;
  }

  const sim = /^1$|sim|quero|pode|bora|ok|isso|vai|confirm/i.test(txt.trim());
  const nao = /^2$|não|nao|cancel|desist|voltar|depois/i.test(txt.trim());

  if (nao) {
    set(BOT, tel, { etapa: S.LIVRE, _confirmando: null, pedido: null });
    await zapi.texto(BOT, tel, `Tudo bem! Quando quiser é só chamar 😊`);
    return;
  }

  if (txt.trim() === '2' && s.pedido?.tipo === 'cargo_paracatu') {
    // Quer ver o COMBO em vez do cargo
    set(BOT, tel, { _confirmando: null });
    await iniciarCompra(tel, 'COMBO Paracatu', s);
    return;
  }

  if (sim || s._confirmando === 'pronto') {
    const pedido = s.pedido;
    if (!pedido) {
      set(BOT, tel, { etapa: S.LIVRE });
      await zapi.texto(BOT, tel, `Me diz qual apostila você quer que eu gero o PIX! 😊`);
      return;
    }
    set(BOT, tel, { etapa: S.AGUARDA_PIX, _confirmando: null });
    await zapi.texto(BOT, tel,
`✅ Ótimo! Segue o pagamento:

🏷 *${pedido.produto}*
💰 *${fmt(pedido.valor)}*

📲 *Chave PIX (CNPJ):*
\`${cfg.pix}\`

Após pagar, manda o *print ou PDF* do comprovante aqui! 📸`
    );
    return;
  }

  // Texto livre na etapa de confirmação — volta para IA com contexto
  set(BOT, tel, { etapa: S.LIVRE });
  await motorIA(tel, txt, s);
}

// ─────────────────────────────────────────────────────────────
// COMPROVANTE PIX (imagem ou PDF)
// ─────────────────────────────────────────────────────────────
async function processarComprovante(tel, urlArquivo, s) {
  await zapi.texto(BOT, tel, `🔍 Recebi! Verificando...`);

  const pedido = s.pedido;
  if (!pedido) {
    await zapi.texto(BOT, tel,
      `Recebi o arquivo, mas não encontrei um pedido ativo 🤔\n\nMe diz o que você comprou que eu verifico!`
    );
    return;
  }

  const resultado = await pix.validar(urlArquivo, pedido.valor);
  const hora = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  const nome = s.nome || 'aluno(a)';

  if (resultado.ok === true) {
    // Pagamento confirmado automaticamente
    await zapi.texto(BOT, tel, `✅ *Pagamento confirmado!* Obrigado, ${nome}! 🎉`);
    await wait(800);
    await liberarProduto(tel, pedido, nome, hora);
    set(BOT, tel, { pedido: null, _comprado: true, etapa: S.LIVRE });
    rmk.cancelar(BOT, tel);

  } else if (resultado.ok === false) {
    if (resultado.motivo === 'valor_errado') {
      await zapi.texto(BOT, tel,
        `O comprovante mostra *${fmt(resultado.valorPago)}* mas o valor do pedido é *${fmt(pedido.valor)}* 🤔\n\nVerifica e envia novamente!`
      );
    } else if (resultado.motivo === 'nao_pix') {
      await zapi.texto(BOT, tel,
        `Não consegui identificar um comprovante PIX aí 🤔\n\nPode enviar o *print do comprovante PIX* completo? 📸`
      );
    } else {
      // Erro desconhecido → libera com notificação manual
      await confirmarELiberar(tel, pedido, nome, hora, urlArquivo);
    }

  } else {
    // ok === null → PDF ou erro de IA → libera automaticamente + notifica
    await confirmarELiberar(tel, pedido, nome, hora, urlArquivo);
  }
}

// ─────────────────────────────────────────────────────────────
// LIBERA PRODUTO + NOTIFICA (usado para PDF e confirmação manual)
// ─────────────────────────────────────────────────────────────
async function confirmarELiberar(tel, pedido, nome, hora, urlArquivo) {
  // Para Paracatu: libera automaticamente (temos os links)
  if (pedido.tipo === 'cargo_paracatu' || pedido.tipo === 'combo_paracatu') {
    await zapi.texto(BOT, tel, `✅ *Comprovante recebido!*\n\nProcessando seu pedido agora... 📦`);
    await wait(800);
    await liberarProduto(tel, pedido, nome, hora);
    set(BOT, tel, { pedido: null, _comprado: true, etapa: S.LIVRE });
    rmk.cancelar(BOT, tel);
    // Notifica para conferência
    await zapi.notificarAtendente(
`💰 *VENDA CONFIRMADA (comprovante recebido)*

🛒 ${pedido.produto}
💰 ${fmt(pedido.valor)}
👤 ${nome}
📱 ${tel}
🕐 ${hora}
⚠️ _Confira se o pagamento foi efetivado no PIX_`
    );

  } else {
    // Buritis: equipe precisa enviar manualmente
    await zapi.texto(BOT, tel,
`✅ *Comprovante recebido!*

Nossa equipe já foi notificada e enviará o material *aqui pelo WhatsApp* o mais rápido possível! 😊

_Seg-Sex 8h-18h | Sáb 8h-12h_ ⏱️`
    );
    await zapi.notificarAtendente(
`📦 *ENVIO MANUAL — SECRETARIA*

🛒 ${pedido.produto}
💰 ${fmt(pedido.valor)}
👤 ${nome}
📱 ${tel}
🕐 ${hora}

_Envie o material para esse número!_ 👆`
    );
    if (urlArquivo) await zapi.comprovante(BOT, tel, nome, pedido.produto, urlArquivo);
    set(BOT, tel, { etapa: S.CONCLUIDO, _comprado: true });
    rmk.cancelar(BOT, tel);
  }
}

// ─────────────────────────────────────────────────────────────
// LIBERAR PRODUTO
// ─────────────────────────────────────────────────────────────
async function liberarProduto(tel, pedido, nome, hora) {
  const n = nome || 'aluno(a)';
  hora = hora || new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

  if (pedido.tipo === 'cargo_buritis' || pedido.tipo === 'combo_buritis') {
    await zapi.texto(BOT, tel,
`🎉 *Pedido confirmado, ${n}!*

📋 ${pedido.produto}
💰 ${fmt(pedido.valor)} — Pago ✔️

📲 Nossa equipe enviará o material *aqui* o mais rápido possível!
_Seg-Sex 8h-18h | Sáb 8h-12h_ ⏱️`
    );
    await zapi.notificarAtendente(
`📦 *ENVIO MANUAL — SECRETARIA*
🛒 ${pedido.produto}
💰 ${fmt(pedido.valor)} — PAGO ✔️
👤 ${n} | 📱 ${tel} | 🕐 ${hora}
_Envie o material para esse número!_ 👆`
    );
    set(BOT, tel, { etapa: S.CONCLUIDO });
    rmk.cancelar(BOT, tel);
    return;
  }

  if (pedido.tipo === 'cargo_paracatu' && pedido.driveId) {
    await zapi.apostila(BOT, tel, pedido.driveId, pedido.produto, n);
    await wait(600);
    await zapi.texto(BOT, tel,
      `🎉 Material enviado, ${n}! Bons estudos e boa sorte em *23 de agosto*! 💪🏆`
    );
    await zapi.notificarAtendente(
`💰 *VENDA PARACATU — SECRETARIA*
🛒 ${pedido.produto} | 💰 ${fmt(pedido.valor)}
👤 ${n} | 📱 ${tel} | 🕐 ${hora}
✅ Apostila entregue automaticamente`
    );
    return;
  }

  if (pedido.tipo === 'combo_paracatu') {
    await zapi.texto(BOT, tel, `📦 Enviando as 27 apostilas... aguarda alguns minutos! ⏳`);
    for (const area of cfg.paracatu.areas) {
      for (const cargo of area.cargos) {
        if (cargo.drive) {
          await zapi.apostila(BOT, tel, cargo.drive, `Apostila ${cargo.titulo}`, n);
          await wait(3000);
        }
      }
    }
    await zapi.texto(BOT, tel, `✅ Tudo enviado, ${n}! Bons estudos! 💪🏆`);
    await zapi.notificarAtendente(
`💰 *VENDA COMBO PARACATU — SECRETARIA*
🛒 ${pedido.produto} | 💰 ${fmt(pedido.valor)}
👤 ${n} | 📱 ${tel} | 🕐 ${hora}
✅ 27 apostilas entregues`
    );
  }
}

// ─────────────────────────────────────────────────────────────
// CONFIRMAÇÃO / RECUSA MANUAL (atendente)
// ─────────────────────────────────────────────────────────────
async function confirmarPedido(tel, s) {
  if (!s.pedido) return;
  const hora = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  await zapi.texto(BOT, tel, `✅ *Pagamento confirmado!* Obrigado! 🎉`);
  await wait(600);
  await liberarProduto(tel, s.pedido, s.nome, hora);
  set(BOT, tel, { pedido: null, _comprado: true, etapa: S.LIVRE });
  rmk.cancelar(BOT, tel);
}

async function recusarPedido(tel, s) {
  set(BOT, tel, { etapa: S.AGUARDA_PIX });
  await zapi.texto(BOT, tel,
    `Não conseguimos confirmar o pagamento 😔\n\nPode enviar o comprovante novamente?\n\nChave PIX: *${cfg.pix}* | Valor: *${fmt(s.pedido?.valor || 19.90)}*`
  );
}

module.exports = { processar, confirmarPedido, recusarPedido };
