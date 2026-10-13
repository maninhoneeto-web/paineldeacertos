import { 
  TrendingUp, TrendingDown, Users, AlertCircle, ArrowUpRight, ArrowDownRight, 
  CheckCircle2, ChevronRight, DollarSign, PieChart, ShieldAlert, Camera, Sparkles
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

  // Dados para o gráfico de barras comparativo (Entradas vs Saídas vs Adiantamentos vs Materiais)
  const maxGrafico = Math.max(
    totaisGerais.totalEntradasCentavos,
    totaisGerais.totalSaidasCentavos,
    totaisGerais.totalAdiantamentosCentavos,
    totaisGerais.totalMateriaisCentavos,
    1
  );

  const getPercent = (centavos: number) => Math.min(100, Math.round((centavos / maxGrafico) * 100));

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

      {/* GRÁFICO COMPARATIVO SIMPLES E RESPONSIVO */}
      <div className="rounded-2xl p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Comparativo Visual de Entradas x Saídas</span>
        </h3>

        <div className="space-y-4">
          {/* Barra Entradas */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Entradas Recebidas
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {formatarCentavos(totaisGerais.totalEntradasCentavos)}
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${getPercent(totaisGerais.totalEntradasCentavos)}%` }}
              />
            </div>
          </div>

          {/* Barra Saídas */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-rose-700 dark:text-rose-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Saídas e Despesas
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {formatarCentavos(totaisGerais.totalSaidasCentavos)}
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-rose-500 transition-all duration-500"
                style={{ width: `${getPercent(totaisGerais.totalSaidasCentavos)}%` }}
              />
            </div>
          </div>

          {/* Barra Adiantamentos */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Adiantamentos Realizados
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {formatarCentavos(totaisGerais.totalAdiantamentosCentavos)}
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${getPercent(totaisGerais.totalAdiantamentosCentavos)}%` }}
              />
            </div>
          </div>

          {/* Barra Materiais */}
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-blue-700 dark:text-blue-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Materiais de Construção
              </span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {formatarCentavos(totaisGerais.totalMateriaisCentavos)}
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${getPercent(totaisGerais.totalMateriaisCentavos)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* LISTA DE TODAS AS PESSOAS COM SITUAÇÃO E BOTÃO PARA ABRIR A ABA DELA */}
      <div className="rounded-2xl p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Saldos Individuais por Pessoa
            </h3>
            <p className="text-xs text-slate-500">
              Clique em qualquer pessoa para abrir a aba dela com detalhes e sub-abas
            </p>
          </div>
          <button
            onClick={onNovaPessoa}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
          >
            <span>+ Nova Pessoa</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {acerto.pessoas.map((pessoa) => {
            const totais = calcularTotaisPessoa(pessoa, lancamentos);

            return (
              <div
                key={pessoa.id}
                onClick={() => onSelecionarPessoa(pessoa.id)}
                className="group flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-xs"
                    style={{ backgroundColor: pessoa.cor || '#059669' }}
                  >
                    {pessoa.nome.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                        {pessoa.nome}
                      </span>
                      {pessoa.papel && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                          {pessoa.papel}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs font-semibold mt-0.5 ${
                      totais.statusRelacao === 'pessoa_deve'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : totais.statusRelacao === 'usuario_deve'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-500'
                    }`}>
                      {totais.fraseDestaque}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-right">
                  <div>
                    <span className="text-[10px] block font-bold text-slate-400 uppercase">Saldo</span>
                    <span className={`font-mono font-bold text-sm ${
                      totais.saldoCentavos > 0
                        ? 'text-emerald-600'
                        : totais.saldoCentavos < 0
                        ? 'text-rose-600'
                        : 'text-slate-500'
                    }`}>
                      {formatarCentavos(totais.saldoCentavos)}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
