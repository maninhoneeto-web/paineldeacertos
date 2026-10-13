import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Check, AlertTriangle, AlertCircle, Plus, Trash2, ZoomIn, ZoomOut, RotateCw, Maximize2,
  FileText, Calendar, DollarSign, Tag, User, Layers, Info, Sparkles, RefreshCw
} from 'lucide-react';
import { Acerto, PessoaTab, LinhaConferenciaOCR, TipoLancamento, FormaPagamento } from '../types';
import { formatarCentavos, parseValorParaCentavos, formatarCentavosSemSimbolo } from '../utils/currency';
import { PhotoZoomModal } from './PhotoZoomModal';

interface ConferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  acerto?: Acerto | null;
  isCriandoNovoAcerto?: boolean;
  tituloSugerido?: string;
  pessoasIdentificadas?: string[];
  pessoasIniciais?: PessoaTab[];
  pessoaAtualId?: string;
  imagemDataUrl: string;
  imagemHash: string;
  nomeArquivo: string;
  tamanhoBytes: number;
  tipoDocumentoIdentificado?: string;
  totalEscritoCentavos?: number;
  totalEscritoFormatado?: string;
  observacoesOCR?: string;
  linhasIniciais: LinhaConferenciaOCR[];
  isDuplicada: boolean;
  onConfirmar: (dadosConfirmados: {
    tituloAcerto?: string;
    pessoasAtualizadas: PessoaTab[];
    linhas: LinhaConferenciaOCR[];
    imagemDataUrl: string;
    imagemHash: string;
    nomeArquivo: string;
    tamanhoBytes: number;
    tipoDocumento: string;
    totalEscritoCentavos: number;
    observacoes: string;
  }) => Promise<void>;
  onReprocessarComIA?: () => Promise<void>;
}

export const ConferenceModal: React.FC<ConferenceModalProps> = ({
  isOpen,
  onClose,
  acerto,
  isCriandoNovoAcerto = false,
  tituloSugerido = 'Proposta / Acerto Organizado por Foto',
  pessoasIdentificadas = [],
  pessoasIniciais,
  pessoaAtualId = '',
  imagemDataUrl,
  imagemHash,
  nomeArquivo,
  tamanhoBytes,
  tipoDocumentoIdentificado = 'Documento / Proposta / Recibo',
  totalEscritoCentavos = 0,
  totalEscritoFormatado = '',
  observacoesOCR = '',
  linhasIniciais,
  isDuplicada,
  onConfirmar,
  onReprocessarComIA,
}) => {
  const [titulo, setTitulo] = useState(tituloSugerido || 'Proposta / Acerto por Foto');
  const [zoom, setZoom] = useState(1);
  const [rotacao, setRotacao] = useState(0);
  const [modalZoomAberto, setModalZoomAberto] = useState(false);
  const [isGerandoPdf, setIsGerandoPdf] = useState(false);
  const [isSalvando, setIsSalvando] = useState(false);
  const [observacoes, setObservacoes] = useState(observacoesOCR);
  const [tipoDoc, setTipoDoc] = useState(tipoDocumentoIdentificado);

  // Lista de pessoas com suporte a criação automática
  const [pessoas, setPessoas] = useState<PessoaTab[]>(() => {
    if (pessoasIniciais && pessoasIniciais.length > 0) {
      return [...pessoasIniciais];
    }

    const cores = ['#059669', '#0284c7', '#7c3aed', '#d97706', '#dc2626', '#4f46e5', '#0d9488'];
    const basePessoas: PessoaTab[] = acerto?.pessoas ? [...acerto.pessoas] : [];

    // Adiciona pessoas identificadas na foto que ainda não existem
    for (const nomeIdentificado of pessoasIdentificadas) {
      const nomeLimpo = nomeIdentificado.trim();
      if (!nomeLimpo) continue;
      const existe = basePessoas.some((p) => p.nome.toLowerCase() === nomeLimpo.toLowerCase());
      if (!existe) {
        basePessoas.push({
          id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          nome: nomeLimpo,
          cor: cores[basePessoas.length % cores.length],
          ordem: basePessoas.length,
        });
      }
    }

    if (basePessoas.length === 0) {
      basePessoas.push({
        id: 'p_' + Date.now() + '_1',
        nome: 'Geral',
        cor: '#059669',
        ordem: 0,
      });
    }

    return basePessoas;
  });

  // Linhas com associação inteligente de pessoas
  const [linhas, setLinhas] = useState<LinhaConferenciaOCR[]>(() => {
    return (linhasIniciais || []).map((l) => {
      const matchId = pessoas.find((p) => p.id === l.pessoaId);
      if (matchId) return l;

      if (l.pessoaSugeridaNome) {
        const matchNome = pessoas.find((p) =>
          p.nome.toLowerCase().includes(l.pessoaSugeridaNome!.toLowerCase()) ||
          l.pessoaSugeridaNome!.toLowerCase().includes(p.nome.toLowerCase())
        );
        if (matchNome) {
          return { ...l, pessoaId: matchNome.id };
        }
      }

      const fallbackId = (pessoaAtualId && pessoas.some((p) => p.id === pessoaAtualId))
        ? pessoaAtualId
        : pessoas[0]?.id || 'geral';

      return { ...l, pessoaId: fallbackId };
    });
  });

  const [nomeNovaPessoaInput, setNomeNovaPessoaInput] = useState('');
  const [mostrarInputNovaPessoa, setMostrarInputNovaPessoa] = useState(false);

  // Sincroniza se linhasIniciais mudarem
  useEffect(() => {
    if (linhasIniciais && linhasIniciais.length > 0) {
      setLinhas(linhasIniciais);
    }
  }, [linhasIniciais]);

  if (!isOpen) return null;

  // Totais em tempo real das linhas marcadas para inclusão
  const { totalEntradas, totalSaidas, saldoResultante, somaLidaCentavos, itensSelecionadosCount } = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let somaLida = 0;
    let selecionados = 0;

    for (const l of linhas) {
      if (!l.incluir) continue;
      selecionados++;
      const v = Math.abs(l.valorCentavos || 0);
      somaLida += v;
      if (l.tipoSugerido === 'entrada') {
        entradas += v;
      } else {
        saidas += v;
      }
    }

    return {
      totalEntradas: entradas,
      totalSaidas: saidas,
      saldoResultante: entradas - saidas,
      somaLidaCentavos: somaLida,
      itensSelecionadosCount: selecionados,
    };
  }, [linhas]);

  const temDivergenciaTotal = totalEscritoCentavos > 0 && Math.abs(totalEscritoCentavos - somaLidaCentavos) > 100;

  const atualizarLinha = (id: string, campo: keyof LinhaConferenciaOCR, valor: any) => {
    setLinhas((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [campo]: valor } : item))
    );
  };

  const atualizarValorLinha = (id: string, textoDigitado: string) => {
    const centavos = parseValorParaCentavos(textoDigitado);
    setLinhas((prev) =>
      prev.map((item) => (item.id === id ? { ...item, valorCentavos: centavos } : item))
    );
  };

  const removerLinha = (id: string) => {
    setLinhas((prev) => prev.filter((item) => item.id !== id));
  };

  const adicionarLinha = () => {
    const nova: LinhaConferenciaOCR = {
      id: 'nova_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      data: new Date().toISOString().slice(0, 10),
      descricao: '',
      quantidade: 1,
      valorCentavos: 0,
      tipoSugerido: 'material',
      categoria: 'Equipamentos e Materiais',
      pessoaId: pessoas[0]?.id || 'geral',
      confianca: 'alta',
      incluir: true,
    };
    setLinhas((prev) => [nova, ...prev]);
  };

  const handleCriarNovaPessoa = (nome: string) => {
    const limpo = nome.trim();
    if (!limpo) return;
    const cores = ['#059669', '#0284c7', '#7c3aed', '#d97706', '#dc2626', '#4f46e5', '#0d9488'];
    const novaP: PessoaTab = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      nome: limpo,
      cor: cores[pessoas.length % cores.length],
      ordem: pessoas.length,
    };
    setPessoas((prev) => [...prev, novaP]);
    setNomeNovaPessoaInput('');
    setMostrarInputNovaPessoa(false);
  };

  // Exportar PDF completo com relatório formatado e foto anexada
  const handleExportarPDF = async () => {
    setIsGerandoPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Cabeçalho Corporativo NDS CFTV Digital
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 28, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('NDS CFTV DIGITAL', 14, 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text('Relatório de Proposta, Itens & Conferência Contábil', 14, 18);
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 14, 18, { align: 'right' });

      let cursorY = 36;
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(titulo || 'Proposta / Itens da Foto', 14, cursorY);
      cursorY += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Arquivo: ${nomeArquivo}  |  Documento: ${tipoDoc}  |  Total Saídas/Materiais: ${formatarCentavos(totalSaidas)}  |  Total Entradas: ${formatarCentavos(totalEntradas)}`,
        14,
        cursorY
      );
      cursorY += 7;

      // Tabela dos lançamentos
      const linhasParaExportar = linhas.filter((l) => l.incluir);
      const rows = linhasParaExportar.map((l) => [
        l.data ? new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR') : '-',
        l.descricao || 'Item sem descrição',
        pessoas.find((p) => p.id === l.pessoaId)?.nome || 'Geral',
        l.categoria || 'Geral',
        l.quantidade && l.quantidade > 1 ? String(l.quantidade) : '1',
        l.tipoSugerido === 'material' ? 'MATERIAL' : l.tipoSugerido === 'adiantamento' ? 'VALE' : l.tipoSugerido.toUpperCase(),
        formatarCentavos(l.valorCentavos),
      ]);

      autoTable(doc, {
        startY: cursorY,
        head: [['Data', 'Item / Descrição', 'Responsável/Aba', 'Categoria', 'Qtd', 'Tipo', 'Valor']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          4: { halign: 'center' },
          6: { halign: 'right', fontStyle: 'bold' },
        },
      });

      cursorY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : cursorY + 40;

      // Resumo de Totais
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, cursorY, pageWidth - 28, 18, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`Total de Itens: ${linhasParaExportar.length}`, 18, cursorY + 7);
      doc.text(`Total Saídas/Custos: ${formatarCentavos(totalSaidas)}`, 70, cursorY + 7);
      doc.text(`Total Entradas: ${formatarCentavos(totalEntradas)}`, 130, cursorY + 7);
      doc.setTextColor(saldoResultante >= 0 ? 5 : 220, saldoResultante >= 0 ? 150 : 38, saldoResultante >= 0 ? 105 : 38);
      doc.text(`Saldo Final: ${formatarCentavos(saldoResultante)}`, 18, cursorY + 13);
      cursorY += 24;

      // Anexo: Foto do Comprovante / Proposta
      if (cursorY + 115 > pageHeight - 15) {
        doc.addPage();
        cursorY = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('Anexo: Foto do Documento / Proposta / Caderno', 14, cursorY);
      cursorY += 5;

      try {
        doc.addImage(imagemDataUrl, 'JPEG', 14, cursorY, 120, 95, undefined, 'FAST');
      } catch (errImg) {
        console.warn('Erro ao anexar imagem ao PDF:', errImg);
      }

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('NDS CFTV Digital - Documento Oficial', 14, pageHeight - 8);

      const sanitizado = (titulo || 'proposta').toLowerCase().replace(/[^a-z0-9]/g, '_');
      doc.save(`nds_proposta_${sanitizado}_${Date.now()}.pdf`);
    } catch (errPdf: any) {
      console.error(errPdf);
      alert('Erro ao exportar PDF: ' + (errPdf.message || 'Tente novamente.'));
    } finally {
      setIsGerandoPdf(false);
    }
  };

  const handleSalvar = async () => {
    const linhasValidas = linhas.filter((l) => l.incluir && l.descricao.trim());
    if (linhasValidas.length === 0) {
      alert('Selecione ou preencha pelo menos um item para adicionar à proposta/acerto.');
      return;
    }

    setIsSalvando(true);
    try {
      await onConfirmar({
        tituloAcerto: titulo.trim(),
        pessoasAtualizadas: pessoas,
        linhas: linhasValidas,
        imagemDataUrl,
        imagemHash,
        nomeArquivo,
        tamanhoBytes,
        tipoDocumento: tipoDoc,
        totalEscritoCentavos,
        observacoes,
      });
      onClose();
    } catch (e: any) {
      alert('Erro ao salvar itens: ' + (e.message || 'Tente novamente.'));
    } finally {
      setIsSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="relative flex flex-col w-full max-w-6xl max-h-[96vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* TOPO: Cabeçalho com Título, Badges e BOTÕES DE AÇÃO RÁPIDA VISÍVEIS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {isCriandoNovoAcerto ? '✨ Proposta / Acerto Organizado por Foto' : 'Conferência de Itens & Proposta da Foto'}
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                {linhas.length} itens encontrados
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Título:</span>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="px-2.5 py-1 text-xs sm:text-sm font-bold rounded-lg border border-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white max-w-md focus:ring-2 focus:ring-emerald-500"
                placeholder="Nome da proposta, orçamento ou acerto..."
              />
            </div>
          </div>

          {/* BOTÕES DE AÇÃO NO TOPO (GARANTINDO QUE O USUÁRIO VEJA NA HORA) */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* BOTÃO AUMENTAR IMAGEM */}
            <button
              type="button"
              onClick={() => setModalZoomAberto(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm transition cursor-pointer"
              title="Aumentar imagem e abrir zoom interativo em tela cheia"
            >
              <Maximize2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Aumentar Imagem</span>
            </button>

            {/* BOTÃO SALVAR EM PDF */}
            <button
              type="button"
              onClick={handleExportarPDF}
              disabled={isGerandoPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-xs sm:text-sm border border-blue-300 dark:border-blue-800 transition cursor-pointer"
              title="Baixar proposta ou itens em PDF com foto anexada"
            >
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{isGerandoPdf ? 'Gerando...' : 'Salvar em PDF'}</span>
            </button>

            {/* BOTÃO ADICIONAR À PROPOSTA / ACERTO (CTA PRINCIPAL) */}
            <button
              type="button"
              onClick={handleSalvar}
              disabled={isSalvando || itensSelecionadosCount === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
              title="Confirmar e adicionar todos os itens selecionados à proposta"
            >
              {isSalvando ? (
                <span className="animate-spin">⏳ Salvando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>+ Adicionar à Proposta ({itensSelecionadosCount})</span>
                </>
              )}
            </button>

            {/* BOTÃO FECHAR */}
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* BARRA DAS PESSOAS / ABAS DETECTADAS */}
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-2 bg-emerald-50/70 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800/50 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Abas / Pessoas da Proposta ({pessoas.length}):</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {pessoas.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-2xs"
                style={{ backgroundColor: p.cor || '#059669' }}
              >
                {p.nome}
              </span>
            ))}

            {mostrarInputNovaPessoa ? (
              <div className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 p-0.5 rounded-lg border border-emerald-500">
                <input
                  type="text"
                  value={nomeNovaPessoaInput}
                  onChange={(e) => setNomeNovaPessoaInput(e.target.value)}
                  placeholder="Nome..."
                  className="px-2 py-0.5 text-xs rounded-md border-0 bg-transparent text-slate-900 dark:text-white w-28 focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => handleCriarNovaPessoa(nomeNovaPessoaInput)}
                  className="px-2 py-0.5 bg-emerald-600 text-white rounded-md text-xs font-bold"
                >
                  OK
                </button>
                <button
                  onClick={() => setMostrarInputNovaPessoa(false)}
                  className="text-slate-400 hover:text-slate-600 px-1"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMostrarInputNovaPessoa(true)}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-emerald-400 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>+ Pessoa/Aba</span>
              </button>
            )}
          </div>
        </div>

        {/* ALERTAS SE HOUVER DUPLICIDADE OU DIVERGÊNCIA */}
        {(isDuplicada || temDivergenciaTotal) && (
          <div className="flex flex-col gap-1 px-4 sm:px-6 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 text-xs">
            {isDuplicada && (
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span><strong>Atenção: Imagem Já Cadastrada!</strong> Este comprovante já foi enviado anteriormente.</span>
              </div>
            )}
            {temDivergenciaTotal && (
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Total da anotação:</strong> Na imagem está escrito <strong>{formatarCentavos(totalEscritoCentavos)}</strong> e a soma dos itens lidos é <strong>{formatarCentavos(somaLidaCentavos)}</strong>.
                </span>
              </div>
            )}
          </div>
        )}

        {/* CORPO: DUAS COLUNAS (FOTO COM ZOOM X LISTA EDITÁVEL DE ITENS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          
          {/* COLUNA ESQUERDA: VISUALIZADOR DA IMAGEM COM CONTROLES DE ZOOM */}
          <div className="lg:col-span-5 flex flex-col bg-slate-900 overflow-hidden min-h-[280px] lg:min-h-[460px]">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-950/90 text-white text-xs border-b border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">Foto do Documento</span>
                <button
                  type="button"
                  onClick={() => setModalZoomAberto(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                  title="Abrir imagem em tela cheia com zoom interativo"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Aumentar Imagem</span>
                </button>
              </div>

              {/* Botões de Zoom rápidos no preview */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Aproximar"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.25).toFixed(2)))}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Afastar"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotacao((r) => (r + 90) % 360)}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Girar"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => { setZoom(1); setRotacao(0); }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Restaurar visualização"
                >
                  100%
                </button>
              </div>
            </div>

            {/* Container da Imagem com clique para tela cheia */}
            <div 
              className="flex-1 flex items-center justify-center p-3 overflow-auto bg-slate-950 cursor-zoom-in relative group"
              onClick={() => setModalZoomAberto(true)}
              title="Clique para abrir com zoom interativo em tela cheia"
            >
              <img
                src={imagemDataUrl}
                alt={nomeArquivo}
                style={{
                  transform: `scale(${zoom}) rotate(${rotacao}deg)`,
                  transition: 'transform 0.15s ease-out',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
                className="rounded shadow-md select-none pointer-events-none"
              />

              <div className="absolute bottom-3 right-3 bg-black/70 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full pointer-events-none backdrop-blur-xs flex items-center gap-1 group-hover:bg-emerald-600 transition">
                <Maximize2 className="w-3 h-3" />
                <span>Clique para Aumentar Imagem</span>
              </div>
            </div>

            <div className="p-2 bg-slate-950/90 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Arquivo: {nomeArquivo}</span>
              <span>{Math.round(tamanhoBytes / 1024)} KB</span>
            </div>
          </div>

          {/* COLUNA DIREITA: TABELA EDITÁVEL DOS ITENS EXTRAÍDOS */}
          <div className="lg:col-span-7 flex flex-col min-h-0 bg-white dark:bg-slate-900">
            
            {/* TOPO DA TABELA DE ITENS */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex-wrap gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  <span>Itens Extraídos da Foto ({linhas.length})</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Verifique cada item, quantidade e valor. Todos serão adicionados à proposta.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={adicionarLinha}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Item Manual</span>
                </button>
              </div>
            </div>

            {/* LISTA ROLÁVEL DE ITENS */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
              {linhas.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <p>Nenhum item adicionado ainda.</p>
                  <button
                    onClick={adicionarLinha}
                    className="mt-2 text-emerald-600 font-bold hover:underline"
                  >
                    + Clique aqui para adicionar um item
                  </button>
                </div>
              ) : (
                linhas.map((linha, idx) => {
                  const isBaixaConfianca = linha.confianca === 'baixa';
                  return (
                    <div
                      key={linha.id}
                      className={`p-3 rounded-xl border transition ${
                        !linha.incluir
                          ? 'opacity-40 bg-slate-100 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800'
                          : isBaixaConfianca
                          ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                          : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700 hover:border-emerald-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {/* Checkbox incluir */}
                        <input
                          type="checkbox"
                          checked={linha.incluir}
                          onChange={(e) => atualizarLinha(linha.id, 'incluir', e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          title="Marcar para incluir na proposta"
                        />

                        {/* Descrição do item */}
                        <input
                          type="text"
                          value={linha.descricao}
                          onChange={(e) => atualizarLinha(linha.id, 'descricao', e.target.value)}
                          placeholder="Descrição do item ou equipamento..."
                          className="flex-1 px-2.5 py-1 text-xs sm:text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                        />

                        {/* Quantidade */}
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[11px] text-slate-400 font-semibold">Qtd:</span>
                          <input
                            type="number"
                            min="1"
                            value={linha.quantidade || 1}
                            onChange={(e) => atualizarLinha(linha.id, 'quantidade', Math.max(1, Number(e.target.value) || 1))}
                            className="w-14 px-2 py-1 text-xs text-center font-bold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </div>

                        {/* Valor em R$ */}
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs font-bold text-slate-400">R$</span>
                          <input
                            type="text"
                            value={formatarCentavosSemSimbolo(linha.valorCentavos)}
                            onChange={(e) => atualizarValorLinha(linha.id, e.target.value)}
                            placeholder="0,00"
                            className="w-24 px-2.5 py-1 text-xs sm:text-sm font-bold font-mono text-right rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        {/* Excluir */}
                        <button
                          type="button"
                          onClick={() => removerLinha(linha.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          title="Remover este item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Linha secundária de atributos: Tipo, Aba/Pessoa, Categoria */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                        {/* Tipo */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Tipo:</span>
                          <select
                            value={linha.tipoSugerido}
                            onChange={(e) => atualizarLinha(linha.id, 'tipoSugerido', e.target.value)}
                            className="flex-1 px-1.5 py-0.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            <option value="material">Material / Equipamento</option>
                            <option value="saida">Saída / Mão de Obra</option>
                            <option value="entrada">Entrada / Receita</option>
                            <option value="adiantamento">Adiantamento / Vale</option>
                            <option value="divida">Dívida / Pendente</option>
                          </select>
                        </div>

                        {/* Pessoa / Aba */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Aba:</span>
                          <select
                            value={linha.pessoaId}
                            onChange={(e) => atualizarLinha(linha.id, 'pessoaId', e.target.value)}
                            className="flex-1 px-1.5 py-0.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                          >
                            {pessoas.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nome}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Categoria */}
                        <div className="flex items-center gap-1 col-span-2 sm:col-span-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Cat:</span>
                          <input
                            type="text"
                            value={linha.categoria || 'Geral'}
                            onChange={(e) => atualizarLinha(linha.id, 'categoria', e.target.value)}
                            className="flex-1 px-1.5 py-0.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            placeholder="Categoria..."
                          />
                        </div>
                      </div>

                      {isBaixaConfianca && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Confiança moderada da IA. Verifique se a quantidade e o valor estão corretos.</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* PAINEL INFERIOR DE TOTAIS E BOTÕES DE AÇÃO FIXOS */}
            <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-3 gap-2 text-center text-xs sm:text-sm font-semibold mb-3">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">Entradas</span>
                  <span className="font-bold font-mono text-emerald-700 dark:text-emerald-300">{formatarCentavos(totalEntradas)}</span>
                </div>
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                  <span className="block text-[10px] text-rose-600 dark:text-rose-400 uppercase font-bold">Saídas / Materiais</span>
                  <span className="font-bold font-mono text-rose-700 dark:text-rose-300">{formatarCentavos(totalSaidas)}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                  <span className="block text-[10px] text-slate-500 uppercase font-bold">Saldo</span>
                  <span className={`font-bold font-mono ${saldoResultante >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatarCentavos(saldoResultante)}
                  </span>
                </div>
              </div>

              {/* BOTÕES DE AÇÃO INFERIORES */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <strong>{itensSelecionadosCount}</strong> de {linhas.length} itens marcados
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Botão Salvar em PDF */}
                  <button
                    type="button"
                    disabled={isGerandoPdf}
                    onClick={handleExportarPDF}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm border border-slate-300 dark:border-slate-700 transition cursor-pointer"
                    title="Salvar esta conferência e comprovante em PDF"
                  >
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>{isGerandoPdf ? 'Gerando...' : 'Salvar em PDF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    Cancelar
                  </button>

                  {/* Botão Adicionar à Proposta / Acerto */}
                  <button
                    type="button"
                    onClick={handleSalvar}
                    disabled={isSalvando || itensSelecionadosCount === 0}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSalvando ? (
                      <span className="animate-spin">⏳ Salvando...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{isCriandoNovoAcerto ? 'Criar Proposta Completa' : `+ Adicionar à Proposta (${itensSelecionadosCount})`}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* MODAL DE ZOOM INTERATIVO EM TELA CHEIA */}
      <PhotoZoomModal
        isOpen={modalZoomAberto}
        onClose={() => setModalZoomAberto(false)}
        imagemUrl={imagemDataUrl}
        titulo={`Documento: ${titulo}`}
        subtitulo={tipoDoc}
      />
    </div>
  );
};
