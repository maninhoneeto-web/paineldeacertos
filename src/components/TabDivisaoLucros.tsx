import React, { useState, useEffect } from 'react';
import { 
  Percent, DollarSign, TrendingUp, TrendingDown, Users, ShieldAlert, 
  CheckCircle2, Plus, Trash2, Sliders, RefreshCw, AlertCircle, FileText, 
  HelpCircle, Sparkles, PieChart, ArrowRight, ShieldCheck
} from 'lucide-react';
import { Acerto, Lancamento, ConfigDivisaoLucros, ParticipanteLucro } from '../types';
import { formatarCentavos, calcularDivisaoLucros } from '../utils/currency';

interface TabDivisaoLucrosProps {
  acerto: Acerto;
  lancamentos: Lancamento[];
  onSalvarConfigLucros: (config: ConfigDivisaoLucros) => Promise<void>;
  onExportarPdf?: () => void;
}

export const TabDivisaoLucros: React.FC<TabDivisaoLucrosProps> = ({
  acerto,
  lancamentos,
  onSalvarConfigLucros,
  onExportarPdf,
}) => {
  // Inicializar estado local a partir do acerto ou pessoas existentes
  const [reservaPorcentagem, setReservaPorcentagem] = useState<number>(
    acerto.configDivisaoLucros?.reservaEmergenciaPorcentagem || 0
  );

  const [participantes, setParticipantes] = useState<ParticipanteLucro[]>(() => {
    if (acerto.configDivisaoLucros?.participantes && acerto.configDivisaoLucros.participantes.length > 0) {
      return acerto.configDivisaoLucros.participantes;
    }
    // Procura pessoas já cadastradas com os nomes Neto e Victor ou cria os 2 sócios padrão (50% cada)
    const pessoaNeto = acerto.pessoas.find((p) => p.nome.toLowerCase().includes('neto'));
    const pessoaVictor = acerto.pessoas.find((p) => p.nome.toLowerCase().includes('victor'));

    return [
      {
        id: pessoaNeto ? pessoaNeto.id : 'socio_neto',
        pessoaId: pessoaNeto?.id,
        nome: pessoaNeto ? pessoaNeto.nome : 'Neto',
        porcentagem: 50,
        descontarAdiantamentos: true,
      },
      {
        id: pessoaVictor ? pessoaVictor.id : 'socio_victor',
        pessoaId: pessoaVictor?.id,
        nome: pessoaVictor ? pessoaVictor.nome : 'Victor',
        porcentagem: 50,
        descontarAdiantamentos: true,
      },
    ];
  });

  const [observacoes, setObservacoes] = useState<string>(
    acerto.configDivisaoLucros?.observacoes || ''
  );

  const [isSalvando, setIsSalvando] = useState(false);
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);

  // Modal para adicionar sócio
  const [modalNovoSocio, setModalNovoSocio] = useState(false);
  const [nomeNovoSocio, setNomeNovoSocio] = useState('');
  const [pessoaSelecionadaId, setPessoaSelecionadaId] = useState('');

  // Sincronizar se o acerto mudar
  useEffect(() => {
    if (acerto.configDivisaoLucros) {
      setReservaPorcentagem(acerto.configDivisaoLucros.reservaEmergenciaPorcentagem || 0);
      if (acerto.configDivisaoLucros.participantes?.length > 0) {
        setParticipantes(acerto.configDivisaoLucros.participantes);
      }
      setObservacoes(acerto.configDivisaoLucros.observacoes || '');
    }
  }, [acerto.configDivisaoLucros]);

  // Cálculo dos lucros em tempo real
  const calculo = calcularDivisaoLucros(acerto, lancamentos, {
    reservaEmergenciaPorcentagem: reservaPorcentagem,
    participantes,
    observacoes,
  });

  // Dividir igualmente entre todos os sócios participantes
  const handleDividirIgualmente = () => {
    if (participantes.length === 0) return;
    const qtd = participantes.length;
    const cotaBase = Number((100 / qtd).toFixed(1));
    const atualizados = participantes.map((p, idx) => {
      // Ajusta o último para fechar exatamente 100%
      const cota = idx === qtd - 1 ? Number((100 - cotaBase * (qtd - 1)).toFixed(1)) : cotaBase;
      return { ...p, porcentagem: cota };
    });
    setParticipantes(atualizados);
  };

  // Ajustar proporcionalmente para somar exatamente 100%
  const handleAjustarPara100 = () => {
    const somaAtual = participantes.reduce((sum, p) => sum + p.porcentagem, 0);
    if (somaAtual <= 0) {
      handleDividirIgualmente();
      return;
    }
    const fator = 100 / somaAtual;
    let acumulado = 0;
    const atualizados = participantes.map((p, idx) => {
      if (idx === participantes.length - 1) {
        return { ...p, porcentagem: Number((100 - acumulado).toFixed(1)) };
      }
      const novaCota = Number((p.porcentagem * fator).toFixed(1));
      acumulado += novaCota;
      return { ...p, porcentagem: novaCota };
    });
    setParticipantes(atualizados);
  };

  const handleMudarPorcentagem = (id: string, valorStr: string) => {
    const val = parseFloat(valorStr) || 0;
    setParticipantes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, porcentagem: Math.max(0, Math.min(100, val)) } : p))
    );
  };

  const handleToggleDescontarAdiantamento = (id: string) => {
    setParticipantes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, descontarAdiantamentos: !p.descontarAdiantamentos } : p))
    );
  };

  const handleRemoverParticipante = (id: string) => {
    setParticipantes((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAdicionarSocio = (e: React.FormEvent) => {
    e.preventDefault();
    let nome = nomeNovoSocio.trim();
    let pId: string | undefined = undefined;

    if (pessoaSelecionadaId) {
      const pessoaExistente = acerto.pessoas.find((p) => p.id === pessoaSelecionadaId);
      if (pessoaExistente) {
        nome = pessoaExistente.nome;
        pId = pessoaExistente.id;
      }
    }

    if (!nome) return;

    const novo: ParticipanteLucro = {
      id: 'part_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      pessoaId: pId,
      nome,
      porcentagem: 0,
      descontarAdiantamentos: true,
    };

    setParticipantes((prev) => [...prev, novo]);
    setNomeNovoSocio('');
    setPessoaSelecionadaId('');
    setModalNovoSocio(false);
  };

  const handleSalvarTudo = async () => {
    setIsSalvando(true);
    try {
      await onSalvarConfigLucros({
        reservaEmergenciaPorcentagem: reservaPorcentagem,
        participantes,
        observacoes,
      });
      setSalvoComSucesso(true);
      setTimeout(() => setSalvoComSucesso(false), 3000);
    } catch (err: any) {
      alert('Erro ao salvar configuração de lucros: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSalvando(false);
    }
  };

  const somaPorcentagens = Number(participantes.reduce((sum, p) => sum + p.porcentagem, 0).toFixed(1));
  const isSoma100 = Math.abs(somaPorcentagens - 100) < 0.2;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* BANNER PRINCIPAL: NDS CFTV DIGITAL & CÁLCULO AUTOMÁTICO DE LUCRO LÍQUIDO REAL */}
      <div className={`relative overflow-hidden rounded-2xl text-white p-5 sm:p-7 shadow-xl border ${
        calculo.isLucroPositivo
          ? 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 border-emerald-600/40'
          : 'bg-gradient-to-br from-rose-950 via-slate-900 to-slate-950 border-rose-700/40'
      }`}>
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>NDS CFTV DIGITAL • Fechamento Financeiro</span>
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200 border border-white/10">
                50% Neto / 50% Victor
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight">
              {calculo.isLucroPositivo ? 'Lucro Líquido Real Automatizado' : 'Prejuízo Operacional Registrado'}
            </h2>
            
            {/* Demonstração da Fórmula Automática */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 space-y-1">
              <p className="font-semibold text-emerald-300">
                Fórmula Automática: (Base de Cálculo Real R$ 8.000,00 - Soma de Todas as Saídas)
              </p>
              <p className="text-[11px] text-slate-300">
                • Entrada Inicial (Faturamento): <strong>{formatarCentavos(calculo.faturamentoProjetoCentavos)}</strong>
                <br />• Taxa de Projeto Deduzida: <strong>-{formatarCentavos(calculo.taxaProjetoCentavos)}</strong>
                <br />• <strong>Base de Cálculo Real Fixada: {formatarCentavos(calculo.baseCalculoRealCentavos)}</strong>
                <br />• Total de Saídas / Gastos: <strong>-{formatarCentavos(calculo.somaTodasSaidasCentavos)}</strong>
              </p>
            </div>
          </div>

          {/* Card Destacado do Lucro Líquido Real e Botão PDF */}
          <div className="flex flex-col items-end gap-3 w-full lg:w-auto shrink-0">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/20 text-right w-full lg:min-w-[260px]">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                Lucro Líquido Real
              </span>
              <div className="text-3xl sm:text-4xl font-black font-mono mt-0.5 tracking-tight text-white">
                {formatarCentavos(calculo.lucroBrutoCentavos)}
              </div>
              <span className="inline-block mt-1 text-xs font-semibold text-emerald-200">
                {calculo.isLucroPositivo
                  ? `✓ Exatos 50% para cada sócio: ${formatarCentavos(Math.round(calculo.lucroBrutoCentavos / 2))}`
                  : '⚠ Despesas superam a Base de Cálculo'}
              </span>
            </div>

            {onExportarPdf && (
              <button
                type="button"
                onClick={onExportarPdf}
                className="w-full lg:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition cursor-pointer"
              >
                <FileText className="w-4 h-4 text-emerald-100" />
                <span>Salvar em PDF</span>
              </button>
            )}
          </div>
        </div>

        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 4 CARDS: FATURAMENTO, TAXA, BASE REAL, SAÍDAS TOTAIS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* 1. Entrada / Faturamento */}
        <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">1. Entrada (Faturamento)</span>
            <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white">
            {formatarCentavos(calculo.faturamentoProjetoCentavos)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Faturamento Fixo Inicial</p>
        </div>

        {/* 2. Taxa de Projeto */}
        <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">2. Taxa de Projeto</span>
            <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
            -{formatarCentavos(calculo.taxaProjetoCentavos)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Dedução Automática</p>
        </div>

        {/* 3. Base de Cálculo Real */}
        <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border-2 border-emerald-500/40 shadow-xs">
          <div className="flex items-center justify-between text-teal-600 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">3. Base de Cálculo Real</span>
            <span className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-emerald-700 dark:text-emerald-400">
            {formatarCentavos(calculo.baseCalculoRealCentavos)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">R$ 9.000 - R$ 1.000</p>
        </div>

        {/* 4. Total de Saídas / Gastos */}
        <div className="rounded-2xl p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">4. Soma de Saídas</span>
            <span className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {formatarCentavos(calculo.somaTodasSaidasCentavos)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Varrida automática de gastos</p>
        </div>

      </div>

      {/* PAINEL DE CONFIGURAÇÃO DE RESERVA & SÓCIOS */}
      <div className="rounded-2xl p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
        
        {/* Controle do Fundo de Reserva */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>Fundo de Reserva / Reinvestimento da Obra: {reservaPorcentagem}%</span>
            </h4>
            <p className="text-xs text-slate-500">
              Guarda uma porcentagem do lucro na conta da empresa/obra antes de distribuir entre os sócios ({formatarCentavos(calculo.reservaEmergenciaCentavos)} retidos).
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={reservaPorcentagem}
              onChange={(e) => setReservaPorcentagem(parseInt(e.target.value, 10))}
              className="w-32 accent-emerald-600 cursor-pointer"
            />
            <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-200 w-10 text-right">
              {reservaPorcentagem}%
            </span>
          </div>
        </div>

        {/* Gerenciamento de Sócios / Participantes */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Divisão entre Sócios e Participantes ({participantes.length})</span>
              </h3>
              <p className="text-xs text-slate-500">
                Configure a porcentagem de cota de cada pessoa. Total alocado atual: <strong className={isSoma100 ? 'text-emerald-600' : 'text-rose-600'}>{somaPorcentagens}%</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDividirIgualmente}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
                title="Dividir 100% igualmente entre todos os sócios"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Dividir Igualmente</span>
              </button>

              <button
                type="button"
                onClick={() => setModalNovoSocio(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Adicionar Sócio</span>
              </button>
            </div>
          </div>

          {/* Alerta se a soma não der 100% */}
          {!isSoma100 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  A soma das porcentagens é <strong>{somaPorcentagens}%</strong> (deve totalizar exatamente 100%).
                </span>
              </div>
              <button
                type="button"
                onClick={handleAjustarPara100}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shrink-0 ml-2"
              >
                Ajustar para 100%
              </button>
            </div>
          )}

          {/* Barra Visual de Divisão de Cotas */}
          <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
            {participantes.map((p, idx) => {
              const cores = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-teal-500', 'bg-rose-500'];
              return (
                <div
                  key={p.id}
                  className={`h-full ${cores[idx % cores.length]} transition-all duration-300`}
                  style={{ width: `${Math.min(100, Math.max(0, p.porcentagem))}%` }}
                  title={`${p.nome}: ${p.porcentagem}%`}
                />
              );
            })}
          </div>

          {/* TABELA DE DEMONSTRATIVO DE DIVISÃO DOS LUCROS */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Sócio / Participante</th>
                    <th className="p-3 w-28 text-center">Cota (%)</th>
                    <th className="p-3 text-right">Cota Bruta</th>
                    <th className="p-3 text-right">Adiantamentos</th>
                    <th className="p-3 text-right">Lucro Líquido a Receber</th>
                    <th className="p-3 w-16 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {calculo.participantes.map((item) => {
                    const configPart = participantes.find((p) => p.id === item.id);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                        
                        {/* Nome do Sócio */}
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {item.nome}
                          </div>
                          <label className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={configPart?.descontarAdiantamentos !== false}
                              onChange={() => handleToggleDescontarAdiantamento(item.id)}
                              className="h-3.5 w-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>Descontar adiantamentos já pegos</span>
                          </label>
                        </td>

                        {/* Input de Porcentagem */}
                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={configPart?.porcentagem || 0}
                              onChange={(e) => handleMudarPorcentagem(item.id, e.target.value)}
                              className="w-16 p-1.5 text-center font-mono font-bold text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                            />
                            <span className="font-bold text-slate-500">%</span>
                          </div>
                        </td>

                        {/* Cota Bruta do Lucro */}
                        <td className="p-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {formatarCentavos(item.cotaBrutaCentavos)}
                        </td>

                        {/* Adiantamentos Abatidos */}
                        <td className="p-3 text-right font-mono text-amber-600 dark:text-amber-400 font-medium">
                          {item.adiantamentosAbatidosCentavos > 0
                            ? `-${formatarCentavos(item.adiantamentosAbatidosCentavos)}`
                            : 'R$ 0,00'}
                        </td>

                        {/* Valor Líquido a Receber */}
                        <td className="p-3 text-right">
                          <div className={`font-mono font-bold text-sm sm:text-base ${
                            item.valorLiquidoAReceberCentavos > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : item.valorLiquidoAReceberCentavos < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-500'
                          }`}>
                            {formatarCentavos(item.valorLiquidoAReceberCentavos)}
                          </div>
                          <span className={`text-[10px] font-semibold block ${
                            item.status === 'a_receber'
                              ? 'text-emerald-600'
                              : item.status === 'adiantou_mais_que_lucro'
                              ? 'text-rose-500'
                              : 'text-slate-400'
                          }`}>
                            {item.status === 'a_receber'
                              ? 'A pagar ao sócio'
                              : item.status === 'adiantou_mais_que_lucro'
                              ? 'Adiantou mais do que o lucro'
                              : 'Quitado / Zerado'}
                          </span>
                        </td>

                        {/* Botão Remover */}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleRemoverParticipante(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Remover sócio"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Observações da Divisão de Lucros */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
            Observações ou Termos do Acordo de Lucros (Opcional)
          </label>
          <textarea
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex: Acordo de 50/50 após dedução dos custos e retenção de 10% para compra de novas ferramentas."
            className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
          />
        </div>

        {/* Botões de Ação do Rodapé */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <HelpCircle className="w-4 h-4 text-emerald-600" />
            <span>Todos os cálculos são atualizados em tempo real a cada novo lançamento de entrada ou saída.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onExportarPdf && (
              <button
                type="button"
                onClick={onExportarPdf}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white text-xs font-bold shadow-md transition cursor-pointer"
                title="Salvar relatório contábil em PDF"
              >
                <FileText className="w-4 h-4 text-emerald-100" />
                <span>Salvar em PDF</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSalvarTudo}
              disabled={isSalvando}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {isSalvando ? (
                <span>Salvando...</span>
              ) : salvoComSucesso ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Configuração Salva!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Salvar Divisão de Lucros</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* MODAL ADICIONAR NOVO SÓCIO */}
      {modalNovoSocio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Adicionar Sócio / Participante
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Escolha uma pessoa já cadastrada no acerto ou digite um novo nome de sócio.
            </p>

            <form onSubmit={handleAdicionarSocio} className="space-y-3.5 text-xs">
              {acerto.pessoas.length > 0 && (
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                    Selecionar Pessoa Existente do Acerto:
                  </label>
                  <select
                    value={pessoaSelecionadaId}
                    onChange={(e) => {
                      setPessoaSelecionadaId(e.target.value);
                      if (e.target.value) setNomeNovoSocio('');
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">-- Ou digite um novo nome abaixo --</option>
                    {acerto.pessoas.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} {p.papel ? `(${p.papel})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Nome do Sócio / Investidor:
                </label>
                <input
                  type="text"
                  value={nomeNovoSocio}
                  onChange={(e) => {
                    setNomeNovoSocio(e.target.value);
                    if (e.target.value) setPessoaSelecionadaId('');
                  }}
                  placeholder="Ex: Carlos (Sócio Investidor), Lucas, etc."
                  required={!pessoaSelecionadaId}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNovoSocio(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
