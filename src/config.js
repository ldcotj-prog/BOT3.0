// config.js — Configuração Multi-Bot JARVIS
require('dotenv').config();

const driveLink = (id) => `https://drive.google.com/file/d/${id}/view?usp=sharing`;

// ──────────────────────────────────────────────────────────────
// CREDENCIAIS Z-API POR BOT
// Cada bot tem sua própria instância Z-API e número WhatsApp
// ──────────────────────────────────────────────────────────────
const BOTS = {
  concursos: {
    nome:        'Concursos',
    numero:      process.env.ZAPI_CONCURSOS_NUMERO   || '5538999075448',
    instanceId:  process.env.ZAPI_CONCURSOS_INSTANCE || process.env.ZAPI_INSTANCE_ID,
    token:       process.env.ZAPI_CONCURSOS_TOKEN    || process.env.ZAPI_TOKEN,
    clientToken: process.env.ZAPI_CONCURSOS_CLIENT   || process.env.ZAPI_CLIENT_TOKEN,
  },
  vestibular: {
    nome:        'Vestibular',
    numero:      process.env.ZAPI_VESTIBULAR_NUMERO   || '',
    instanceId:  process.env.ZAPI_VESTIBULAR_INSTANCE || '',
    token:       process.env.ZAPI_VESTIBULAR_TOKEN    || '',
    clientToken: process.env.ZAPI_VESTIBULAR_CLIENT   || '',
  },
  informatica: {
    nome:        'Informatica',
    numero:      process.env.ZAPI_INFORMATICA_NUMERO   || '',
    instanceId:  process.env.ZAPI_INFORMATICA_INSTANCE || '',
    token:       process.env.ZAPI_INFORMATICA_TOKEN    || '',
    clientToken: process.env.ZAPI_INFORMATICA_CLIENT   || '',
  },
  online: {
    nome:        'CursosOnline',
    numero:      process.env.ZAPI_ONLINE_NUMERO   || '',
    instanceId:  process.env.ZAPI_ONLINE_INSTANCE || '',
    token:       process.env.ZAPI_ONLINE_TOKEN    || '',
    clientToken: process.env.ZAPI_ONLINE_CLIENT   || '',
  },
  secretaria: {
    nome:        'Secretaria',
    numero:      process.env.ZAPI_SECRETARIA_NUMERO   || '5538999313182',
    instanceId:  process.env.ZAPI_SECRETARIA_INSTANCE || process.env.ZAPI_INSTANCE_ID,
    token:       process.env.ZAPI_SECRETARIA_TOKEN    || process.env.ZAPI_TOKEN,
    clientToken: process.env.ZAPI_SECRETARIA_CLIENT   || process.env.ZAPI_CLIENT_TOKEN,
  },
};

// ──────────────────────────────────────────────────────────────
// CONFIGURAÇÕES GERAIS
// ──────────────────────────────────────────────────────────────
const cfg = {
  port:      process.env.PORT || 3000,
  atendente: process.env.NUMERO_ATENDIMENTO || '5538999313182',
  openai:    { key: process.env.OPENAI_API_KEY },
  landing:   process.env.LANDING_URL || 'https://bot-production-1561.up.railway.app/produtos',
  pix:       '31.852.681/0001-40',
  driveLink,
  BOTS,

  zapiUrl: (botId) => {
    const b = BOTS[botId];
    return `https://api.z-api.io/instances/${b.instanceId}/token/${b.token}`;
  },
  zapiHeaders: (botId) => ({
    'Client-Token': BOTS[botId].clientToken,
    'Content-Type': 'application/json',
  }),

  // ──────────────────────────────────────────────────────────
  // CATÁLOGO — PARACATU 2026
  // ──────────────────────────────────────────────────────────
  paracatu: {
    precoCargo: 19.90,
    precoCombo: 49.90,
    info: 'IBGP | 272 vagas | Prova: 23/08/2026',
    areas: [
      {
        id: 'saude', emoji: '🏥', titulo: 'Área da Saúde',
        cargos: [
          { id: 'enfermagem',      titulo: 'Enfermagem',                   drive: '11WOBOciw_BI97Q06gecjAGw2zf5PSaUP', pags: 189, esp: 'SUS, PNAB, Vigilância em Saúde, PNI, SAE, Diagnósticos NANDA-I' },
          { id: 'farmacia',        titulo: 'Farmácia',                     drive: '1BARdFb1Shn67GgbY2UQb2J2YnOSaTdKH', pags: 153, esp: 'Farmacologia, Assistência Farmacêutica no SUS, Farmácia Hospitalar' },
          { id: 'radiologia',      titulo: 'Radiologia',                   drive: '14T3hfv_nN31yftXHOO01ckqtpApftjlS', pags: 138, esp: 'Dir. Constitucional, Dir. Penal, ECA, CTB, Legislação Paracatu' },
          { id: 'odontologia',     titulo: 'Odontologia',                  drive: '1t5bgQ8KO42iF8uHq_tAAYoAnyIUjGDOd', pags: 155, esp: 'Diagnóstico de lesões bucais, Clínica odontológica, Saúde bucal coletiva' },
          { id: 'fisioterapia',    titulo: 'Fisioterapia',                 drive: '17TPGOpHmlFDQ60EOV2tgi84P4iHPaeMo', pags: 208, esp: 'Cinesioterapia, Fisioterapia traumato-ortopédica, Fisioterapia respiratória' },
          { id: 'analises',        titulo: 'Técnico em Análises Clínicas', drive: '1ebLoNgQV1oj5n-U8FntI7BwUDTh-BD3v', pags: 214, esp: 'Hematologia, Bioquímica, Microbiologia, Parasitologia, Imunologia' },
          { id: 'vigilancia',      titulo: 'Vigilância Sanitária',         drive: '1cW4p_i14mpndi1tG4BKdyltt1wJsxwD1', pags: 154, esp: 'Legislação sanitária, ANVISA, Vigilância de alimentos, Epidemiologia' },
        ],
      },
      {
        id: 'educacao', emoji: '📚', titulo: 'Área da Educação',
        cargos: [
          { id: 'peb',             titulo: 'PEB — Professor Ed. Básica',   drive: '1E_o-V90wpR7n2IEaDoOKwUfDWHj8XtE9', pags: 144, esp: 'Dir. Humanos, Dir. Constitucional, Dir. Penal, ECA, Legislação Paracatu' },
          { id: 'peb_arte',        titulo: 'PEB Arte',                     drive: '1qJPU4g0SY8CrW8NnGsLLOXEYfJt22CDU', pags: 199, esp: 'Dir. Humanos, Dir. Constitucional, Dir. Penal, ECA, Legislação Paracatu' },
          { id: 'peb_historia',    titulo: 'PEB História',                 drive: '1n6o94UX-O6JByb3Z-cZFdNfW0Cz8bw3t', pags: 154, esp: 'História do Brasil, MG e Paracatu, Historiografia, Didática' },
          { id: 'supervisor',      titulo: 'Supervisor Escolar',           drive: '1V0_kUF9j-Sg30PAKCKVjMIUIuA3MYuSn', pags: 173, esp: 'Gestão escolar, LDB/PNE/FUNDEB, Avaliação educacional, Educação inclusiva' },
          { id: 'educador_creche', titulo: 'Educador de Creche',           drive: '1oUtYuq0zC9u7JT7FZOucGdY9Up3Iytie', pags: 117, esp: 'Legislação da 1ª infância, Desenvolvimento 0-3 anos, O cuidar e o educar' },
          { id: 'bibliotecario',   titulo: 'Bibliotecário',                drive: '18rI6YD0DCkN1pFck5cUQHNqi-HvD5Rn9', pags: 196, esp: 'Biblioteconomia, Catalogação, Gestão de acervos, Biblioteca escolar' },
        ],
      },
      {
        id: 'administrativa', emoji: '🗂', titulo: 'Área Administrativa',
        cargos: [
          { id: 'oficial_adm',     titulo: 'Oficial Administrativo',       drive: '1_l4E0WBtUVRDNK-7fJ0FSgeZvhHjMDXm', pags: 264, esp: 'Administração pública, Dir. administrativo, Gestão de documentos' },
          { id: 'aux_secretaria',  titulo: 'Auxiliar de Secretaria',       drive: '16V9biF2pt8wi6_WF2Pm-z0wd7k5QUr-t', pags: 161, esp: 'Adm. pública, Redação oficial, Atendimento ao público, Protocolo' },
          { id: 'adm_aux',         titulo: 'Administração / Aux. Adm.',    drive: '1b472UpWf_atmsvGNZx1TW_hTSij4tUs3', pags: 194, esp: 'Administração geral, Gestão de processos, Comunicação organizacional' },
          { id: 'almoxarifado',    titulo: 'Almoxarifado',                 drive: '1Y5ukBkkFRKgDIuO_1L80Cf2wwIgESSL4', pags: 197, esp: 'Gestão de estoques, Patrimônio, Compras públicas, Licitações' },
          { id: 'assist_social',   titulo: 'Assistente Social',            drive: '1FEBX-QOXOTFa0HjYlaLr67tIpb8XOFwS', pags: 230, esp: 'Fundamentos do Serviço Social, ECA, Serviço Social no SUS' },
          { id: 'contabilidade',   titulo: 'Contabilidade',                drive: '1sgvfIFMceGQcdr2UB5ZXdGm8d9s8-DSn', pags: 205, esp: 'Contabilidade geral, Orçamento público PPA/LDO/LOA, LRF' },
        ],
      },
      {
        id: 'juridica', emoji: '⚖', titulo: 'Jurídica / Segurança',
        cargos: [
          { id: 'advogado',        titulo: 'Advogado',                     drive: '16pY7zg2WAkbEizMNE9sNcAV4kS8ntlWh', pags: 135, esp: 'Dir. Constitucional, Dir. Administrativo, Dir. Penal, CTB, ECA' },
          { id: 'gcm',             titulo: 'GCM — Guarda Civil Municipal', drive: '16mafamGWMgnkknq93HLGaKIUjMu3-uYQ', pags: 182, esp: 'Segurança Pública, Estatuto das Guardas, Dir. Penal, CTB, Uso da Força' },
          { id: 'psicologia',      titulo: 'Psicologia',                   drive: '1pEDCbigbYlXzaxfNcLpc7dV_fZ5_DAmF', pags: 136, esp: 'Dir. Humanos, Dir. Constitucional, Dir. Administrativo, ECA' },
          { id: 'vigia',           titulo: 'Vigia',                        drive: '1TgUBmun-TwEnSFj2kdbTnYFLadXEG0b-', pags: 169, esp: 'Controle de acesso, Prevenção incêndios, Primeiros socorros' },
        ],
      },
      {
        id: 'tecnica', emoji: '⚙', titulo: 'Área Técnica',
        cargos: [
          { id: 'eng_el1',         titulo: 'Engenharia Elétrica vol.1',    drive: '1dGoopWYwiSxcTCakC0xEtV4w_a3qKBy6', pags: 152, esp: 'Eletrotécnica, Instalações elétricas, Normas ABNT' },
          { id: 'eng_el2',         titulo: 'Engenharia Elétrica vol.2',    drive: '1m_pP7UFGGo9LrDCb4yAuEKKF0IP3YmOW', pags: 152, esp: 'Instalações avançadas, Projetos elétricos, Normas de segurança' },
          { id: 'eng_ambiental',   titulo: 'Engenheiro Ambiental',         drive: '1K3KR5tKryLmYhIwMKIIXVz9-YbLMGjyA', pags: 189, esp: 'Saneamento ambiental, Gestão ambiental ISO 14001' },
          { id: 'motorista',       titulo: 'Motorista',                    drive: '18EFNToV5gZ2yBzBXHN5pNQvaSpP7vGJF', pags: 204, esp: 'CTB completo, Direção defensiva, Veículos especiais' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // CATÁLOGO — BURITIS
  // ──────────────────────────────────────────────────────────
  buritis: {
    precoCargo: 19.90,
    precoCombo: 49.90,
    areas: [
      { id: 'saude',    emoji: '🏥', titulo: 'Área da Saúde',      qtd: 35 },
      { id: 'social',   emoji: '🤝', titulo: 'Assistência Social', qtd: 20 },
      { id: 'educacao', emoji: '📚', titulo: 'Área da Educação',   qtd: 9  },
    ],
    cargos: {
      saude: ['ACS ESF VI Canaã','ACS ESF VII Veredas','ACS Serra Bonita','ACS Vila Rosa e Região','ACS Vila Palmeira e Região','ACS Barriguda II e Região','ACS Vila Serrana','ACS Coopago e Região','Agente de Combate às Endemias','Auxiliar em Saúde Bucal','Técnico em Saúde Bucal','Dentista','Enfermeiro','Técnico em Enfermagem','Recepcionista','Artesão CAPS','Assistente Social CAPS','Técnico em Enfermagem CAPS','Pedagogo CAPS','Psicólogo CAPS','Assistente Social E-Multi','Fisioterapeuta E-Multi','Psicólogo E-Multi','Nutricionista E-Multi','Educador Físico E-Multi','Farmacêutico E-Multi','Técnico em Imobilização Ortopédica','Auxiliar de Análise Clínica','Digitador','Psicólogo — Autismo e TDAH','Terapeuta Ocupacional — Autismo e TDAH','Fisioterapeuta — Autismo e TDAH','Psicopedagogo — Autismo e TDAH','Nutricionista — Autismo e TDAH','Fonoaudiólogo — Autismo e TDAH'],
      social: ['Auxiliar de Coordenação SEMAS','Advogado SEMAS','Assistente Social SEMAS','Nutricionista SEMAS','Pedagogo SEMAS','Psicólogo SEMAS','Auxiliar de Cozinha e Limpeza','Auxiliar de Carga e Descarga','Agente Social','Atendente de Projeto','Cozinheira','Cuidador Social Diurno','Cuidador Social Noturno','Educador Social','Visitador do Cadastro Único','Horticultor','Instrutor de Artesanato','Motorista','Orientador de Oficinas Socioeducativas','Padeiro'],
      educacao: ['Assistente de Sala de Aula','Professor de AEE','Secretário Escolar','Educador Social — Educação','Professor PII Inglês','Professor PII Português','Professor PII Educação Física','Professor PI Educação Física','Monitor de Educação Infantil'],
    },
  },

  // ──────────────────────────────────────────────────────────
  // PRÉ-VESTIBULAR
  // ──────────────────────────────────────────────────────────
  preVest: {
    mensalidadePontual: 595.90,
    mensalidadePadrao:  745.00,
    diferenciais: [
      'Aulas presenciais Seg-Sex 19h-22h',
      'Plataforma digital + aulas gravadas',
      'Apostilas trimestrais (~540 questões)',
      'Sala de estudos aberta 8h-22h',
      'Professores especializados por disciplina',
      'Simulados mensais e correção individual',
      'Suporte pedagógico personalizado',
    ],
    cursos: [
      { id: 'enem',       titulo: 'Preparatório ENEM',         desc: 'Foco total nas 5 áreas do ENEM' },
      { id: 'fuvest',     titulo: 'Preparatório FUVEST/UNESP', desc: 'Vestibulares estaduais de SP' },
      { id: 'ufu',        titulo: 'Preparatório UFU/UNIMONTES',desc: 'Vestibulares regionais de MG' },
      { id: 'completo',   titulo: 'Preparatório Completo',     desc: 'ENEM + vestibulares simultâneo' },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // INFORMÁTICA
  // ──────────────────────────────────────────────────────────
  informatica: {
    modalidades: [
      {
        id: 'presencial',
        titulo: '🏫 Informática Presencial — 9 meses',
        duracao: '9 meses | 2x/semana | 120h certificadas',
        conteudo: 'Windows, Word, Excel, PowerPoint, Internet, Hardware, Software — básico ao avançado',
        preco: { cartao: '9x R$ 311,92', avista: 'R$ 2.456,37' },
      },
      {
        id: 'empresarial',
        titulo: '🏢 Informática Empresarial — 3 meses',
        duracao: '3 meses | foco no mercado de trabalho',
        conteudo: 'Excel avançado, Word profissional, PowerPoint, ferramentas empresariais',
        preco: { cartao: '10x R$ 99,79', avista: 'R$ 899,90' },
      },
      {
        id: 'online',
        titulo: '🌐 Informática Online',
        duracao: 'No seu ritmo | acesso por 12 meses',
        conteudo: 'Conteúdo completo com certificado digital — acesse de qualquer lugar',
        preco: { cartao: '10x R$ 29,79', avista: 'R$ 297,90' },
      },
    ],
  },

  // ──────────────────────────────────────────────────────────
  // CURSOS ONLINE
  // ──────────────────────────────────────────────────────────
  cursosOnline: [
    { id: 'ia',    titulo: 'IA para Negócios',               valor: 397.90, desc: 'ChatGPT, automações e IA aplicada ao trabalho' },
    { id: 'adm',   titulo: 'Auxiliar Administrativo Online', valor: 397.90, desc: 'Rotinas administrativas, documentos e gestão' },
    { id: 'gest',  titulo: 'Gestão Empresarial Completo',    valor: 297.90, desc: 'Liderança, planejamento e finanças empresariais' },
    { id: 'quim',  titulo: 'Química para Vestibulares',      valor: 197.90, desc: 'Conteúdo completo de Química para ENEM e vestibulares' },
    { id: 'excel', titulo: 'Excel do Zero ao Avançado',      valor: 197.90, desc: 'Fórmulas, tabelas dinâmicas, dashboards e macros' },
    { id: 'port',  titulo: 'Português e Redação',            valor: 197.90, desc: 'Gramática, interpretação e redação nota 1000' },
  ],
};

module.exports = cfg;
