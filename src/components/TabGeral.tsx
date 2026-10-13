import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, Users, AlertCircle, ArrowUpRight, ArrowDownRight, 
  CheckCircle2, ChevronRight, DollarSign, PieChart, ShieldAlert, Camera, Sparkles,
  Table as TableIcon, Search, Filter, Calendar, Tag, User, Layers
} from 'lucide-react';
import { Acerto, Lancamento, PessoaTab } from '../types';
import { formatarCentavos, calcularTotaisGerais, calcularTotaisPessoa } from '../utils/currency';

interface TabGeralProps {
  acerto: Acerto;
  lancamentos: Lancamento[];
  onSelecionarPessoa: (pessoaId: string) => void;
  onNovaPessoa: () => void;
  onUploadImagem?: (files: FileList | null) => void;
  isEnviandoImagem?: boolean;
}

export const TabGeral: React.FC<TabGeralProps> = ({
  acerto,
  lancamentos,
  onSelecionarPessoa,
  onNovaPessoa,
  onUploadImagem,
  isEnviandoImagem = false,
}) => {
  const totaisGerais = calcularTotaisGerais(acerto.pessoas, lancamentos);

  const [buscaTabela, setBuscaTabela] = useState('');
  const [filtroPessoaTabela, setFiltroPessoaTabela] = useState('todas');
  const [filtroTipoTabela, setFiltroTipoTabela] = useState('todos');

  // Dados para o gráfico de barras comparativo (Entradas vs Saídas vs Adiantamentos vs Materiais)
  const maxGrafico = Math.max(
    totaisGerais.totalEntradasCentavos,
    totaisGerais.totalSaidasCentavos,
    totaisGerais.totalAdiantamentosCentavos,
    totaisGerais.totalMateriaisCentavos,
    1
  );

  const getPercent = (centavos: number) => Math.min(100, Math.round((centavos / maxGrafico) * 100));

  // Lançamentos filtrados para a tabela geral
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter((l) => {
      const batePessoa = filtroPessoaTabela === 'todas' || l.pessoaId === filtroPessoaTabela;
      const bateTipo = filtroTipoTabela === 'todos' || l.tipo === filtroTipoTabela;
      const bateBusca = !buscaTabela || 
        (l.descricao || '').toLowerCase().includes(buscaTabela.toLowerCase()) ||
        (l.categoria || '').toLowerCase().includes(buscaTabela.toLowerCase()) ||
        (l.loja || '').toLowerCase().includes(buscaTabela.toLowerCase());
      return batePessoa && bateTipo && bateBusca;
    });
  }, [lancamentos, filtroPessoaTabela, filtroTipoTabela, buscaTabela]);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* BANNER PRINCIPAL DE SALDO CONSOLIDADO */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 text-white p-5 sm:p-7 shadow-xl border border-emerald-700/40">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Aba Geral Consolidada
              </span>
              <span className="text-xs text-emerald-200/70">
                {acerto.pessoas.length} {acerto.pessoas.length === 1 ? 'pessoa envolvida' : 'pessoas envolvidas'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Balanço Geral do Acerto
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 max-w-xl">
              {acerto.observacoes && !acerto.observacoes.includes('Faturamento R$ 9.000,00') 
                ? acerto.observacoes 
                : 'Visão geral dinâmica de entradas, saídas e saldos consolidados.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {onUploadImagem && (
                <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-bold shadow-md transition cursor-pointer active:scale-95">
                  <Camera className="w-4 h-4 text-emerald-700" />
                  <span>{isEnviandoImagem ? 'Processando Foto...' : '📷 Enviar Foto do Caderno / Acerto'}</span>
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
            </div>
          </div>

          {/* Saldo Final */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/20 text-right shrink-0 min-w-[200px]">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-200">
              Saldo Líquido Final
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono mt-0.5 tracking-tight">
              {formatarCentavos(totaisGerais.saldoFinalCentavos)}
            </div>
            <span className="inline-block mt-1 text-[11px] font-semibold text-emerald-200/90">
              {totaisGerais.saldoFinalCentavos >= 0
                ? '✓ Entradas cobrem as despesas'
                : '⚠ Despesas superam as entradas'}
            </span>
          </div>
        </div>

        {/* Efeito sutil no fundo */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 4 CARDS DE TOTAIS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Entradas */}
        <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Entradas</span>
            <span className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white">
            {formatarCentavos(totaisGerais.totalEntradasCentavos)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Pix, dinheiro e recebimentos</p>
        </div>

        {/* Saídas */}
        <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Saídas</span>
            <span className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white">
            {formatarCentavos(totaisGerais.totalSaidasCentavos)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Despesas operacionais e custos</p>
        </div>

        {/* Adiantamentos */}
        <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Adiantamentos</span>
            <span className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white">
            {formatarCentavos(totaisGerais.totalAdiantamentosCentavos)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Vales e repasses adiantados</p>
        </div>

        {/* Materiais */}
        <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Materiais</span>
            <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
              <PieChart className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white">
            {formatarCentavos(totaisGerais.totalMateriaisCentavos)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Compras com notas e fornecedores</p>
        </div>

      </div>

      {/* ======================================================== */}
      {/* TABELA CONTÁBIL DE FECHAMENTO & CÁLCULOS POR PESSOA      */}
      {/* ======================================================== */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-emerald-600" />
              <span>Tabela de Fechamento Contábil por Pessoa</span>
            </h3>
            <p className="text-xs text-slate-500">
              Cálculo detalhado de entradas, despesas comprovadas, vales/adiantamentos e saldo líquido individual.
            </p>
          </div>
          <button
            onClick={onNovaPessoa}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
          >
            <span>+ Nova Pessoa</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold border-b border-slate-200 dark:border-slate-700 text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Pessoa / Participante</th>
                <th className="py-2.5 px-3 text-right">Despesas Pagas</th>
                <th className="py-2.5 px-3 text-right">Materiais Comprados</th>
                <th className="py-2.5 px-3 text-right">Total Gastos</th>
                <th className="py-2.5 px-3 text-right">Vales Recebidos</th>
                <th className="py-2.5 px-3 text-right">Saldo Líquido</th>
                <th className="py-2.5 px-4 text-center">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {acerto.pessoas.map((p) => {
                const totais = calcularTotaisPessoa(p, lancamentos);
                const totalGastos = totais.totalSaidasCentavos + totais.totalMateriaisCentavos;

                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelecionarPessoa(p.id)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition cursor-pointer"
                  >
                    <td className="py-3 px-4 flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.cor || '#059669' }}
                      />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{p.nome}</span>
                        {p.papel && <span className="text-[10px] text-slate-400">{p.papel}</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {formatarCentavos(totais.totalSaidasCentavos)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-blue-600 dark:text-blue-400">
                      {formatarCentavos(totais.totalMateriaisCentavos)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      {formatarCentavos(totalGastos)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                      {formatarCentavos(totais.totalAdiantamentosCentavos)}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono font-black ${
                      totais.saldoCentavos > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : totais.saldoCentavos < 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-500'
                    }`}>
                      {totais.saldoCentavos > 0
                        ? `+ ${formatarCentavos(totais.saldoCentavos)}`
                        : totais.saldoCentavos < 0
                        ? `- ${formatarCentavos(Math.abs(totais.saldoCentavos))}`
                        : 'R$ 0,00'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        totais.statusRelacao === 'pessoa_deve'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : totais.statusRelacao === 'usuario_deve'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {totais.statusRelacao === 'pessoa_deve'
                          ? 'Te deve'
                          : totais.statusRelacao === 'usuario_deve'
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
                <td className="py-3 px-4 uppercase text-slate-800 dark:text-white">TOTAL CONSOLIDADO</td>
                <td className="py-3 px-3 text-right font-mono">{formatarCentavos(totaisGerais.totalSaidasCentavos)}</td>
                <td className="py-3 px-3 text-right font-mono text-blue-600 dark:text-blue-400">{formatarCentavos(totaisGerais.totalMateriaisCentavos)}</td>
                <td className="py-3 px-3 text-right font-mono text-rose-600 dark:text-rose-400">
                  {formatarCentavos(totaisGerais.totalSaidasCentavos + totaisGerais.totalMateriaisCentavos)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-amber-600 dark:text-amber-400">
                  {formatarCentavos(totaisGerais.totalAdiantamentosCentavos)}
                </td>
                <td className={`py-3 px-3 text-right font-mono font-black ${totaisGerais.saldoFinalCentavos >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatarCentavos(totaisGerais.saldoFinalCentavos)}
                </td>
                <td className="py-3 px-4 text-center text-[11px] text-slate-500">Saldo Geral</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TABELA COMPLETA DE LANÇAMENTOS DO ACERTO                 */}
      {/* ======================================================== */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-emerald-600" />
              <span>Tabela Completa de Todos os Lançamentos ({lancamentosFiltrados.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Planilha consolidada de todos os itens cadastrados via foto ou manual.
            </p>
          </div>

          {/* Filtros da tabela */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={buscaTabela}
                onChange={(e) => setBuscaTabela(e.target.value)}
                placeholder="Buscar item..."
                className="pl-8 pr-2.5 py-1 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-36 sm:w-44 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <select
              value={filtroPessoaTabela}
              onChange={(e) => setFiltroPessoaTabela(e.target.value)}
              className="px-2 py-1 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
            >
              <option value="todas">Todas as Pessoas</option>
              {acerto.pessoas.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>

            <select
              value={filtroTipoTabela}
              onChange={(e) => setFiltroTipoTabela(e.target.value)}
              className="px-2 py-1 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
            >
              <option value="todos">Todos os Tipos</option>
              <option value="saida">🔴 Despesas</option>
              <option value="adiantamento">🟡 Vales</option>
              <option value="material">🔵 Materiais</option>
              <option value="entrada">🟢 Entradas</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[460px]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold border-b border-slate-200 dark:border-slate-700 text-[11px] shadow-2xs">
              <tr>
                <th className="py-2.5 px-3 w-24">Data</th>
                <th className="py-2.5 px-3">Item / Descrição</th>
                <th className="py-2.5 px-3 w-32">Pessoa / Aba</th>
                <th className="py-2.5 px-3 w-28">Tipo</th>
                <th className="py-2.5 px-3 w-28">Categoria</th>
                <th className="py-2.5 px-3 text-right w-28">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lancamentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    Nenhum lançamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                lancamentosFiltrados.map((l) => {
                  const pessoa = acerto.pessoas.find((p) => p.id === l.pessoaId);
                  const isAdiantamento = l.tipo === 'adiantamento';
                  const isMaterial = l.tipo === 'material';
                  const isEntrada = l.tipo === 'entrada';

                  return (
                    <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {l.data ? new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {l.descricao}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: pessoa?.cor || '#059669' }}
                          />
                          <span>{pessoa?.nome || 'Geral'}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          isAdiantamento
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                            : isMaterial
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                            : isEntrada
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                        }`}>
                          {isAdiantamento ? '🟡 VALE' : isMaterial ? '🔵 MATERIAL' : isEntrada ? '🟢 ENTRADA' : '🔴 DESPESA'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {l.categoria || 'Geral'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono font-bold ${
                        isEntrada ? 'text-emerald-600' : 'text-slate-900 dark:text-white'
                      }`}>
                        {formatarCentavos(l.valorCentavos)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
