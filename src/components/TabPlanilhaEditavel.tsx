import React, { useState, useMemo } from 'react';
import { 
  Table as TableIcon, Plus, Trash2, Copy, ArrowRightLeft, Search, Filter, 
  Download, FileText, CheckCircle2, AlertCircle, Camera, DollarSign, Calendar,
  TrendingUp, TrendingDown, Clock, Package, User, Layers, ArrowUpDown
} from 'lucide-react';
import { Acerto, Lancamento, PessoaTab, TipoLancamento, FormaPagamento } from '../types';
import { formatarCentavos, parseValorParaCentavos, formatarCentavosSemSimbolo, calcularTotaisGerais, calcularTotaisPessoa } from '../utils/currency';

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
  isEnviandoImagem?: boolean;
}

export const TabPlanilhaEditavel: React.FC<TabPlanilhaEditavelProps> = ({
  acerto,
  lancamentos,
  onSalvarLancamento,
  onExcluirLancamento,
  onDuplicarLancamento,
  onMoverLancamento,
  onNovoLancamento,
  onUploadImagem,
  onGerarPdf,
  isEnviandoImagem = false,
}) => {
  const [busca, setBusca] = useState('');
  const [filtroPessoa, setFiltroPessoa] = useState<string>('todas');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [ordenacao, setOrdenacao] = useState<'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc'>('data_desc');
  const [linhaEmEdicaoId, setLinhaEmEdicaoId] = useState<string | null>(null);
  const [selecionadosIds, setSelecionadosIds] = useState<string[]>([]);
  const [isSalvandoLinha, setIsSalvandoLinha] = useState<string | null>(null);

  // Totais consolidados
  const totaisGerais = useMemo(() => {
    return calcularTotaisGerais(acerto.pessoas, lancamentos);
  }, [acerto.pessoas, lancamentos]);

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
      descricao: 'Novo lançamento na planilha',
      valorCentavos: 0,
      categoria: tipoPadrao === 'adiantamento' ? 'Adiantamento/Val' : tipoPadrao === 'material' ? 'Material de Construção' : 'Mão de Obra',
      formaPagamento: 'Pix',
      quantidade: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSalvarLancamento(novo);
    setLinhaEmEdicaoId(novo.id);
  };

  // Exportar para CSV / Excel
  const handleExportarExcelCSV = () => {
    const cabecalho = ['ID', 'Data', 'Descrição', 'Pessoa / Aba', 'Tipo', 'Categoria', 'Forma Pagamento', 'Qtd', 'Valor (R$)'];
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
    if (!confirm(`Tem certeza que deseja excluir ${selecionadosIds.length} lançamentos selecionados da planilha?`)) {
      return;
    }
    for (const id of selecionadosIds) {
      await onExcluirLancamento(id);
    }
    setSelecionadosIds([]);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* CABEÇALHO DA PLANILHA COM AÇÕES RÁPIDAS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <TableIcon className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              Planilha Completa e Editável do Acerto
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Edite descrições, valores, tipos e pessoas diretamente nas linhas. Reorganize tudo com simplicidade e cálculos em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Adicionar linha na planilha */}
          <button
            onClick={handleAdicionarLinhaRapida}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-700/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nova Linha</span>
          </button>

          {/* Ler foto de caderno */}
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

          {/* Exportar Excel / CSV */}
          <button
            onClick={handleExportarExcelCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold transition active:scale-95 cursor-pointer"
            title="Baixar planilha compatível com Microsoft Excel e Google Planilhas"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Exportar Excel (CSV)</span>
          </button>

          {/* Salvar em PDF */}
          <button
            onClick={onGerarPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition active:scale-95 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Salvar em PDF</span>
          </button>
        </div>
      </div>

      {/* CARDS DE CÁLCULOS TOTAIS DINÂMICOS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Entradas */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200/60 dark:border-emerald-900/40 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-emerald-600">Entradas</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
            {formatarCentavos(totaisGerais.totalEntradasCentavos)}
          </div>
        </div>

        {/* Despesas */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200/60 dark:border-rose-900/40 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-rose-600">Despesas</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">
            {formatarCentavos(totaisGerais.totalSaidasCentavos)}
          </div>
        </div>

        {/* Vales / Adiantamentos */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200/60 dark:border-amber-900/40 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-amber-600">Vales / Adiantamentos</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">
            {formatarCentavos(totaisGerais.totalAdiantamentosCentavos)}
          </div>
        </div>

        {/* Materiais */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200/60 dark:border-blue-900/40 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-blue-600">Materiais</span>
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400">
            {formatarCentavos(totaisGerais.totalMateriaisCentavos)}
          </div>
        </div>

        {/* Saldo Líquido */}
        <div className="col-span-2 sm:col-span-4 lg:col-span-1 p-3.5 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold text-emerald-400">Saldo Líquido</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className={`text-base sm:text-lg font-black ${totaisGerais.saldoFinalCentavos >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatarCentavos(totaisGerais.saldoFinalCentavos)}
          </div>
        </div>
      </div>

      {/* RESUMO RÁPIDO POR PESSOA (DISTRIBUIÇÃO) */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-emerald-500" />
          <span>Fechamento Contábil por Pessoa</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: pessoa.cor || '#059669' }}
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{pessoa.nome}</span>
                </div>
                <span className="text-[10px] text-slate-400">{count} itens</span>
              </div>
              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between text-slate-500">
                  <span>Gastos:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {formatarCentavos(totais.totalSaidasCentavos + totais.totalMateriaisCentavos)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Vales:</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {formatarCentavos(totais.totalAdiantamentosCentavos)}
                  </span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-slate-200 dark:border-slate-700/60">
                  <span>Saldo:</span>
                  <span className={totais.saldoCentavos >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                    {totais.saldoCentavos > 0
                      ? `Te deve ${formatarCentavos(totais.saldoCentavos)}`
                      : totais.saldoCentavos < 0
                      ? `Recebe ${formatarCentavos(Math.abs(totais.saldoCentavos))}`
                      : 'Quitado'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BARRA DE FILTROS E BUSCA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por item, descrição, categoria ou pessoa..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Filtro por pessoa */}
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

          {/* Filtro por tipo */}
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="todos">Todos os tipos</option>
            <option value="saida">Despesas (Saídas)</option>
            <option value="adiantamento">Vales / Adiantamentos</option>
            <option value="material">Materiais</option>
            <option value="entrada">Entradas / Recebimentos</option>
            <option value="divida">Dívidas</option>
          </select>

          {/* Ordenação */}
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
              onClick={handleExcluirSelecionados}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir {selecionadosIds.length}</span>
            </button>
          )}
        </div>
      </div>

      {/* TABELA PLANILHA COM CÉLULAS DIRETAMENTE EDITÁVEIS */}
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
              <th className="py-3 px-3 min-w-[200px]">Item / Descrição</th>
              <th className="py-3 px-2 w-36">Pessoa / Aba</th>
              <th className="py-3 px-2 w-36">Tipo</th>
              <th className="py-3 px-2 w-28">Categoria</th>
              <th className="py-3 px-2 w-16 text-center">Qtd</th>
              <th className="py-3 px-3 w-32 text-right">Valor (R$)</th>
              <th className="py-3 px-2 w-20 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {lancamentosProcessados.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <TableIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-sm">Nenhum lançamento encontrado para os filtros selecionados.</p>
                  <p className="text-xs text-slate-500 mt-1">Clique em "+ Nova Linha" ou envie uma foto para preencher a planilha.</p>
                </td>
              </tr>
            ) : (
              lancamentosProcessados.map((l, index) => {
                const isSelected = selecionadosIds.includes(l.id);
                const isSaving = isSalvandoLinha === l.id;

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

                    {/* Pessoa (Dropdown direto) */}
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

                    {/* Tipo (Dropdown direto com cores) */}
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
                        <option value="saida">Despesa</option>
                        <option value="adiantamento">Vale / Adiant.</option>
                        <option value="material">Material</option>
                        <option value="entrada">Entrada</option>
                        <option value="divida">Dívida</option>
                      </select>
                    </td>

                    {/* Categoria */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        defaultValue={l.categoria || ''}
                        onBlur={(e) => {
                          if (e.target.value !== l.categoria) {
                            handleAtualizarCampo(l, 'categoria', e.target.value);
                          }
                        }}
                        placeholder="Categoria"
                        className="w-full px-2 py-1 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-500 bg-transparent text-xs text-slate-600 dark:text-slate-400 focus:outline-none"
                      />
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
                        className="w-28 text-right py-1 px-2 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-emerald-500 bg-transparent text-xs font-black text-slate-900 dark:text-white focus:outline-none"
                      />
                    </td>

                    {/* Ações (Duplicar, Excluir) */}
                    <td className="py-2 px-2 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition">
                        <button
                          onClick={() => onDuplicarLancamento(l)}
                          title="Duplicar linha"
                          className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
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

      {/* RODAPÉ DA PLANILHA */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60">
        <div>
          Mostrando <span className="font-bold text-slate-800 dark:text-slate-200">{lancamentosProcessados.length}</span> de <span className="font-bold text-slate-800 dark:text-slate-200">{lancamentos.length}</span> lançamentos da planilha.
        </div>
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Alterações gravadas automaticamente no banco de dados.</span>
        </div>
      </div>

    </div>
  );
};
