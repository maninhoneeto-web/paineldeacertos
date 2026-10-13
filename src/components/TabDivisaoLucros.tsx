import React, { useState, useEffect } from 'react';
import { 
  Percent, DollarSign, TrendingUp, TrendingDown, Users, 
  CheckCircle2, Plus, Trash2, Sliders, RefreshCw, FileText, 
  HelpCircle, Sparkles, ShieldCheck, Settings, ToggleLeft, ToggleRight
} from 'lucide-react';
import { Acerto, Lancamento, ConfigDivisaoLucros, ParticipanteLucro } from '../types';
import { formatarCentavos, calcularDivisaoLucros, aplicarMascaraCentavos } from '../utils/currency';

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
  // Configuração opcional de preço fixo / contrato (por padrão 100% dinâmico)
  const configSalva = acerto.configDivisaoLucros;
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
    configSalva?.observacoes || ''
  );

  const [isSalvando, setIsSalvando] = useState(false);
  const [salvoComSucesso, setSalvoComSucesso] = useState(false);

  // Modal para adicionar novo sócio
  const [modalNovoSocio, setModalNovoSocio] = useState(false);
  const [nomeNovoSocio, setNomeNovoSocio] = useState('');
  const [pessoaSelecionadaId, setPessoaSelecionadaId] = useState('');

  // Sincronizar se o acerto mudar
  useEffect(() => {
    if (acerto.configDivisaoLucros) {
      const cfg = acerto.configDivisaoLucros;
      if (cfg.usarPrecoFixo !== undefined) {
        setUsarPrecoFixo(cfg.usarPrecoFixo && cfg.faturamentoProjetoCentavos !== 900000);
      }
      if (cfg.faturamentoProjetoCentavos !== undefined) {
        const fat = cfg.faturamentoProjetoCentavos === 900000 ? 0 : cfg.faturamentoProjetoCentavos;
        setFaturamentoCentavos(fat);
        setFaturamentoTexto(fat ? formatarCentavos(fat) : '');
      }
      if (cfg.taxaProjetoCentavos !== undefined) {
        const tx = cfg.taxaProjetoCentavos === 100000 ? 0 : cfg.taxaProjetoCentavos;
        setTaxaCentavos(tx);
        setTaxaTexto(tx ? formatarCentavos(tx) : '');
      }
      setReservaPorcentagem(cfg.reservaEmergenciaPorcentagem || 0);
      if (cfg.participantes?.length > 0) {
        setParticipantes(cfg.participantes);
      }
      setObservacoes(cfg.observacoes || '');
    }
  }, [acerto.configDivisaoLucros]);

  // Cálculo dos lucros em tempo real
  const calculo = calcularDivisaoLucros(acerto, lancamentos, {
    usarPrecoFixo,
    faturamentoProjetoCentavos: usarPrecoFixo ? faturamentoCentavos : undefined,
    taxaProjetoCentavos: usarPrecoFixo ? taxaCentavos : 0,
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
        usarPrecoFixo,
        faturamentoProjetoCentavos: usarPrecoFixo ? faturamentoCentavos : undefined,
        taxaProjetoCentavos: usarPrecoFixo ? taxaCentavos : 0,
        reservaEmergenciaPorcentagem: reservaPorcentagem,
        participantes,
        observacoes,
      });
      setSalvoComSucesso(true);
      setTimeout(() => setSalvoComSucesso(false), 3000);
    } catch (err: any) {
      alert('Erro ao salvar configuração: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSalvando(false);
    }
  };

  const somaPorcentagens = Number(participantes.reduce((sum, p) => sum + p.porcentagem, 0).toFixed(1));
  const isSoma100 = Math.abs(somaPorcentagens - 100) < 0.2;

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* CABEÇALHO LIMPO E DINÂMICO (SEM TEXTOS OU ESTIMATIVAS FORÇADAS) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              Divisão de Lucros & Fechamento
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              {usarPrecoFixo ? 'Preço Fixo Customizado' : '100% Dinâmico'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cálculo dinâmico em tempo real conforme gastos, notas e adiantamentos lançados.
          </p>
        </div>

        {onExportarPdf && (
          <button
            type="button"
            onClick={onExportarPdf}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition cursor-pointer shrink-0"
            title="Salvar relatório em PDF"
          >
            <FileText className="w-4 h-4 text-emerald-100" />
            <span>Salvar em PDF</span>
          </button>
        )}
      </div>

      {/* 3 CARDS DIRETOS E DINÂMICOS: LUCRO LÍQUIDO, BASE DE CÁLCULO E SOMA DE SAÍDAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        
        {/* Card 1: Lucro Líquido Real */}
        <div className={`p-4 sm:p-5 rounded-2xl border shadow-xs ${
          calculo.isLucroPositivo
            ? 'bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900 text-white border-emerald-600/40'
            : 'bg-gradient-to-br from-rose-950 via-slate-900 to-slate-950 text-white border-rose-700/40'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Lucro Líquido Real
            </span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight">
            {formatarCentavos(calculo.lucroBrutoCentavos)}
          </div>
          <p className="text-[11px] text-emerald-200/80 mt-1">
            {calculo.isLucroPositivo 
              ? '✓ Divisão automática entre os sócios abaixo'
              : '⚠ Gastos superam a receita/base'}
          </p>
        </div>

        {/* Card 2: Base de Cálculo */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-1 text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">
              {usarPrecoFixo ? 'Base de Cálculo Real' : 'Receita Total (Entradas)'}
            </span>
            <TrendingUp className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-teal-600 dark:text-teal-400">
            {formatarCentavos(calculo.baseCalculoRealCentavos)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {usarPrecoFixo
              ? `Faturamento (${formatarCentavos(calculo.faturamentoProjetoCentavos)}) - Taxa (${formatarCentavos(calculo.taxaProjetoCentavos)})`
              : 'Soma de todas as entradas lançadas na lista'}
          </p>
        </div>

        {/* Card 3: Soma de Saídas / Gastos */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-1 text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total de Gastos (Saídas)</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-rose-600 dark:text-rose-400">
            {formatarCentavos(calculo.somaTodasSaidasCentavos)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Varredura automática de despesas e compras
          </p>
        </div>

      </div>

      {/* ABA / SEÇÃO EDITÁVEL: CONFIGURAR PREÇO DO PROJETO (SE O USUÁRIO QUISER DEFINIR) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-600" />
              <span>Configurar Preço ou Contrato do Projeto (Opcional)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Se desejar estipular um valor contratual de entrada e taxa de dedução, ative abaixo. Caso contrário, o cálculo é 100% dinâmico pelas entradas reais.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setUsarPrecoFixo(!usarPrecoFixo)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              usarPrecoFixo
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {usarPrecoFixo ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4" />}
            <span>{usarPrecoFixo ? 'Preço Fixo Ativado' : 'Modo Dinâmico (Recomendado)'}</span>
          </button>
        </div>

        {usarPrecoFixo ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Input Faturamento */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Faturamento / Preço do Projeto (R$)
              </label>
              <input
                type="text"
                value={faturamentoTexto}
                onChange={(e) => {
                  const m = aplicarMascaraCentavos(e.target.value);
                  setFaturamentoTexto(m.textoFormatado);
                  setFaturamentoCentavos(m.centavos);
                }}
                placeholder="R$ 0,00"
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-sm text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Valor total contratado do projeto
              </span>
            </div>

            {/* Input Taxa Deduzida */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Taxa de Dedução do Projeto (R$)
              </label>
              <input
                type="text"
                value={taxaTexto}
                onChange={(e) => {
                  const m = aplicarMascaraCentavos(e.target.value);
                  setTaxaTexto(m.textoFormatado);
                  setTaxaCentavos(m.centavos);
                }}
                placeholder="Ex: R$ 1.000,00"
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono font-bold text-sm text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Dedução operacional de taxa (se houver)
              </span>
            </div>

            {/* Base Resultante */}
            <div className="flex flex-col justify-center p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60">
              <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 uppercase">
                Base de Cálculo Real Calculada
              </span>
              <div className="text-lg font-black font-mono text-teal-700 dark:text-teal-400 mt-0.5">
                {formatarCentavos(Math.max(0, faturamentoCentavos - taxaCentavos))}
              </div>
              <span className="text-[10px] text-teal-600/80 dark:text-teal-400/80">
                Faturamento menos Taxa Deduzida
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500">
            O faturamento está operando em modo <strong>100% dinâmico</strong>. A receita total é somada automaticamente a partir de todos os lançamentos do tipo "Entrada" cadastrados neste acerto.
          </div>
        )}

      </div>

      {/* DEMONSTRATIVO DE DIVISÃO DOS SÓCIOS */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Divisão entre Sócios ({participantes.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Alocação das cotas de lucro. Total alocado: <strong className={isSoma100 ? 'text-emerald-600' : 'text-rose-600'}>{somaPorcentagens}%</strong>
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleDividirIgualmente}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
              title="Dividir 50% / 50%"
            >
              50% / 50%
            </button>
            <button
              type="button"
              onClick={handleAjustarPara100}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
              title="Ajustar soma para 100%"
            >
              Ajustar 100%
            </button>
            <button
              type="button"
              onClick={() => setModalNovoSocio(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Sócio</span>
            </button>
          </div>
        </div>

        {/* Barra de Cotas */}
        <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
          {participantes.map((p, idx) => {
            const cores = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-teal-500'];
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

        {/* Tabela dos Sócios */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Sócio</th>
                  <th className="p-3 w-28 text-center">Cota (%)</th>
                  <th className="p-3 text-right">Cota Bruta</th>
                  <th className="p-3 text-right">Adiantamentos</th>
                  <th className="p-3 text-right font-black">Saldo Final a Receber</th>
                  <th className="p-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {calculo.participantes.map((item) => {
                  const configPart = participantes.find((p) => p.id === item.id);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {item.nome}
                        </div>
                        <label className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={configPart?.descontarAdiantamentos !== false}
                            onChange={() => handleToggleDescontarAdiantamento(item.id)}
                            className="h-3.5 w-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Descontar adiantamento pessoal</span>
                        </label>
                      </td>

                      <td className="p-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={configPart?.porcentagem || 0}
                            onChange={(e) => handleMudarPorcentagem(item.id, e.target.value)}
                            className="w-16 p-1.5 text-center font-mono font-bold text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                          <span className="font-bold text-slate-500">%</span>
                        </div>
                      </td>

                      <td className="p-3 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {formatarCentavos(item.cotaBrutaCentavos)}
                      </td>

                      <td className="p-3 text-right font-mono text-amber-600 dark:text-amber-400 font-medium">
                        {item.adiantamentosAbatidosCentavos > 0
                          ? `-${formatarCentavos(item.adiantamentosAbatidosCentavos)}`
                          : 'R$ 0,00'}
                      </td>

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
                        <span className="text-[10px] font-semibold text-slate-400 block">
                          {item.valorLiquidoAReceberCentavos >= 0 ? 'Líquido a Receber' : 'Adiantou mais que o lucro'}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        {participantes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoverParticipante(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Remover sócio"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fundo de Reserva opcional simplificado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <span>Fundo de Reserva / Caixa da Empresa: <strong>{reservaPorcentagem}%</strong> ({formatarCentavos(calculo.reservaEmergenciaCentavos)} retidos)</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="50"
              step="5"
              value={reservaPorcentagem}
              onChange={(e) => setReservaPorcentagem(parseInt(e.target.value, 10))}
              className="w-28 accent-emerald-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Botão de Salvar Alterações */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleSalvarTudo}
            disabled={isSalvando}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md transition disabled:opacity-50 cursor-pointer"
          >
            {isSalvando ? (
              <span>Salvando...</span>
            ) : salvoComSucesso ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Salvo com Sucesso!</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Salvar Configuração</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* MODAL ADICIONAR NOVO SÓCIO */}
      {modalNovoSocio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Adicionar Sócio / Participante
            </h3>

            <form onSubmit={handleAdicionarSocio} className="space-y-3.5 text-xs">
              {acerto.pessoas.length > 0 && (
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                    Selecionar Pessoa do Acerto:
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
                  Nome do Sócio:
                </label>
                <input
                  type="text"
                  value={nomeNovoSocio}
                  onChange={(e) => {
                    setNomeNovoSocio(e.target.value);
                    if (e.target.value) setPessoaSelecionadaId('');
                  }}
                  placeholder="Nome do sócio"
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
