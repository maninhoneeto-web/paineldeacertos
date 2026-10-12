import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Handle JSON payloads up to 50MB for receipt photo transfers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Gemini SDK with User-Agent header as required
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Endpoint: Receipt OCR & Financial extraction using Gemini
app.post('/api/gemini/extract-receipt', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', knownPersons = [], currentPerson = '' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma imagem foi enviada para processamento.',
      });
    }

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'A chave da API Gemini (GEMINI_API_KEY) não está configurada no ambiente.',
      });
    }

    // Strip data URL scheme prefix if present
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

    const systemPrompt = `Você é o melhor contador e auditor financeiro pessoal e empresarial do Brasil.
Sua especialidade é ler e conferir comprovantes de Pix, notas fiscais (NF-e, NFC-e, SAT), recibos manuais de papel, cadernos de anotação de obras, conversas e prints de WhatsApp com valores, tabelas de gastos e recibos de pagamento.

INSTRUÇÕES RIGOROSAS:
1. Extraia CADA LANÇAMENTO ou item individual legível na imagem.
2. NUNCA invente ou adivinhe valores. Se um número for ilegível, rasurado ou cortado, deixe 'valorCentavos' como 0 e marque 'confianca' como 'baixa'.
3. 'valorCentavos' DEVE SER UM NÚMERO INTEIRO representando a quantia em centavos de Real:
   - R$ 150,00 => 15000
   - R$ 12,50 => 1250
   - R$ 0,99 => 99
   - R$ 3.450,20 => 345020
4. 'tipoSugerido' deve ser um destes:
   - 'entrada': recebimento de dinheiro, pix recebido, pagamento de cliente.
   - 'saida': gasto geral, combustível, refeição, diária paga, serviço.
   - 'adiantamento': adiantamento/vale entregue a um funcionário ou parceiro.
   - 'material': compra de materiais (cimento, areia, fios, tintas, parafusos, etc.) com loja, quantidade e valor unitário.
   - 'divida': conta pendente, fiado, boleto a pagar, promissória ou saldo em aberto.
5. 'confianca' deve ser 'alta' (texto e números claros) ou 'baixa' (rasura, caligrafia difícil, dobra no papel, número incerto).
6. Identifique se na imagem está escrito um TOTAL GERAL ou valor total do documento em 'totalEscritoNaAnotacaoCentavos'.
7. Se for citado o nome de uma pessoa, verifique se corresponde a uma das pessoas conhecidas: ${knownPersons.join(', ') || 'nenhuma informada'}. Pessoa atual da aba: "${currentPerson || 'Geral'}".
8. Forneça observações e resumo em português claro.`;

    const imagePart = {
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: cleanBase64,
      },
    };

    const textPart = {
      text: `Analise cuidadosamente esta imagem de comprovante/anotação financeira. Extraia todos os lançamentos em detalhes estruturados. Se for um comprovante Pix, identifique data/hora, valor total, pagador e recebedor. Se for caderno manuscrito, extraia cada linha com a descrição e o valor. Se houver total escrito pelo autor, extraia o total.`,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tipoDocumento: {
              type: Type.STRING,
              description: 'Tipo do documento (ex: Comprovante Pix, Recibo Manuscrito, Cupom Fiscal, Caderno de Obras, Nota Fiscal, etc.)',
            },
            totalEscritoNaAnotacaoCentavos: {
              type: Type.INTEGER,
              description: 'Total geral escrito explicitamente no documento em centavos (ou 0 se não houver soma explícita)',
            },
            totalEscritoFormatado: {
              type: Type.STRING,
              description: 'Texto exato do total escrito (ex: "R$ 450,00")',
            },
            estabelecimentoOuLoja: {
              type: Type.STRING,
              description: 'Nome da loja, banco ou estabelecimento identificado',
            },
            dataGeral: {
              type: Type.STRING,
              description: 'Data geral do documento no formato YYYY-MM-DD',
            },
            pessoaSugeridaGeral: {
              type: Type.STRING,
              description: 'Nome da pessoa mencionada no documento (pagador, beneficiário, cliente, etc.)',
            },
            observacoes: {
              type: Type.STRING,
              description: 'Observações, avisos de rasura ou resumo da leitura contábil',
            },
            linhas: {
              type: Type.ARRAY,
              description: 'Lista de todos os lançamentos ou itens extraídos da imagem',
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
                    description: 'Categoria financeira (ex: Mão de Obra, Materiais, Alimentação, Transporte, Pix, Adiantamento, Dívida, etc.)',
                  },
                  formaPagamento: {
                    type: Type.STRING,
                    description: 'Forma de pagamento (Pix, Dinheiro, Cartão, Transferência, Boleto, etc.)',
                  },
                  pessoaSugerida: {
                    type: Type.STRING,
                    description: 'Pessoa relacionada a esta linha',
                  },
                  confianca: {
                    type: Type.STRING,
                    description: '"alta" ou "baixa"',
                  },
                  loja: {
                    type: Type.STRING,
                    description: 'Nome da loja ou fornecedor se for material',
                  },
                  dividaDeQuem: {
                    type: Type.STRING,
                    description: 'Se tipo for divida: "eu_devo" ou "me_devem"',
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
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      return res.status(500).json({
        success: false,
        error: 'Erro ao interpretar a resposta da IA como JSON.',
        raw: responseText,
      });
    }

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string };
    console.error('Erro na extração Gemini:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Erro inesperado ao processar a imagem com o Gemini.',
    });
  }
});

// Setup Vite middlewares in development or static serving in production
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 AcertoFácil servidor rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer();
