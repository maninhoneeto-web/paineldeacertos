/**
 * Gerador de Relatório em PDF limpo, prático e direto para Acertos de Contas.
 * Totalmente sem conceito de "sócio" ou divisão de lucros forçada.
 * Mostra claramente: Quem Pagou o quê, Quem Deve a Quem e a Planilha Completa de Lançamentos.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Acerto, Lancamento, ImagemComprovante } from '../types';
import { formatarCentavos, calcularResolucaoAcerto } from './currency';

export interface OpcoesExportacaoPDF {
  pessoasIds?: string[];
  secoes?: {
    resumo?: boolean;
    entradas?: boolean;
    saidas?: boolean;
    adiantamentos?: boolean;
    materiais?: boolean;
    dividas?: boolean;
  };
  incluirImagens?: boolean;
  incluirAbaGeral?: boolean;
  incluirDivisaoLucros?: boolean;
}

export async function gerarRelatorioPDF(
  acerto: Acerto,
  lancamentos: Lancamento[],
  imagens: ImagemComprovante[] = [],
  _opcoes?: OpcoesExportacaoPDF
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const hojeFormatado = new Date().toLocaleDateString('pt-BR');
  const horaFormatada = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // 1. CABEÇALHO ELEGANTE E LIMPO
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(16, 185, 129); // Emerald 500 accent
  doc.rect(0, 28, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text((acerto.titulo || 'RELATÓRIO DE ACERTO DE CONTAS').toUpperCase(), 14, 12);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const nomesPessoas = acerto.pessoas.map((p) => p.nome).join(', ') || 'Geral';
  doc.text(`Participantes: ${nomesPessoas} | Status: ${acerto.status.toUpperCase()}`, 14, 18);
  doc.text(`Data: ${hojeFormatado} às ${horaFormatada}`, pageWidth - 14, 18, { align: 'right' });

  let cursorY = 36;

  // 2. OBSERVAÇÕES E NOTAS DO ACERTO (Se houver)
  if (acerto.observacoes && acerto.observacoes.trim()) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    const splitObs = doc.splitTextToSize(`Observações: ${acerto.observacoes}`, pageWidth - 36);
    const boxHeight = splitObs.length * 4.5 + 8;
    
    doc.roundedRect(14, cursorY, pageWidth - 28, boxHeight, 2, 2, 'FD');
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(splitObs, 18, cursorY + 6);
    cursorY += boxHeight + 6;
  }

  // 3. RESOLUÇÃO DIRETA DO ACERTO: QUEM DEVE A QUEM
  const resolucao = calcularResolucaoAcerto(acerto, lancamentos);

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.6);
  
  // Altura dinâmica do box de fechamento
  const qtdTransacoes = Math.max(1, resolucao.transacoes.length);
  const cardHeight = 22 + (qtdTransacoes * 10);
  doc.roundedRect(14, cursorY, pageWidth - 28, cardHeight, 2, 2, 'FD');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('🤝 FECHAMENTO DE CONTAS: QUEM DEVE A QUEM', 18, cursorY + 7);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Cálculo direto de repasses, despesas e devoluções entre os participantes.', 18, cursorY + 12);

  let posYTrans = cursorY + 19;

  if (resolucao.transacoes.length === 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text('✓ Todas as contas estão quitadas e equilibradas entre os participantes!', 18, posYTrans);
  } else {
    resolucao.transacoes.forEach((t) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(18, posYTrans - 4.5, pageWidth - 36, 8.5, 1.5, 1.5, 'FD');

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(225, 29, 72); // Vermelho devedor
      doc.text(`${t.devedor.toUpperCase()}`, 22, posYTrans);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('deve pagar', 22 + doc.getTextWidth(`${t.devedor.toUpperCase()}`) + 2, posYTrans);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(4, 120, 87); // Verde credor
      const textoMeio = `deve pagar para ${t.credor.toUpperCase()}:`;
      doc.text(textoMeio, 22 + doc.getTextWidth(`${t.devedor.toUpperCase()}`) + 2, posYTrans);

      doc.setFontSize(10.5);
      doc.setTextColor(4, 120, 87);
      doc.text(formatarCentavos(t.valorCentavos), pageWidth - 22, posYTrans, { align: 'right' });

      posYTrans += 10;
    });
  }

  cursorY += cardHeight + 8;

  // 4. TABELA COMPLETA E PRÁTICA DE TODOS OS LANÇAMENTOS
  if (cursorY > pageHeight - 60) {
    doc.addPage();
    cursorY = 20;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PLANILHA DE LANÇAMENTOS DO ACERTO', 14, cursorY);
  cursorY += 3;

  // Ordena lançamentos por data
  const todosLancamentosOrdenados = [...lancamentos].sort((a, b) => (a.data || '').localeCompare(b.data || ''));

  const bodyGastos = todosLancamentosOrdenados.map((l) => {
    const nomePessoa = acerto.pessoas.find((p) => p.id === l.pessoaId)?.nome || (l.pessoaId === 'geral' ? 'Geral' : '-');
    const tipoLabel = 
      l.tipo === 'saida' ? 'Saída' : 
      l.tipo === 'material' ? 'Material' : 
      l.tipo === 'adiantamento' ? 'Vale / Adiant.' : 
      l.tipo === 'entrada' ? 'Entrada' : 'Dívida';

    const dataFormatada = l.data 
      ? (l.data.includes('-') ? l.data.split('-').reverse().join('/') : l.data)
      : '-';

    return [
      dataFormatada,
      l.descricao || '-',
      nomePessoa,
      tipoLabel,
      formatarCentavos(l.valorCentavos),
      l.observacoes || '-',
    ];
  });

  autoTable(doc, {
    startY: cursorY,
    head: [['Data', 'Descrição / Item', 'Participante', 'Tipo', 'Valor (R$)', 'Observações']],
    body: bodyGastos.length > 0 ? bodyGastos : [['-', 'Nenhum lançamento registrado', '-', '-', 'R$ 0,00', '-']],
    theme: 'striped',
    headStyles: { 
      fillColor: [15, 23, 42], 
      textColor: [255, 255, 255], 
      fontSize: 8.5, 
      fontStyle: 'bold' 
    },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 28 },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 35, textColor: [100, 116, 139] },
    },
    margin: { left: 14, right: 14 },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 8;

  // 5. RESUMO CONSOLIDADO NO RODAPÉ DA TABELA
  if (cursorY > pageHeight - 35) {
    doc.addPage();
    cursorY = 20;
  }

  let totalEntradas = 0;
  let totalSaidas = 0;
  lancamentos.forEach((l) => {
    if (l.tipo === 'entrada') totalEntradas += Math.abs(l.valorCentavos || 0);
    else totalSaidas += Math.abs(l.valorCentavos || 0);
  });

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, cursorY, pageWidth - 28, 14, 1.5, 1.5, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(`Total de Entradas: ${formatarCentavos(totalEntradas)}`, 20, cursorY + 9);
  doc.text(`Total de Saídas: ${formatarCentavos(totalSaidas)}`, 75, cursorY + 9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Lançamentos: ${lancamentos.length}`, 130, cursorY + 9);
  doc.text(`Diferença: ${formatarCentavos(Math.abs(totalEntradas - totalSaidas))}`, pageWidth - 20, cursorY + 9, { align: 'right' });

  cursorY += 20;

  // 6. ANEXO DE COMPROVANTES / FOTOS (SE HOUVER)
  if (imagens && imagens.length > 0) {
    doc.addPage();
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('ANEXO: COMPROVANTES E FOTOS', 14, 20);

    let imgY = 26;
    for (let idx = 0; idx < imagens.length; idx++) {
      const img = imagens[idx];
      if (imgY > pageHeight - 110) {
        doc.addPage();
        imgY = 20;
      }

      try {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`Foto ${idx + 1}: ${img.nomeArquivo || 'Comprovante do Acerto'}`, 14, imgY);
        doc.addImage(img.dataUrl, 'JPEG', 14, imgY + 3, 90, 75, undefined, 'FAST');
        imgY += 85;
      } catch (err) {
        console.warn('Erro ao desenhar imagem no PDF:', err);
      }
    }
  }

  // Rodapé em todas as páginas
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `AcertoFácil - Relatório de Acerto de Contas | Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  return doc;
}

export async function compartilharOuBaixarPDF(
  doc: jsPDF,
  nomeArquivo: string,
  titulo: string
): Promise<void> {
  const blob = doc.output('blob');
  const file = new File([blob], nomeArquivo, { type: 'application/pdf' });

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: titulo || 'Relatório de Acerto de Contas',
        text: `Relatório de Acerto: ${titulo}`,
        files: [file],
      });
      return;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        doc.save(nomeArquivo);
      }
      return;
    }
  }

  doc.save(nomeArquivo);
}
