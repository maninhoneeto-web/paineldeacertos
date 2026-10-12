import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Check, AlertTriangle, AlertCircle, Plus, Trash2, ZoomIn, ZoomOut, RotateCcw, 
  ArrowRightLeft, FileText, Calendar, DollarSign, Tag, User, Layers, Info, Sparkles, UserPlus
} from 'lucide-react';
import { Acerto, PessoaTab, LinhaConferenciaOCR, TipoLancamento, FormaPagamento, DirecaoDivida } from '../types';
import { formatarCentavos, parseValorParaCentavos, formatarCentavosSemSimbolo } from '../utils/currency';

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
          <div className="lg:col-span-5 flex flex-col bg-slate-900 overflow-hidden min-h-[260px] lg:min-h-[460px]">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-950/80 text-white text-xs border-b border-slate-800">
              <span className="text-slate-400">Visualização da Folha / Foto</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                  title="Diminuir zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] px-1">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                  title="Aumentar zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                  title="Redefinir"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/40 select-none">
              <img
                src={imagemDataUrl}
                alt="Comprovante"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg transition-transform duration-150"
              />
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
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvar}
                  disabled={isSalvando || linhas.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isSalvando ? (
                    <span className="animate-spin">⏳ Salvando e organizando...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{isCriandoNovoAcerto ? 'Criar Acerto Completo Organizado' : `Confirmar e Lançar (${linhas.filter((l) => l.incluir).length})`}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
