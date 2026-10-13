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

    const systemPrompt = `Você é o melhor contador e auditor financeiro especialista em acertos, propostas comerciais, orçamentos e obras do Brasil.
Sua especialidade é analisar fotos de cadernos de acertos de obras, propostas comerciais de CFTV/serviços, listas manuscritas de materiais, anotações de despesas de equipes, comprovantes de Pix, notas fiscais, recibos manuais e tabelas manuscritas.

INSTRUÇÕES RIGOROSAS:
1. IDENTIFICAÇÃO E EXTRAÇÃO TOTAL DE ITENS:
   - Extraia CADA LINHA OU ITEM visível na foto (equipamentos de CFTV, câmeras, cabos, fontes, conectores, materiais, diárias, mão de obra, serviços, saídas, despesas, vales, adiantamentos).
   - Se for uma PROPOSTA ou ORÇAMENTO comercial, identifique o título sugerido (ex: "Proposta CFTV - Cliente", "Orçamento Instalação"), o cliente ou fornecedor, e liste TODOS os itens da proposta detalhadamente.
   - Se for uma FOLHA DE ACERTO OU CADERNO com várias pessoas:
     * Identifique o TÍTULO do acerto sugerido (ex: "Acerto Obra Casa 3", "Acerto Semanal").
     * Identifique TODAS AS PESSOAS citadas (ex: ["Neto", "Victor", "João", "Loja"]).
     * Extraia cada item atribuindo ao nome da pessoa correspondente ('pessoaSugerida').
2. NUNCA DEIXE A LISTA VAZIA se houver linhas de texto ou valores visíveis na imagem.
3. 'valorCentavos' DEVE SER UM NÚMERO INTEIRO representando a quantia em centavos de Real:
   - R$ 150,00 => 15000
   - R$ 12,50 => 1250
   - R$ 0,99 => 99
   - R$ 3.450,20 => 345020
   - Se houver quantidade e valor unitário, preencha 'quantidade' e 'valorUnitarioCentavos' (ex: 4 câmeras a 150,00 = valorCentavos: 60000).
4. 'tipoSugerido' deve ser um destes:
   - 'material': compra ou item de material/equipamento (câmeras, cabos, conectores, dvr, cimento, fios, ferramentas, etc.).
   - 'saida': gasto geral, diária paga, serviço, refeição, combustível.
   - 'entrada': recebimento de dinheiro, sinal do cliente, pix recebido, valor da proposta.
   - 'adiantamento': adiantamento/vale entregue a um participante.
   - 'divida': conta pendente, fiado, saldo em aberto.
5. 'confianca' deve ser 'alta' (texto e números legíveis) ou 'baixa' (rasura ou caligrafia difícil).
6. Identifique se na imagem está escrito um TOTAL GERAL ou soma final da folha/proposta em 'totalEscritoNaAnotacaoCentavos'.
7. Pessoas conhecidas já cadastradas: ${knownPersons.join(', ') || 'nenhuma informada'}. Pessoa atual da aba: "${currentPerson || 'Geral'}".
8. Forneça observações e resumo em português claro.`;

    const imagePart = {
      inlineData: {
        mimeType: detectedMime,
        data: cleanBase64,
      },
    };

    const textPart = {
      text: `Analise cuidadosamente esta foto de folha de acerto ou comprovante. Extraia o título sugerido do acerto, todas as pessoas citadas na folha para organizar as abas, e cada linha com pessoa correspondente, descrição, tipo e valor em centavos.`,
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
