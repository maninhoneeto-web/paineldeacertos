import React, { useState, useMemo } from 'react';
import { 
  Table as TableIcon, Plus, Trash2, Copy, Search, 
  Download, FileText, Check, CheckCircle2, Camera, User
} from 'lucide-react';
import { Acerto, Lancamento, TipoLancamento } from '../types';
import { 
  formatarCentavos, 
  parseValorParaCentavos, 
  formatarCentavosSemSimbolo, 
  calcularTotaisPessoa,
  calcularResolucaoAcerto 
} from '../utils/currency';

interface TabPlanilhaEditavelProps {
  acerto: Acerto;
  lancamentos: Lancamento[];
  onSalvarLancamento: (lancamento: Lancamento) => Promise<void>;
  onExcluirLancamento: (id: string) => Promise<void>;
  onDuplicarLancamento: (lancamento: Lancamento) => Promise<void>;
  onMoverLancamento: (lancamentoId: string, novaPessoaId: string, novoTipo?: TipoLancamento) => Promise<void>;
  onNovoLancamento: (tipoPre?: TipoLancamento) => void;
  onUploadImagem?: (files: FileList | null) => void;
  onGerarPdf: () => void;
  onSalvarObservacoesAcerto?: (observacoes: string) => Promise<void>;
  isEnviandoImagem?: boolean;
}

export const TabPlanilhaEditavel: React.FC<TabPlanilhaEditavelProps> = ({
  acerto,
  lancamentos,
  onSalvarLancamento,
  onExcluirLancamento,
  onDuplicarLancamento,
  onMoverLancamento,
  onNovoLancamento: _onNovoLancamento,
  onUploadImagem,
  onGerarPdf,
  onSalvarObservacoesAcerto,
  isEnviandoImagem = false,
}) => {
  const [busca, setBusca] = useState('');
  const [filtroPessoa, setFiltroPessoa] = useState<string>('todas');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [ordenacao, setOrdenacao] = useState<'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc'>('data_desc');
  const [selecionadosIds, setSelecionadosIds] = useState<string[]>([]);
  const [isSalvandoLinha, setIsSalvandoLinha] = useState<string | null>(null);

  // Observações gerais do acerto
  const [obsAcerto, setObsAcerto] = useState(acerto.observacoes || '');
  const [isSalvandoObs, setIsSalvandoObs] = useState(false);
  const [obsSalvaSucesso, setObsSalvaSucesso] = useState(false);

  // WhatsApp
  const [copiadoWhats, setCopiadoWhats] = useState(false);

  // Resolução contábil direta: QUEM DEVE A QUEM
  const resolucao = useMemo(() => {
    return calcularResolucaoAcerto(acerto, lancamentos);
  }, [acerto, lancamentos]);

  // Resumo por pessoa
  const resumoPessoas = useMemo(() => {
    return acerto.pessoas.map((p) => {
      const tot = calcularTotaisPessoa(p, lancamentos);
      const count = lancamentos.filter((l) => l.pessoaId === p.id).length;
      return {
        pessoa: p,
        totais: tot,
        count,
      };
    });
  }, [acerto.pessoas, lancamentos]);

  // Lançamentos filtrados e ordenados
  const lancamentosProcessados = useMemo(() => {
    let lista = lancamentos.filter((l) => {
      const batePessoa = filtroPessoa === 'todas' || l.pessoaId === filtroPessoa;
      const bateTipo = filtroTipo === 'todos' || l.tipo === filtroTipo;
      const bateBusca = !busca.trim() || 
        (l.descricao || '').toLowerCase().includes(busca.toLowerCase()) ||
        (l.categoria || '').toLowerCase().includes(busca.toLowerCase()) ||
        (l.observacoes || '').toLowerCase().includes(busca.toLowerCase()) ||
        (l.loja || '').toLowerCase().includes(busca.toLowerCase()) ||
        acerto.pessoas.find(p => p.id === l.pessoaId)?.nome.toLowerCase().includes(busca.toLowerCase());

      return batePessoa && bateTipo && bateBusca;
    });

    return lista.sort((a, b) => {
      if (ordenacao === 'data_desc') return (b.data || '').localeCompare(a.data || '');
      if (ordenacao === 'data_asc') return (a.data || '').localeCompare(b.data || '');
      if (ordenacao === 'valor_desc') return (b.valorCentavos || 0) - (a.valorCentavos || 0);
      if (ordenacao === 'valor_asc') return (a.valorCentavos || 0) - (b.valorCentavos || 0);
      return 0;
    });
  }, [lancamentos, filtroPessoa, filtroTipo, busca, ordenacao, acerto.pessoas]);

  // Atualização direta de campo
  const handleAtualizarCampo = async (lancamento: Lancamento, campo: keyof Lancamento, valor: any) => {
    try {
      setIsSalvandoLinha(lancamento.id);
      const atualizado: Lancamento = {
        ...lancamento,
        [campo]: valor,
        updatedAt: new Date().toISOString(),
      };
      await onSalvarLancamento(atualizado);
    } catch (err) {
      console.error('Erro ao atualizar linha da planilha:', err);
    } finally {
      setIsSalvandoLinha(null);
    }
  };

  // Atualização de valor em R$
  const handleAtualizarValor = async (lancamento: Lancamento, textoValor: string) => {
    const centavos = parseValorParaCentavos(textoValor);
    if (centavos !== lancamento.valorCentavos) {
      await handleAtualizarCampo(lancamento, 'valorCentavos', centavos);
    }
  };

  // Adicionar nova linha em branco no topo
  const handleAdicionarLinhaRapida = async () => {
    const idPessoaPadrao = filtroPessoa !== 'todas' ? filtroPessoa : acerto.pessoas[0]?.id || 'geral';
    const tipoPadrao: TipoLancamento = filtroTipo !== 'todos' ? (filtroTipo as any) : 'saida';
    
    const novo: Lancamento = {
      id: 'lanc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      acertoId: acerto.id,
      pessoaId: idPessoaPadrao,
      tipo: tipoPadrao,
      data: new Date().toISOString().slice(0, 10),
      descricao: '',
      valorCentavos: 0,
      categoria: 'Geral',
      formaPagamento: 'Pix',
      quantidade: 1,
      observacoes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSalvarLancamento(novo);
  };

  // Salvar Observações do Acerto
  const handleSalvarObs = async () => {
    setIsSalvandoObs(true);
    try {
      if (onSalvarObservacoesAcerto) {
        await onSalvarObservacoesAcerto(obsAcerto);
      }
      setObsSalvaSucesso(true);
      setTimeout(() => setObsSalvaSucesso(false), 3000);
    } catch (err: any) {
      alert('Erro ao salvar observações: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSalvandoObs(false);
    }
  };

  // Copiar resumo para WhatsApp
  const handleCopiarWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(resolucao.textoWhatsApp);
      setCopiadoWhats(true);
      setTimeout(() => setCopiadoWhats(false), 3000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = resolucao.textoWhatsApp;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiadoWhats(true);
      setTimeout(() => setCopiadoWhats(false), 3000);
    }
  };

  // Exportar para CSV / Excel
  const handleExportarExcelCSV = () => {
    const cabecalho = ['ID', 'Data', 'Descrição', 'Pessoa / Aba', 'Tipo', 'Categoria', 'Forma Pagamento', 'Qtd', 'Valor (R$)', 'Observações'];
    const linhasCSV = lancamentosProcessados.map((l) => {
      const nomePessoa = acerto.pessoas.find((p) => p.id === l.pessoaId)?.nome || 'Geral';
      const valorFormatado = (l.valorCentavos / 100).toFixed(2).replace('.', ',');
      const tipoNome = l.tipo === 'adiantamento' ? 'Vale / Adiantamento' : l.tipo === 'material' ? 'Material' : l.tipo === 'entrada' ? 'Entrada' : 'Despesa';
      
      return [
        l.id,
        l.data || '',
        `"${(l.descricao || '').replace(/"/g, '""')}"`,
        `"${nomePessoa}"`,
        `"${tipoNome}"`,
        `"${l.categoria || ''}"`,
        `"${l.formaPagamento || 'Pix'}"`,
        l.quantidade || 1,
        `"${valorFormatado}"`,
        `"${(l.observacoes || '').replace(/"/g, '""')}"`,
      ].join(';');
    });

    const csvCompleto = '\uFEFF' + [cabecalho.join(';'), ...linhasCSV].join('\r\n');
    const blob = new Blob([csvCompleto], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const nomeLimpo = acerto.titulo.toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.href = url;
    link.setAttribute('download', `planilha_acerto_${nomeLimpo}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Excluir selecionados em lote
  const handleExcluirSelecionados = async () => {
    if (selecionadosIds.length === 0) return;
    if (!confirm(`Deseja excluir os ${selecionadosIds.length} lançamentos selecionados?`)) {
      return;
    }
    for (const id of selecionadosIds) {
      await onExcluirLancamento(id);
    }
    setSelecionadosIds([]);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* 1. CARD PRINCIPAL E DIRETO: QUEM DEVE A QUEM (SEM CONCEITO DE SÓCIO) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl border border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/80 pb-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
              Fechamento do Acerto
            </span>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">
              🤝 Quem Deve a Quem
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopiarWhatsApp}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition active:scale-95 cursor-pointer shadow-xs ${
                copiadoWhats
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
              }`}
              title="Copiar resumo do acerto formatado para o WhatsApp"
            >
              {copiadoWhats ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiadoWhats ? 'Copiado para WhatsApp!' : 'Copiar p/ WhatsApp'}</span>
            </button>

            <button
              type="button"
              onClick={onGerarPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-bold border border-slate-600 transition active:scale-95 cursor-pointer shadow-xs"
              title="Baixar PDF simplificado do acerto"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Salvar em PDF</span>
            </button>
          </div>
        </div>

        {resolucao.transacoes.length === 0 ? (
          <div className="py-4 text-center text-slate-300">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1" />
            <p className="text-base font-bold text-white">Todas as contas estão quitadas e equilibradas!</p>
            <p className="text-xs text-slate-400">Não há valores pendentes entre os participantes.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
            {resolucao.transacoes.map((t, idx) => (
              <div
                key={t.id || idx}
                className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-between gap-3 shadow-md"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-rose-300 uppercase">{t.devedor}</span>
                    <span className="text-slate-400">➔</span>
                    <span className="font-bold text-emerald-300 uppercase">{t.credor}</span>
                  </div>
                  <p className="text-base sm:text-lg font-black text-white mt-1">
                    👉 <strong className="text-rose-300 uppercase">{t.devedor}</strong> DEVE PAGAR PARA <strong className="text-emerald-300 uppercase">{t.credor}</strong>
                  </p>
                  <p className="text-[11px] text-slate-300 mt-0.5">{t.motivo}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Valor a Acertar</span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                    {formatarCentavos(t.valorCentavos)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. CAMPO DE OBSERVAÇÕES E NOTAS DO ACERTO (EDITÁVEL) */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Observações e Notas do Acerto
            </h4>
          </div>
          {obsSalvaSucesso && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-fade-in">
              <Check className="w-3.5 h-3.5" /> Salvo com sucesso!
            </span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <textarea
            rows={2}
            value={obsAcerto}
            onChange={(e) => setObsAcerto(e.target.value)}
            placeholder="Ex: vamos fazer o que maninho pegou e o que passou para regina..."
            className="flex-1 p-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={handleSalvarObs}
            disabled={isSalvandoObs}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition cursor-pointer shrink-0 self-end sm:self-center disabled:opacity-50"
          >
            {isSalvandoObs ? 'Salvando...' : 'Salvar Observações'}
          </button>
        </div>
      </div>

      {/* 3. BARRA DE AÇÕES DA PLANILHA (NOVA LINHA, LER FOTO, EXPORTAR) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-emerald-600" />
            <span>Planilha de Lançamentos ({lancamentos.length})</span>
          </h3>
          <p className="text-xs text-slate-500">
            Edite itens, valores e pessoas diretamente nas linhas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Adicionar linha na planilha */}
          <button
            type="button"
            onClick={handleAdicionarLinhaRapida}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-700/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nova Linha</span>
          </button>

          {/* Ler foto */}
          {onUploadImagem && (
            <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer active:scale-95">
              <Camera className="w-4 h-4 text-emerald-600" />
              <span>{isEnviandoImagem ? 'Lendo Foto...' : '📷 Ler Foto com IA'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isEnviandoImagem}
                onChange={(e) => {
                  onUploadImagem(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          )}

          {/* Exportar Excel */}
          <button
            type="button"
            onClick={handleExportarExcelCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition active:scale-95 cursor-pointer"
            title="Exportar para Excel / CSV"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Excel (CSV)</span>
          </button>
        </div>
      </div>

      {/* 4. BARRA DE FILTROS E BUSCA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por descrição, pessoa ou observação..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            value={filtroPessoa}
            onChange={(e) => setFiltroPessoa(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="todas">Todas as pessoas ({acerto.pessoas.length})</option>
            {acerto.pessoas.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="todos">Todos os tipos</option>
            <option value="entrada">Entradas / Repasses</option>
            <option value="saida">Saídas / Despesas</option>
            <option value="adiantamento">Vales / Adiantamentos</option>
            <option value="material">Materiais</option>
          </select>

          <select
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="data_desc">Data (Mais recente)</option>
            <option value="data_asc">Data (Mais antiga)</option>
            <option value="valor_desc">Maior Valor R$</option>
            <option value="valor_asc">Menor Valor R$</option>
          </select>

          {selecionadosIds.length > 0 && (
            <button
              type="button"
              onClick={handleExcluirSelecionados}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir {selecionadosIds.length}</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. TABELA DA PLANILHA DIRETAMENTE EDITÁVEL */}
      <div className="overflow-x-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
              <th className="py-3 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={selecionadosIds.length === lancamentosProcessados.length && lancamentosProcessados.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelecionadosIds(lancamentosProcessados.map(l => l.id));
                    } else {
                      setSelecionadosIds([]);
                    }
                  }}
                  className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </th>
              <th className="py-3 px-2 w-28">Data</th>
              <th className="py-3 px-3 min-w-[180px]">Item / Descrição</th>
              <th className="py-3 px-2 w-32">Participante</th>
              <th className="py-3 px-2 w-28">Tipo</th>
              <th className="py-3 px-2 w-14 text-center">Qtd</th>
              <th className="py-3 px-3 w-28 text-right">Valor (R$)</th>
              <th className="py-3 px-3 min-w-[160px]">Observações / Notas</th>
              <th className="py-3 px-2 w-16 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {lancamentosProcessados.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <TableIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-sm">Nenhum lançamento encontrado.</p>
                  <p className="text-xs text-slate-500 mt-1">Clique em "+ Nova Linha" ou envie uma foto para preencher a planilha.</p>
                </td>
              </tr>
            ) : (
              lancamentosProcessados.map((l) => {
                const isSelected = selecionadosIds.includes(l.id);

                return (
                  <tr
                    key={l.id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group ${
                      isSelected ? 'bg-emerald-50/30 dark:bg-emerald-950/15' : ''
                    }`}
                  >
                    {/* Checkbox seleção */}
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelecionadosIds((prev) => [...prev, l.id]);
                          } else {
                            setSelecionadosIds((prev) => prev.filter((id) => id !== l.id));
                          }
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Data */}
                    <td className="py-2 px-2">
                      <input
                        type="date"
                        value={l.data || ''}
                        onChange={(e) => handleAtualizarCampo(l, 'data', e.target.value)}
                        className="w-full px-2 py-1 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-500 bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                      />
                    </td>

                    {/* Descrição */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        defaultValue={l.descricao}
                        onBlur={(e) => {
                          if (e.target.value !== l.descricao) {
                            handleAtualizarCampo(l, 'descricao', e.target.value);
                          }
                        }}
                        placeholder="Descrição do item..."
                        className="w-full px-2 py-1 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-500 bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </td>

                    {/* Pessoa (Dropdown) */}
                    <td className="py-2 px-2">
                      <select
                        value={l.pessoaId}
                        onChange={(e) => onMoverLancamento(l.id, e.target.value)}
                        className="w-full px-2 py-1 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-500 bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                      >
                        {acerto.pessoas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Tipo */}
                    <td className="py-2 px-2">
                      <select
                        value={l.tipo}
                        onChange={(e) => handleAtualizarCampo(l, 'tipo', e.target.value as TipoLancamento)}
                        className={`w-full px-2 py-1 rounded-lg font-bold text-xs focus:outline-none cursor-pointer border border-transparent hover:border-slate-300 dark:hover:border-slate-600 ${
                          l.tipo === 'adiantamento'
                            ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40'
                            : l.tipo === 'material'
                            ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40'
                            : l.tipo === 'entrada'
                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40'
                            : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40'
                        }`}
                      >
                        <option value="saida">Saída / Pix</option>
                        <option value="entrada">Entrada / Repasse</option>
                        <option value="adiantamento">Vale / Adiant.</option>
                        <option value="material">Material</option>
                      </select>
                    </td>

                    {/* Quantidade */}
                    <td className="py-2 px-2 text-center">
                      <input
                        type="number"
                        min="1"
                        defaultValue={l.quantidade || 1}
                        onBlur={(e) => {
                          const n = Number(e.target.value) || 1;
                          if (n !== l.quantidade) {
                            handleAtualizarCampo(l, 'quantidade', n);
                          }
                        }}
                        className="w-12 text-center py-1 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-500 bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
                      />
                    </td>

                    {/* Valor em R$ */}
                    <td className="py-2 px-3 text-right">
                      <input
                        type="text"
                        defaultValue={formatarCentavosSemSimbolo(l.valorCentavos)}
                        onBlur={(e) => handleAtualizarValor(l, e.target.value)}
                        placeholder="0,00"
                        className="w-24 text-right py-1 px-2 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-500 bg-transparent text-xs font-black text-slate-900 dark:text-white focus:outline-none"
                      />
                    </td>

                    {/* Observações da Linha */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        defaultValue={l.observacoes || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (l.observacoes || '')) {
                            handleAtualizarCampo(l, 'observacoes', e.target.value);
                          }
                        }}
                        placeholder="Nota / obs..."
                        className="w-full px-2 py-1 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-500 bg-transparent text-xs text-slate-600 dark:text-slate-300 focus:outline-none"
                      />
                    </td>

                    {/* Ações (Duplicar, Excluir) */}
                    <td className="py-2 px-2 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={() => onDuplicarLancamento(l)}
                          title="Duplicar linha"
                          className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onExcluirLancamento(l.id)}
                          title="Excluir linha"
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 6. RESUMO RÁPIDO DOS PARTICIPANTES */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-emerald-500" />
          <span>Resumo por Participante</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {resumoPessoas.map(({ pessoa, totais, count }) => (
            <div
              key={pessoa.id}
              onClick={() => setFiltroPessoa(filtroPessoa === pessoa.id ? 'todas' : pessoa.id)}
              className={`p-3 rounded-xl border transition cursor-pointer ${
                filtroPessoa === pessoa.id
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: pessoa.cor || '#059669' }}
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{pessoa.nome}</span>
                </div>
                <span className="text-[10px] text-slate-400">{count} lançamentos</span>
              </div>
              <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700/60">
                <span>Total Movimentado:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                  {formatarCentavos(totais.totalEntradasCentavos + totais.totalSaidasCentavos)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
