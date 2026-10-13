import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Check, AlertTriangle, AlertCircle, Plus, Trash2, ZoomIn, ZoomOut, RotateCw, Maximize2,
  FileText, Calendar, DollarSign, Tag, User, Layers, Info, Sparkles, RefreshCw, Users, Clock, Package,
  Table as TableIcon, LayoutGrid, Eye, ArrowUpDown, Filter, CheckSquare, Square, TrendingUp, TrendingDown,
  Calculator
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
  tituloSugerido = 'Acerto Organizado por Foto',
  pessoasIdentificadas = [],
  pessoasIniciais,
  pessoaAtualId = '',
  imagemDataUrl,
  imagemHash,
  nomeArquivo,
  tamanhoBytes,
  tipoDocumentoIdentificado = 'Folha de Acerto / Caderno',
  totalEscritoCentavos = 0,
  totalEscritoFormatado = '',
  observacoesOCR = '',
  linhasIniciais,
  isDuplicada,
  onConfirmar,
  onReprocessarComIA,
}) => {
  const [titulo, setTitulo] = useState(tituloSugerido || 'Acerto por Foto');
  const [zoom, setZoom] = useState(1);
  const [rotacao, setRotacao] = useState(0);
  const [modalZoomAberto, setModalZoomAberto] = useState(false);
  const [isGerandoPdf, setIsGerandoPdf] = useState(false);
  const [isSalvando, setIsSalvando] = useState(false);
  const [observacoes, setObservacoes] = useState(observacoesOCR);
  const [tipoDoc, setTipoDoc] = useState(tipoDocumentoIdentificado);

  // Modo de exibição: 'tabelas' (tabelas completas de cálculos e itens) ou 'split' (foto lado a lado)
  const [abaVisualizacao, setAbaVisualizacao] = useState<'tabelas' | 'split'>('tabelas');
  // Formato da lista de itens: 'tabela' ou 'cards'
  const [formatoItens, setFormatoItens] = useState<'tabela' | 'cards'>('tabela');
  // Filtros
  const [filtroPessoaId, setFiltroPessoaId] = useState<string>('todas');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');

  // Lista de pessoas com suporte a criação automática
  const [pessoas, setPessoas] = useState<PessoaTab[]>(() => {
    if (pessoasIniciais && pessoasIniciais.length > 0) {
      return [...pessoasIniciais];
    }

    const cores = ['#059669', '#0284c7', '#7c3aed', '#d97706', '#dc2626', '#4f46e5', '#0d9488'];
    const basePessoas: PessoaTab[] = acerto?.pessoas ? [...acerto.pessoas] : [];

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

  // Cálculos contábeis completos: totais gerais e distribuição rigorosa por pessoa
  const { 
    totalEntradas, 
    totalSaidasDespesas, 
    totalMateriais, 
    totalDespesasGerais, 
    totalAdiantamentos, 
    saldoResultante, 
    somaLidaCentavos, 
    itensSelecionadosCount,
    distribuicaoPorPessoa 
  } = useMemo(() => {
    let entradas = 0;
    let saidasDespesas = 0;
    let materiais = 0;
    let adiantamentos = 0;
    let somaLida = 0;
    let selecionados = 0;

    const mapaPorPessoa: Record<string, {
      totalDespesasCentavos: number;
      totalMateriaisCentavos: number;
      totalAdiantamentosCentavos: number;
      totalEntradasCentavos: number;
      itensCount: number;
    }> = {};

    for (const p of pessoas) {
      mapaPorPessoa[p.id] = {
        totalDespesasCentavos: 0,
        totalMateriaisCentavos: 0,
        totalAdiantamentosCentavos: 0,
        totalEntradasCentavos: 0,
        itensCount: 0,
      };
    }

    for (const l of linhas) {
      if (!l.incluir) continue;
      selecionados++;
      const v = Math.abs(l.valorCentavos || 0);
      somaLida += v;

      if (!mapaPorPessoa[l.pessoaId]) {
        mapaPorPessoa[l.pessoaId] = {
          totalDespesasCentavos: 0,
          totalMateriaisCentavos: 0,
          totalAdiantamentosCentavos: 0,
          totalEntradasCentavos: 0,
          itensCount: 0,
        };
      }
      mapaPorPessoa[l.pessoaId].itensCount++;

      switch (l.tipoSugerido) {
        case 'entrada':
          entradas += v;
          mapaPorPessoa[l.pessoaId].totalEntradasCentavos += v;
          break;
        case 'adiantamento':
          adiantamentos += v;
          mapaPorPessoa[l.pessoaId].totalAdiantamentosCentavos += v;
          break;
        case 'material':
          materiais += v;
          mapaPorPessoa[l.pessoaId].totalMateriaisCentavos += v;
          break;
        case 'saida':
        default:
          saidasDespesas += v;
          mapaPorPessoa[l.pessoaId].totalDespesasCentavos += v;
          break;
      }
    }

    const despesasGerais = saidasDespesas + materiais;
    const saldo = entradas - (despesasGerais + adiantamentos);

    const dist = pessoas.map((p) => {
      const dados = mapaPorPessoa[p.id] || {
        totalDespesasCentavos: 0,
        totalMateriaisCentavos: 0,
        totalAdiantamentosCentavos: 0,
        totalEntradasCentavos: 0,
        itensCount: 0,
      };
      const totalGastosPessoa = dados.totalDespesasCentavos + dados.totalMateriaisCentavos;
      // Saldo da pessoa: Vales recebidos menos Gastos comprovados
      // Se > 0: pessoa pegou mais vales do que comprovou despesas (ela deve/te deve)
      // Se < 0: pessoa gastou mais do próprio bolso do que recebeu em vales (ela tem a receber)
      const saldoPessoa = dados.totalAdiantamentosCentavos - totalGastosPessoa;

      return {
        pessoa: p,
        totalGastosCentavos: totalGastosPessoa,
        totalDespesasCentavos: dados.totalDespesasCentavos,
        totalMateriaisCentavos: dados.totalMateriaisCentavos,
        totalAdiantamentosCentavos: dados.totalAdiantamentosCentavos,
        totalEntradasCentavos: dados.totalEntradasCentavos,
        saldoCentavos: saldoPessoa,
        itensCount: dados.itensCount,
      };
    });

    return {
      totalEntradas: entradas,
      totalSaidasDespesas: saidasDespesas,
      totalMateriais: materiais,
      totalDespesasGerais: despesasGerais,
      totalAdiantamentos: adiantamentos,
      saldoResultante: saldo,
      somaLidaCentavos: somaLida,
      itensSelecionadosCount: selecionados,
      distribuicaoPorPessoa: dist,
    };
  }, [linhas, pessoas]);

  const temDivergenciaTotal = totalEscritoCentavos > 0 && Math.abs(totalEscritoCentavos - somaLidaCentavos) > 100;

  // Filtragem combinada por pessoa e por tipo
  const linhasFiltradas = useMemo(() => {
    return linhas.filter((l) => {
      const batePessoa = filtroPessoaId === 'todas' || l.pessoaId === filtroPessoaId;
      const bateTipo = filtroTipo === 'todos' || l.tipoSugerido === filtroTipo;
      return batePessoa && bateTipo;
    });
  }, [linhas, filtroPessoaId, filtroTipo]);

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

  const toggleMarcarTodos = (marcar: boolean) => {
    setLinhas((prev) =>
      prev.map((l) => {
        if (filtroPessoaId !== 'todas' && l.pessoaId !== filtroPessoaId) return l;
        if (filtroTipo !== 'todos' && l.tipoSugerido !== filtroTipo) return l;
        return { ...l, incluir: marcar };
      })
    );
  };

  const adicionarLinha = () => {
    const pId = filtroPessoaId !== 'todas' ? filtroPessoaId : pessoas[0]?.id || 'geral';
    const tipoDef: TipoLancamento = filtroTipo !== 'todos' ? (filtroTipo as any) : 'saida';
    const nova: LinhaConferenciaOCR = {
      id: 'nova_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      data: new Date().toISOString().slice(0, 10),
      descricao: '',
      quantidade: 1,
      valorCentavos: 0,
      tipoSugerido: tipoDef,
      categoria: tipoDef === 'adiantamento' ? 'Adiantamento/Val' : tipoDef === 'material' ? 'Material de Construção' : 'Mão de Obra',
      pessoaId: pId,
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

  // Exportar PDF completo com relatório formatado, distribuição por pessoa e foto anexada
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
      doc.text('Relatório Contábil de Fechamento, Tabelas & Cálculos da Foto', 14, 18);
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 14, 18, { align: 'right' });

      let cursorY = 36;
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(titulo || 'Acerto Organizado por Foto', 14, cursorY);
      cursorY += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Documento: ${tipoDoc}  |  Despesas: ${formatarCentavos(totalDespesasGerais)}  |  Vales: ${formatarCentavos(totalAdiantamentos)}  |  Saldo: ${formatarCentavos(saldoResultante)}`,
        14,
        cursorY
      );
      cursorY += 8;

      // TABELA 1: Demonstrativo de Fechamento & Cálculos por Pessoa
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('1. TABELA DE FECHAMENTO & CÁLCULOS POR PESSOA', 14, cursorY);
      cursorY += 5;

      const rowsPessoas = distribuicaoPorPessoa.map((d) => [
        d.pessoa.nome,
        `${d.itensCount} itens`,
        formatarCentavos(d.totalGastosCentavos),
        formatarCentavos(d.totalAdiantamentosCentavos),
        d.saldoCentavos > 0
          ? `Te deve ${formatarCentavos(d.saldoCentavos)}`
          : d.saldoCentavos < 0
          ? `A receber ${formatarCentavos(Math.abs(d.saldoCentavos))}`
          : 'Quitado',
      ]);

      autoTable(doc, {
        startY: cursorY,
        head: [['Pessoa / Aba', 'Qtd Itens', 'Gastos Comprovados', 'Vales Recebidos', 'Saldo Calculado']],
        body: rowsPessoas,
        theme: 'grid',
        headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right', fontStyle: 'bold' },
        },
      });

      cursorY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : cursorY + 30;

      // TABELA 2: Tabela Completa dos Itens da Foto
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('2. TABELA DETALHADA DE ITENS DA FOTO', 14, cursorY);
      cursorY += 5;

      const linhasParaExportar = linhas.filter((l) => l.incluir);
      const rows = linhasParaExportar.map((l) => [
        l.data ? new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR') : '-',
        l.descricao || 'Item sem descrição',
        pessoas.find((p) => p.id === l.pessoaId)?.nome || 'Geral',
        l.tipoSugerido === 'adiantamento' ? 'VALE' : l.tipoSugerido === 'material' ? 'MATERIAL' : l.tipoSugerido === 'entrada' ? 'ENTRADA' : 'DESPESA',
        l.quantidade && l.quantidade > 1 ? String(l.quantidade) : '1',
        formatarCentavos(l.valorCentavos),
      ]);

      autoTable(doc, {
        startY: cursorY,
        head: [['Data', 'Item / Descrição', 'Pessoa', 'Tipo', 'Qtd', 'Valor']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          4: { halign: 'center' },
          5: { halign: 'right', fontStyle: 'bold' },
        },
      });

      cursorY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : cursorY + 40;

      // TABELA 3: Resumo Geral Consolidado
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, cursorY, pageWidth - 28, 18, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`Total de Itens: ${linhasParaExportar.length}`, 18, cursorY + 7);
      doc.text(`Total Despesas: ${formatarCentavos(totalDespesasGerais)}`, 70, cursorY + 7);
      doc.text(`Total Vales: ${formatarCentavos(totalAdiantamentos)}`, 130, cursorY + 7);
      doc.setTextColor(saldoResultante >= 0 ? 5 : 220, saldoResultante >= 0 ? 150 : 38, saldoResultante >= 0 ? 105 : 38);
      doc.text(`Saldo Líquido Geral: ${formatarCentavos(saldoResultante)}`, 18, cursorY + 13);
      cursorY += 24;

      // Anexo: Foto do Comprovante / Proposta
      if (cursorY + 115 > pageHeight - 15) {
        doc.addPage();
        cursorY = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('Anexo: Foto Original do Documento / Caderno de Obra', 14, cursorY);
      cursorY += 5;

      try {
        doc.addImage(imagemDataUrl, 'JPEG', 14, cursorY, 120, 95, undefined, 'FAST');
      } catch (errImg) {
        console.warn('Erro ao anexar imagem ao PDF:', errImg);
      }

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('NDS CFTV Digital - Documento Oficial', 14, pageHeight - 8);

      const sanitizado = (titulo || 'acerto').toLowerCase().replace(/[^a-z0-9]/g, '_');
      doc.save(`nds_tabelas_calculos_${sanitizado}_${Date.now()}.pdf`);
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
      alert('Selecione ou preencha pelo menos um item para adicionar ao acerto.');
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
      <div className="relative flex flex-col w-full max-w-7xl max-h-[96vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* TOPO: Título, Badges, Alternância de Modo (Tabelas x Foto Lado a Lado) e Ações Rápidas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-600" />
                <span>{isCriandoNovoAcerto ? '✨ Cálculos & Tabelas Extraídos da Foto' : 'Tabelas & Cálculos Contábeis da Foto'}</span>
              </h2>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                {linhas.length} itens calculados
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Título:</span>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="px-2.5 py-1 text-xs sm:text-sm font-bold rounded-lg border border-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white max-w-md focus:ring-2 focus:ring-emerald-500"
                placeholder="Nome do acerto ou obra..."
              />
            </div>
          </div>

          {/* BOTÕES DE NAVEGAÇÃO E AÇÃO SUPERIORES */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Alternador de Modo: Tabelas & Cálculos vs Split-Screen */}
            <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setAbaVisualizacao('tabelas')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  abaVisualizacao === 'tabelas'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Tabelas & Cálculos</span>
              </button>
              <button
                type="button"
                onClick={() => setAbaVisualizacao('split')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  abaVisualizacao === 'split'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Foto + Conferência</span>
              </button>
            </div>

            {/* BOTÃO AUMENTAR IMAGEM */}
            <button
              type="button"
              onClick={() => setModalZoomAberto(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm transition cursor-pointer"
              title="Aumentar imagem e abrir zoom interativo em tela cheia"
            >
              <Maximize2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Ver Foto</span>
            </button>

            {/* BOTÃO SALVAR EM PDF */}
            <button
              type="button"
              onClick={handleExportarPDF}
              disabled={isGerandoPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-xs sm:text-sm border border-blue-300 dark:border-blue-800 transition cursor-pointer"
              title="Baixar tabelas e cálculos em PDF com anexo da foto"
            >
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{isGerandoPdf ? 'Gerando...' : 'Salvar Tabelas em PDF'}</span>
            </button>

            {/* BOTÃO ADICIONAR AO ACERTO */}
            <button
              type="button"
              onClick={handleSalvar}
              disabled={isSalvando || itensSelecionadosCount === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
              title="Salvar todas as tabelas e cálculos no acerto"
            >
              {isSalvando ? (
                <span className="animate-spin">⏳ Salvando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>+ Confirmar e Salvar ({itensSelecionadosCount})</span>
                </>
              )}
            </button>

            {/* FECHAR */}
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ALERTA SE HOUVER DUPLICIDADE OU DIVERGÊNCIA */}
        {(isDuplicada || temDivergenciaTotal) && (
          <div className="flex flex-col gap-1 px-4 sm:px-6 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 text-xs">
            {isDuplicada && (
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span><strong>Atenção:</strong> Imagem já cadastrada anteriormente no sistema.</span>
              </div>
            )}
            {temDivergenciaTotal && (
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Divergência de Total:</strong> Na foto está escrito <strong>{formatarCentavos(totalEscritoCentavos)}</strong> e a soma dos itens lidos é <strong>{formatarCentavos(somaLidaCentavos)}</strong>.
                </span>
              </div>
            )}
          </div>
        )}

        {/* CORPO PRINCIPAL COM CONTEÚDO EM TABELAS OU SPLIT SCREEN */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* ======================================================== */}
          {/* TABELA 1: TABELA DE FECHAMENTO & CÁLCULOS POR PESSOA     */}
          {/* ======================================================== */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/20 border-b border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-black text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  <span>1. TABELA DE FECHAMENTO & CÁLCULOS POR PESSOA (GERADA DA FOTO)</span>
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Distribuição calculada em tempo real: gastos comprovados, vales recebidos e saldo individual de cada participante.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {mostrarInputNovaPessoa ? (
                  <div className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-emerald-500 shadow-2xs">
                    <input
                      type="text"
                      value={nomeNovaPessoaInput}
                      onChange={(e) => setNomeNovaPessoaInput(e.target.value)}
                      placeholder="Nome da pessoa..."
                      className="px-2 py-0.5 text-xs rounded border-0 bg-transparent text-slate-900 dark:text-white w-28 focus:outline-none font-bold"
                      autoFocus
                    />
                    <button
                      onClick={() => handleCriarNovaPessoa(nomeNovaPessoaInput)}
                      className="px-2 py-0.5 bg-emerald-600 text-white rounded text-xs font-bold"
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
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Nova Pessoa / Aba</span>
                  </button>
                )}
              </div>
            </div>

            {/* TABELA CONTÁBIL DE CÁLCULO POR PESSOA */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 uppercase font-bold border-b border-slate-200 dark:border-slate-700 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Pessoa / Participante</th>
                    <th className="py-2.5 px-3 text-center">Itens</th>
                    <th className="py-2.5 px-3 text-right">Despesas Pagas</th>
                    <th className="py-2.5 px-3 text-right">Materiais Comprados</th>
                    <th className="py-2.5 px-3 text-right">Total Gastos</th>
                    <th className="py-2.5 px-3 text-right">Vales / Adiantamentos</th>
                    <th className="py-2.5 px-3 text-right">Saldo Calculado</th>
                    <th className="py-2.5 px-3 text-center">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {distribuicaoPorPessoa.map((d) => {
                    const isFiltroAtivo = filtroPessoaId === d.pessoa.id;
                    return (
                      <tr
                        key={d.pessoa.id}
                        onClick={() => setFiltroPessoaId(isFiltroAtivo ? 'todas' : d.pessoa.id)}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer ${
                          isFiltroAtivo ? 'bg-emerald-50/70 dark:bg-emerald-950/30 font-bold' : ''
                        }`}
                        title="Clique para filtrar a tabela de itens por esta pessoa"
                      >
                        <td className="py-2.5 px-3 flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: d.pessoa.cor || '#059669' }}
                          />
                          <span className="font-bold text-slate-900 dark:text-white">{d.pessoa.nome}</span>
                          {isFiltroAtivo && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-600 text-white text-[10px]">
                              Filtrado
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-500">
                          {d.itensCount}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          {formatarCentavos(d.totalDespesasCentavos)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-blue-600 dark:text-blue-400">
                          {formatarCentavos(d.totalMateriaisCentavos)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                          {formatarCentavos(d.totalGastosCentavos)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                          {formatarCentavos(d.totalAdiantamentosCentavos)}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono font-black ${
                          d.saldoCentavos > 0 ? 'text-rose-600 dark:text-rose-400' : d.saldoCentavos < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'
                        }`}>
                          {d.saldoCentavos > 0
                            ? `+ ${formatarCentavos(d.saldoCentavos)}`
                            : d.saldoCentavos < 0
                            ? `- ${formatarCentavos(Math.abs(d.saldoCentavos))}`
                            : 'R$ 0,00'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            d.saldoCentavos > 0
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : d.saldoCentavos < 0
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {d.saldoCentavos > 0
                              ? 'Te deve'
                              : d.saldoCentavos < 0
                              ? 'A receber'
                              : 'Quitado'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-xs">
                  <tr>
                    <td className="py-2.5 px-3 uppercase text-slate-800 dark:text-white">TOTAL CONSOLIDADO</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white">{itensSelecionadosCount}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{formatarCentavos(totalSaidasDespesas)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-blue-600 dark:text-blue-400">{formatarCentavos(totalMateriais)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-rose-600 dark:text-rose-400">{formatarCentavos(totalDespesasGerais)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-600 dark:text-amber-400">{formatarCentavos(totalAdiantamentos)}</td>
                    <td className={`py-2.5 px-3 text-right font-mono font-black ${saldoResultante >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatarCentavos(saldoResultante)}
                    </td>
                    <td className="py-2.5 px-3 text-center text-[11px] text-slate-500">Saldo Líquido</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ======================================================== */}
          {/* SEÇÃO DA FOTO (SE MODO SPLIT ESTIVER ATIVO)             */}
          {/* ======================================================== */}
          {abaVisualizacao === 'split' && (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 text-white text-xs border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-400">Foto Original do Acerto</span>
                  <button
                    type="button"
                    onClick={() => setModalZoomAberto(true)}
                    className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[11px]"
                  >
                    Tela Cheia
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} className="p-1 rounded bg-slate-800 text-slate-300">
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.25).toFixed(2)))} className="p-1 rounded bg-slate-800 text-slate-300">
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setRotacao((r) => (r + 90) % 360)} className="p-1 rounded bg-slate-800 text-slate-300">
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div 
                className="p-4 flex items-center justify-center min-h-[300px] max-h-[460px] overflow-auto cursor-zoom-in bg-slate-950"
                onClick={() => setModalZoomAberto(true)}
              >
                <img
                  src={imagemDataUrl}
                  alt={nomeArquivo}
                  style={{
                    transform: `scale(${zoom}) rotate(${rotacao}deg)`,
                    transition: 'transform 0.15s ease-out',
                    maxWidth: '100%',
                    maxHeight: '440px',
                    objectFit: 'contain',
                  }}
                  className="rounded shadow-lg"
                />
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TABELA 2: TABELA DETALHADA DE ITENS DA FOTO             */}
          {/* ======================================================== */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            
            {/* CABEÇALHO DA TABELA DE ITENS COM FILTROS E AÇÕES */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-emerald-600" />
                  <span>2. TABELA DE ITENS DA FOTO ({linhasFiltradas.length} exibidos de {linhas.length})</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Edite valores, quantidades, descrições ou pessoas diretamente na planilha.
                </p>
              </div>

              {/* CONTROLES: FILTRO DE PESSOA, FILTRO DE TIPO E FORMATO */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Filtro por Pessoa */}
                <select
                  value={filtroPessoaId}
                  onChange={(e) => setFiltroPessoaId(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                >
                  <option value="todas">Todas as Pessoas ({linhas.length})</option>
                  {pessoas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({linhas.filter((l) => l.pessoaId === p.id).length})
                    </option>
                  ))}
                </select>

                {/* Filtro por Tipo */}
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                >
                  <option value="todos">Todos os Tipos</option>
                  <option value="saida">🔴 Apenas Despesas</option>
                  <option value="adiantamento">🟡 Apenas Vales</option>
                  <option value="material">🔵 Apenas Materiais</option>
                  <option value="entrada">🟢 Apenas Entradas</option>
                </select>

                {/* Alternador Tabela / Cards */}
                <div className="flex items-center bg-slate-200 dark:bg-slate-700 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFormatoItens('tabela')}
                    className={`p-1 rounded text-xs transition ${
                      formatoItens === 'tabela' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-300'
                    }`}
                    title="Exibir como Tabela Contábil"
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormatoItens('cards')}
                    className={`p-1 rounded text-xs transition ${
                      formatoItens === 'cards' ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-2xs font-bold' : 'text-slate-600 dark:text-slate-300'
                    }`}
                    title="Exibir como Cards"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Botão + Linha */}
                <button
                  type="button"
                  onClick={adicionarLinha}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Adicionar Linha</span>
                </button>
              </div>
            </div>

            {/* TABELA REAL / PLANILHA DOS ITENS */}
            {formatoItens === 'tabela' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 uppercase font-bold border-b border-slate-200 dark:border-slate-700 text-[11px]">
                    <tr>
                      <th className="py-2 px-2 text-center w-8">
                        <button
                          type="button"
                          onClick={() => toggleMarcarTodos(!linhasFiltradas.every((l) => l.incluir))}
                          className="text-slate-400 hover:text-emerald-600"
                          title="Marcar/Desmarcar todos"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                        </button>
                      </th>
                      <th className="py-2 px-2 w-24">Data</th>
                      <th className="py-2 px-3">Item / Descrição da Foto</th>
                      <th className="py-2 px-2 w-32">Pessoa / Aba</th>
                      <th className="py-2 px-2 w-32">Tipo</th>
                      <th className="py-2 px-2 text-center w-16">Qtd</th>
                      <th className="py-2 px-3 text-right w-28">Valor (R$)</th>
                      <th className="py-2 px-2 text-center w-10">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {linhasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                          Nenhum item encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      linhasFiltradas.map((linha, idx) => {
                        const isAdiantamento = linha.tipoSugerido === 'adiantamento';
                        const isMaterial = linha.tipoSugerido === 'material';
                        const isEntrada = linha.tipoSugerido === 'entrada';

                        return (
                          <tr
                            key={linha.id}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${
                              !linha.incluir ? 'opacity-40 bg-slate-100/50 dark:bg-slate-800/20' : ''
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="py-2 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={linha.incluir}
                                onChange={(e) => atualizarLinha(linha.id, 'incluir', e.target.checked)}
                                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                            </td>

                            {/* Data */}
                            <td className="py-2 px-2">
                              <input
                                type="date"
                                value={linha.data || ''}
                                onChange={(e) => atualizarLinha(linha.id, 'data', e.target.value)}
                                className="w-full px-1.5 py-0.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                              />
                            </td>

                            {/* Descrição */}
                            <td className="py-2 px-3">
                              <input
                                type="text"
                                value={linha.descricao}
                                onChange={(e) => atualizarLinha(linha.id, 'descricao', e.target.value)}
                                placeholder="Descrição do item..."
                                className="w-full px-2 py-1 text-xs font-semibold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                              />
                            </td>

                            {/* Pessoa */}
                            <td className="py-2 px-2">
                              <select
                                value={linha.pessoaId}
                                onChange={(e) => atualizarLinha(linha.id, 'pessoaId', e.target.value)}
                                className="w-full px-1.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                              >
                                {pessoas.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.nome}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Tipo */}
                            <td className="py-2 px-2">
                              <select
                                value={linha.tipoSugerido}
                                onChange={(e) => atualizarLinha(linha.id, 'tipoSugerido', e.target.value)}
                                className={`w-full px-1.5 py-1 text-xs rounded border font-bold ${
                                  isAdiantamento
                                    ? 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                                    : isMaterial
                                    ? 'bg-blue-50 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200'
                                    : isEntrada
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200'
                                    : 'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200'
                                }`}
                              >
                                <option value="saida">🔴 Despesa</option>
                                <option value="adiantamento">🟡 Vale</option>
                                <option value="material">🔵 Material</option>
                                <option value="entrada">🟢 Entrada</option>
                                <option value="divida">Dívida</option>
                              </select>
                            </td>

                            {/* Qtd */}
                            <td className="py-2 px-2 text-center">
                              <input
                                type="number"
                                min="1"
                                value={linha.quantidade || 1}
                                onChange={(e) => atualizarLinha(linha.id, 'quantidade', Math.max(1, Number(e.target.value) || 1))}
                                className="w-12 px-1 py-0.5 text-center text-xs font-bold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                              />
                            </td>

                            {/* Valor */}
                            <td className="py-2 px-3 text-right">
                              <input
                                type="text"
                                value={formatarCentavosSemSimbolo(linha.valorCentavos)}
                                onChange={(e) => atualizarValorLinha(linha.id, e.target.value)}
                                placeholder="0,00"
                                className="w-24 px-2 py-1 text-right text-xs font-mono font-bold rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                              />
                            </td>

                            {/* Excluir */}
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => removerLinha(linha.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition"
                                title="Remover item da tabela"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* MODO CARDS ALTERNATIVO */
              <div className="p-4 space-y-2.5">
                {linhasFiltradas.map((linha) => {
                  const isAdiantamento = linha.tipoSugerido === 'adiantamento';
                  const isMaterial = linha.tipoSugerido === 'material';
                  const isEntrada = linha.tipoSugerido === 'entrada';

                  return (
                    <div
                      key={linha.id}
                      className={`p-3 rounded-xl border transition ${
                        !linha.incluir
                          ? 'opacity-40 bg-slate-100 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800'
                          : isAdiantamento
                          ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                          : isMaterial
                          ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                          : isEntrada
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                          : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={linha.incluir}
                          onChange={(e) => atualizarLinha(linha.id, 'incluir', e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600"
                        />
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          isAdiantamento
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isMaterial
                            ? 'bg-blue-100 text-blue-900 border border-blue-300'
                            : isEntrada
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-rose-100 text-rose-900 border border-rose-300'
                        }`}>
                          {isAdiantamento ? '🟡 VALE' : isMaterial ? '🔵 MATERIAL' : isEntrada ? '🟢 ENTRADA' : '🔴 DESPESA'}
                        </span>
                        <input
                          type="text"
                          value={linha.descricao}
                          onChange={(e) => atualizarLinha(linha.id, 'descricao', e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs font-semibold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                        />
                        <input
                          type="text"
                          value={formatarCentavosSemSimbolo(linha.valorCentavos)}
                          onChange={(e) => atualizarValorLinha(linha.id, e.target.value)}
                          className="w-24 px-2 py-1 text-right text-xs font-mono font-bold rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                        />
                        <button onClick={() => removerLinha(linha.id)} className="p-1 text-slate-400 hover:text-rose-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

        {/* RODAPÉ FIXO COM TOTAIS FINAIS E BOTÕES DE CONFIRMAÇÃO */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/90 border-t border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* 4 CARDS DE RESUMO DOS CÁLCULOS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 text-xs">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
              <span className="block text-[10px] text-emerald-600 uppercase font-bold">Total Entradas</span>
              <span className="font-bold font-mono text-emerald-700 dark:text-emerald-300 text-sm">
                {formatarCentavos(totalEntradas)}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center">
              <span className="block text-[10px] text-rose-600 uppercase font-bold">Total Despesas</span>
              <span className="font-bold font-mono text-rose-700 dark:text-rose-300 text-sm">
                {formatarCentavos(totalDespesasGerais)}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center">
              <span className="block text-[10px] text-amber-600 uppercase font-bold">Total Vales</span>
              <span className="font-bold font-mono text-amber-700 dark:text-amber-300 text-sm">
                {formatarCentavos(totalAdiantamentos)}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-center">
              <span className="block text-[10px] text-slate-500 uppercase font-bold">Saldo Líquido</span>
              <span className={`font-bold font-mono text-sm ${saldoResultante >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatarCentavos(saldoResultante)}
              </span>
            </div>
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="flex items-center justify-end gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              disabled={isGerandoPdf}
              onClick={handleExportarPDF}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm border border-slate-300 dark:border-slate-700 transition cursor-pointer"
            >
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>{isGerandoPdf ? 'Gerando...' : 'Salvar em PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Cancelar
            </button>

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
                  <span>{isCriandoNovoAcerto ? 'Criar Acerto Completo' : `+ Confirmar Tabelas (${itensSelecionadosCount})`}</span>
                </>
              )}
            </button>
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
