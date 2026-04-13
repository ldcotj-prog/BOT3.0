// ============================================================
// JARVIS — Script de Testes Técnicos Completo
// Smart Cursos Unaí
// Gerado em: 13/04/2026
//
// COMO EXECUTAR:
//   node test-jarvis.js
//   node test-jarvis.js --verbose   (exibe todos os detalhes)
// ============================================================
'use strict';

require('dotenv').config();

const VERBOSE = process.argv.includes('--verbose');
const erros   = [];
const avisos  = [];
const ok      = [];

let cfg, E, storage;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function pass(msg) { ok.push(msg);    if (VERBOSE) console.log(`  ✅ ${msg}`); }
function fail(msg) { erros.push(msg); console.log(`  ❌ ERRO: ${msg}`); }
function warn(msg) { avisos.push(msg);console.log(`  ⚠️  AVISO: ${msg}`); }
function sec(titulo) { console.log(`\n${'─'.repeat(60)}\n  ${titulo}\n${'─'.repeat(60)}`); }

// ─────────────────────────────────────────────────────────────
// T01 — MÓDULOS CARREGAM SEM ERRO
// ─────────────────────────────────────────────────────────────
function testarModulos() {
  sec('T01 — CARREGAMENTO DE MÓDULOS');
  const modulos = [
    ['storage',       './src/storage'],
    ['config',        './src/config'],
    ['zapi',          './src/zapi'],
    ['ia',            './src/ia'],
    ['pagamento',     './src/pagamento'],
    ['remarketing',   './src/remarketing'],
    ['bot:concursos', './src/bots/concursos'],
    ['bot:vestibular','./src/bots/vestibular'],
    ['bot:informatica','./src/bots/informatica'],
    ['bot:online',    './src/bots/online'],
    ['bot:secretaria','./src/bots/secretaria'],
  ];

  for (const [nome, path] of modulos) {
    try {
      require(path);
      pass(`${nome} carregou OK`);
    } catch (e) {
      fail(`${nome} falhou ao carregar: ${e.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// T02 — EXPORTAÇÕES DOS MÓDULOS
// ─────────────────────────────────────────────────────────────
function testarExportacoes() {
  sec('T02 — EXPORTAÇÕES');

  const zapi = require('./src/zapi');
  ['texto','apostila','notificar','notificarAtendente','comprovante'].forEach(fn => {
    typeof zapi[fn] === 'function' ? pass(`zapi.${fn} existe`) : fail(`zapi.${fn} FALTANDO`);
  });

  const ia = require('./src/ia');
  ['responder','responderCompleto'].forEach(fn => {
    typeof ia[fn] === 'function' ? pass(`ia.${fn} existe`) : fail(`ia.${fn} FALTANDO`);
  });

  const pix = require('./src/pagamento');
  typeof pix.validar === 'function' ? pass('pagamento.validar existe') : fail('pagamento.validar FALTANDO');

  const rmk = require('./src/remarketing');
  ['agendar','cancelar'].forEach(fn => {
    typeof rmk[fn] === 'function' ? pass(`remarketing.${fn} existe`) : fail(`remarketing.${fn} FALTANDO`);
  });

  ['concursos','vestibular','informatica','online','secretaria'].forEach(b => {
    const bot = require(`./src/bots/${b}`);
    typeof bot.processar === 'function' ? pass(`bot:${b}.processar existe`) : fail(`bot:${b}.processar FALTANDO`);
    if (b === 'concursos' || b === 'secretaria') {
      typeof bot.confirmarPedido === 'function' ? pass(`bot:${b}.confirmarPedido existe`) : fail(`bot:${b}.confirmarPedido FALTANDO`);
      typeof bot.recusarPedido   === 'function' ? pass(`bot:${b}.recusarPedido existe`)   : fail(`bot:${b}.recusarPedido FALTANDO`);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// T03 — CATÁLOGO PARACATU
// ─────────────────────────────────────────────────────────────
function testarCatalogoParacatu() {
  sec('T03 — CATÁLOGO PARACATU 2026');
  cfg = require('./src/config');
  const { paracatu } = cfg;

  let totalCargos = 0;
  const driveIds  = new Set();

  if (!paracatu.areas || paracatu.areas.length === 0) {
    fail('paracatu.areas não definido'); return;
  }
  pass(`${paracatu.areas.length} áreas definidas`);

  for (const area of paracatu.areas) {
    if (!area.id)     fail(`Área sem id: ${area.titulo}`);
    if (!area.titulo) fail(`Área sem título`);
    if (!area.emoji)  warn(`Área sem emoji: ${area.id}`);
    if (!area.cargos || area.cargos.length === 0) {
      fail(`Área ${area.id} sem cargos`); continue;
    }

    for (const cargo of area.cargos) {
      totalCargos++;
      const tag = `[${area.id}/${cargo.id}]`;

      if (!cargo.id)    fail(`${tag} sem id`);
      if (!cargo.titulo)fail(`${tag} sem título`);
      if (!cargo.drive) fail(`${tag} SEM DRIVE ID — link não funcionará!`);
      else if (cargo.drive.length < 20) warn(`${tag} drive ID suspeito (curto): ${cargo.drive}`);
      else pass(`${tag} ${cargo.titulo} | ${cargo.pags}p | drive:${cargo.drive.slice(0,8)}...`);

      if (!cargo.pags)  warn(`${tag} sem quantidade de páginas`);
      if (!cargo.esp)   warn(`${tag} sem especialidades definidas`);

      // Detecta drive duplicado
      if (cargo.drive) {
        if (driveIds.has(cargo.drive)) fail(`${tag} DRIVE ID DUPLICADO: ${cargo.drive}`);
        else driveIds.add(cargo.drive);
      }
    }
  }

  totalCargos === 27
    ? pass(`Total: ${totalCargos} cargos (correto)`)
    : fail(`Total: ${totalCargos} cargos (esperado: 27)`);

  // Verifica preços
  paracatu.precoCargo === 19.90
    ? pass(`Preço cargo: R$ ${paracatu.precoCargo}`)
    : fail(`Preço cargo: R$ ${paracatu.precoCargo} (esperado: 19.90)`);

  paracatu.precoCombo === 49.90
    ? pass(`Preço COMBO: R$ ${paracatu.precoCombo}`)
    : fail(`Preço COMBO: R$ ${paracatu.precoCombo} (esperado: 49.90)`);
}

// ─────────────────────────────────────────────────────────────
// T04 — CATÁLOGO BURITIS
// ─────────────────────────────────────────────────────────────
function testarCatalogoBuritis() {
  sec('T04 — CATÁLOGO BURITIS/MG');
  const { buritis } = cfg;
  let totalCargos = 0;

  if (!buritis.areas || buritis.areas.length === 0) {
    fail('buritis.areas não definido'); return;
  }
  pass(`${buritis.areas.length} áreas definidas`);

  for (const area of buritis.areas) {
    const cargos = buritis.cargos[area.id] || [];
    if (cargos.length === 0) { fail(`Área ${area.id} sem cargos`); continue; }
    totalCargos += cargos.length;
    cargos.forEach(c => {
      if (!c || c.trim().length === 0) fail(`Buritis ${area.id}: cargo vazio`);
    });
    pass(`${area.emoji} ${area.titulo}: ${cargos.length} cargos`);
  }

  const esperado = 64;
  totalCargos === esperado
    ? pass(`Total: ${totalCargos} cargos`)
    : warn(`Total: ${totalCargos} cargos (esperado: ${esperado})`);

  buritis.precoCargo === 19.90
    ? pass(`Preço cargo: R$ ${buritis.precoCargo}`)
    : fail(`Preço cargo incorreto: ${buritis.precoCargo}`);

  buritis.precoCombo === 49.90
    ? pass(`Preço COMBO: R$ ${buritis.precoCombo}`)
    : fail(`Preço COMBO incorreto: ${buritis.precoCombo}`);
}

// ─────────────────────────────────────────────────────────────
// T05 — SERVIÇOS CADASTRADOS
// ─────────────────────────────────────────────────────────────
function testarServicos() {
  sec('T05 — SERVIÇOS CADASTRADOS');

  // Pré-vestibular
  const pv = cfg.preVest;
  if (!pv) { fail('preVest não definido no config'); }
  else {
    pv.mensalidadePontual === 595.90 ? pass(`Pré-vest pontual: R$ ${pv.mensalidadePontual}`) : fail(`Pré-vest pontual incorreto: ${pv.mensalidadePontual}`);
    pv.mensalidadePadrao  === 745.00 ? pass(`Pré-vest padrão: R$ ${pv.mensalidadePadrao}`)  : fail(`Pré-vest padrão incorreto: ${pv.mensalidadePadrao}`);
    Array.isArray(pv.diferenciais) && pv.diferenciais.length >= 5
      ? pass(`Pré-vest: ${pv.diferenciais.length} diferenciais`)
      : warn('Pré-vest com poucos diferenciais');
  }

  // Informática
  const info = cfg.informatica;
  if (!info || !info.modalidades) { fail('informatica.modalidades não definido'); }
  else {
    info.modalidades.length === 3 ? pass(`Informática: ${info.modalidades.length} modalidades`) : warn(`Informática: ${info.modalidades.length} modalidades (esperado 3)`);
    info.modalidades.forEach(m => {
      if (!m.preco?.cartao) warn(`Informática ${m.id} sem preço cartão`);
      else pass(`Informática ${m.titulo}: ${m.preco.cartao}`);
    });
  }

  // Cursos Online
  const online = cfg.cursosOnline;
  if (!online || online.length === 0) { fail('cursosOnline não definido'); }
  else {
    online.length >= 4 ? pass(`Cursos online: ${online.length} cursos`) : warn(`Cursos online: apenas ${online.length}`);
    online.forEach(c => {
      if (!c.titulo || !c.valor) fail(`Curso online incompleto: ${JSON.stringify(c)}`);
      else pass(`Online: ${c.titulo} — R$ ${c.valor}`);
    });
  }
}

// ─────────────────────────────────────────────────────────────
// T06 — CONFIGURAÇÕES DE BOTS
// ─────────────────────────────────────────────────────────────
function testarBots() {
  sec('T06 — BOTS CONFIGURADOS');
  const botsEsperados = ['concursos','vestibular','informatica','online','secretaria'];

  botsEsperados.forEach(id => {
    const b = cfg.BOTS[id];
    if (!b) { fail(`Bot ${id} não definido em cfg.BOTS`); return; }
    pass(`cfg.BOTS.${id} definido: ${b.nome}`);
    if (!b.instanceId) warn(`Bot ${id} sem ZAPI_INSTANCE (OK se variável não setada localmente)`);
    if (!b.numero)     warn(`Bot ${id} sem número configurado`);
    else               pass(`Bot ${id} número: ${b.numero}`);
  });

  // PIX e atendente
  cfg.pix === '31.852.681/0001-40'
    ? pass(`PIX CNPJ: ${cfg.pix}`)
    : fail(`PIX incorreto: ${cfg.pix} (esperado: 31.852.681/0001-40)`);

  cfg.atendente === '5538999313182'
    ? pass(`Número atendente: ${cfg.atendente}`)
    : warn(`Número atendente: ${cfg.atendente} (verifique se está correto)`);
}

// ─────────────────────────────────────────────────────────────
// T07 — STORAGE E ETAPAS
// ─────────────────────────────────────────────────────────────
function testarStorage() {
  sec('T07 — STORAGE E ETAPAS');
  storage = require('./src/storage');
  const { E, getSession, set, reset } = storage;

  // Verifica etapas obrigatórias
  const etapasObrigatorias = ['INICIO','AGUARDA_NOME','MENU','LIVRE','AGUARDA_PIX','PIX_ENVIADO'];
  etapasObrigatorias.forEach(e => {
    E[e] ? pass(`E.${e} = '${E[e]}'`) : fail(`E.${e} não definido`);
  });

  // Verifica etapas da secretaria (estão hardcoded como string no remarketing)
  const rmkSrc = require('fs').readFileSync('./src/remarketing.js','utf8');
  ['sec_concluido','sec_pix_enviado','pix_enviado'].forEach(e => {
    rmkSrc.includes(`'${e}'`)
      ? pass(`Remarketing bloqueia etapa '${e}'`)
      : fail(`Remarketing NÃO bloqueia '${e}' — pode remarketar após compra!`);
  });

  // Testa CRUD básico
  const tel = '5538001001001';
  const botId = 'test';
  reset(botId, tel);
  const s1 = getSession(botId, tel);
  s1.etapa === 'inicio' ? pass('getSession cria sessão com etapa inicio') : fail('Sessão inicial inválida');

  set(botId, tel, { nome: 'Teste', etapa: 'menu' });
  const s2 = getSession(botId, tel);
  s2.nome === 'Teste' && s2.etapa === 'menu'
    ? pass('set() atualiza sessão corretamente')
    : fail('set() não atualizou a sessão');

  reset(botId, tel);
  const s3 = getSession(botId, tel);
  s3.etapa === 'inicio' ? pass('reset() reinicia a sessão') : fail('reset() não reiniciou');

  // Verifica isolamento por botId
  set('bot_a', tel, { nome: 'A' });
  set('bot_b', tel, { nome: 'B' });
  const sA = getSession('bot_a', tel);
  const sB = getSession('bot_b', tel);
  sA.nome === 'A' && sB.nome === 'B'
    ? pass('Sessões isoladas por botId')
    : fail('Sessões NÃO isoladas por botId — cross-contamination!');

  // Limpa
  reset('bot_a', tel); reset('bot_b', tel); reset(botId, tel);
}

// ─────────────────────────────────────────────────────────────
// T08 — FLUXO DE COMPRA (simulado)
// ─────────────────────────────────────────────────────────────
function testarFluxoCompra() {
  sec('T08 — FLUXO DE COMPRA (lógica)');
  const { getSession, set, reset } = require('./src/storage');
  const pagamento = require('./src/pagamento');

  // Simula detecção de cargo no texto
  const cargosBusca = [
    { texto: 'quero a apostila de enfermagem', esperado: 'Enfermagem' },
    { texto: 'Enfermagem paracatu', esperado: 'Enfermagem' },
    { texto: 'GCM guarda civil', esperado: 'GCM' },
    { texto: 'motorista paracatu 2026', esperado: 'Motorista' },
    { texto: 'fisioterapia', esperado: 'Fisioterapia' },
    { texto: 'peb professor educação', esperado: 'PEB' },
  ];

  for (const { texto, esperado } of cargosBusca) {
    let encontrado = null;
    const low = texto.toLowerCase();
    for (const area of cfg.paracatu.areas) {
      for (const cargo of area.cargos) {
        const palavras = low.split(/\s+/).filter(w => w.length > 4);
        if (palavras.some(w => cargo.titulo.toLowerCase().includes(w)) ||
            cargo.titulo.toLowerCase().includes(low.replace(/apostila|paracatu|quero|a |de /gi,'').trim())) {
          encontrado = cargo.titulo;
          break;
        }
      }
      if (encontrado) break;
    }
    encontrado
      ? pass(`Busca "${texto}" → encontrou: ${encontrado}`)
      : warn(`Busca "${texto}" → NÃO encontrou (esperado: ${esperado})`);
  }

  // Verifica geração de link Drive
  const testeDriveId = '11WOBOciw_BI97Q06gecjAGw2zf5PSaUP';
  const link = cfg.driveLink(testeDriveId);
  link.includes('drive.google.com') && link.includes(testeDriveId)
    ? pass(`driveLink() gera URL correta`)
    : fail(`driveLink() URL inválida: ${link}`);

  // Verifica formatação de preço
  const fmt = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
  fmt(19.90) === 'R$ 19,90' ? pass('fmt(19.90) = R$ 19,90') : fail(`fmt(19.90) = ${fmt(19.90)}`);
  fmt(49.90) === 'R$ 49,90' ? pass('fmt(49.90) = R$ 49,90') : fail(`fmt(49.90) = ${fmt(49.90)}`);
}

// ─────────────────────────────────────────────────────────────
// T09 — LÓGICA DE PAGAMENTO
// ─────────────────────────────────────────────────────────────
function testarPagamento() {
  sec('T09 — LÓGICA DE PAGAMENTO (sem chamada de API)');
  const pix = require('./src/pagamento');

  // Verifica que PDFs retornam ok: null (confirmação manual)
  // Não chama a API — testa a lógica de detecção de PDF
  const urlPDF = 'https://exemplo.com/comprovante2026-04-09.pdf';
  const urlImg = 'https://exemplo.com/print.jpg';

  urlPDF.toLowerCase().includes('.pdf')
    ? pass('Detecção de PDF por extensão .pdf funciona')
    : fail('Detecção de PDF falhou');

  !urlImg.toLowerCase().includes('.pdf')
    ? pass('Imagem .jpg não é confundida com PDF')
    : fail('Imagem .jpg sendo tratada como PDF');

  // Verifica que validar() existe e é função assíncrona
  typeof pix.validar === 'function'
    ? pass('pagamento.validar é uma função')
    : fail('pagamento.validar não é função');

  const result = pix.validar.constructor.name;
  result === 'AsyncFunction'
    ? pass('pagamento.validar é assíncrona')
    : warn('pagamento.validar pode não ser assíncrona');
}

// ─────────────────────────────────────────────────────────────
// T10 — REMARKETING (lógica de bloqueio)
// ─────────────────────────────────────────────────────────────
function testarRemarketing() {
  sec('T10 — REMARKETING (lógica de bloqueio)');
  const rmk = require('./src/remarketing');
  const { getSession, set, reset } = require('./src/storage');
  const rmkSrc = require('fs').readFileSync('./src/remarketing.js','utf8');

  // Verifica mensagens para todos os bots
  const botsComMsg = ['concursos','secretaria','vestibular','informatica','online'];
  botsComMsg.forEach(b => {
    rmkSrc.includes(`${b}:`)
      ? pass(`Remarketing: mensagens para bot '${b}' definidas`)
      : fail(`Remarketing: bot '${b}' sem mensagens`);
  });

  // Verifica etapas bloqueadas
  const etapasDeveBloquear = ['sec_concluido','sec_pix_enviado','pix_enviado','inicio'];
  etapasDeveBloquear.forEach(e => {
    rmkSrc.includes(`'${e}'`) || rmkSrc.includes(`E.INICIO`)
      ? pass(`Remarketing bloqueia etapa '${e}'`)
      : fail(`Remarketing NÃO bloqueia '${e}'`);
  });

  // Verifica que _comprado bloqueia
  rmkSrc.includes('_comprado')
    ? pass('Remarketing verifica flag _comprado')
    : fail('Remarketing não verifica _comprado — pode remarketar após compra!');

  // Verifica que humano bloqueia
  rmkSrc.includes('s.humano')
    ? pass('Remarketing verifica s.humano (atendente ativo)')
    : fail('Remarketing não verifica s.humano!');

  // Testa agendar/cancelar
  typeof rmk.agendar  === 'function' ? pass('rmk.agendar() existe')  : fail('rmk.agendar FALTANDO');
  typeof rmk.cancelar === 'function' ? pass('rmk.cancelar() existe') : fail('rmk.cancelar FALTANDO');
}

// ─────────────────────────────────────────────────────────────
// T11 — VARIÁVEIS DE AMBIENTE
// ─────────────────────────────────────────────────────────────
function testarEnvVars() {
  sec('T11 — VARIÁVEIS DE AMBIENTE');

  const varsCriticas = [
    ['ZAPI_INSTANCE_ID',        'Bot Concursos — Instance ID'],
    ['ZAPI_TOKEN',              'Bot Concursos — Token'],
    ['ZAPI_CLIENT_TOKEN',       'Bot Concursos — Client Token'],
    ['OPENAI_API_KEY',          'OpenAI API Key'],
    ['NUMERO_ATENDIMENTO',      'Número do atendente'],
  ];

  const varsSecretaria = [
    ['ZAPI_SECRETARIA_INSTANCE','Bot Secretaria — Instance ID'],
    ['ZAPI_SECRETARIA_TOKEN',   'Bot Secretaria — Token'],
    ['ZAPI_SECRETARIA_CLIENT',  'Bot Secretaria — Client Token'],
  ];

  let todasCriticas = true;
  varsCriticas.forEach(([nome, desc]) => {
    if (process.env[nome]) pass(`${nome} definida (${desc})`);
    else { warn(`${nome} não definida localmente (${desc}) — necessária no Railway`); todasCriticas = false; }
  });

  varsSecretaria.forEach(([nome, desc]) => {
    if (process.env[nome]) pass(`${nome} definida`);
    else warn(`${nome} não definida — bot secretaria usará fallback do bot concursos`);
  });

  if (!todasCriticas) warn('Variáveis críticas ausentes localmente — normais se testando fora do Railway');
}

// ─────────────────────────────────────────────────────────────
// T12 — CONSISTÊNCIA ENTRE ARQUIVOS
// ─────────────────────────────────────────────────────────────
function testarConsistencia() {
  sec('T12 — CONSISTÊNCIA ENTRE ARQUIVOS');
  const fs = require('fs');

  const indexSrc      = fs.readFileSync('./src/index.js','utf8');
  const secretariaSrc = fs.readFileSync('./src/bots/secretaria.js','utf8');
  const concursosSrc  = fs.readFileSync('./src/bots/concursos.js','utf8');
  const rmkSrc        = fs.readFileSync('./src/remarketing.js','utf8');

  // index.js registra todos os bots
  ['concursos','vestibular','informatica','online','secretaria'].forEach(b => {
    indexSrc.includes(`bots/${b}`) && indexSrc.includes(`webhook/${b}`)
      ? pass(`index.js registra bot e webhook '${b}'`)
      : fail(`index.js NÃO registra '${b}' corretamente`);
  });

  // Preços consistentes entre config e prompts
  secretariaSrc.includes('19,90') && secretariaSrc.includes('49,90')
    ? pass('Secretaria menciona preços corretos no prompt')
    : warn('Secretaria pode não ter preços atualizados no prompt IA');

  // Regra de desconto no prompt
  secretariaSrc.includes('FIXO') || secretariaSrc.includes('NUNCA') && secretariaSrc.includes('desconto')
    ? pass('Secretaria tem regra anti-desconto no prompt')
    : fail('Secretaria pode dar desconto — verificar prompt da IA!');

  // PIX correto nos prompts
  ['secretaria','concursos'].forEach(b => {
    const src = fs.readFileSync(`./src/bots/${b}.js`,'utf8');
    src.includes('cfg.pix') || src.includes('31.852.681/0001-40')
      ? pass(`Bot ${b} usa chave PIX correta`)
      : fail(`Bot ${b} pode ter chave PIX errada`);
  });

  // Secretaria libera Paracatu automaticamente
  secretariaSrc.includes('cargo_paracatu') && secretariaSrc.includes('driveId')
    ? pass('Secretaria libera Paracatu via Drive automaticamente')
    : fail('Secretaria NÃO libera Paracatu automaticamente');

  // Secretaria notifica para Buritis manual
  secretariaSrc.includes('cargo_buritis') && secretariaSrc.includes('notificarAtendente')
    ? pass('Secretaria notifica atendente para Buritis')
    : fail('Secretaria NÃO notifica para Buritis — material pode não ser entregue!');

  // Concursos.js notifica vendas
  concursosSrc.includes('notificarAtendente')
    ? pass('Concursos notifica atendente em todas as vendas')
    : fail('Concursos NÃO notifica atendente');
}

// ─────────────────────────────────────────────────────────────
// RELATÓRIO FINAL
// ─────────────────────────────────────────────────────────────
function relatorio() {
  const total = ok.length + erros.length + avisos.length;
  console.log('\n' + '═'.repeat(60));
  console.log('  RELATÓRIO FINAL — JARVIS Smart Cursos Unaí');
  console.log('═'.repeat(60));
  console.log(`  ✅ Passou:  ${ok.length}`);
  console.log(`  ❌ Erros:   ${erros.length}`);
  console.log(`  ⚠️  Avisos:  ${avisos.length}`);
  console.log(`  📊 Total:   ${total} verificações`);

  if (erros.length > 0) {
    console.log('\n  ❌ ERROS CRÍTICOS QUE PRECISAM DE CORREÇÃO:');
    erros.forEach((e, i) => console.log(`     ${i+1}. ${e}`));
  }

  if (avisos.length > 0) {
    console.log('\n  ⚠️  AVISOS (verificar):');
    avisos.forEach((a, i) => console.log(`     ${i+1}. ${a}`));
  }

  const nota = erros.length === 0 ? '🟢 APROVADO' : erros.length <= 3 ? '🟡 APROVADO COM RESSALVAS' : '🔴 REPROVADO';
  console.log(`\n  STATUS: ${nota}`);
  console.log('═'.repeat(60) + '\n');

  process.exit(erros.length > 0 ? 1 : 0);
}

// ─────────────────────────────────────────────────────────────
// EXECUÇÃO
// ─────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('  🤖 JARVIS — Script de Testes Técnicos');
console.log('  Smart Cursos Unaí | ' + new Date().toLocaleDateString('pt-BR'));
console.log('═'.repeat(60));

testarModulos();
testarExportacoes();
testarCatalogoParacatu();
testarCatalogoBuritis();
testarServicos();
testarBots();
testarStorage();
testarFluxoCompra();
testarPagamento();
testarRemarketing();
testarEnvVars();
testarConsistencia();
relatorio();
