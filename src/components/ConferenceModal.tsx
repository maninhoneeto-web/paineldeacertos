import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Check, AlertTriangle, AlertCircle, Plus, Trash2, ZoomIn, ZoomOut, RotateCcw, RotateCw, Maximize2,
  ArrowRightLeft, FileText, Calendar, DollarSign, Tag, User, Layers, Info, Sparkles, UserPlus
} from 'lucide-react';
import { Acerto, PessoaTab, LinhaConferenciaOCR, TipoLancamento, FormaPagamento, DirecaoDivida } from '../types';
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
  tipoDocumentoIdentificado = 'Documento / Recibo',
  totalEscritoCentavos = 0,
  totalEscritoFormatado = '',
  observacoesOCR = '',
  linhasIniciais,
  isDuplicada,
  onConfirmar,
}) => {
  const [titulo, setTitulo] = useState(tituloSugerido || 'Acerto Organizado por Foto');
  const [zoom, setZoom] = useState(1);
  const [rotacao, setRotacao] = useState(0);
  const [modalZoomAberto, setModalZoomAberto] = useState(false);
  const [isGerandoPdf, setIsGerandoPdf] = useState(false);
  const [isSalvando, setIsSalvando] = useState(false);
  const [observacoes, setObservacoes] = useState(observacoesOCR);
  const [tipoDoc, setTipoDoc] = useState(tipoDocumentoIdentificado);

  // Lista de pessoas com suporte a criação automática mantendo IDs consistentes
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

  // Linhas com associação inteligente de pessoas aos IDs reais
  const [linhas, setLinhas] = useState<LinhaConferenciaOCR[]>(() => {
    return (linhasIniciais || []).map((l) => {
      // 1. Se o ID já bate com uma pessoa existente, mantém
      const matchId = pessoas.find((p) => p.id === l.pessoaId);
      if (matchId) {
        return l;
      }

      // 2. Tenta associar pelo nome sugerido da pessoa na linha
      if (l.pessoaSugeridaNome) {
        const matchNome = pessoas.find((p) =>
          p.nome.toLowerCase().includes(l.pessoaSugeridaNome!.toLowerCase()) ||
          l.pessoaSugeridaNome!.toLowerCase().includes(p.nome.toLowerCase())
        );
        if (matchNome) {
          return { ...l, pessoaId: matchNome.id };
        }
      }

      // 3. Fallback seguro para primeira pessoa ou pessoaAtualId
      const fallbackId = (pessoaAtualId && pessoas.some(p => p.id === pessoaAtualId))
        ? pessoaAtualId
        : pessoas[0]?.id || 'geral';

      return { ...l, pessoaId: fallbackId };
    });
  });

  const [nomeNovaPessoaInput, setNomeNovaPessoaInput] = useState('');
  const [mostrarInputNovaPessoa, setMostrarInputNovaPessoa] = useState(false);

  if (!isOpen) return null;

  // Totais em tempo real das linhas marcadas para inclusão
  const { totalEntradas, totalSaidas, saldoResultante, somaLidaCentavos } = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let somaLida = 0;

    for (const l of linhas) {
      if (!l.incluir) continue;
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
    };
  }, [linhas]);

  const temDivergenciaTotal = totalEscritoCentavos > 0 && Math.abs(totalEscritoCentavos - somaLidaCentavos) > 100;

  // Atualizar campo de uma linha
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
      tipoSugerido: 'saida',
      categoria: 'Outros',
      pessoaId: pessoas[0]?.id || 'geral',
      confianca: 'alta',
      incluir: true,
    };
    setLinhas((prev) => [...prev, nova]);
  };

  // Adicionar uma nova pessoa rapidamente
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

  const handleSalvar = async () => {
    const linhasValidas = linhas.filter((l) => l.incluir && l.descricao.trim());
    if (linhasValidas.length === 0) {
      alert('Selecione ou preencha pelo menos um lançamento para salvar.');
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
      alert('Erro ao salvar acerto: ' + (e.message || 'Tente novamente.'));
    } finally {
      setIsSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="relative flex flex-col w-full max-w-6xl max-h-[96vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* TOPO: Cabeçalho com Título do Acerto Editável se for novo */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {isCriandoNovoAcerto ? '✨ Organizar Todo o Acerto por Foto' : 'Conferência Inteligente do Acerto'}
              </h2>
            </div>
            
            {isCriandoNovoAcerto ? (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Título do Acerto:</span>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="px-2 py-0.5 text-xs sm:text-sm font-bold rounded-lg border border-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="Nome do acerto ou obra..."
                />
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {nomeArquivo} • {tipoDoc} • Confirme os dados lidos pela IA antes de salvar
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="self-end sm:self-auto rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BARRA DAS PESSOAS / ABAS DETECTADAS */}
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-2 bg-emerald-50/70 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800/50 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Abas / Pessoas Identificadas ({pessoas.length}):</span>
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
              <div className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={nomeNovaPessoaInput}
                  onChange={(e) => setNomeNovaPessoaInput(e.target.value)}
                  placeholder="Nome da pessoa..."
                  className="px-2 py-0.5 text-xs rounded-md border border-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
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
                  className="text-slate-400 hover:text-slate-600"
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
                <span>+ Outra Pessoa</span>
              </button>
            )}
          </div>
        </div>

        {/* ALERTAS NO TOPO SE HOUVER DUPLICIDADE OU DIVERGÊNCIA */}
        {(isDuplicada || temDivergenciaTotal) && (
          <div className="flex flex-col gap-1 px-4 sm:px-6 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 text-xs">
            {isDuplicada && (
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span><strong>Atenção: Imagem Já Cadastrada!</strong> Este comprovante já foi enviado anteriormente. Verifique se não está duplicando lançamentos.</span>
              </div>
            )}
            {temDivergenciaTotal && (
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Divergência de Totais:</strong> O valor total escrito na nota/anotação é <strong>{formatarCentavos(totalEscritoCentavos)}</strong>, mas a soma dos itens lidos é <strong>{formatarCentavos(somaLidaCentavos)}</strong>.
                </span>
              </div>
            )}
          </div>
        )}

        {/* CORPO: DUAS COLUNAS (FOTO COM ZOOM X TABELA EDITÁVEL) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          
          {/* COLUNA ESQUERDA: VISUALIZADOR DA IMAGEM COM ZOOM */}
          <div className="lg:col-span-5 flex flex-col bg-slate-900 overflow-hidden min-h-[280px] lg:min-h-[460px]">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-950/80 text-white text-xs border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-medium">Folha / Foto</span>
                <button
                  type="button"
                  onClick={() => setModalZoomAberto(true)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition cursor-pointer"
                  title="Aumentar imagem e abrir em tela cheia com zoom interativo"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Aumentar Imagem</span>
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                  title="Diminuir zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] px-1 text-slate-300">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(1)))}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                  title="Aumentar zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotacao((r) => (r + 90) % 360)}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                  title="Girar 90°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => { setZoom(1); setRotacao(0); }}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                  title="Redefinir tamanho e rotação"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div 
              onClick={() => setModalZoomAberto(true)}
              className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/40 select-none cursor-zoom-in relative group"
              title="Clique para ampliar em tela cheia com zoom e arraste"
            >
              <img
                src={imagemDataUrl}
                alt="Comprovante"
                style={{ transform: `scale(${zoom}) rotate(${rotacao}deg)`, transformOrigin: 'center center' }}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg transition-transform duration-150"
              />
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/75 text-white text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-xs pointer-events-none">
                <Maximize2 className="w-3 h-3 text-emerald-400" />
                <span>Clique para ampliar</span>
              </div>
            </div>

            {totalEscritoFormatado && (
              <div className="px-3 py-2 bg-slate-950 text-slate-300 text-xs border-t border-slate-800 flex justify-between items-center">
                <span>Total identificado na nota/folha:</span>
                <span className="font-bold text-emerald-400">{totalEscritoFormatado}</span>
              </div>
            )}
          </div>

          {/* COLUNA DIREITA: TABELA EDITÁVEL DOS LANÇAMENTOS EXTRAÍDOS */}
          <div className="lg:col-span-7 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
            
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Lançamentos Organizados ({linhas.length})
              </span>
              <button
                onClick={adicionarLinha}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Adicionar Linha</span>
              </button>
            </div>

            {/* Lista Editável das Linhas */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {linhas.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <FileText className="w-10 h-10 mb-2 stroke-1" />
                  <p className="text-sm font-medium">Nenhum lançamento identificado.</p>
                  <button
                    onClick={adicionarLinha}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                  >
                    + Inserir Lançamento Manual
                  </button>
                </div>
              ) : (
                linhas.map((linha) => {
                  const isBaixaConfianca = linha.confianca === 'baixa';
                  const pessoaDaLinha = pessoas.find((p) => p.id === linha.pessoaId);

                  return (
                    <div
                      key={linha.id}
                      className={`p-3 rounded-xl border transition ${
                        !linha.incluir
                          ? 'opacity-40 bg-slate-100 border-slate-200 dark:bg-slate-800/40 dark:border-slate-800'
                          : isBaixaConfianca
                          ? 'bg-amber-50/80 border-amber-300 dark:bg-amber-950/20 dark:border-amber-800'
                          : 'bg-white border-slate-200 dark:bg-slate-800/60 dark:border-slate-700 shadow-2xs'
                      }`}
                    >
                      {/* Linha 1: Checkbox, Descrição, Valor e Exclusão */}
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={linha.incluir}
                          onChange={(e) => atualizarLinha(linha.id, 'incluir', e.target.checked)}
                          className="mt-1.5 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          title="Marque para incluir este lançamento"
                        />

                        <div className="flex-1">
                          <input
                            type="text"
                            value={linha.descricao}
                            onChange={(e) => atualizarLinha(linha.id, 'descricao', e.target.value)}
                            placeholder="Descrição do item ou adiantamento..."
                            className="w-full text-xs sm:text-sm font-medium px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                          />
                        </div>

                        <div className="w-28 sm:w-32">
                          <div className="relative">
                            <span className="absolute left-2 top-2 text-[11px] font-bold text-slate-400">R$</span>
                            <input
                              type="text"
                              value={formatarCentavosSemSimbolo(linha.valorCentavos)}
                              onChange={(e) => atualizarValorLinha(linha.id, e.target.value)}
                              placeholder="0,00"
                              className="w-full text-right font-mono font-bold text-xs sm:text-sm pl-7 pr-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => removerLinha(linha.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title="Excluir este item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Linha 2: Pessoa (Aba), Tipo (Sub-aba), Categoria e Data */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        
                        {/* Pessoa (Aba de destino) */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Pessoa (Aba)</label>
                          <select
                            value={linha.pessoaId}
                            onChange={(e) => atualizarLinha(linha.id, 'pessoaId', e.target.value)}
                            className="w-full px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold"
                          >
                            {pessoas.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nome}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Tipo (Sub-aba) */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Tipo / Seção</label>
                          <select
                            value={linha.tipoSugerido}
                            onChange={(e) => atualizarLinha(linha.id, 'tipoSugerido', e.target.value as TipoLancamento)}
                            className="w-full px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold"
                          >
                            <option value="adiantamento">Adiantamento / Vale</option>
                            <option value="saida">Saída / Despesa</option>
                            <option value="material">Material</option>
                            <option value="entrada">Entrada</option>
                            <option value="divida">Dívida</option>
                          </select>
                        </div>

                        {/* Categoria */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Categoria</label>
                          <input
                            type="text"
                            value={linha.categoria || 'Geral'}
                            onChange={(e) => atualizarLinha(linha.id, 'categoria', e.target.value)}
                            className="w-full px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          />
                        </div>

                        {/* Data */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Data</label>
                          <input
                            type="date"
                            value={linha.data || new Date().toISOString().slice(0, 10)}
                            onChange={(e) => atualizarLinha(linha.id, 'data', e.target.value)}
                            className="w-full px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      </div>

                      {/* Notificação se a IA identificou a pessoa específica */}
                      {linha.pessoaSugeridaNome && (
                        <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                          <Info className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Identificado na foto para: <strong>{linha.pessoaSugeridaNome}</strong> (Alocado na aba: <strong>{pessoaDaLinha?.nome || 'Geral'}</strong>)</span>
                        </div>
                      )}

                      {isBaixaConfianca && (
                        <div className="flex items-center gap-1 mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>Confiança baixa da IA (texto com rasura ou corte). Verifique o valor.</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* PAINEL DE TOTAIS EM TEMPO REAL */}
            <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-3 gap-2 text-center text-xs sm:text-sm font-semibold mb-3">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 uppercase">Entradas</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">{formatarCentavos(totalEntradas)}</span>
                </div>
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                  <span className="block text-[10px] text-rose-600 dark:text-rose-400 uppercase">Saídas/Adiantamentos</span>
                  <span className="font-bold text-rose-700 dark:text-rose-300">{formatarCentavos(totalSaidas)}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                  <span className="block text-[10px] text-slate-500 uppercase">Saldo Resultante</span>
                  <span className={`font-bold ${saldoResultante >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatarCentavos(saldoResultante)}
                  </span>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-2 sm:gap-3">
                {/* Botão Salvar em PDF na Conferência */}
                <button
                  type="button"
                  disabled={isGerandoPdf}
                  onClick={async () => {
                    setIsGerandoPdf(true);
                    try {
                      const { jsPDF } = await import('jspdf');
                      const { default: autoTable } = await import('jspdf-autotable');
                      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                      const pageWidth = doc.internal.pageSize.getWidth();
                      const pageHeight = doc.internal.pageSize.getHeight();

                      // Cabeçalho Corporativo
                      doc.setFillColor(15, 23, 42);
                      doc.rect(0, 0, pageWidth, 28, 'F');
                      doc.setTextColor(255, 255, 255);
                      doc.setFont('helvetica', 'bold');
                      doc.setFontSize(14);
                      doc.text('NDS CFTV DIGITAL', 14, 12);

                      doc.setFont('helvetica', 'normal');
                      doc.setFontSize(9);
                      doc.setTextColor(148, 163, 184);
                      doc.text('Relatório de Conferência de Comprovante & Lançamentos', 14, 18);
                      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - 14, 18, { align: 'right' });

                      let cursorY = 36;
                      doc.setTextColor(15, 23, 42);
                      doc.setFont('helvetica', 'bold');
                      doc.setFontSize(11);
                      doc.text(titulo || 'Conferência de Comprovante', 14, cursorY);
                      cursorY += 5;

                      doc.setFont('helvetica', 'normal');
                      doc.setFontSize(8);
                      doc.setTextColor(100, 116, 139);
                      doc.text(`Arquivo: ${nomeArquivo} | Tipo: ${tipoDoc} | Total Saídas: ${formatarCentavos(totalSaidas)}`, 14, cursorY);
                      cursorY += 6;

                      // Tabela dos lançamentos
                      const linhasParaExportar = linhas.filter((l) => l.incluir);
                      const rows = linhasParaExportar.map((l) => [
                        l.data ? new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR') : '-',
                        l.descricao || 'Item sem descrição',
                        pessoas.find((p) => p.id === l.pessoaId)?.nome || 'Geral',
                        l.categoria || 'Geral',
                        l.tipoSugerido === 'adiantamento' ? 'Adiantamento/Val' : l.tipoSugerido.toUpperCase(),
                        formatarCentavos(l.valorCentavos),
                      ]);

                      autoTable(doc, {
                        startY: cursorY,
                        head: [['Data', 'Descrição', 'Pessoa', 'Categoria', 'Tipo', 'Valor']],
                        body: rows,
                        theme: 'striped',
                        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
                        styles: { fontSize: 8, cellPadding: 2 },
                        columnStyles: {
                          5: { halign: 'right', fontStyle: 'bold' },
                        },
                      });

                      cursorY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : cursorY + 40;

                      // Foto do Comprovante anexada
                      if (cursorY + 110 > pageHeight - 15) {
                        doc.addPage();
                        cursorY = 20;
                      }

                      doc.setFont('helvetica', 'bold');
                      doc.setFontSize(10);
                      doc.setTextColor(15, 23, 42);
                      doc.text('Anexo: Foto do Comprovante', 14, cursorY);
                      cursorY += 5;

                      try {
                        doc.addImage(imagemDataUrl, 'JPEG', 14, cursorY, 110, 85, undefined, 'FAST');
                      } catch (errImg) {
                        console.warn('Erro ao anexar imagem ao PDF:', errImg);
                      }

                      doc.setFontSize(8);
                      doc.setTextColor(148, 163, 184);
                      doc.text('NDS CFTV Digital - Documento Contábil', 14, pageHeight - 8);

                      doc.save(`nds_conferencia_${Date.now()}.pdf`);
                    } catch (errPdf: any) {
                      console.error(errPdf);
                      alert('Erro ao exportar PDF: ' + errPdf.message);
                    } finally {
                      setIsGerandoPdf(false);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm border border-slate-300 dark:border-slate-700 transition cursor-pointer"
                  title="Salvar esta conferência e comprovante em PDF"
                >
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>{isGerandoPdf ? 'Gerando...' : 'Salvar em PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSalvar}
                  disabled={isSalvando || linhas.length === 0}
                  className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isSalvando ? (
                    <span className="animate-spin">⏳ Salvando...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{isCriandoNovoAcerto ? 'Criar Acerto Completo' : `Confirmar (${linhas.filter((l) => l.incluir).length})`}</span>
                    </>
                  )}
                </button>
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
        titulo={`Comprovante: ${nomeArquivo}`}
        subtitulo={tipoDoc}
      />
    </div>
  );
};
