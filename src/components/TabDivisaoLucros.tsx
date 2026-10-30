import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, DollarSign, TrendingUp, TrendingDown, ArrowRightLeft, 
  CheckCircle2, Plus, Trash2, FileText, Share2, Copy, Check,
  AlertCircle, Sparkles, MessageSquare, Save, Settings, ToggleLeft, ToggleRight,
  HelpCircle, ShieldCheck
} from 'lucide-react';
import { Acerto, Lancamento, ConfigDivisaoLucros, ParticipanteLucro } from '../types';
import { 
  formatarCentavos, 
  calcularDivisaoLucros, 
  aplicarMascaraCentavos, 
  calcularResolucaoAcerto 
} from '../utils/currency';

interface TabDivisaoLucrosProps {
  acerto: Acerto;
  lancamentos: Lancamento[];
  onSalvarConfigLucros: (config: ConfigDivisaoLucros) => Promise<void>;
  onSalvarObservacoesAcerto?: (observacoes: string) => Promise<void>;
  onExportarPdf?: () => void;
}

export const TabDivisaoLucros: React.FC<TabDivisaoLucrosProps> = ({
  acerto,
  lancamentos,
  onSalvarConfigLucros,
  onSalvarObservacoesAcerto,
  onExportarPdf,
}) => {
  // Modo de exibição: 'quem_deve_a_quem' (padrão direto) vs 'divisao_lucros' (%)
  const configSalva = acerto.configDivisaoLucros;
  const [modoAba, setModoAba] = useState<'quem_deve_a_quem' | 'divisao_lucros'>(
    configSalva?.modoFechamento === 'divisao_lucros' ? 'divisao_lucros' : 'quem_deve_a_quem'
  );

  // Observações gerais do acerto
  const [observacoesTexto, setObservacoesTexto] = useState(acerto.observacoes || '');
  const [salvandoObs, setSalvandoObs] = useState(false);
  const [obsSalvaSucesso, setObsSalvaSucesso] = useState(false);

  // Feedback de cópia para WhatsApp
  const [copiadoWhats, setCopiadoWhats] = useState(false);

  // Resolução contábil direta "Fulano deve a Ciclano"
  const resolucao = useMemo(() => {
    return calcularResolucaoAcerto(acerto, lancamentos);
  }, [acerto, lancamentos]);

  // Configurações para modo opcional de lucro com porcentagem
  const [usarPrecoFixo, setUsarPrecoFixo] = useState<boolean>(() => {
    if (configSalva?.usarPrecoFixo === true && configSalva.faturamentoProjetoCentavos && configSalva.faturamentoProjetoCentavos !== 900000) {
      return true;
    }
    return false;
  });

  const [faturamentoCentavos, setFaturamentoCentavos] = useState<number>(() => {
    if (configSalva?.faturamentoProjetoCentavos && configSalva.faturamentoProjetoCentavos !== 900000) {
      return configSalva.faturamentoProjetoCentavos;
    }
    return 0;
  });
  const [faturamentoTexto, setFaturamentoTexto] = useState<string>(() => {
    if (configSalva?.faturamentoProjetoCentavos && configSalva.faturamentoProjetoCentavos !== 900000) {
      return formatarCentavos(configSalva.faturamentoProjetoCentavos);
    }
    return '';
  });

  const [taxaCentavos, setTaxaCentavos] = useState<number>(() => {
    if (configSalva?.taxaProjetoCentavos && configSalva.taxaProjetoCentavos !== 100000) {
      return configSalva.taxaProjetoCentavos;
    }
    return 0;
  });
  const [taxaTexto, setTaxaTexto] = useState<string>(() => {
    if (configSalva?.taxaProjetoCentavos && configSalva.taxaProjetoCentavos !== 100000) {
      return formatarCentavos(configSalva.taxaProjetoCentavos);
    }
    return '';
  });

  const [reservaPorcentagem, setReservaPorcentagem] = useState<number>(
    configSalva?.reservaEmergenciaPorcentagem || 0
  );

  const [participantes, setParticipantes] = useState<ParticipanteLucro[]>(() => {
    if (configSalva?.participantes && configSalva.participantes.length > 0) {
      return configSalva.participantes;
    }
    if (acerto.pessoas && acerto.pessoas.length > 0) {
      const pct = Math.floor(100 / acerto.pessoas.length);
      const resto = 100 - (pct * acerto.pessoas.length);
      return acerto.pessoas.map((p, idx) => ({
        id: 'part_' + p.id,
        pessoaId: p.id,
        nome: p.nome,
        porcentagem: idx === 0 ? pct + resto : pct,
        descontarAdiantamentos: true,
      }));
    }
    return [];
  });

  const [isSalvandoConfig, setIsSalvandoConfig] = useState(false);
  const [configSalvaSucesso, setConfigSalvaSucesso] = useState(false);

  // Sincronizar observações caso o acerto mude
  useEffect(() => {
    if (acerto.observacoes !== undefined) {
      setObservacoesTexto(acerto.observacoes);
    }
  }, [acerto.observacoes]);

  // Copiar resumo do acerto formatado para WhatsApp
  const handleCopiarWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(resolucao.textoWhatsApp);
      setCopiadoWhats(true);
      setTimeout(() => setCopiadoWhats(false), 3000);
    } catch {
      // Fallback
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

  // Salvar Observações
  const handleSalvarObservacoes = async () => {
    setSalvandoObs(true);
    try {
      if (onSalvarObservacoesAcerto) {
        await onSalvarObservacoesAcerto(observacoesTexto);
      } else {
        await onSalvarConfigLucros({
          ...(configSalva || {
            reservaEmergenciaPorcentagem: 0,
            participantes,
          }),
          observacoes: observacoesTexto,
        });
      }
      setObsSalvaSucesso(true);
      setTimeout(() => setObsSalvaSucesso(false), 3000);
    } catch (err: any) {
      alert('Erro ao salvar observações: ' + (err.message || 'Tente novamente.'));
    } finally {
      setSalvandoObs(false);
    }
  };

  // Salvar configuração de lucros
  const handleSalvarConfig = async () => {
    setIsSalvandoConfig(true);
    try {
      await onSalvarConfigLucros({
        modoFechamento: modoAba,
        usarPrecoFixo,
        faturamentoProjetoCentavos: usarPrecoFixo ? faturamentoCentavos : undefined,
        taxaProjetoCentavos: usarPrecoFixo ? taxaCentavos : 0,
        reservaEmergenciaPorcentagem: reservaPorcentagem,
        participantes,
        observacoes: observacoesTexto,
      });
      setConfigSalvaSucesso(true);
      setTimeout(() => setConfigSalvaSucesso(false), 3000);
    } catch (err: any) {
      alert('Erro ao salvar: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSalvandoConfig(false);
    }
  };

  // Cálculo da divisão de lucros (%) se ativada
  const calculoLucro = useMemo(() => {
    return calcularDivisaoLucros(
      acerto,
      lancamentos,
      {
        usarPrecoFixo,
        faturamentoProjetoCentavos: usarPrecoFixo ? faturamentoCentavos : undefined,
        taxaProjetoCentavos: usarPrecoFixo ? taxaCentavos : 0,
        reservaEmergenciaPorcentagem: reservaPorcentagem,
        participantes,
      }
    );
  }, [acerto, lancamentos, usarPrecoFixo, faturamentoCentavos, taxaCentavos, reservaPorcentagem, participantes]);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* SELETOR SUPERIOR: ACERTO DIRETO (QUEM DEVE A QUEM) vs DIVISÃO DE LUCROS (%) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <ArrowRightLeft className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {modoAba === 'quem_deve_a_quem' ? '🤝 Fechamento: Quem Deve a Quem' : '💼 Divisão de Lucros (%)'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {modoAba === 'quem_deve_a_quem'
              ? 'Resolução direta de dívidas, vales e reembolsos sem complicação.'
              : 'Divisão societária com porcentagens e faturamento fixo contratual.'}
          </p>
        </div>

        {/* BOTOES DE AÇÃO E ALTERNADOR */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Alternador de Modo */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setModoAba('quem_deve_a_quem')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                modoAba === 'quem_deve_a_quem'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Quem Deve a Quem (Simples)</span>
            </button>
            <button
              type="button"
              onClick={() => setModoAba('divisao_lucros')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                modoAba === 'divisao_lucros'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>Divisão % Sócios</span>
            </button>
          </div>

          {/* Copiar WhatsApp */}
          <button
            type="button"
            onClick={handleCopiarWhatsApp}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer active:scale-95 shadow-xs ${
              copiadoWhats
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
            }`}
            title="Copiar resumo completo formatado para WhatsApp"
          >
            {copiadoWhats ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiadoWhats ? 'Copiado para WhatsApp!' : 'Copiar p/ WhatsApp'}</span>
          </button>

          {/* Salvar PDF */}
          {onExportarPdf && (
            <button
              type="button"
              onClick={onExportarPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition cursor-pointer active:scale-95 shadow-xs"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Salvar em PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODO 1: QUEM DEVE A QUEM (DIRETO E OBJETIVO)             */}
      {/* ======================================================== */}
      {modoAba === 'quem_deve_a_quem' ? (
        <div className="space-y-5">
          
          {/* CARDS GRANDES DE FECHAMENTO DIRETO */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl border border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Resolução Final de Contas
                </span>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">
                  Como Acertar: Quem Paga Quem
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {resolucao.transacoes.length === 0 ? 'Tudo Quitado' : `${resolucao.transacoes.length} acerto(s) a realizar`}
              </span>
            </div>

            {/* LISTA DAS TRANSAÇÕES DIRETAS */}
            {resolucao.transacoes.length === 0 ? (
              <div className="py-6 text-center text-slate-300">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-base font-bold">Todas as contas estão quitadas e equilibradas!</p>
                <p className="text-xs text-slate-400 mt-1">Não há nenhuma pendência entre os participantes ou o caixa da obra.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 pt-1">
                {resolucao.transacoes.map((t, idx) => (
                  <div
                    key={t.id || idx}
                    className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-rose-300">
                          {t.devedor}
                        </span>
                        <span className="text-slate-400 font-bold">➔</span>
                        <span className="text-xs font-semibold text-emerald-300">
                          {t.credor}
                        </span>
                      </div>
                      <p className="text-sm font-black text-white mt-1">
                        👉 Pagar a <strong className="text-emerald-400">{t.credor}</strong>
                      </p>
                      <p className="text-[11px] text-slate-300 truncate mt-0.5">
                        {t.motivo}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Valor do Acerto
                      </span>
                      <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                        {formatarCentavos(t.valorCentavos)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* RESUMO DE VALORES TOTAIS (SEM CAMPOS VAZIOS INÚTEIS) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-700/80 text-xs">
              {resolucao.temEntradas && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Receitas / Entradas (Nota)</span>
                  <span className="text-base sm:text-lg font-bold font-mono text-emerald-300">
                    {formatarCentavos(resolucao.totalEntradasCentavos)}
                  </span>
                </div>
              )}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total de Gastos Comprovados</span>
                <span className="text-base sm:text-lg font-bold font-mono text-rose-300">
                  {formatarCentavos(resolucao.totalGastosCentavos)}
                </span>
              </div>
              {resolucao.temEntradas && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Sobra Líquida da Obra</span>
                  <span className="text-base sm:text-lg font-bold font-mono text-teal-300">
                    {formatarCentavos(resolucao.sobraOuDeficitCentavos)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* TABELA LIMPA: BALANÇO INDIVIDUAL POR PESSOA */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Extrato Individual: Gastos, Vales & Saldo a Receber</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Valores comprovados por cada pessoa envolvida no acerto.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase">
                  <tr>
                    <th className="p-3">Participante</th>
                    <th className="p-3 text-right">Gastos Pagos</th>
                    <th className="p-3 text-right">Vales / Adiantamentos</th>
                    {resolucao.temEntradas && <th className="p-3 text-right">Cota da Obra</th>}
                    <th className="p-3 text-right font-black">Saldo Final</th>
                    <th className="p-3 text-center">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {resolucao.balancoPorPessoa.map((b) => (
                    <tr key={b.pessoaId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: b.cor || '#059669' }}
                        />
                        <span>{b.nome}</span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatarCentavos(b.gastosPagosCentavos)}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-600 dark:text-amber-400 font-bold">
                        {b.adiantamentosPegosCentavos > 0 ? `- ${formatarCentavos(b.adiantamentosPegosCentavos)}` : 'R$ 0,00'}
                      </td>
                      {resolucao.temEntradas && (
                        <td className="p-3 text-right font-mono text-teal-600 dark:text-teal-400">
                          {formatarCentavos(b.cotaEntradasCentavos)}
                        </td>
                      )}
                      <td className={`p-3 text-right font-mono font-black ${
                        b.status === 'recebe'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : b.status === 'paga'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-500'
                      }`}>
                        {formatarCentavos(Math.abs(b.saldoFinalAReceberCentavos))}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          b.status === 'recebe'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : b.status === 'paga'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {b.status === 'recebe' ? 'A Receber' : b.status === 'paga' ? 'Deve Pagar' : 'Quitado'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ======================================================== */}
          {/* CAMPO DE OBSERVAÇÕES E NOTAS DO ACERTO (EDITÁVEL)       */}
          {/* ======================================================== */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Observações, Notas & Detalhes do Acerto
                </h4>
              </div>
              {obsSalvaSucesso && (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 animate-fade-in">
                  <Check className="w-3.5 h-3.5" />
                  Observações salvas com sucesso!
                </span>
              )}
            </div>
            
            <p className="text-xs text-slate-500">
              Digite observações livres sobre este acerto (ex: dados bancários do Pix, datas combinadas, pendências ou notas). Esse texto também sai no PDF e na cópia para WhatsApp.
            </p>

            <textarea
              rows={3}
              value={observacoesTexto}
              onChange={(e) => setObservacoesTexto(e.target.value)}
              placeholder="Ex: Pagamento da sobra de Victor agendado via Pix para segunda-feira. Todas as notas fiscais foram anexadas."
              className="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSalvarObservacoes}
                disabled={salvandoObs}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-700/20 transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{salvandoObs ? 'Salvando...' : 'Salvar Observações'}</span>
              </button>
            </div>
          </div>

        </div>
      ) : (
        /* ======================================================== */
        /* MODO 2: DIVISÃO SOCIETÁRIA COM PORCENTAGENS (%)          */
        /* ======================================================== */
        <div className="space-y-5">
          {/* CARDS RESUMO DO LUCRO SOCIETÁRIO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className={`p-4 rounded-2xl border shadow-xs ${
              calculoLucro.isLucroPositivo
                ? 'bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900 text-white border-emerald-600/40'
                : 'bg-gradient-to-br from-rose-950 via-slate-900 to-slate-950 text-white border-rose-700/40'
            }`}>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">Lucro Líquido Real</span>
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight mt-1">
                {formatarCentavos(calculoLucro.lucroBrutoCentavos)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Receita Total</span>
              <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 dark:text-teal-400 mt-1">
                {formatarCentavos(calculoLucro.baseCalculoRealCentavos)}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total de Despesas</span>
              <div className="text-2xl sm:text-3xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                {formatarCentavos(calculoLucro.somaTodasSaidasCentavos)}
              </div>
            </div>
          </div>

          {/* TABELA DOS SÓCIOS COM % */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Participação Societária e Distribuição de Lucros</span>
              </h3>
              <button
                type="button"
                onClick={handleSalvarConfig}
                disabled={isSalvandoConfig}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSalvandoConfig ? 'Salvando...' : 'Salvar Percentuais'}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Sócio</th>
                    <th className="p-3 w-28 text-center">Cota (%)</th>
                    <th className="p-3 text-right">Cota Bruta</th>
                    <th className="p-3 text-right">Adiantamentos</th>
                    <th className="p-3 text-right font-black">Saldo Final a Receber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {calculoLucro.participantes.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{item.nome}</td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.porcentagem}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setParticipantes((prev) =>
                              prev.map((p) => (p.id === item.id ? { ...p, porcentagem: val } : p))
                            );
                          }}
                          className="w-16 px-2 py-1 text-center font-bold font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        />
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatarCentavos(item.cotaBrutaCentavos)}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-600 font-bold">
                        {item.adiantamentosAbatidosCentavos > 0 ? `- ${formatarCentavos(item.adiantamentosAbatidosCentavos)}` : 'R$ 0,00'}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {formatarCentavos(item.valorLiquidoAReceberCentavos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
