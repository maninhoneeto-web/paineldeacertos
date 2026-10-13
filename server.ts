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

    // Strip data URL scheme prefix if present and detect mimeType
    let cleanBase64 = imageBase64;
    let detectedMime = mimeType || 'image/jpeg';
    const matchMime = imageBase64.match(/^data:([^;]+);base64,/);
    if (matchMime) {
      detectedMime = matchMime[1];
      cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
    }

    const systemPrompt = `Você é o melhor contador e auditor financeiro especialista em acertos de obras, cadernos financeiros, propostas comerciais e orçamentos do Brasil.
Sua especialidade é analisar fotos de cadernos de acertos de obras manuscritos, folhas com colunas divididas por pessoa (ex: colunas para Neto, Victor, etc.), notas de despesas de equipes, comprovantes de Pix, recibos manuais e propostas de CFTV/serviços.

INSTRUÇÕES RIGOROSAS DE DISTRIBUIÇÃO E AUDITORIA:
1. RECONHECIMENTO DE PESSOAS E COLUNAS:
   - Cadernos de obra frequentemente organizam as contas em colunas ou blocos separados para cada pessoa (ex: uma coluna ou seção com o nome "Neto", outra com "Victor", etc.).
   - Identifique TODAS AS PESSOAS encontradas no documento e liste em 'todasPessoasIdentificadas'.
   - Cada linha ou anotação que estiver abaixo do nome ou na coluna de uma pessoa DEVE OBRIGATORIAMENTE ter o campo 'pessoaSugerida' preenchido com o nome exato dessa pessoa.
   - Pessoas conhecidas já cadastradas no acerto: ${knownPersons.join(', ') || 'Neto, Victor'}. Se a anotação corresponder a uma delas, use o mesmo nome.

2. CLASSIFICAÇÃO RIGOROSA DE DESPESAS, ADIANTAMENTOS E MATERIAIS ('tipoSugerido'):
   - 'adiantamento': OBRIGATÓRIO para qualquer item que represente VALE, ADIANTAMENTO, RETIRADA, 'PEGOU', 'ADIANTADO', 'VALE PIX', 'VALE EM DINHEIRO' recebido por uma pessoa.
   - 'saida': OBRIGATÓRIO para despesas pagas pela obra ou pela pessoa (diárias de ajudante, alimentação/almoço/café, combustível/gasolina, pedágio, transporte, pequenos serviços).
   - 'material': OBRIGATÓRIO para materiais de instalação, cabos, câmeras, conectores, fontes, dvr, parafusos, cimento, fios, ferramentas e compras de obra.
   - 'entrada': OBRIGATÓRIO para valores recebidos (adiantamento do cliente da obra, pagamentos recebidos, medições, faturamento).
   - 'divida': para fiados ou contas pendentes a pagar.

3. EXTRAÇÃO COMPLETA DE TODOS OS ITENS:
   - Extraia CADA LINHA ou item visível na imagem. NUNCA resuma ou omita itens.
   - 'valorCentavos': número inteiro em centavos de Real (ex: R$ 150,00 => 15000; R$ 601,00 => 60100; R$ 12,50 => 1250).
   - 'quantidade': número de itens (padrão 1).

4. TOTAIS E CÁLCULOS:
   - Se a folha tiver somatórios ou subtotais manuscritos (ex: 'Total Neto', 'Total Geral', 'Soma'), informe em 'totalEscritoNaAnotacaoCentavos' e 'totalEscritoFormatado'.

5. Forneça observações contábeis claras indicando o total de despesas, vales e a distribuição identificada na foto.`;

    const imagePart = {
      inlineData: {
        mimeType: detectedMime,
        data: cleanBase64,
      },
    };

    const textPart = {
      text: `Analise cuidadosamente esta foto de folha de acerto ou comprovante. Faça a separação de cada pessoa (Neto, Victor, etc.), identifique rigorosamente o que é DESPESA, o que é ADIANTAMENTO/VALE e o que é MATERIAL, e extraia cada linha com a pessoa correspondente ('pessoaSugerida') e o valor correto em centavos.`,
    };

    const schemaConfig = {
      type: Type.OBJECT,
      properties: {
        tipoDocumento: {
          type: Type.STRING,
          description: 'Tipo do documento (ex: Folha de Caderno de Acerto, Comprovante Pix, Cupom Fiscal, Recibo Manuscrito, etc.)',
        },
        tituloSugeridoAcerto: {
          type: Type.STRING,
          description: 'Título sugerido para o acerto identificado na folha',
        },
        todasPessoasIdentificadas: {
          type: Type.ARRAY,
          description: 'Lista com o nome de todas as pessoas, funcionários ou parceiros encontrados na folha',
          items: { type: Type.STRING },
        },
        totalEscritoNaAnotacaoCentavos: {
          type: Type.NUMBER,
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
                type: Type.NUMBER,
                description: 'Valor unitário em centavos',
              },
              valorCentavos: {
                type: Type.NUMBER,
                description: 'Valor total da linha em centavos',
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
    };

    let response: any;
    let lastError: any;
    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest',
    ];

    for (const modelName of candidateModels) {
      try {
        console.log(`Tentando extração de foto com modelo: ${modelName}`);
        response = await ai.models.generateContent({
          model: modelName,
          contents: { parts: [imagePart, textPart] },
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema: schemaConfig,
          },
        });
        if (response && response.text) {
          console.log(`Sucesso na extração com modelo: ${modelName}`);
          break;
        }
      } catch (modelErr: any) {
        lastError = modelErr;
        console.warn(`Aviso: Modelo ${modelName} falhou (${modelErr.message || modelErr}), tentando próximo modelo...`);
      }
    }

    if (!response || !response.text) {
      throw new Error(
        `Todos os modelos de IA falharam ao processar a foto. Último erro: ${lastError?.message || 'Indisponibilidade momentânea'}`
      );
    }

    let responseText = response.text || '{}';
    // Strip markdown code fences if present (e.g., ```json ... ``` or ``` ...)
    responseText = responseText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();

    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      // Fallback: try finding first '{' and last '}'
      const firstBrace = responseText.indexOf('{');
      const lastBrace = responseText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          parsedData = JSON.parse(responseText.substring(firstBrace, lastBrace + 1));
        } catch {
          console.error('Failed to parse Gemini output:', responseText);
          return res.status(500).json({
            success: false,
            error: 'Erro ao interpretar a resposta da IA. O formato recebido não é um JSON válido.',
            raw: responseText.slice(0, 300),
          });
        }
      } else {
        console.error('Failed to parse Gemini output:', responseText);
        return res.status(500).json({
          success: false,
          error: 'Erro ao interpretar a resposta da IA como JSON.',
          raw: responseText.slice(0, 300),
        });
      }
    }

    // Ensure array fields exist and numbers are normalized to rounded integer cents
    if (!parsedData.linhas) {
      parsedData.linhas = [];
    }
    if (!parsedData.todasPessoasIdentificadas) {
      parsedData.todasPessoasIdentificadas = [];
    }

    parsedData.totalEscritoNaAnotacaoCentavos = Math.round(Number(parsedData.totalEscritoNaAnotacaoCentavos) || 0);

    parsedData.linhas = parsedData.linhas.map((l: any) => ({
      ...l,
      quantidade: Number(l.quantidade) || 1,
      valorCentavos: Math.round(Number(l.valorCentavos) || 0),
      valorUnitarioCentavos: l.valorUnitarioCentavos ? Math.round(Number(l.valorUnitarioCentavos)) : undefined,
    }));

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
