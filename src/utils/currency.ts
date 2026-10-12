/**
 * Utilitários para manuseio rigoroso de valores financeiros em CENTAVOS (números inteiros).
 * Garante precisão absoluta eliminando erros de arredondamento IEEE-754.
 */

import { Lancamento, TotaisPessoa, TotaisGerais, PessoaTab } from '../types';

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
