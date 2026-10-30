import { GoogleGenAI, Type } from '@google/genai';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  // Configuração CORS para Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  }

  try {
    const { imageBase64, mimeType = 'image/jpeg', knownPersons = [], currentPerson = '' } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma imagem foi enviada para processamento.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'A chave da API Gemini (GEMINI_API_KEY) não está configurada no painel da Vercel (Project Settings > Environment Variables).',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let cleanBase64 = imageBase64;
    let detectedMime = mimeType || 'image/jpeg';
    const matchMime = imageBase64.match(/^data:([^;]+);base64,/);
    if (matchMime) {
      detectedMime = matchMime[1];
      cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
    }

    const currentYear = new Date().getFullYear();

    const systemPrompt = `Você é um contador e auditor financeiro profissional especialista em acertos contábeis e cadernos de obras do Brasil.
Sua missão é transcrever fielmente CADA LINHA desta folha de caderno de acerto manuscrita e organizar todos os itens e cálculos em uma tabela contábil perfeita.

INSTRUÇÕES OBRIGATÓRIAS:
1. DETECÇÃO DA ESTRUTURA DO CADERNO:
   - Identifique o TÍTULO no topo (ex: "Acerto Victor", "Acerto Obra", etc.) e coloque em 'tituloSugeridoAcerto'.
   - O caderno contém colunas: DIA | VALOR | REFERENTE.
   - EXTRAIA CADA UMA DAS LINHAS da tabela para a lista 'linhas'! NÃO AGRUPE, NÃO OMITA NENHUMA LINHA!

2. CLASSIFICAÇÃO RIGOROSA DO 'tipoSugerido':
   - 'adiantamento': OBRIGATÓRIO para qualquer item que contenha "ADIANTAMENTO", "VALE", "PEGOU" ou adiantamento pessoal (ex: "Adiantamento 500,00", "Adiantamento 300,00").
   - 'material': OBRIGATÓRIO para câmeras, fontes, cabos, conectores, tubulações, peças, tintas, parafusos, materiais e compras de loja (ex: "CAMERAS (4)", "FONTE / CABO", "ENGEMOVIE MATERIAL", "ITATIAIA").
   - 'saida': para despesas operacionais da obra como combustível, alimentação, almoço, diária, pedágio.
   - 'entrada': OBRIGATÓRIO para valores de "NOTA", "FATURAMENTO", "RECEBIDO", "SINAL" ou pagamento do cliente (ex: "10/09 9.000 NOTA" => tipo: entrada, valor: 900000 centavos).

3. VALORES EM CENTAVOS ('valorCentavos' inteiro):
   - 500,00 => 50000
   - 330,00 => 33000
   - 100,00 => 10000
   - 125,00 => 12500
   - 300,00 => 30000
   - 130,00 => 13000
   - 601,66 => 60166
   - 2.110,00 => 211000
   - 9.000 => 900000 (R$ 9.000,00)

4. PESSOAS:
   - Se o caderno for intitulado "Acerto Victor" (ou outro nome), associe a pessoa (ex: "Victor") a todos os itens de adiantamento e ao documento.
   - Liste todos os nomes identificados em 'todasPessoasIdentificadas'.

5. CÁLCULO FINAL ESCRITO NO RODAPÉ:
   - No rodapé da folha existem somas manuscritas (ex: "TOTAL GASTOS: 3.396,66", "9000 - 3396,66 = 5603,34 / 2 = 2801,67 - 1300,00 = 1501,67").
   - Inclua no campo 'observacoes' o resumo desse cálculo para que o usuário veja a exata conferência contábil!`;

    const imagePart = {
      inlineData: {
        mimeType: detectedMime,
        data: cleanBase64,
      },
    };

    const textPart = {
      text: `Transcreva cada linha desta folha de caderno de acerto contábil (DIA, VALOR, REFERENTE e NOTA). Retorne o JSON com a lista completa de linhas, tipos, pessoas e o cálculo contábil.`,
    };

    // Modelos com suporte ativo oficial: 3.1-flash-lite, flash-latest, 3.8-flash
    const candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-3.8-flash',
    ];

    let response: any;
    let lastError: any;

    for (const modelName of candidateModels) {
      try {
        console.log(`[Vercel OCR] Tentando modelo: ${modelName}`);
        response = await ai.models.generateContent({
          model: modelName,
          contents: { parts: [imagePart, textPart] },
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
          },
        });
        if (response && response.text) {
          console.log(`[Vercel OCR] Sucesso com modelo: ${modelName}`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Vercel OCR] Falha com modelo ${modelName}:`, err.message || err);
      }
    }

    if (!response || !response.text) {
      throw new Error(`Falha ao ler foto com os modelos de IA disponíveis: ${lastError?.message || 'Tente novamente.'}`);
    }

    let responseText = response.text || '{}';
    responseText = responseText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();

    let parsedData: any;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      const firstBrace = responseText.indexOf('{');
      const lastBrace = responseText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        parsedData = JSON.parse(responseText.substring(firstBrace, lastBrace + 1));
      } else {
        throw new Error('A IA não retornou um formato JSON válido.');
      }
    }

    if (!parsedData.linhas || !Array.isArray(parsedData.linhas)) {
      parsedData.linhas = [];
    }
    if (!parsedData.todasPessoasIdentificadas || !Array.isArray(parsedData.todasPessoasIdentificadas)) {
      parsedData.todasPessoasIdentificadas = [];
    }

    // Normaliza linhas
    parsedData.linhas = parsedData.linhas.map((l: any, idx: number) => {
      let dataFinal = l.data || '';
      // Se a data vier como "26/09", normaliza para "YYYY-09-26"
      if (dataFinal.includes('/')) {
        const partes = dataFinal.split('/');
        if (partes.length === 2) {
          dataFinal = `${currentYear}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
        } else if (partes.length === 3) {
          const ano = partes[2].length === 2 ? `20${partes[2]}` : partes[2];
          dataFinal = `${ano}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
        }
      } else if (!dataFinal) {
        dataFinal = new Date().toISOString().slice(0, 10);
      }

      let valorCentavos = Math.round(Number(l.valorCentavos) || 0);
      // Se valorCentavos for menor que 100 e houver valorOriginalTexto com vírgula ou ponto
      if (valorCentavos === 0 && l.valorOriginalTexto) {
        const limpo = l.valorOriginalTexto.replace(/[^\d,\.]/g, '').replace(',', '.');
        valorCentavos = Math.round(parseFloat(limpo) * 100) || 0;
      }

      let tipoSugerido = l.tipoSugerido || 'saida';
      const descLower = (l.descricao || '').toLowerCase();
      if (descLower.includes('adiant') || descLower.includes('vale') || descLower.includes('pegou')) {
        tipoSugerido = 'adiantamento';
      } else if (descLower.includes('camera') || descLower.includes('câmera') || descLower.includes('material') || descLower.includes('fonte') || descLower.includes('cabo') || descLower.includes('itatiaia') || descLower.includes('engemovie')) {
        tipoSugerido = 'material';
      } else if (descLower.includes('nota') || descLower.includes('faturamento') || descLower.includes('entrada') || descLower.includes('recebido')) {
        tipoSugerido = 'entrada';
      }

      return {
        id: 'linha_' + Date.now() + '_' + idx,
        data: dataFinal,
        descricao: l.descricao || 'Item da anotação',
        quantidade: Number(l.quantidade) || 1,
        valorCentavos,
        valorOriginalTexto: l.valorOriginalTexto || (valorCentavos / 100).toFixed(2),
        tipoSugerido,
        categoria: l.categoria || (tipoSugerido === 'adiantamento' ? 'Adiantamento/Val' : tipoSugerido === 'material' ? 'Material de Construção' : 'Mão de Obra'),
        formaPagamento: l.formaPagamento || 'Pix',
        pessoaSugerida: l.pessoaSugerida || (parsedData.todasPessoasIdentificadas[0] || 'Geral'),
        confianca: l.confianca || 'alta',
        incluir: true,
      };
    });

    return res.status(200).json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Erro na extração Gemini na Vercel:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro inesperado ao processar a imagem com o Gemini.',
    });
  }
}
