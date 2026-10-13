/**
 * Gerador profissional de relatórios em PDF com jsPDF e jspdf-autotable
 * Compatível com Web Share API (WhatsApp, E-mail) e download direto.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Acerto, Lancamento, ImagemComprovante, PessoaTab } from '../types';
import { formatarCentavos, calcularTotaisPessoa, calcularTotaisGerais, calcularDivisaoLucros } from './currency';

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
  incluirDivisaoLucros?: boolean;
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
  // CABEÇALHO CORPORATIVO DO DOCUMENTO: NDS CFTV Digital
  // -----------------------------------------------------------------
  doc.setFillColor(15, 23, 42); // Slate 900 (Corporativo Elegante)
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setFillColor(4, 120, 87); // Emerald 700 Accent bar
  doc.rect(0, 30, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('NDS CFTV DIGITAL', 14, 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('SISTEMA AUTOMATIZADO DE FECHAMENTO FINANCEIRO E ACERTO DE PROJETOS', 14, 19);
  doc.text(`Projeto: ${acerto.titulo.toUpperCase()} | Status: ${acerto.status.toUpperCase()}`, 14, 25);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data: ${hojeFormatado} às ${horaFormatada}`, pageWidth - 14, 13, { align: 'right' });
  doc.text('Relatório Contábil Oficial', pageWidth - 14, 19, { align: 'right' });

  let cursorY = 38;

  // Informações adicionais do acerto
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (acerto.observacoes) {
    const splitObs = doc.splitTextToSize(`Observações do Projeto: ${acerto.observacoes}`, pageWidth - 28);
    doc.text(splitObs, 14, cursorY);
    cursorY += splitObs.length * 4.5 + 4;
  }

  // -----------------------------------------------------------------
  // RESUMO FINANCEIRO AUTOMATIZADO (NDS CFTV DIGITAL)
  // Faturamento (R$ 9.000) - Taxa de Projeto (R$ 1.000) = Base R$ 8.000
  // Lucro Líquido Real = Base - Saídas | Divisão 50% Neto / Victor
  // -----------------------------------------------------------------
  const calculoLucro = calcularDivisaoLucros(acerto, lancamentos);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, cursorY, pageWidth - 28, 32, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, cursorY, pageWidth - 28, 32, 2, 2, 'S');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('DEMONSTRATIVO DE FECHAMENTO & BASE DE CÁLCULO REAL', 18, cursorY + 7);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  if (calculoLucro.taxaProjetoCentavos > 0) {
    doc.text(`1. Faturamento / Entrada: ${formatarCentavos(calculoLucro.faturamentoProjetoCentavos)}`, 18, cursorY + 14);
    doc.text(`2. Taxa de Projeto: -${formatarCentavos(calculoLucro.taxaProjetoCentavos)}`, 78, cursorY + 14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(3, 105, 161);
    doc.text(`Base de Cálculo Real: ${formatarCentavos(calculoLucro.baseCalculoRealCentavos)}`, 135, cursorY + 14);
  } else {
    doc.text(`1. Receita Total (Entradas): ${formatarCentavos(calculoLucro.faturamentoProjetoCentavos)}`, 18, cursorY + 14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(3, 105, 161);
    doc.text(`Base de Cálculo: ${formatarCentavos(calculoLucro.baseCalculoRealCentavos)}`, 110, cursorY + 14);
  }

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Total de Gastos (Saídas): ${formatarCentavos(calculoLucro.somaTodasSaidasCentavos)}`, 18, cursorY + 21);
  doc.setFont('helvetica', 'bold');
  const corLucro = calculoLucro.isLucroPositivo ? [4, 120, 87] : [225, 29, 72];
  doc.setTextColor(corLucro[0], corLucro[1], corLucro[2]);
  doc.text(`Lucro Líquido Real: ${formatarCentavos(calculoLucro.lucroBrutoCentavos)}`, 78, cursorY + 21);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  const nomesSocios = calculoLucro.participantes.map((p) => `${p.porcentagem}% ${p.nome}`).join(' / ');
  doc.text(`(${nomesSocios || 'Divisão entre Sócios'})`, 140, cursorY + 21);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`* Descontos de adiantamentos/vales são deduzidos unicamente da cota final individual sem afetar os outros sócios.`, 18, cursorY + 28);

  cursorY += 38;

  // -----------------------------------------------------------------
  // RESUMO FINAL DOS SÓCIOS: NETO E VICTOR COM SALDOS LÍQUIDOS EXATOS
  // -----------------------------------------------------------------
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('RESUMO FINANCEIRO FINAL DOS SÓCIOS', 14, cursorY - 1);

  const bodySocios = calculoLucro.participantes.map((p) => [
    p.nome,
    `${p.porcentagem}%`,
    formatarCentavos(p.cotaBrutaCentavos),
    p.adiantamentosAbatidosCentavos > 0 ? `-${formatarCentavos(p.adiantamentosAbatidosCentavos)}` : 'R$ 0,00',
    formatarCentavos(p.valorLiquidoAReceberCentavos),
    p.valorLiquidoAReceberCentavos >= 0 ? 'Líquido a Receber' : 'Saldo Devedor / Adiantou a Mais',
  ]);

  autoTable(doc, {
    startY: cursorY + 1,
    head: [['Sócio', 'Cota (%)', 'Cota do Lucro (50%)', 'Desconto Adiantamento', 'SALDO FINAL A RECEBER', 'Status']],
    body: bodySocios,
    theme: 'grid',
    headStyles: { fillColor: [4, 120, 87], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right', textColor: [225, 29, 72] },
      4: { halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
      5: { halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 10;

  // -----------------------------------------------------------------
  // TABELA ORGANIZADA DE TODOS OS GASTOS DA LISTA (DATA, DESCRIÇÃO, CATEGORIA, VALOR)
  // -----------------------------------------------------------------
  if (cursorY > pageHeight - 50) {
    doc.addPage();
    cursorY = 20;
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('TABELA DISCRIMINADA DE TODOS OS GASTOS E LANÇAMENTOS DO PROJETO', 14, cursorY - 1);

  // Ordena lançamentos por data
  const todosLancamentosOrdenados = [...lancamentos].sort((a, b) => (a.data || '').localeCompare(b.data || ''));

  const bodyGastos = todosLancamentosOrdenados.map((l) => {
    const nomePessoa = acerto.pessoas.find((p) => p.id === l.pessoaId)?.nome || (l.pessoaId === 'geral' ? 'Geral' : '-');
    const tipoLabel = l.tipo === 'saida' ? 'Saída' : l.tipo === 'material' ? 'Material' : l.tipo === 'adiantamento' ? 'Adiantamento/Vale' : l.tipo === 'entrada' ? 'Entrada' : 'Dívida';
    return [
      l.data ? new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR') : '-',
      l.descricao || '-',
      l.categoria || tipoLabel,
      nomePessoa,
      tipoLabel,
      formatarCentavos(l.valorCentavos),
    ];
  });

  autoTable(doc, {
    startY: cursorY + 1,
    head: [['Data', 'Descrição', 'Categoria', 'Alocado Para', 'Tipo', 'Valor']],
    body: bodyGastos.length > 0 ? bodyGastos : [['-', 'Nenhum lançamento registrado', '-', '-', '-', 'R$ 0,00']],
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 32 },
      3: { cellWidth: 26 },
      4: { cellWidth: 28, halign: 'center' },
      5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 10;

  // -----------------------------------------------------------------
  // SEÇÃO GERAL CONSOLIDADA (Opcional se selecionada)
  // -----------------------------------------------------------------
  if (opcoes.incluirAbaGeral) {
    if (cursorY > pageHeight - 50) {
      doc.addPage();
      cursorY = 20;
    }
    const totaisGerais = calcularTotaisGerais(acerto.pessoas, lancamentos);

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, cursorY, pageWidth - 28, 22, 2, 2, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('BALANÇO GERAL CONSOLIDADO DE REPASSES', 18, cursorY + 6);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Entradas: ${formatarCentavos(totaisGerais.totalEntradasCentavos)}`, 18, cursorY + 13);
    doc.text(`Total Saídas: ${formatarCentavos(totaisGerais.totalSaidasCentavos)}`, 68, cursorY + 13);
    doc.text(`Adiantamentos: ${formatarCentavos(totaisGerais.totalAdiantamentosCentavos)}`, 118, cursorY + 13);
    doc.text(`Materiais: ${formatarCentavos(totaisGerais.totalMateriaisCentavos)}`, 160, cursorY + 13);

    cursorY += 28;
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
