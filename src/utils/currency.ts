/**
 * Utilitários para manuseio rigoroso de valores financeiros em CENTAVOS (números inteiros).
 * Garante precisão absoluta eliminando erros de arredondamento IEEE-754.
 */

import { 
  Lancamento, TotaisPessoa, TotaisGerais, PessoaTab, Acerto, 
  ParticipanteLucro, CalculoDivisaoLucros, ParticipanteLucroCalculado, ConfigDivisaoLucros 
} from '../types';

/**
 * Converte centavos inteiros para formato de moeda brasileira: R$ 1.234,56
 */
export function formatarCentavos(centavos: number | undefined | null): string {
  if (centavos === undefined || centavos === null || isNaN(centavos)) {
    return 'R$ 0,00';
  }

  const isNegativo = centavos < 0;
  const valorAbsoluto = Math.abs(Math.round(centavos));
  const reais = Math.floor(valorAbsoluto / 100);
  const restoCentavos = valorAbsoluto % 100;

  const parteReaisFormatada = reais.toLocaleString('pt-BR');
  const parteCentavosFormatada = restoCentavos.toString().padStart(2, '0');

  const resultado = `R$ ${parteReaisFormatada},${parteCentavosFormatada}`;
  return isNegativo ? `-${resultado}` : resultado;
}

/**
 * Formata apenas os números e vírgula: 1.234,56
 */
export function formatarCentavosSemSimbolo(centavos: number | undefined | null): string {
  if (centavos === undefined || centavos === null || isNaN(centavos)) {
    return '0,00';
  }
  const isNegativo = centavos < 0;
  const valorAbsoluto = Math.abs(Math.round(centavos));
  const reais = Math.floor(valorAbsoluto / 100);
  const restoCentavos = valorAbsoluto % 100;

  const resultado = `${reais.toLocaleString('pt-BR')},${restoCentavos.toString().padStart(2, '0')}`;
  return isNegativo ? `-${resultado}` : resultado;
}

/**
 * Converte qualquer entrada (string "150,50", "150.50", "R$ 150,50" ou número) para CENTAVOS inteiros
 */
export function parseValorParaCentavos(input: string | number | undefined | null): number {
  if (input === undefined || input === null) return 0;
  if (typeof input === 'number') {
    return Math.round(input);
  }

  const texto = String(input).trim();
  if (!texto) return 0;

  const isNegativo = texto.startsWith('-');

  // Remove caracteres que não sejam dígitos, vírgula ou ponto
  const limpo = texto.replace(/[^\d.,]/g, '');
  if (!limpo) return 0;

  // Se tiver vírgula e ponto, determinar qual é o separador decimal
  let valorFinalReais = 0;
  if (limpo.includes(',') && limpo.includes('.')) {
    // Ex: "1.234,56" -> ponto é milhar, vírgula é decimal
    const normalizado = limpo.replace(/\./g, '').replace(',', '.');
    valorFinalReais = parseFloat(normalizado) || 0;
  } else if (limpo.includes(',')) {
    // Ex: "1234,56"
    valorFinalReais = parseFloat(limpo.replace(',', '.')) || 0;
  } else if (limpo.includes('.')) {
    // Ex: "1234.56"
    valorFinalReais = parseFloat(limpo) || 0;
  } else {
    // Apenas dígitos inteiros
    valorFinalReais = parseInt(limpo, 10) || 0;
  }

  const centavos = Math.round(valorFinalReais * 100);
  return isNegativo ? -centavos : centavos;
}

/**
 * Trata entrada contínua de digitação de moeda (ex: digita 1500 -> R$ 15,00)
 */
export function aplicarMascaraCentavos(valorDigitado: string): { centavos: number; textoFormatado: string } {
  // Pega apenas os números digitados
  const numeros = valorDigitado.replace(/\D/g, '');
  if (!numeros) {
    return { centavos: 0, textoFormatado: 'R$ 0,00' };
  }

  const centavos = parseInt(numeros, 10);
  return {
    centavos,
    textoFormatado: formatarCentavos(centavos),
  };
}

/**
 * Calcula os totais e o saldo contábil de uma pessoa dentro do acerto
 * Lógica contábil transparente:
 * - Entradas: pagamentos efetuados ou recebidos
 * - Saídas: despesas pagas pela pessoa ou atribuídas a ela
 * - Adiantamentos: dinheiro adiantado/vales que a pessoa recebeu
 * - Materiais: gastos com insumos/materiais comprados
 * - Dívidas: pendências ('eu_devo' vs 'me_devem')
 * 
 * Fórmula do saldo do acerto com a pessoa:
 * Total que a pessoa recebeu adiantado (Adiantamentos) + Dívidas que ela me deve
 * MENOS
 * Total de despesas comprovadas pela pessoa (Saídas pagas por ela + Materiais comprados por ela) + Dívidas que eu devo a ela
 *
 * Se Saldo > 0: "Pessoa te deve R$ X" (ela pegou mais dinheiro adiantado do que comprovou em gastos)
 * Se Saldo < 0: "Você deve R$ X a Pessoa" (ela gastou mais do próprio bolso do que recebeu de adiantamento)
 * Se Saldo == 0: "Tudo quitado / Relação zerada"
 */
export function calcularTotaisPessoa(pessoa: PessoaTab, lancamentos: Lancamento[]): TotaisPessoa {
  const lancsPessoa = lancamentos.filter((l) => l.pessoaId === pessoa.id);

  let totalEntradasCentavos = 0;
  let totalSaidasCentavos = 0;
  let totalAdiantamentosCentavos = 0;
  let totalAdiantamentosAbatidosCentavos = 0;
  let totalMateriaisCentavos = 0;
  let totalDividasEuDevoCentavos = 0;
  let totalDividasMeDevemCentavos = 0;

  for (const l of lancsPessoa) {
    const valor = Math.abs(l.valorCentavos || 0);

    switch (l.tipo) {
      case 'entrada':
        totalEntradasCentavos += valor;
        break;
      case 'saida':
        totalSaidasCentavos += valor;
        break;
      case 'adiantamento':
        totalAdiantamentosCentavos += valor;
        totalAdiantamentosAbatidosCentavos += Math.abs(l.abatidoCentavos || 0);
        break;
      case 'material':
        totalMateriaisCentavos += valor;
        break;
      case 'divida':
        if (l.statusDivida === 'pendente') {
          if (l.direcaoDivida === 'eu_devo') {
            totalDividasEuDevoCentavos += valor;
          } else {
            totalDividasMeDevemCentavos += valor;
          }
        }
        break;
    }
  }

  const totalAdiantamentosPendentesCentavos = Math.max(0, totalAdiantamentosCentavos - totalAdiantamentosAbatidosCentavos);

  // Total gasto/comprovado pela pessoa
  const totalDespesasComprovadas = totalSaidasCentavos + totalMateriaisCentavos;
  
  // Saldo líquido da relação
  // (Adiantamentos recebidos pela pessoa + O que ela me deve) - (Despesas que ela pagou/comprovou + O que eu devo a ela)
  const saldoCentavos = (totalAdiantamentosCentavos + totalDividasMeDevemCentavos) - (totalDespesasComprovadas + totalDividasEuDevoCentavos);

  let statusRelacao: 'pessoa_deve' | 'usuario_deve' | 'quitado' = 'quitado';
  let fraseDestaque = `${pessoa.nome} está com as contas quitadas`;

  if (saldoCentavos > 0) {
    statusRelacao = 'pessoa_deve';
    fraseDestaque = `${pessoa.nome} te deve ${formatarCentavos(saldoCentavos)}`;
  } else if (saldoCentavos < 0) {
    statusRelacao = 'usuario_deve';
    fraseDestaque = `Você deve ${formatarCentavos(Math.abs(saldoCentavos))} a ${pessoa.nome}`;
  }

  return {
    totalEntradasCentavos,
    totalSaidasCentavos,
    totalAdiantamentosCentavos,
    totalAdiantamentosAbatidosCentavos,
    totalAdiantamentosPendentesCentavos,
    totalMateriaisCentavos,
    totalDividasEuDevoCentavos,
    totalDividasMeDevemCentavos,
    saldoCentavos,
    statusRelacao,
    fraseDestaque,
  };
}

/**
 * Calcula os totais consolidados da aba GERAL
 */
export function calcularTotaisGerais(pessoas: PessoaTab[], lancamentos: Lancamento[]): TotaisGerais {
  let totalEntradasCentavos = 0;
  let totalSaidasCentavos = 0;
  let totalAdiantamentosCentavos = 0;
  let totalMateriaisCentavos = 0;
  let totalDividasPendentesCentavos = 0;
  let pessoasEmDebito = 0;
  let pessoasEmCredito = 0;

  for (const l of lancamentos) {
    const valor = Math.abs(l.valorCentavos || 0);
    switch (l.tipo) {
      case 'entrada':
        totalEntradasCentavos += valor;
        break;
      case 'saida':
        totalSaidasCentavos += valor;
        break;
      case 'adiantamento':
        totalAdiantamentosCentavos += valor;
        break;
      case 'material':
        totalMateriaisCentavos += valor;
        break;
      case 'divida':
        if (l.statusDivida === 'pendente') {
          totalDividasPendentesCentavos += valor;
        }
        break;
    }
  }

  // Verifica situação de cada pessoa
  for (const p of pessoas) {
    const t = calcularTotaisPessoa(p, lancamentos);
    if (t.saldoCentavos > 0) {
      pessoasEmDebito++;
    } else if (t.saldoCentavos < 0) {
      pessoasEmCredito++;
    }
  }

  // Saldo geral do acerto: Total de Entradas - Total de Saídas (incluindo materiais e adiantamentos realizados)
  const totalDespesasGerais = totalSaidasCentavos + totalMateriaisCentavos + totalAdiantamentosCentavos;
  const saldoFinalCentavos = totalEntradasCentavos - totalDespesasGerais;

  return {
    totalEntradasCentavos,
    totalSaidasCentavos,
    totalAdiantamentosCentavos,
    totalMateriaisCentavos,
    totalDividasPendentesCentavos,
    saldoFinalCentavos,
    totalPessoas: pessoas.length,
    pessoasEmDebito,
    pessoasEmCredito,
  };
}

/**
 * Calcula a Divisão de Lucros do acerto:
 * REGRAS OBRIGATÓRIAS AUTOMATIZADAS:
 * 1. Entrada (Faturamento do Projeto): R$ 9.000,00 padrão (ou configurado/entradas registradas)
 * 2. Dedução automática de R$ 1.000,00 da Taxa de Projeto => Base de Cálculo Real = R$ 8.000,00
 * 3. Varre a lista de lançamentos e soma o valor total de gastos de saídas (saídas + materiais)
 * 4. Lucro Líquido Real = Base de Cálculo Real - Soma de Todas as Saídas
 * 5. Divisão automática em exatamente 50% para cada sócio: Neto e Victor
 * 6. REGRA AUTOMÁTICA DE ADIANTAMENTOS: Se um lançamento for adiantamento/vale alocado para o sócio "Neto"
 *    (ex: R$ 601,00 Itatiaia), o sistema subtrai esse valor AUTOMATICAMENTE e EXCLUSIVAMENTE do saldo final que o Neto tem a receber.
 *    Esse desconto pessoal NÃO diminui a Base de Cálculo do projeto e NÃO afeta o valor líquido que o Victor tem a receber.
 */
export function calcularDivisaoLucros(
  acerto: Acerto,
  lancamentos: Lancamento[],
  configCustom?: import('../types').ConfigDivisaoLucros
): import('../types').CalculoDivisaoLucros {
  const config = configCustom || acerto.configDivisaoLucros;

  // Soma de entradas, saídas e materiais lançados
  let totalEntradasLancadasCentavos = 0;
  let totalSaidasDespesasCentavos = 0;
  let totalMateriaisCentavos = 0;

  for (const l of lancamentos) {
    const valor = Math.abs(l.valorCentavos || 0);
    if (l.tipo === 'entrada') {
      totalEntradasLancadasCentavos += valor;
    } else if (l.tipo === 'saida') {
      totalSaidasDespesasCentavos += valor;
    } else if (l.tipo === 'material') {
      totalMateriaisCentavos += valor;
    }
  }

  // 1. Faturamento do Projeto:
  // Se o usuário marcou usarPrecoFixo ou informou um faturamento (> 0), usa o que ele definiu.
  // Caso contrário, calcula de forma 100% DINÂMICA a partir das entradas reais registradas!
  const isPrecoDefinidoPeloUsuario = config?.usarPrecoFixo === true || (config?.faturamentoProjetoCentavos !== undefined && config.faturamentoProjetoCentavos > 0);

  let faturamentoProjetoCentavos = 0;
  let taxaProjetoCentavos = 0;

  if (isPrecoDefinidoPeloUsuario) {
    faturamentoProjetoCentavos = config?.faturamentoProjetoCentavos ?? 0;
    taxaProjetoCentavos = config?.taxaProjetoCentavos ?? 0;
  } else {
    // 100% DINÂMICO
    faturamentoProjetoCentavos = totalEntradasLancadasCentavos;
    taxaProjetoCentavos = config?.taxaProjetoCentavos ?? 0;
  }

  // Base de Cálculo Real = Faturamento - Taxa de Projeto
  const baseCalculoRealCentavos = Math.max(0, faturamentoProjetoCentavos - taxaProjetoCentavos);

  // Soma de Todas as Saídas (despesas operacionais + materiais da lista, sem adiantamentos pessoais)
  const somaTodasSaidasCentavos = totalSaidasDespesasCentavos + totalMateriaisCentavos;

  // 4. Lucro Líquido Real = Base de Cálculo Real - Soma de Todas as Saídas
  const lucroBrutoCentavos = baseCalculoRealCentavos - somaTodasSaidasCentavos;
  const isLucroPositivo = lucroBrutoCentavos > 0;

  const reservaPorcentagem = config?.reservaEmergenciaPorcentagem || 0;
  const reservaEmergenciaCentavos = isLucroPositivo && reservaPorcentagem > 0
    ? Math.round((lucroBrutoCentavos * reservaPorcentagem) / 100)
    : 0;

  const lucroLiquidoDistribuivelCentavos = isLucroPositivo
    ? Math.max(0, lucroBrutoCentavos - reservaEmergenciaCentavos)
    : 0;

  const margemLucroPercentual = faturamentoProjetoCentavos > 0
    ? Number(((lucroBrutoCentavos / faturamentoProjetoCentavos) * 100).toFixed(1))
    : 0;

  // 5. Configurar participantes: distribui igualmente entre as pessoas deste acerto
  let participantesConfig: ParticipanteLucro[] = config?.participantes || [];
  if (participantesConfig.length === 0 && acerto.pessoas && acerto.pessoas.length > 0) {
    const pct = Math.floor(100 / acerto.pessoas.length);
    const resto = 100 - (pct * acerto.pessoas.length);
    participantesConfig = acerto.pessoas.map((p, idx) => ({
      id: 'part_' + p.id,
      pessoaId: p.id,
      nome: p.nome,
      porcentagem: idx === 0 ? pct + resto : pct,
      descontarAdiantamentos: true,
    }));
  }

  let totalPorcentagemAlocada = 0;
  const participantesCalculados: ParticipanteLucroCalculado[] = participantesConfig.map((p: ParticipanteLucro) => {
    totalPorcentagemAlocada += p.porcentagem;

    // Cota bruta baseada na porcentagem da pessoa do Lucro Líquido
    const cotaBrutaCentavos = isLucroPositivo
      ? Math.round((lucroLiquidoDistribuivelCentavos * p.porcentagem) / 100)
      : 0;

    // 6. REGRA DINÂMICA DE ADIANTAMENTOS:
    // Abate os vales destinados exclusivamente a esta pessoa específica
    let adiantamentosAbatidosCentavos = 0;
    if (p.descontarAdiantamentos !== false) {
      const pNome = (p.nome || '').toLowerCase().trim();
      for (const l of lancamentos) {
        if (l.tipo === 'adiantamento') {
          const lNomePessoa = acerto.pessoas.find((pes) => pes.id === l.pessoaId)?.nome.toLowerCase().trim() || '';
          const matchId = (p.pessoaId && l.pessoaId === p.pessoaId) || l.pessoaId === p.id;
          const matchNome = pNome && (lNomePessoa.includes(pNome) || (l.descricao && l.descricao.toLowerCase().includes(pNome)));
          
          if (matchId || matchNome) {
            adiantamentosAbatidosCentavos += Math.abs(l.valorCentavos || 0);
          }
        }
      }
    }

    const valorLiquidoAReceberCentavos = cotaBrutaCentavos - adiantamentosAbatidosCentavos;

    let status: 'a_receber' | 'zerado' | 'adiantou_mais_que_lucro' = 'zerado';
    if (valorLiquidoAReceberCentavos > 0) {
      status = 'a_receber';
    } else if (valorLiquidoAReceberCentavos < 0) {
      status = 'adiantou_mais_que_lucro';
    }

    return {
      id: p.id,
      pessoaId: p.pessoaId,
      nome: p.nome,
      porcentagem: p.porcentagem,
      cotaBrutaCentavos,
      adiantamentosAbatidosCentavos,
      valorLiquidoAReceberCentavos,
      status,
    };
  });

  return {
    faturamentoProjetoCentavos,
    taxaProjetoCentavos,
    baseCalculoRealCentavos,
    somaTodasSaidasCentavos,
    totalEntradasCentavos: faturamentoProjetoCentavos,
    totalSaidasCentavos: somaTodasSaidasCentavos,
    totalCustosCentavos: somaTodasSaidasCentavos,
    lucroBrutoCentavos,
    reservaEmergenciaCentavos,
    reservaPorcentagem,
    lucroLiquidoDistribuivelCentavos,
    margemLucroPercentual,
    isLucroPositivo,
    participantes: participantesCalculados,
    totalPorcentagemAlocada,
  };
}

export interface TransacaoResolucao {
  id: string;
  devedor: string;
  credor: string;
  valorCentavos: number;
  motivo: string;
}

export interface BalancoPessoaResolucao {
  pessoaId: string;
  nome: string;
  cor?: string;
  gastosPagosCentavos: number;
  adiantamentosPegosCentavos: number;
  saldoDiretoCentavos: number; // adiantamentos - gastos
  cotaEntradasCentavos: number;
  saldoFinalAReceberCentavos: number;
  status: 'recebe' | 'paga' | 'quitado';
  descricaoStatus: string;
}

export interface ResolucaoAcertoContas {
  totalEntradasCentavos: number;
  totalGastosCentavos: number;
  sobraOuDeficitCentavos: number;
  temEntradas: boolean;
  balancoPorPessoa: BalancoPessoaResolucao[];
  transacoes: TransacaoResolucao[];
  textoWhatsApp: string;
}

/**
 * Calcula a resolução direta e sem complicação de um acerto de contas:
 * "Fulano deve pagar R$ X para Ciclano"
 * Elimina o conceito de "sócio" forçado, tabelas vazias e mostra a conta real.
 */
export function calcularResolucaoAcerto(acerto: Acerto, lancamentos: Lancamento[]): ResolucaoAcertoContas {
  const pessoas = acerto.pessoas || [];
  const numPessoas = pessoas.length;

  let totalEntradasCentavos = 0;
  let totalGastosGeraisCentavos = 0;

  lancamentos.forEach((l) => {
    const v = Math.abs(l.valorCentavos || 0);
    if (l.tipo === 'entrada') {
      totalEntradasCentavos += v;
    } else {
      totalGastosGeraisCentavos += v;
    }
  });

  const sobraOuDeficitCentavos = totalEntradasCentavos - totalGastosGeraisCentavos;
  const temEntradas = totalEntradasCentavos > 0;

  // Calcula quanto cada pessoa movimentou
  const balancoPessoasRaw = pessoas.map((p) => {
    const lancsPessoa = lancamentos.filter((l) => l.pessoaId === p.id);
    let entradasPessoa = 0;
    let saidasPessoa = 0;
    let adiantamentosPessoa = 0;

    lancsPessoa.forEach((l) => {
      const v = Math.abs(l.valorCentavos || 0);
      if (l.tipo === 'entrada') {
        entradasPessoa += v;
      } else if (l.tipo === 'saida' || l.tipo === 'material') {
        saidasPessoa += v;
      } else if (l.tipo === 'adiantamento') {
        adiantamentosPessoa += v;
      }
    });

    // Total que a pessoa colocou ou enviou para o acerto
    const totalColocado = entradasPessoa + saidasPessoa;
    return {
      pessoa: p,
      entradasPessoa,
      saidasPessoa,
      adiantamentosPessoa,
      totalColocado,
    };
  });

  const transacoes: TransacaoResolucao[] = [];
  let balancoPorPessoa: BalancoPessoaResolucao[] = [];

  // CASO 1: EXATAMENTE DUAS PESSOAS (ex: Regina e Maninho, ou Neto e Victor)
  // Conta direta: Quem passou dinheiro vs Quem devolveu/gastou
  if (numPessoas === 2) {
    const p1 = balancoPessoasRaw[0];
    const p2 = balancoPessoasRaw[1];

    // Se uma pessoa enviou entradas e a outra enviou saídas/pix (caso clássico de empréstimo/repasse)
    // Ex: Regina colocou 3.844,45 e Maninho mandou 1.500,00 de volta
    const diferencaCentavos = Math.abs(p1.totalColocado - p2.totalColocado);

    let devedor = '';
    let credor = '';
    let saldoP1 = 0;
    let saldoP2 = 0;

    if (p1.totalColocado > p2.totalColocado) {
      // P1 colocou mais dinheiro (credor), P2 pegou mais ou devolveu menos (devedor)
      devedor = p2.pessoa.nome;
      credor = p1.pessoa.nome;
      saldoP1 = diferencaCentavos;
      saldoP2 = -diferencaCentavos;
      if (diferencaCentavos > 50) {
        transacoes.push({
          id: `trans_direta_1_2`,
          devedor: p2.pessoa.nome,
          credor: p1.pessoa.nome,
          valorCentavos: diferencaCentavos,
          motivo: `Diferença de repasses: ${p1.pessoa.nome} passou ${formatarCentavos(p1.totalColocado)} e ${p2.pessoa.nome} repassou ${formatarCentavos(p2.totalColocado)}`,
        });
      }
    } else if (p2.totalColocado > p1.totalColocado) {
      // P2 colocou mais dinheiro (credor), P1 é devedor
      devedor = p1.pessoa.nome;
      credor = p2.pessoa.nome;
      saldoP1 = -diferencaCentavos;
      saldoP2 = diferencaCentavos;
      if (diferencaCentavos > 50) {
        transacoes.push({
          id: `trans_direta_2_1`,
          devedor: p1.pessoa.nome,
          credor: p2.pessoa.nome,
          valorCentavos: diferencaCentavos,
          motivo: `Diferença de repasses: ${p2.pessoa.nome} passou ${formatarCentavos(p2.totalColocado)} e ${p1.pessoa.nome} repassou ${formatarCentavos(p1.totalColocado)}`,
        });
      }
    }

    balancoPorPessoa = [
      {
        pessoaId: p1.pessoa.id,
        nome: p1.pessoa.nome,
        cor: p1.pessoa.cor,
        gastosPagosCentavos: p1.saidasPessoa,
        adiantamentosPegosCentavos: p1.adiantamentosPessoa,
        saldoDiretoCentavos: saldoP1,
        cotaEntradasCentavos: p1.entradasPessoa,
        saldoFinalAReceberCentavos: saldoP1,
        status: saldoP1 > 50 ? 'recebe' : saldoP1 < -50 ? 'paga' : 'quitado',
        descricaoStatus: saldoP1 > 50 ? `Tem a receber ${formatarCentavos(saldoP1)}` : saldoP1 < -50 ? `Deve pagar ${formatarCentavos(Math.abs(saldoP1))}` : 'Quitado',
      },
      {
        pessoaId: p2.pessoa.id,
        nome: p2.pessoa.nome,
        cor: p2.pessoa.cor,
        gastosPagosCentavos: p2.saidasPessoa,
        adiantamentosPegosCentavos: p2.adiantamentosPessoa,
        saldoDiretoCentavos: saldoP2,
        cotaEntradasCentavos: p2.entradasPessoa,
        saldoFinalAReceberCentavos: saldoP2,
        status: saldoP2 > 50 ? 'recebe' : saldoP2 < -50 ? 'paga' : 'quitado',
        descricaoStatus: saldoP2 > 50 ? `Tem a receber ${formatarCentavos(saldoP2)}` : saldoP2 < -50 ? `Deve pagar ${formatarCentavos(Math.abs(saldoP2))}` : 'Quitado',
      },
    ];
  } else {
    // CASO GERAL: 1 pessoa (obra com prestador) ou mais de 2 pessoas
    balancoPorPessoa = balancoPessoasRaw.map((item) => {
      let saldo = 0;
      if (item.entradasPessoa > 0) {
        // Entradas da pessoa menos o que ela já recebeu/gastou
        saldo = item.totalColocado - item.adiantamentosPessoa;
      } else {
        // Gastos pagos do bolso menos adiantamentos pegos
        saldo = item.saidasPessoa - item.adiantamentosPessoa;
      }

      let status: 'recebe' | 'paga' | 'quitado' = 'quitado';
      let descricaoStatus = 'Quitado';

      if (saldo > 50) {
        status = 'recebe';
        descricaoStatus = `Tem a receber ${formatarCentavos(saldo)}`;
      } else if (saldo < -50) {
        status = 'paga';
        descricaoStatus = `Deve pagar/acertar ${formatarCentavos(Math.abs(saldo))}`;
      }

      return {
        pessoaId: item.pessoa.id,
        nome: item.pessoa.nome,
        cor: item.pessoa.cor,
        gastosPagosCentavos: item.saidasPessoa,
        adiantamentosPegosCentavos: item.adiantamentosPessoa,
        saldoDiretoCentavos: saldo,
        cotaEntradasCentavos: item.entradasPessoa,
        saldoFinalAReceberCentavos: saldo,
        status,
        descricaoStatus,
      };
    });

    // Gera transações diretas
    const quemDeve = balancoPorPessoa.filter((b) => b.saldoFinalAReceberCentavos < -50);
    const quemRecebe = balancoPorPessoa.filter((b) => b.saldoFinalAReceberCentavos > 50);

    if (quemDeve.length > 0 && quemRecebe.length > 0) {
      let i = 0, j = 0;
      let devTemp = quemDeve.map((d) => ({ ...d, rest: Math.abs(d.saldoFinalAReceberCentavos) }));
      let credTemp = quemRecebe.map((c) => ({ ...c, rest: c.saldoFinalAReceberCentavos }));

      while (i < devTemp.length && j < credTemp.length) {
        const d = devTemp[i];
        const c = credTemp[j];
        const val = Math.min(d.rest, c.rest);
        if (val > 50) {
          transacoes.push({
            id: `trans_${i}_${j}`,
            devedor: d.nome,
            credor: c.nome,
            valorCentavos: val,
            motivo: `Acerto direto de repasses e despesas`,
          });
        }
        d.rest -= val;
        c.rest -= val;
        if (d.rest < 50) i++;
        if (c.rest < 50) j++;
      }
    } else if (quemRecebe.length > 0) {
      quemRecebe.forEach((c, idx) => {
        transacoes.push({
          id: `trans_obra_${idx}`,
          devedor: 'Caixa / Obra',
          credor: c.nome,
          valorCentavos: c.saldoFinalAReceberCentavos,
          motivo: `Reembolso / Pagamento do saldo a receber`,
        });
      });
    } else if (quemDeve.length > 0) {
      quemDeve.forEach((d, idx) => {
        transacoes.push({
          id: `trans_dev_${idx}`,
          devedor: d.nome,
          credor: 'Caixa / Obra',
          valorCentavos: Math.abs(d.saldoFinalAReceberCentavos),
          motivo: `Devolução de adiantamento excedente`,
        });
      });
    }
  }

  // Gera texto para WhatsApp
  const dataHoje = new Date().toLocaleDateString('pt-BR');
  let textoWhats = `📋 *ACERTO DE CONTAS: ${acerto.titulo.toUpperCase()}*\n`;
  textoWhats += `📅 Data: ${dataHoje}\n\n`;

  textoWhats += `💰 *Movimentações Registradas:*\n`;
  balancoPorPessoa.forEach((b) => {
    const raw = balancoPessoasRaw.find(p => p.pessoa.id === b.pessoaId);
    textoWhats += `• *${b.nome}:* ${formatarCentavos(raw?.totalColocado || 0)} movimentados\n`;
  });
  textoWhats += `\n`;

  if (transacoes.length > 0) {
    textoWhats += `🤝 *FECHAMENTO (QUEM DEVE A QUEM):*\n`;
    transacoes.forEach((t) => {
      textoWhats += `👉 *${t.devedor}* DEVE PAGAR *${formatarCentavos(t.valorCentavos)}* PARA *${t.credor}*\n`;
    });
  } else {
    textoWhats += `✅ *Contas quitadas e equilibradas!*\n`;
  }

  if (acerto.observacoes) {
    textoWhats += `\n📝 *Observações:*\n${acerto.observacoes}\n`;
  }

  return {
    totalEntradasCentavos,
    totalGastosCentavos: totalGastosGeraisCentavos,
    sobraOuDeficitCentavos,
    temEntradas,
    balancoPorPessoa,
    transacoes,
    textoWhatsApp: textoWhats.trim(),
  };
}

