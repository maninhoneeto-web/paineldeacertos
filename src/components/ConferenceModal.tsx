import React, { useState, useMemo } from 'react';
import { 
  X, Check, AlertTriangle, AlertCircle, Plus, Trash2, ZoomIn, ZoomOut, RotateCcw, 
  ArrowRightLeft, FileText, Calendar, DollarSign, Tag, User, Layers, Info
} from 'lucide-react';
import { Acerto, PessoaTab, LinhaConferenciaOCR, TipoLancamento, FormaPagamento, DirecaoDivida } from '../types';
import { formatarCentavos, parseValorParaCentavos, formatarCentavosSemSimbolo } from '../utils/currency';

interface ConferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  acerto: Acerto;
  pessoaAtualId: string;
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
  pessoaAtualId,
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
  const [linhas, setLinhas] = useState<LinhaConferenciaOCR[]>(linhasIniciais);
  const [zoom, setZoom] = useState(1);
  const [isSalvando, setIsSalvando] = useState(false);
  const [observacoes, setObservacoes] = useState(observacoesOCR);
  const [tipoDoc, setTipoDoc] = useState(tipoDocumentoIdentificado);

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
        // Saída, adiantamento, material
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

  // Alerta de divergência entre o total escrito na nota e a soma das linhas
  const temDivergenciaTotal = totalEscritoCentavos > 0 && Math.abs(totalEscritoCentavos - somaLidaCentavos) > 100; // tolerância R$ 1,00

  // Atualizar campo de uma linha
  const atualizarLinha = (id: string, campo: keyof LinhaConferenciaOCR, valor: any) => {
    setLinhas((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const atualizado = { ...item, [campo]: valor };
          // Se alterou quantidade e unitário de material, recalcular valorCentavos se coerente
          if (campo === 'quantidade' && atualizado.valorCentavos) {
            // mantém
          }
          return atualizado;
        }
        return item;
      })
    );
  };

  // Alterar valor em centavos
  const atualizarValorLinha = (id: string, textoDigitado: string) => {
    const centavos = parseValorParaCentavos(textoDigitado);
    setLinhas((prev) =>
      prev.map((item) => (item.id === id ? { ...item, valorCentavos: centavos } : item))
    );
  };

  // Remover linha
  const removerLinha = (id: string) => {
    setLinhas((prev) => prev.filter((item) => item.id !== id));
  };

  // Adicionar linha manual na conferência
  const adicionarLinha = () => {
    const nova: LinhaConferenciaOCR = {
      id: 'nova_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      data: new Date().toISOString().slice(0, 10),
      descricao: '',
      quantidade: 1,
      valorCentavos: 0,
      tipoSugerido: 'saida',
      categoria: 'Outros',
      pessoaId: pessoaAtualId,
      confianca: 'alta',
      incluir: true,
    };
    setLinhas((prev) => [...prev, nova]);
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
      alert('Erro ao salvar lançamentos: ' + (e.message || 'Tente novamente.'));
    } finally {
      setIsSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="relative flex flex-col w-full max-w-6xl max-h-[95vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* TOPO: Cabeçalho da Conferência */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Conferência Inteligente de Comprovante
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {nomeArquivo} • {tipoDoc} • Confirme os dados lidos pela IA antes de salvar
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ALERTAS NO TOPO SE HOUVER DUPLICIDADE OU DIVERGÊNCIA */}
        {(isDuplicada || temDivergenciaTotal) && (
          <div className="flex flex-col gap-1.5 px-4 sm:px-6 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 text-xs">
            {isDuplicada && (
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span><strong>Atenção: Imagem Já Cadastrada!</strong> Este comprovante já foi enviado anteriormente para este acerto. Verifique se não está duplicando o lançamento.</span>
              </div>
            )}
            {temDivergenciaTotal && (
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Divergência de Totais:</strong> O valor total escrito na nota/anotação é <strong>{formatarCentavos(totalEscritoCentavos)}</strong>, mas a soma dos itens lidos é <strong>{formatarCentavos(somaLidaCentavos)}</strong>. Confira cada linha ao lado.
                </span>
              </div>
            )}
          </div>
        )}

        {/* CORPO: DIVISÃO EM DUAS COLUNAS (IMAGEM X TABELA EDITÁVEL) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          
          {/* COLUNA ESQUERDA: VISUALIZADOR DA IMAGEM COM ZOOM */}
          <div className="lg:col-span-5 flex flex-col bg-slate-900 overflow-hidden min-h-[260px] lg:min-h-[460px]">
            {/* Controles de Zoom */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-950/80 text-white text-xs border-b border-slate-800">
              <span className="text-slate-400">Visualização do Comprovante</span>
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

            {/* Área com Scroll e Zoom */}
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
                <span>Total identificado na nota:</span>
                <span className="font-bold text-emerald-400">{totalEscritoFormatado}</span>
              </div>
            )}
          </div>

          {/* COLUNA DIREITA: TABELA EDITÁVEL DOS LANÇAMENTOS EXTRAÍDOS */}
          <div className="lg:col-span-7 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
            
            {/* Barra de Ações da Tabela */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Itens Extraídos ({linhas.length})
              </span>
              <button
                onClick={adicionarLinha}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Linha</span>
              </button>
            </div>

            {/* Lista Editável das Linhas */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
              {linhas.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <FileText className="w-10 h-10 mb-2 stroke-1" />
                  <p className="text-sm font-medium">Nenhum lançamento extraído automaticamente.</p>
                  <button
                    onClick={adicionarLinha}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                  >
                    + Inserir Lançamento Manual
                  </button>
                </div>
              ) : (
                linhas.map((linha, index) => {
                  const isBaixaConfianca = linha.confianca === 'baixa';
                  const pessoaAtualLinha = acerto.pessoas.find((p) => p.id === linha.pessoaId);

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
                      {/* Linha 1: Checkbox incluir, Descrição, Valor e Exclusão */}
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={linha.incluir}
                          onChange={(e) => atualizarLinha(linha.id, 'incluir', e.target.checked)}
                          className="mt-1.5 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          title="Marque para incluir este lançamento"
                        />

                        {/* Descrição */}
                        <div className="flex-1">
                          <input
                            type="text"
                            value={linha.descricao}
                            onChange={(e) => atualizarLinha(linha.id, 'descricao', e.target.value)}
                            placeholder="Descrição do item ou serviço..."
                            className="w-full text-xs sm:text-sm font-medium px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                          />
                        </div>

                        {/* Valor monetário */}
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
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                          title="Excluir este item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Linha 2: Configurações de Tipo, Categoria, Pessoa e Data */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        
                        {/* Tipo (Sub-aba) */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Seção / Tipo</label>
                          <select
                            value={linha.tipoSugerido}
                            onChange={(e) => atualizarLinha(linha.id, 'tipoSugerido', e.target.value as TipoLancamento)}
                            className="w-full px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          >
                            <option value="saida">Saída / Gasto</option>
                            <option value="entrada">Entrada</option>
                            <option value="adiantamento">Adiantamento</option>
                            <option value="material">Material</option>
                            <option value="divida">Dívida</option>
                          </select>
                        </div>

                        {/* Pessoa (Aba de destino) */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Pessoa (Aba)</label>
                          <select
                            value={linha.pessoaId}
                            onChange={(e) => atualizarLinha(linha.id, 'pessoaId', e.target.value)}
                            className="w-full px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          >
                            {acerto.pessoas.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nome}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Categoria */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Categoria</label>
                          <select
                            value={linha.categoria || 'Geral'}
                            onChange={(e) => atualizarLinha(linha.id, 'categoria', e.target.value)}
                            className="w-full px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          >
                            {acerto.categorias.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
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

                      {/* Notificação se a IA sugeriu mover para outra pessoa */}
                      {linha.pessoaSugeridaNome && linha.pessoaSugeridaNome !== pessoaAtualLinha?.nome && (
                        <div className="flex items-center justify-between mt-2 px-2 py-1 rounded bg-blue-50 dark:bg-blue-950/40 text-[11px] text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-1.5">
                            <Info className="w-3 h-3 shrink-0" />
                            <span>Mencionou <strong>{linha.pessoaSugeridaNome}</strong> na imagem.</span>
                          </div>
                          {(() => {
                            const pessoaEncontrada = acerto.pessoas.find(
                              (p) => p.nome.toLowerCase().includes(linha.pessoaSugeridaNome!.toLowerCase())
                            );
                            if (pessoaEncontrada && pessoaEncontrada.id !== linha.pessoaId) {
                              return (
                                <button
                                  onClick={() => atualizarLinha(linha.id, 'pessoaId', pessoaEncontrada.id)}
                                  className="text-xs font-bold text-blue-600 dark:text-blue-400 underline cursor-pointer"
                                >
                                  Mover para {pessoaEncontrada.nome}
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}

                      {/* Alerta de baixa confiança */}
                      {isBaixaConfianca && (
                        <div className="flex items-center gap-1 mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Confiança baixa da IA (texto ilegível ou rasurado). Confira o valor antes de confirmar.</span>
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
                  <span className="block text-[10px] text-rose-600 dark:text-rose-400 uppercase">Saídas/Materiais</span>
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
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-xs sm:text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isSalvando ? (
                    <span className="animate-spin">⏳ Salvando...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar e Lançar ({linhas.filter((l) => l.incluir).length})</span>
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
