/**
 * Gerador profissional de relatórios em PDF com jsPDF e jspdf-autotable
 * Compatível com Web Share API (WhatsApp, E-mail) e download direto.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Acerto, Lancamento, ImagemComprovante, PessoaTab } from '../types';
import { formatarCentavos, calcularTotaisPessoa, calcularTotaisGerais } from './currency';

export interface OpcoesExportacaoPDF {
  pessoasIds: string[]; // IDs das pessoas a incluir
  secoes: {
    resumo: boolean;
    entradas: boolean;
    saidas: boolean;
    adiantamentos: boolean;
    materiais: boolean;
    dividas: boolean;
  };
  incluirImagens: boolean;
  incluirAbaGeral: boolean;
}

export async function gerarRelatorioPDF(
  acerto: Acerto,
  lancamentos: Lancamento[],
  imagens: ImagemComprovante[],
  opcoes: OpcoesExportacaoPDF
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

  // -----------------------------------------------------------------
  // CABEÇALHO DO DOCUMENTO
  // -----------------------------------------------------------------
  doc.setFillColor(4, 120, 87); // Emerald 700
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ACERTOFÁCIL - RELATÓRIO DE ACERTO', 14, 13);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${hojeFormatado} às ${horaFormatada}`, pageWidth - 14, 13, { align: 'right' });
  doc.text(`Acerto: ${acerto.titulo.toUpperCase()} | Status: ${acerto.status.toUpperCase()}`, 14, 21);

  let cursorY = 36;

  // Informações adicionais do acerto
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (acerto.observacoes) {
    const splitObs = doc.splitTextToSize(`Observações: ${acerto.observacoes}`, pageWidth - 28);
    doc.text(splitObs, 14, cursorY);
    cursorY += splitObs.length * 5 + 4;
  }

  // -----------------------------------------------------------------
  // SEÇÃO GERAL CONSOLIDADA
  // -----------------------------------------------------------------
  if (opcoes.incluirAbaGeral) {
    const totaisGerais = calcularTotaisGerais(acerto.pessoas, lancamentos);

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, cursorY, pageWidth - 28, 26, 3, 3, 'F');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('RESUMO GERAL CONSOLIDADO', 18, cursorY + 7);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Entradas: ${formatarCentavos(totaisGerais.totalEntradasCentavos)}`, 18, cursorY + 14);
    doc.text(`Total Saídas: ${formatarCentavos(totaisGerais.totalSaidasCentavos)}`, 68, cursorY + 14);
    doc.text(`Adiantamentos: ${formatarCentavos(totaisGerais.totalAdiantamentosCentavos)}`, 118, cursorY + 14);
    doc.text(`Materiais: ${formatarCentavos(totaisGerais.totalMateriaisCentavos)}`, 168, cursorY + 14);

    // Saldo Final em destaque
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const saldoPositivo = totaisGerais.saldoFinalCentavos >= 0;
    doc.setTextColor(saldoPositivo ? 4 : 225, saldoPositivo ? 120 : 29, saldoPositivo ? 87 : 72);
    doc.text(`SALDO FINAL DO ACERTO: ${formatarCentavos(totaisGerais.saldoFinalCentavos)}`, 18, cursorY + 22);

    cursorY += 34;

    // Tabela resumida de saldos por pessoa
    const bodyPessoas = acerto.pessoas.map((p) => {
      const t = calcularTotaisPessoa(p, lancamentos);
      return [
        p.nome,
        p.papel || '-',
        formatarCentavos(t.totalAdiantamentosCentavos),
        formatarCentavos(t.totalSaidasCentavos + t.totalMateriaisCentavos),
        formatarCentavos(t.saldoCentavos),
        t.fraseDestaque,
      ];
    });

    autoTable(doc, {
      startY: cursorY,
      head: [['Pessoa / Fornecedor', 'Papel', 'Adiantado', 'Despesas Comprovadas', 'Saldo Líquido', 'Situação']],
      body: bodyPessoas,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 10;
  }

  // -----------------------------------------------------------------
  // SEÇÕES INDIVIDUAIS POR PESSOA
  // -----------------------------------------------------------------
  const pessoasSelecionadas = acerto.pessoas.filter((p) => opcoes.pessoasIds.includes(p.id));

  for (const pessoa of pessoasSelecionadas) {
    // Nova página para cada pessoa se o espaço for menor que 60mm
    if (cursorY > pageHeight - 60) {
      doc.addPage();
      cursorY = 20;
    }

    const totaisPessoa = calcularTotaisPessoa(pessoa, lancamentos);
    const lancsPessoa = lancamentos.filter((l) => l.pessoaId === pessoa.id);

    // Banner da pessoa
    doc.setFillColor(248, 250, 252);
    doc.rect(14, cursorY, pageWidth - 28, 16, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, cursorY, pageWidth - 28, 16, 'S');

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`PESSOA: ${pessoa.nome.toUpperCase()}`, 18, cursorY + 7);

    // Frase destaque com cor apropriada
    doc.setFontSize(10);
    if (totaisPessoa.statusRelacao === 'pessoa_deve') {
      doc.setTextColor(4, 120, 87); // Verde
    } else if (totaisPessoa.statusRelacao === 'usuario_deve') {
      doc.setTextColor(225, 29, 72); // Vermelho
    } else {
      doc.setTextColor(71, 85, 105);
    }
    doc.text(`STATUS: ${totaisPessoa.fraseDestaque}`, 18, cursorY + 12.5);

    cursorY += 22;

    // Resumo de valores da pessoa
    if (opcoes.secoes.resumo) {
      const dadosResumo = [
        ['Adiantamentos Recebidos', formatarCentavos(totaisPessoa.totalAdiantamentosCentavos)],
        ['Despesas Pagas (Saídas)', formatarCentavos(totaisPessoa.totalSaidasCentavos)],
        ['Materiais Comprados', formatarCentavos(totaisPessoa.totalMateriaisCentavos)],
        ['Dívidas Pendentes (Que me devem)', formatarCentavos(totaisPessoa.totalDividasMeDevemCentavos)],
        ['Dívidas Pendentes (Que eu devo)', formatarCentavos(totaisPessoa.totalDividasEuDevoCentavos)],
        ['Saldo Final desta Pessoa', formatarCentavos(totaisPessoa.saldoCentavos)],
      ];

      autoTable(doc, {
        startY: cursorY,
        head: [['Item Contábil', 'Valor']],
        body: dadosResumo,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });

      cursorY = (doc as any).lastAutoTable.finalY + 8;
    }

    // 1. ENTRADAS
    if (opcoes.secoes.entradas) {
      const entradas = lancsPessoa.filter((l) => l.tipo === 'entrada');
      if (entradas.length > 0) {
        if (cursorY > pageHeight - 35) { doc.addPage(); cursorY = 20; }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Entradas Registradas', 14, cursorY);
        cursorY += 4;

        autoTable(doc, {
          startY: cursorY,
          head: [['Data', 'Descrição', 'Forma Pagamento', 'Valor']],
          body: entradas.map((e) => [e.data, e.descricao, e.formaPagamento || '-', formatarCentavos(e.valorCentavos)]),
          theme: 'grid',
          headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
        });
        cursorY = (doc as any).lastAutoTable.finalY + 8;
      }
    }

    // 2. SAÍDAS
    if (opcoes.secoes.saidas) {
      const saidas = lancsPessoa.filter((l) => l.tipo === 'saida');
      if (saidas.length > 0) {
        if (cursorY > pageHeight - 35) { doc.addPage(); cursorY = 20; }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Saídas / Despesas Realizadas', 14, cursorY);
        cursorY += 4;

        autoTable(doc, {
          startY: cursorY,
          head: [['Data', 'Descrição', 'Categoria', 'Quem Pagou', 'Valor']],
          body: saidas.map((s) => [s.data, s.descricao, s.categoria || 'Geral', s.quemPagou || pessoa.nome, formatarCentavos(s.valorCentavos)]),
          theme: 'grid',
          headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
        });
        cursorY = (doc as any).lastAutoTable.finalY + 8;
      }
    }

    // 3. ADIANTAMENTOS
    if (opcoes.secoes.adiantamentos) {
      const adiantamentos = lancsPessoa.filter((l) => l.tipo === 'adiantamento');
      if (adiantamentos.length > 0) {
        if (cursorY > pageHeight - 35) { doc.addPage(); cursorY = 20; }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Adiantamentos / Vales', 14, cursorY);
        cursorY += 4;

        autoTable(doc, {
          startY: cursorY,
          head: [['Data', 'Descrição', 'Valor Adiantado', 'Já Abatido', 'Saldo Restante']],
          body: adiantamentos.map((a) => {
            const abatido = a.abatidoCentavos || 0;
            const falta = Math.max(0, a.valorCentavos - abatido);
            return [a.data, a.descricao, formatarCentavos(a.valorCentavos), formatarCentavos(abatido), formatarCentavos(falta)];
          }),
          theme: 'grid',
          headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
        });
        cursorY = (doc as any).lastAutoTable.finalY + 8;
      }
    }

    // 4. MATERIAIS
    if (opcoes.secoes.materiais) {
      const materiais = lancsPessoa.filter((l) => l.tipo === 'material');
      if (materiais.length > 0) {
        if (cursorY > pageHeight - 35) { doc.addPage(); cursorY = 20; }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Materiais e Insumos Comprados', 14, cursorY);
        cursorY += 4;

        autoTable(doc, {
          startY: cursorY,
          head: [['Data', 'Item', 'Qtd', 'Valor Unit.', 'Total', 'Loja / Fornecedor']],
          body: materiais.map((m) => [
            m.data,
            m.item || m.descricao,
            m.quantidade || 1,
            formatarCentavos(m.valorUnitarioCentavos || m.valorCentavos),
            formatarCentavos(m.valorCentavos),
            m.loja || '-',
          ]),
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
        });
        cursorY = (doc as any).lastAutoTable.finalY + 8;
      }
    }

    // 5. DÍVIDAS
    if (opcoes.secoes.dividas) {
      const dividas = lancsPessoa.filter((l) => l.tipo === 'divida');
      if (dividas.length > 0) {
        if (cursorY > pageHeight - 35) { doc.addPage(); cursorY = 20; }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Dívidas e Pendências', 14, cursorY);
        cursorY += 4;

        autoTable(doc, {
          startY: cursorY,
          head: [['Vencimento', 'Descrição', 'Direção', 'Status', 'Valor']],
          body: dividas.map((d) => [
            d.vencimento || d.data,
            d.descricao,
            d.direcaoDivida === 'eu_devo' ? 'Eu devo a ela' : 'Ela me deve',
            d.statusDivida === 'paga' ? 'Paga' : 'Pendente',
            formatarCentavos(d.valorCentavos),
          ]),
          theme: 'grid',
          headStyles: { fillColor: [147, 51, 234], textColor: [255, 255, 255], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
        });
        cursorY = (doc as any).lastAutoTable.finalY + 8;
      }
    }

    cursorY += 6;
  }

  // -----------------------------------------------------------------
  // ANEXO DE IMAGENS E COMPROVANTES NO FINAL
  // -----------------------------------------------------------------
  if (opcoes.incluirImagens && imagens.length > 0) {
    doc.addPage();
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ANEXO: COMPROVANTES E NOTAS FISCAIS', 14, 13);

    let imgCursorY = 30;

    for (const img of imagens) {
      if (imgCursorY > pageHeight - 110) {
        doc.addPage();
        imgCursorY = 25;
      }

      const pessoaNome = acerto.pessoas.find((p) => p.id === img.pessoaId)?.nome || 'Geral';
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Comprovante: ${img.nomeArquivo} (${pessoaNome})`, 14, imgCursorY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Tipo: ${img.tipoDocumentoIdentificado || 'Recibo'} | Data Envio: ${new Date(img.createdAt).toLocaleDateString('pt-BR')}`, 14, imgCursorY + 5);

      try {
        // Inserir imagem com proporção controlada
        doc.addImage(img.dataUrl, 'JPEG', 14, imgCursorY + 8, 90, 75, undefined, 'FAST');
        imgCursorY += 92;
      } catch (e) {
        console.error('Erro ao anexar imagem ao PDF:', e);
        imgCursorY += 15;
      }
    }
  }

  // -----------------------------------------------------------------
  // NUMERAÇÃO DE PÁGINAS E RODAPÉ EM TODAS AS PÁGINAS
  // -----------------------------------------------------------------
  const totalPaginas = doc.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text('AcertoFácil - Sistema Inteligente de Acertos Financeiros', 14, pageHeight - 7);
    doc.text(`Página ${i} de ${totalPaginas}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }

  return doc;
}

/**
 * Compartilha o PDF gerado via Web Share API (WhatsApp, e-mail) ou dispara download como fallback
 */
export async function compartilharOuBaixarPDF(doc: jsPDF, nomeArquivo: string, titulo: string): Promise<boolean> {
  const blob = doc.output('blob');
  const file = new File([blob], nomeArquivo, { type: 'application/pdf' });

  // Tentar Web Share API se suportado com arquivos
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: titulo,
        text: `Relatório financeiro do ${titulo} gerado pelo AcertoFácil.`,
        files: [file],
      });
      return true;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return false; // Usuário cancelou o compartilhamento
      }
      console.warn('Falha no Web Share API, recorrendo a download direto:', err);
    }
  }

  // Fallback: Baixar arquivo
  doc.save(nomeArquivo);
  return true;
}
