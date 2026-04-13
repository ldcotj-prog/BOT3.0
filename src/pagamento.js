// pagamento.js — Validação de comprovante PIX (imagem ou PDF)
const axios = require('axios');
const cfg   = require('./config');

async function validar(urlArquivo, valorEsperado) {
  if (!urlArquivo) return { ok: null, motivo: 'sem_arquivo' };

  const url = String(urlArquivo).toLowerCase();

  // PDF não pode ser analisado por visão — confirma automaticamente
  // (a Z-API envia o PDF como documento, não tem como extrair imagem)
  if (url.includes('.pdf') || url.includes('pdf')) {
    console.log('[PIX] PDF detectado — confirmação automática (sem análise de visão)');
    return { ok: null, motivo: 'pdf_confirmar_manual' };
  }

  // Imagem — analisa com GPT-4o-mini
  try {
    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        max_tokens: 120,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: urlArquivo, detail: 'low' } },
            {
              type: 'text',
              text: 'Analise esta imagem. É um comprovante de PIX concluído? Qual o valor pago? Responda SOMENTE com JSON válido, sem markdown: {"isPix":true,"concluido":true,"valor":19.90}'
            },
          ],
        }],
      },
      { headers: { Authorization: `Bearer ${cfg.openai.key}`, 'Content-Type': 'application/json' } }
    );

    const raw = resp.data.choices[0].message.content
      .replace(/```json|```/g, '').trim();
    console.log('[PIX] Resposta IA:', raw);

    const r = JSON.parse(raw);

    if (!r.isPix)      return { ok: false, motivo: 'nao_pix' };
    if (!r.concluido)  return { ok: false, motivo: 'nao_concluido' };

    const valorPago = parseFloat(r.valor) || 0;
    if (Math.abs(valorPago - valorEsperado) > 1.00) {
      return { ok: false, motivo: 'valor_errado', valorPago };
    }

    return { ok: true };

  } catch (e) {
    console.error('[PIX] Erro IA:', e.message);
    return { ok: null, motivo: 'erro_tecnico' };
  }
}

module.exports = { validar };
