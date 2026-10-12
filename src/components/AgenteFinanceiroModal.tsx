import React from 'react';
import { 
  X, ShieldCheck, AlertTriangle, Clock, TrendingUp, AlertCircle, 
  Lightbulb, CheckCircle2, UserCheck, DollarSign, Calendar
} from 'lucide-react';
import { Acerto, Lancamento, PessoaTab } from '../types';
import { formatarCentavos, calcularTotaisPessoa, calcularTotaisGerais } from '../utils/currency';

interface AgenteFinanceiroModalProps {
  isOpen: boolean;
  onClose: () => void;
  acerto: Acerto;
  lancamentos: Lancamento[];
  onSelecionarPessoa?: (pessoaId: string) => void;
}

export const AgenteFinanceiroModal: React.FC<AgenteFinanceiroModalProps> = ({
  isOpen,
  onClose,
  acerto,
  lancamentos,
  onSelecionarPessoa,
}) => {
  if (!isOpen) return null;

  const hoje = new Date().toISOString().slice(0, 10);
  const dataHojeTimestamp = new Date(hoje).getTime();
  const seteDiasFrenteTimestamp = dataHojeTimestamp + 7 * 86400000;

  // 1. Auditoria de Dívidas Vencidas ou Vencendo em 7 dias
  const dividasPendentes = lancamentos.filter((l) => l.tipo === 'divida' && l.statusDivida === 'pendente');
  const dividasVencidas: Lancamento[] = [];
  const dividasVencendoLogo: Lancamento[] = [];

  for (const d of dividasPendentes) {
    if (d.vencimento) {
      const vTimestamp = new Date(d.vencimento).getTime();
      if (vTimestamp < dataHojeTimestamp) {
        dividasVencidas.push(d);
      } else if (vTimestamp <= seteDiasFrenteTimestamp) {
        dividasVencendoLogo.push(d);
      }
    }
  }

  // 2. Auditoria de Adiantamento Maior que Gasto Comprovado
  const alertasAdiantamento: Array<{ pessoa: PessoaTab; adiantado: number; gasto: number; diferenca: number }> = [];
  for (const p of acerto.pessoas) {
    const totais = calcularTotaisPessoa(p, lancamentos);
    const gastosComprovados = totais.totalSaidasCentavos + totais.totalMateriaisCentavos;
    if (totais.totalAdiantamentosCentavos > gastosComprovados && totais.totalAdiantamentosCentavos > 0) {
      alertasAdiantamento.push({
        pessoa: p,
        adiantado: totais.totalAdiantamentosCentavos,
        gasto: gastosComprovados,
        diferenca: totais.totalAdiantamentosCentavos - gastosComprovados,
      });
    }
  }

  // 3. Auditoria de Lançamentos sem Comprovante
  const lancamentosSemFoto = lancamentos.filter((l) => !l.imagemId && l.valorCentavos > 10000); // acima de R$ 100 sem foto

  // 4. Totais gerais
  const totaisGerais = calcularTotaisGerais(acerto.pessoas, lancamentos);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
        
        {/* Topo do Agente */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white border-b border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">
                  Agente Financeiro & Auditoria Contábil
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300">
                  Ativo
                </span>
              </div>
              <p className="text-xs text-emerald-100/70">
                Auditoria em tempo real de saldos, dívidas a vencer e riscos de acerto
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-emerald-200 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo dos Alertas e Recomendações */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs sm:text-sm">
          
          {/* Card Resumo da Saúde do Acerto */}
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold text-emerald-900 dark:text-emerald-200">
                Diagnóstico Geral do Acerto: "{acerto.titulo}"
              </h4>
              <p className="text-emerald-800/80 dark:text-emerald-300/80 text-xs mt-0.5">
                Foram analisados {lancamentos.length} lançamentos de {acerto.pessoas.length} pessoas. O saldo consolidado é de <strong>{formatarCentavos(totaisGerais.saldoFinalCentavos)}</strong>.
              </p>
            </div>
          </div>

          {/* 1. Alerta de Dívidas Vencidas */}
          {dividasVencidas.length > 0 && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 space-y-2">
              <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Dívidas Vencidas ({dividasVencidas.length})</span>
              </div>
              <div className="space-y-1.5">
                {dividasVencidas.map((d) => {
                  const pessoa = acerto.pessoas.find((p) => p.id === d.pessoaId)?.nome || 'Geral';
                  return (
                    <div key={d.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">{d.descricao}</span>
                        <span className="text-[11px] text-slate-500 block">Pessoa: {pessoa} • Venceu em: {new Date(d.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                      <span className="font-mono font-bold text-rose-600">{formatarCentavos(d.valorCentavos)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Dívidas Vencendo nos Próximos 7 Dias */}
          {dividasVencendoLogo.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Dívidas Vencendo nos Próximos 7 Dias ({dividasVencendoLogo.length})</span>
              </div>
              <div className="space-y-1.5">
                {dividasVencendoLogo.map((d) => {
                  const pessoa = acerto.pessoas.find((p) => p.id === d.pessoaId)?.nome || 'Geral';
                  return (
                    <div key={d.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">{d.descricao}</span>
                        <span className="text-[11px] text-slate-500 block">Pessoa: {pessoa} • Vencimento: {new Date(d.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                      <span className="font-mono font-bold text-amber-600">{formatarCentavos(d.valorCentavos)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Adiantamentos Maiores que Gastos Comprovados */}
          {alertasAdiantamento.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Pessoas com Adiantamento Maior que o Gasto Comprovado</span>
              </div>
              <div className="space-y-1.5">
                {alertasAdiantamento.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{item.pessoa.nome}</span>
                      <p className="text-[11px] text-slate-500">
                        Adiantado: {formatarCentavos(item.adiantado)} • Gastos comprovados: {formatarCentavos(item.gasto)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-emerald-600 font-bold block uppercase">Ela te deve</span>
                      <span className="font-mono font-bold text-emerald-600">{formatarCentavos(item.diferenca)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Dicas e Recomendações do Contador */}
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-2">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold">
              <Lightbulb className="w-4 h-4 text-blue-600" />
              <span>Conselho Profissional do Contador para este Acerto</span>
            </div>
            <ul className="text-xs text-blue-800/90 dark:text-blue-300/90 space-y-1.5 list-disc pl-4">
              <li>
                <strong>Fotografe sempre o recibo ou print do Pix:</strong> A conferência de imagem com IA armazena o comprovante para nunca haver dúvidas entre as partes no dia do fechamento.
              </li>
              <li>
                <strong>Abatimento de Adiantamento:</strong> Conforme os serviços forem sendo entregues, edite os adiantamentos e preencha "Quanto já foi abatido" para acompanhar o saldo real.
              </li>
              <li>
                <strong>Gere o relatório em PDF semanalmente:</strong> Envie pelo WhatsApp aos envolvidos usando o botão Compartilhar para manter alinhamento contínuo.
              </li>
            </ul>
          </div>

        </div>

        {/* Rodapé */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 text-right">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm cursor-pointer shadow-sm transition"
          >
            Fechar Painel do Agente
          </button>
        </div>

      </div>
    </div>
  );
};
