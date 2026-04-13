// remarketing.js — Follow-up por inatividade (20/40/60 min)
// REGRA: NÃO dispara se pedido foi concluído ou sessão encerrada
const zapi = require('./zapi');
const { getSession, E } = require('./storage');

const timers = new Map();
const MS = 20 * 60 * 1000;

// Etapas que NÃO devem receber remarketing (compra concluída ou bot pausado)
const ETAPAS_BLOQUEADAS = new Set([
  'sec_pix_enviado',
  'sec_concluido',
  'pix_enviado',
  E.INICIO,
]);

// Etapas que indicam compra finalizada — nunca remarketar
function compraFinalizada(etapa) {
  return ETAPAS_BLOQUEADAS.has(etapa);
}

const MSGS = {
  concursos: [
    (n) => `${n}, ainda está escolhendo sua apostila? 😊\n\nDigite *menu* pra continuar de onde parou!`,
    (n) => `${n}, 🔥 a prova de Paracatu é em *23/08* — quem começa cedo sai na frente!\n\nApostila por *R$ 19,90*, acesso imediato!`,
    (n) => `${n}, última mensagem! 😊 Estou por aqui quando precisar!`,
  ],
  secretaria: [
    (n) => `${n}, conseguiu o que precisava? 😊\n\nSe ainda tiver dúvida ou quiser saber mais sobre nossos cursos, pode perguntar!`,
    (n) => `${n}, só passando pra lembrar que estamos com apostilas para o concurso de *Paracatu 2026* por R$ 19,90! 📚\n\nQuer saber mais?`,
    (n) => `${n}, última mensagem por aqui! Quando precisar, é só chamar. 😊`,
  ],
  vestibular: [
    (n) => `${n}, ficou com alguma dúvida sobre o *Pré-Vestibular*? 😊`,
    (n) => `${n}, nosso pré-vest tem ajudado muitos alunos a conquistar a vaga! 🎓\n\nQuer conhecer melhor?`,
    (n) => `${n}, estou por aqui quando quiser! 😊`,
  ],
  informatica: [
    (n) => `${n}, ainda pensando no curso de *Informática*? Temos opções a partir de *R$ 99,79/mês*! 😊`,
    (n) => `${n}, informática hoje é essencial em qualquer carreira! 💻\n\nPosso te ajudar a escolher?`,
    (n) => `${n}, estou aqui quando quiser saber mais! 😊`,
  ],
  online: [
    (n) => `${n}, ainda está vendo nossos cursos online? Certificado incluso! 😊`,
    (n) => `${n}, temos cursos a partir de *R$ 197,90*! 🎓`,
    (n) => `${n}, estou por aqui quando precisar! 😊`,
  ],
};

function tk(botId, tel) { return `${botId}:${tel}`; }

function agendar(botId, tel) {
  cancelar(botId, tel);
  disparar(botId, tel, 0);
}

function disparar(botId, tel, rodada) {
  if (rodada > 2) return;
  const t = setTimeout(async () => {
    try {
      const s = getSession(botId, tel);

      // Bloqueia se: humano ativo, sem etapa, compra finalizada, pedido concluído
      if (s.humano) return;
      if (!s.etapa) return;
      if (compraFinalizada(s.etapa)) return;
      // Não manda se tem pedido concluído recentemente (flag _comprado)
      if (s._comprado) return;

      const fnMsgs = MSGS[botId] || MSGS.secretaria;
      const fn = fnMsgs[rodada];
      if (!fn) return;

      const n = s.nome ? `*${s.nome}*` : 'você';
      const msg = fn(n);
      console.log(`[RMK:${botId}] rodada ${rodada + 1}/3 → ${tel}`);
      await zapi.texto(botId, tel, msg);
      disparar(botId, tel, rodada + 1);
    } catch (e) { console.error('[RMK]', e.message); }
  }, MS);
  timers.set(tk(botId, tel), t);
}

function cancelar(botId, tel) {
  const k = tk(botId, tel);
  if (timers.has(k)) { clearTimeout(timers.get(k)); timers.delete(k); }
}

module.exports = { agendar, cancelar };
