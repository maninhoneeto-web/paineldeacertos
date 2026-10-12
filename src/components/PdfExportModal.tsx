import React, { useState } from 'react';
import { X, FileText, Share2, Download, CheckSquare, Square, Layers, Image as ImageIcon } from 'lucide-react';
import { Acerto, Lancamento, ImagemComprovante } from '../types';
import { gerarRelatorioPDF, compartilharOuBaixarPDF, OpcoesExportacaoPDF } from '../utils/pdfGenerator';

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  acerto: Acerto;
  lancamentos: Lancamento[];
  imagens: ImagemComprovante[];
  pessoaPreSelecionadaId?: string;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  acerto,
  lancamentos,
  imagens,
  pessoaPreSelecionadaId,
}) => {
  const [pessoasSelecionadas, setPessoasSelecionadas] = useState<string[]>(
    pessoaPreSelecionadaId ? [pessoaPreSelecionadaId] : acerto.pessoas.map((p) => p.id)
  );

  const [incluirAbaGeral, setIncluirAbaGeral] = useState<boolean>(!pessoaPreSelecionadaId);

  const [secoes, setSecoes] = useState({
    resumo: true,
    entradas: true,
    saidas: true,
    adiantamentos: true,
    materiais: true,
    dividas: true,
  });

  const [incluirImagens, setIncluirImagens] = useState<boolean>(true);
  const [isGerando, setIsGerando] = useState<boolean>(false);

  if (!isOpen) return null;

  const togglePessoa = (id: string) => {
    setPessoasSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const selecionarTodasPessoas = () => {
    setPessoasSelecionadas(acerto.pessoas.map((p) => p.id));
  };

  const limparPessoas = () => {
    setPessoasSelecionadas([]);
  };

  const handleExportar = async (compartilhar: boolean) => {
    if (pessoasSelecionadas.length === 0 && !incluirAbaGeral) {
      alert('Selecione pelo menos uma pessoa ou marque o Resumo Geral para gerar o PDF.');
      return;
    }

    setIsGerando(true);
    try {
      const opcoes: OpcoesExportacaoPDF = {
        pessoasIds: pessoasSelecionadas,
        secoes,
        incluirImagens,
        incluirAbaGeral,
      };

      const doc = await gerarRelatorioPDF(acerto, lancamentos, imagens, opcoes);
      const sanitizado = acerto.titulo.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const nomeArquivo = `acerto_${sanitizado}_${new Date().toISOString().slice(0, 10)}.pdf`;

      if (compartilhar) {
        await compartilharOuBaixarPDF(doc, nomeArquivo, acerto.titulo);
      } else {
        doc.save(nomeArquivo);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao gerar PDF: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsGerando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Exportar Relatório em PDF
              </h3>
              <p className="text-xs text-slate-500">
                Layout contábil profissional pronto para compartilhar
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Opções */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs sm:text-sm">
          
          {/* Aba Geral */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">Incluir Aba Geral (Consolidada)</span>
              <span className="text-xs text-slate-500">Resumo de todas as pessoas e gráfico de entradas x saídas</span>
            </div>
            <input
              type="checkbox"
              checked={incluirAbaGeral}
              onChange={(e) => setIncluirAbaGeral(e.target.checked)}
              className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>

          {/* Seleção de Pessoas */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300 uppercase text-xs">
                Pessoas a Incluir ({pessoasSelecionadas.length}/{acerto.pessoas.length})
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={selecionarTodasPessoas}
                  className="text-emerald-600 hover:underline font-semibold cursor-pointer"
                >
                  Todas
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={limparPessoas}
                  className="text-slate-400 hover:underline font-semibold cursor-pointer"
                >
                  Nenhuma
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {acerto.pessoas.map((p) => {
                const checked = pessoasSelecionadas.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePessoa(p.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      checked
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-slate-900 dark:text-white font-bold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">{p.nome}</span>
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seleção de Seções */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-xs mb-1.5">
              Seções de Cada Pessoa
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'resumo', label: 'Resumo / Totais' },
                { id: 'entradas', label: 'Entradas' },
                { id: 'saidas', label: 'Saídas' },
                { id: 'adiantamentos', label: 'Adiantamentos' },
                { id: 'materiais', label: 'Materiais' },
                { id: 'dividas', label: 'Dívidas' },
              ].map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={(secoes as any)[s.id]}
                    onChange={(e) =>
                      setSecoes((prev) => ({ ...prev, [s.id]: e.target.checked }))
                    }
                    className="h-3.5 w-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-800 dark:text-slate-200">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Anexar fotos */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="font-bold text-slate-900 dark:text-white block text-xs sm:text-sm">
                  Anexar Fotos dos Comprovantes
                </span>
                <span className="text-[11px] text-slate-500">
                  Inclui as imagens lidas pela IA no final do PDF ({imagens.length} disponíveis)
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={incluirImagens}
              onChange={(e) => setIncluirImagens(e.target.checked)}
              className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
          </div>

        </div>

        {/* Rodapé com Botões de Ação */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2 p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => handleExportar(false)}
            disabled={isGerando}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Baixar Arquivo PDF</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportar(true)}
            disabled={isGerando}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            {isGerando ? (
              <span>Gerando PDF...</span>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Compartilhar (WhatsApp / E-mail)</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
