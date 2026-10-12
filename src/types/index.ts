/**
 * Modelos de dados e tipos contábeis para o AcertoFácil
 * Todos os valores monetários são obrigatoriamente guardados em CENTAVOS (números inteiros)
 * Ex: R$ 1.234,56 => 123456 centavos
 */

export type StatusAcerto = 'aberto' | 'fechado' | 'arquivado';

export type TipoLancamento = 'entrada' | 'saida' | 'adiantamento' | 'material' | 'divida';

export type FormaPagamento = 'Pix' | 'Dinheiro' | 'Transferência' | 'Cartão de Débito' | 'Cartão de Crédito' | 'Boleto' | 'Cheque' | 'Outro';

export type DirecaoDivida = 'eu_devo' | 'me_devem';

export type StatusDivida = 'pendente' | 'paga';

export type NivelConfianca = 'alta' | 'baixa';

export interface PessoaTab {
  id: string;
  nome: string;
  cor?: string;
  telefone?: string;
  papel?: string; // ex: Funcionário, Fornecedor, Parceiro, Pedreiro, Cliente
  ordem: number;
}

export interface ParticipanteLucro {
  id: string;
  pessoaId?: string; // Vinculação opcional com PessoaTab
  nome: string;
  porcentagem: number; // Porcentagem do lucro (ex: 50 para 50%)
  descontarAdiantamentos?: boolean; // Se deve abater adiantamentos já pegos
}

export interface ConfigDivisaoLucros {
  reservaEmergenciaPorcentagem: number; // ex: 0 a 50 (%) retido para reinvestimento/fundo de caixa
  participantes: ParticipanteLucro[];
  observacoes?: string;
}

export interface Acerto {
  id: string;
  titulo: string;
  dataInicio: string; // YYYY-MM-DD
  status: StatusAcerto;
  observacoes: string;
  pessoas: PessoaTab[];
  categorias: string[];
  configDivisaoLucros?: ConfigDivisaoLucros;
  createdAt: string;
  updatedAt: string;
}

export interface Lancamento {
  id: string;
  acertoId: string;
  pessoaId: string; // id de PessoaTab ou 'geral'
  tipo: TipoLancamento;
  data: string; // YYYY-MM-DD
  descricao: string;
  valorCentavos: number; // CENTAVOS (ex: 15000 = R$ 150,00)
  
  // Específico para 'entrada'
  formaPagamento?: FormaPagamento;

  // Específico para 'saida'
  categoria?: string;
  quemPagou?: string; // Nome de quem realizou o pagamento

  // Específico para 'adiantamento'
  abatidoCentavos?: number; // Quanto já foi abatido
  observacaoAdiantamento?: string;

  // Específico para 'material'
  item?: string;
  quantidade?: number;
  valorUnitarioCentavos?: number;
  loja?: string;

  // Específico para 'divida'
  vencimento?: string; // YYYY-MM-DD
  statusDivida?: StatusDivida;
  direcaoDivida?: DirecaoDivida; // 'eu_devo' ou 'me_devem'

  // Vinculação com imagem
  imagemId?: string;
  confianca?: NivelConfianca;

  createdAt: string;
  updatedAt: string;
}

export interface ImagemComprovante {
  id: string;
  acertoId: string;
  pessoaId: string;
  dataUrl: string; // Base64 compactado
  hash: string; // Hash para detectar imagem duplicada
  nomeArquivo: string;
  tamanhoBytes: number;
  tipoDocumentoIdentificado?: string;
  totalEscritoCentavos?: number;
  totalCalculadoCentavos?: number;
  observacoes?: string;
  lancamentosGeradosIds: string[];
  createdAt: string;
}

export interface HistoricoItem {
  id: string;
  acertoId: string;
  pessoaId?: string;
  acao: 'criacao' | 'edicao' | 'exclusao' | 'upload_imagem' | 'status_alterado';
  tipoItem: 'acerto' | 'pessoa' | 'lancamento' | 'imagem';
  detalhes: string;
  dadosAnteriores?: any;
  timestamp: string;
}

export interface LinhaConferenciaOCR {
  id: string; // temporário
  data: string;
  descricao: string;
  quantidade: number;
  valorCentavos: number;
  valorOriginalTexto?: string;
  tipoSugerido: TipoLancamento;
  categoria: string;
  formaPagamento?: FormaPagamento;
  pessoaId: string;
  pessoaSugeridaNome?: string;
  confianca: NivelConfianca;
  loja?: string;
  dividaDeQuem?: DirecaoDivida;
  incluir: boolean;
}

export interface ResultadoOCR {
  tipoDocumento: string;
  totalEscritoNaAnotacaoCentavos?: number;
  totalEscritoFormatado?: string;
  estabelecimentoOuLoja?: string;
  dataGeral?: string;
  pessoaSugeridaGeral?: string;
  observacoes?: string;
  linhas: Array<{
    data?: string;
    descricao: string;
    quantidade?: number;
    valorUnitarioCentavos?: number;
    valorCentavos: number;
    valorOriginalTexto?: string;
    tipoSugerido: TipoLancamento;
    categoria?: string;
    formaPagamento?: string;
    pessoaSugerida?: string;
    confianca: NivelConfianca;
    loja?: string;
    dividaDeQuem?: DirecaoDivida;
  }>;
}

export interface TotaisPessoa {
  totalEntradasCentavos: number;
  totalSaidasCentavos: number;
  totalAdiantamentosCentavos: number;
  totalAdiantamentosAbatidosCentavos: number;
  totalAdiantamentosPendentesCentavos: number;
  totalMateriaisCentavos: number;
  totalDividasEuDevoCentavos: number;
  totalDividasMeDevemCentavos: number;
  saldoCentavos: number; // Saldo da relação financeira
  statusRelacao: 'pessoa_deve' | 'usuario_deve' | 'quitado';
  fraseDestaque: string;
}

export interface TotaisGerais {
  totalEntradasCentavos: number;
  totalSaidasCentavos: number;
  totalAdiantamentosCentavos: number;
  totalMateriaisCentavos: number;
  totalDividasPendentesCentavos: number;
  saldoFinalCentavos: number;
  totalPessoas: number;
  pessoasEmDebito: number;
  pessoasEmCredito: number;
}

export interface ParticipanteLucroCalculado {
  id: string;
  pessoaId?: string;
  nome: string;
  porcentagem: number;
  cotaBrutaCentavos: number;
  adiantamentosAbatidosCentavos: number;
  valorLiquidoAReceberCentavos: number;
  status: 'a_receber' | 'zerado' | 'adiantou_mais_que_lucro';
}

export interface CalculoDivisaoLucros {
  totalEntradasCentavos: number; // Receita Total
  totalSaidasCentavos: number; // Despesas / Saídas totais (saídas + materiais)
  totalCustosCentavos: number;
  lucroBrutoCentavos: number; // Entradas - Saídas
  reservaEmergenciaCentavos: number;
  reservaPorcentagem: number;
  lucroLiquidoDistribuivelCentavos: number;
  margemLucroPercentual: number;
  isLucroPositivo: boolean;
  participantes: ParticipanteLucroCalculado[];
  totalPorcentagemAlocada: number;
}
