/**
 * Serviço de comunicação robusto com a IA Gemini para OCR e organização automática de acertos.
 * Trata erros de rede, respostas não-JSON (como 404 HTML da Vercel) e oferece feedback amigável.
 */

import { ResultadoOCR } from '../types';

export interface ParametrosExtracaoOCR {
  imageBase64: string;
  mimeType?: string;
  knownPersons?: string[];
  currentPerson?: string;
}

export async function extrairDadosAcertoComGemini(params: ParametrosExtracaoOCR): Promise<ResultadoOCR> {
  const { imageBase64, mimeType = 'image/jpeg', knownPersons = [], currentPerson = '' } = params;

  try {
    const res = await fetch('/api/gemini/extract-receipt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64,
        mimeType,
        knownPersons,
        currentPerson,
      }),
    });

    const contentType = res.headers.get('content-type') || '';
    const responseText = await res.text();

    // Se o servidor retornou HTML (ex: erro 404 da Vercel "The page could not be found" ou 500)
    if (!contentType.includes('application/json') || responseText.trim().startsWith('<')) {
      if (res.status === 404 || responseText.includes('The page could not be found')) {
        throw new Error(
          'O endpoint de inteligência artificial (/api/gemini/extract-receipt) não foi encontrado no servidor. ' +
          'Se você está usando Vercel ou hospedagem estática, certifique-se de configurar a variável de ambiente GEMINI_API_KEY no painel da sua hospedagem.'
        );
      }
      throw new Error(`O servidor retornou uma resposta inesperada (Status ${res.status}). Detalhes: ${responseText.slice(0, 150)}...`);
    }

    let json: any;
    try {
      json = JSON.parse(responseText);
    } catch {
      throw new Error('Falha ao interpretar a resposta da IA. O formato recebido não é um JSON válido.');
    }

    if (!json.success) {
      throw new Error(json.error || 'Erro desconhecido ao processar o comprovante com o Gemini.');
    }

    return json.data as ResultadoOCR;
  } catch (error: any) {
    console.error('Erro na extração OCR:', error);
    throw error;
  }
}
