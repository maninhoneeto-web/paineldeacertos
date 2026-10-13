 
  import { GoogleGenAI, Type } from '@google/genai';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  // Set CORS headers
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
        error: 'A chave da API Gemini (GEMINI_API_KEY) não está configurada no ambiente do servidor ou Vercel.',
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

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

    const systemPrompt = `Você é o melhor contador e auditor financeiro pessoal e de obras do Brasil. Sua especialidade é analisar fotos de cadernos de acertos de obras, anotações de despesas de equipes, comprovantes de Pix, notas fiscais, recibos manuais e tabelas manuscritas.

INSTRUÇÕES RIGOROSAS:
1. SE FOR UMA FOLHA DE ACERTO OU CADERNO COM VÁRIAS PESSOAS:
   - Identifique o TÍTULO do acerto sugerido (ex: "Acerto Obra Casa 3", "Acerto Semanal Pedreiros", "Contas Outubro").
   - Identifique TODAS AS PESSOAS ou fornecedores citados (ex: ["João", "Tiago", "Valdeci", "Loja do Pedro"]).
   - Extraia CADA LINHA individual atribuindo ao nome da pessoa correspondente.
2. NUNCA invente ou adivinhe valores. Se um número for ilegível, rasurado ou cortado, deixe 'valorCentavos' como 0 e marque 'confianca' como 'baixa'.
3. 'valorCentavos' DEVE SER UM NÚMERO INTEIRO representando a quantia em centavos de Real:
   - R$ 150,00 => 15000
   - R$ 12,50 => 1250
   - R$ 0,99 => 99
   - R$ 3.450,20 => 345020
4. 'tipoSugerido' deve ser um destes:
   - 'entrada': recebimento de dinheiro, pix recebido, adiantamento de cliente.
   - 'saida': gasto geral, combustível, refeição, diária paga, serviço.
   - 'adiantamento': adiantamento/vale entregue a um funcionário ou parceiro.
   - 'material': compra de materiais (cimento, areia, fios, tintas, parafusos, etc.) com loja, quantidade e valor unitário.
   - 'divida': conta pendente, fiado, boleto a pagar, promissória ou saldo em aberto.
5. 'confianca' deve ser 'alta' (texto e números claros) ou 'baixa' (rasura, caligrafia difícil, dobra no papel, número incerto).
6. Identifique se na imagem está escrito um TOTAL GERAL ou soma final da folha em 'totalEscritoNaAnotacaoCentavos'.
7. Pessoas conhecidas já cadastradas: ${knownPersons.join(', ') || 'nenhuma informada'}. Pessoa atual da aba: "${currentPerson || 'Geral'}".
8. Forneça observações e resumo em português claro.`;

    const imagePart = {
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: cleanBase64,
      },
    };

    const textPart = {
      text: `Analise cuidadosamente esta foto de folha de acerto ou comprovante. Extraia o título sugerido do acerto, todas as pessoas citadas na folha para organizar as abas, e cada linha com pessoa correspondente, descrição, tipo e valor em centavos.`,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tipoDocumento: {
              type: Type.STRING,
              description: 'Tipo do documento (ex: Folha de Caderno de Acerto, Comprovante Pix, Cupom Fiscal, Recibo Manuscrito, etc.)',
            },
            tituloSugeridoAcerto: {
              type: Type.STRING,
              description: 'Título sugerido para o acerto identificado na folha (ex: "Acerto Obra Fazenda", "Semana Equipe Silva")',
            },
            todasPessoasIdentificadas: {
              type: Type.ARRAY,
              description: 'Lista com o nome de todas as pessoas, funcionários ou parceiros encontrados na folha',
              items: { type: Type.STRING },
            },
            totalEscritoNaAnotacaoCentavos: {
              type: Type.INTEGER,
              description: 'Total geral escrito explicitamente no documento em centavos',
            },
            totalEscritoFormatado: {
              type: Type.STRING,
              description: 'Texto exato do total escrito (ex: "R$ 450,00")',
            },
            estabelecimentoOuLoja: {
              type: Type.STRING,
              description: 'Nome da loja ou estabelecimento se identificado',
            },
            dataGeral: {
              type: Type.STRING,
              description: 'Data geral identificada no documento (YYYY-MM-DD)',
            },
            observacoes: {
              type: Type.STRING,
              description: 'Resumo e observações da auditoria contábil',
            },
            linhas: {
              type: Type.ARRAY,
              description: 'Lista de todos os lançamentos extraídos da imagem',
              items: {
                type: Type.OBJECT,
                properties: {
                  data: {
                    type: Type.STRING,
                    description: 'Data do item no formato YYYY-MM-DD',
                  },
                  descricao: {
                    type: Type.STRING,
                    description: 'Descrição detalhada do item ou transação',
                  },
                  quantidade: {
                    type: Type.NUMBER,
                    description: 'Quantidade (padrão 1 se não especificado)',
                  },
                  valorUnitarioCentavos: {
                    type: Type.INTEGER,
                    description: 'Valor unitário em centavos',
                  },
                  valorCentavos: {
                    type: Type.INTEGER,
                    description: 'Valor total da linha em centavos (número inteiro)',
                  },
                  valorOriginalTexto: {
                    type: Type.STRING,
                    description: 'Texto original do valor como visto na imagem',
                  },
                  tipoSugerido: {
                    type: Type.STRING,
                    description: 'Tipo: "entrada", "saida", "adiantamento", "material" ou "divida"',
                  },
                  categoria: {
                    type: Type.STRING,
                    description: 'Categoria financeira (Mão de Obra, Materiais, Alimentação, Combustível, etc.)',
                  },
                  formaPagamento: {
                    type: Type.STRING,
                    description: 'Forma de pagamento (Pix, Dinheiro, Cartão, etc.)',
                  },
                  pessoaSugerida: {
                    type: Type.STRING,
                    description: 'Nome da pessoa relacionada a esta linha específica',
                  },
                  confianca: {
                    type: Type.STRING,
                    description: '"alta" ou "baixa"',
                  },
                  loja: {
                    type: Type.STRING,
                    description: 'Nome da loja se for material',
                  },
                  dividaDeQuem: {
                    type: Type.STRING,
                    description: 'Se for dívida: "eu_devo" ou "me_devem"',
                  },
                },
                required: ['descricao', 'valorCentavos', 'tipoSugerido', 'confianca'],
              },
            },
          },
          required: ['tipoDocumento', 'linhas'],
        },
      },
    });

    const responseText = response.text || '{}';
    const parsedData = JSON.parse(responseText);

    return res.status(200).json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Erro na extração Gemini:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro inesperado ao processar a imagem com o Gemini.',
    });
  }
}
