/**
 * Utilitário de compressão de imagens de alta resolução no navegador
 * e cálculo de hash para prevenção de envio duplicado.
 */

export interface ImagemProcessada {
  dataUrl: string;
  hash: string;
  tamanhoOriginalBytes: number;
  tamanhoComprimidoBytes: number;
  largura: number;
  altura: number;
}

/**
 * Calcula hash SHA-256 no navegador usando Web Crypto API
 */
export async function calcularHashImagem(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Reduz a imagem proporcionalmente mantendo resolução ideal para leitura de OCR manuscrito
 */
export async function comprimirImagem(file: File, maxDimensao = 1200, qualidade = 0.8): Promise<ImagemProcessada> {
  const arrayBuffer = await file.arrayBuffer();
  const hash = await calcularHashImagem(arrayBuffer);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let largura = img.width;
        let altura = img.height;

        // Redimensionar proporcionalmente se ultrapassar a dimensão máxima
        if (largura > maxDimensao || altura > maxDimensao) {
          if (largura > altura) {
            altura = Math.round((altura * maxDimensao) / largura);
            largura = maxDimensao;
          } else {
            largura = Math.round((largura * maxDimensao) / altura);
            altura = maxDimensao;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível obter contexto 2D do Canvas.'));
          return;
        }

        // Desenhar fundo branco para recibos transparentes (PNG)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, largura, altura);
        ctx.drawImage(img, 0, 0, largura, altura);

        const dataUrl = canvas.toDataURL('image/jpeg', qualidade);

        // Calcular tamanho aproximado do base64 em bytes
        const stringLength = dataUrl.length - 'data:image/jpeg;base64,'.length;
        const tamanhoComprimidoBytes = Math.round(stringLength * 0.75);

        resolve({
          dataUrl,
          hash,
          tamanhoOriginalBytes: file.size,
          tamanhoComprimidoBytes,
          largura,
          altura,
        });
      };

      img.onerror = () => reject(new Error('Erro ao carregar a imagem para compressão.'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo da imagem.'));
    reader.readAsDataURL(file);
  });
}
