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

  // 5. Configurar sócios padrão: Neto (50%) e Victor (50%) se não configurado
  let participantesConfig: ParticipanteLucro[] = config?.participantes || [];
  if (participantesConfig.length === 0) {
    // Procura pessoas com nomes similares no acerto ou cria os 2 sócios padrão
    const pessoaNeto = acerto.pessoas.find((p) => p.nome.toLowerCase().includes('neto'));
    const pessoaVictor = acerto.pessoas.find((p) => p.nome.toLowerCase().includes('victor'));

    participantesConfig = [
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
  }

  let totalPorcentagemAlocada = 0;
  const participantesCalculados: ParticipanteLucroCalculado[] = participantesConfig.map((p: ParticipanteLucro) => {
    totalPorcentagemAlocada += p.porcentagem;

    // Cota bruta baseada em 50% (ou na porcentagem do sócio) do Lucro Líquido Real
    const cotaBrutaCentavos = isLucroPositivo
      ? Math.round((lucroLiquidoDistribuivelCentavos * p.porcentagem) / 100)
      : 0;

    // 6. REGRA AUTOMÁTICA DE ADIANTAMENTOS:
    // Se o sócio for "Neto" (ou qualquer com descontarAdiantamentos = true),
    // somamos todos os adiantamentos / vales destinados a ele (ex: R$ 601,00 Itatiaia).
    // Esse desconto é AUTOMÁTICO e EXCLUSIVO dele e NÃO afeta o saldo de Victor ou a Base do projeto.
    let adiantamentosAbatidosCentavos = 0;
    if (p.descontarAdiantamentos !== false) {
      const pNome = p.nome.toLowerCase().trim();
      for (const l of lancamentos) {
        if (l.tipo === 'adiantamento') {
          const lNomePessoa = acerto.pessoas.find((pes) => pes.id === l.pessoaId)?.nome.toLowerCase().trim() || '';
          const matchId = (p.pessoaId && l.pessoaId === p.pessoaId) || l.pessoaId === p.id;
          const matchNome = (pNome.includes('neto') && (lNomePessoa.includes('neto') || l.descricao.toLowerCase().includes('neto'))) ||
                            (pNome.includes('victor') && (lNomePessoa.includes('victor') || l.descricao.toLowerCase().includes('victor')));
          
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

