import React, { useState, useEffect } from 'react';
import { X, Check, DollarSign, Calendar, Tag, User, Layers, Store, Clock } from 'lucide-react';
import { Lancamento, TipoLancamento, FormaPagamento, StatusDivida, DirecaoDivida, PessoaTab, Acerto } from '../types';
import { formatarCentavos, parseValorParaCentavos, formatarCentavosSemSimbolo } from '../utils/currency';

interface LancamentoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  acerto: Acerto;
  pessoaAtualId: string;
  tipoPreSelecionado?: TipoLancamento;
  lancamentoEmEdicao?: Lancamento | null;
  onSalvar: (lancamento: Lancamento) => Promise<void>;
  onDuplicar?: (lancamento: Lancamento) => Promise<void>;
}

export const LancamentoFormModal: React.FC<LancamentoFormModalProps> = ({
  isOpen,
  onClose,
  acerto,
  pessoaAtualId,
  tipoPreSelecionado = 'saida',
  lancamentoEmEdicao = null,
  onSalvar,
  onDuplicar,
}) => {
  const [tipo, setTipo] = useState<TipoLancamento>(tipoPreSelecionado);
  const [pessoaId, setPessoaId] = useState<string>(pessoaAtualId);
  const [data, setData] = useState<string>(new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState<string>('');
  const [valorTexto, setValorTexto] = useState<string>('0,00');

  // Campos específicos
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('Pix');
  const [categoria, setCategoria] = useState<string>('Mão de Obra');
  const [quemPagou, setQuemPagou] = useState<string>('');

  const [abatidoTexto, setAbatidoTexto] = useState<string>('0,00');
  const [observacaoAdiantamento, setObservacaoAdiantamento] = useState<string>('');

  const [item, setItem] = useState<string>('');
  const [quantidade, setQuantidade] = useState<number>(1);
  const [valorUnitarioTexto, setValorUnitarioTexto] = useState<string>('0,00');
  const [loja, setLoja] = useState<string>('');

  const [vencimento, setVencimento] = useState<string>('');
  const [statusDivida, setStatusDivida] = useState<StatusDivida>('pendente');
  const [direcaoDivida, setDirecaoDivida] = useState<DirecaoDivida>('eu_devo');

  const [isSalvando, setIsSalvando] = useState(false);

  useEffect(() => {
    if (lancamentoEmEdicao) {
      setTipo(lancamentoEmEdicao.tipo);
      setPessoaId(lancamentoEmEdicao.pessoaId);
      setData(lancamentoEmEdicao.data);
      setDescricao(lancamentoEmEdicao.descricao);
      setValorTexto(formatarCentavosSemSimbolo(lancamentoEmEdicao.valorCentavos));
      setFormaPagamento(lancamentoEmEdicao.formaPagamento || 'Pix');
      setCategoria(lancamentoEmEdicao.categoria || acerto.categorias[0] || 'Geral');
      setQuemPagou(lancamentoEmEdicao.quemPagou || '');
      setAbatidoTexto(formatarCentavosSemSimbolo(lancamentoEmEdicao.abatidoCentavos || 0));
      setObservacaoAdiantamento(lancamentoEmEdicao.observacaoAdiantamento || '');
      setItem(lancamentoEmEdicao.item || lancamentoEmEdicao.descricao);
      setQuantidade(lancamentoEmEdicao.quantidade || 1);
      setValorUnitarioTexto(formatarCentavosSemSimbolo(lancamentoEmEdicao.valorUnitarioCentavos || lancamentoEmEdicao.valorCentavos));
      setLoja(lancamentoEmEdicao.loja || '');
      setVencimento(lancamentoEmEdicao.vencimento || '');
      setStatusDivida(lancamentoEmEdicao.statusDivida || 'pendente');
      setDirecaoDivida(lancamentoEmEdicao.direcaoDivida || 'eu_devo');
    } else {
      setTipo(tipoPreSelecionado);
      setPessoaId(pessoaAtualId);
      setData(new Date().toISOString().slice(0, 10));
      setDescricao('');
      setValorTexto('0,00');
      setFormaPagamento('Pix');
      setCategoria(acerto.categorias[0] || 'Mão de Obra');
      setQuemPagou('');
      setAbatidoTexto('0,00');
      setObservacaoAdiantamento('');
      setItem('');
      setQuantidade(1);
      setValorUnitarioTexto('0,00');
      setLoja('');
      setVencimento(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
      setStatusDivida('pendente');
      setDirecaoDivida('eu_devo');
    }
  }, [lancamentoEmEdicao, tipoPreSelecionado, pessoaAtualId, isOpen, acerto.categorias]);

  if (!isOpen) return null;

  // Atualizar total do material quando mudar unitário ou quantidade
  const handleMudarUnitarioOuQtd = (novaQtd: number, novoUnitarioStr: string) => {
    setQuantidade(novaQtd);
    setValorUnitarioTexto(novoUnitarioStr);
    const unitCentavos = parseValorParaCentavos(novoUnitarioStr);
    if (unitCentavos > 0 && novaQtd > 0) {
      setValorTexto(formatarCentavosSemSimbolo(unitCentavos * novaQtd));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim() && !item.trim()) {
      alert('Por favor, informe a descrição do lançamento.');
      return;
    }

    const valorCentavos = parseValorParaCentavos(valorTexto);
    if (valorCentavos <= 0) {
      alert('O valor precisa ser maior que zero.');
      return;
    }

    setIsSalvando(true);
    try {
      const id = lancamentoEmEdicao ? lancamentoEmEdicao.id : 'lanc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

      const novoLancamento: Lancamento = {
        id,
        acertoId: acerto.id,
        pessoaId,
        tipo,
        data,
        descricao: tipo === 'material' && item.trim() ? item.trim() : descricao.trim(),
        valorCentavos,
        formaPagamento: tipo === 'entrada' ? formaPagamento : undefined,
        categoria: tipo === 'saida' ? categoria : undefined,
        quemPagou: tipo === 'saida' ? quemPagou.trim() || undefined : undefined,
        abatidoCentavos: tipo === 'adiantamento' ? parseValorParaCentavos(abatidoTexto) : undefined,
        observacaoAdiantamento: tipo === 'adiantamento' ? observacaoAdiantamento.trim() || undefined : undefined,
        item: tipo === 'material' ? (item.trim() || descricao.trim()) : undefined,
        quantidade: tipo === 'material' ? quantidade : undefined,
        valorUnitarioCentavos: tipo === 'material' ? parseValorParaCentavos(valorUnitarioTexto) : undefined,
        loja: tipo === 'material' ? loja.trim() || undefined : undefined,
        vencimento: tipo === 'divida' ? vencimento : undefined,
        statusDivida: tipo === 'divida' ? statusDivida : undefined,
        direcaoDivida: tipo === 'divida' ? direcaoDivida : undefined,
        imagemId: lancamentoEmEdicao?.imagemId,
        confianca: lancamentoEmEdicao?.confianca || 'alta',
        createdAt: lancamentoEmEdicao?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSalvar(novoLancamento);
      onClose();
    } catch (err: any) {
      alert('Erro ao salvar lançamento: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {lancamentoEmEdicao ? 'Editar Lançamento' : 'Novo Lançamento Manual'}
            </h3>
            <p className="text-xs text-slate-500">
              Lançamentos salvam e recalculam os totais imediatamente em centavos
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {/* Seletor do Tipo / Sub-aba */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1.5">
              Tipo do Lançamento
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {(
                [
                  { id: 'entrada', label: 'Entrada', cor: 'border-emerald-500 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40' },
                  { id: 'saida', label: 'Saída', cor: 'border-rose-500 text-rose-700 bg-rose-50 dark:bg-rose-950/40' },
                  { id: 'adiantamento', label: 'Adiantamento', cor: 'border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/40' },
                  { id: 'material', label: 'Material', cor: 'border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950/40' },
                  { id: 'divida', label: 'Dívida', cor: 'border-purple-500 text-purple-700 bg-purple-50 dark:bg-purple-950/40' },
                ] as const
              ).map((itemTipo) => (
                <button
                  key={itemTipo.id}
                  type="button"
                  onClick={() => setTipo(itemTipo.id)}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition cursor-pointer ${
                    tipo === itemTipo.id
                      ? `${itemTipo.cor} ring-2 ring-emerald-500 shadow-xs`
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {itemTipo.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pessoa e Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pessoa / Aba do Acerto
              </label>
              <select
                value={pessoaId}
                onChange={(e) => setPessoaId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              >
                {acerto.pessoas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} {p.papel ? `(${p.papel})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data do Registro
              </label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Descrição e Valor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {tipo === 'material' ? 'Item / Material' : 'Descrição'}
              </label>
              <input
                type="text"
                value={tipo === 'material' ? item : descricao}
                onChange={(e) => {
                  if (tipo === 'material') {
                    setItem(e.target.value);
                    setDescricao(e.target.value);
                  } else {
                    setDescricao(e.target.value);
                  }
                }}
                placeholder={
                  tipo === 'adiantamento'
                    ? 'Ex: Vale semanal repassado em dinheiro'
                    : tipo === 'material'
                    ? 'Ex: Cimento CP-II 50kg'
                    : 'Ex: Almoço da equipe de pedreiros'
                }
                required
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Valor Total (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                <input
                  type="text"
                  value={valorTexto}
                  onChange={(e) => setValorTexto(e.target.value)}
                  placeholder="0,00"
                  required
                  className="w-full text-right font-mono font-bold text-sm pl-8 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* CAMPOS ESPECÍFICOS DE CADA SUB-ABA */}

          {/* 1. ENTRADA */}
          {tipo === 'entrada' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Forma de Pagamento
              </label>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="Pix">Pix</option>
                <option value="Dinheiro">Dinheiro em Espécie</option>
                <option value="Transferência">Transferência Bancária (TED/DOC)</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Boleto">Boleto Bancário</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          )}

          {/* 2. SAÍDA */}
          {tipo === 'saida' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Categoria
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  {acerto.categorias.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Quem Pagou?
                </label>
                <input
                  type="text"
                  value={quemPagou}
                  onChange={(e) => setQuemPagou(e.target.value)}
                  placeholder="Nome de quem pagou do próprio bolso"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* 3. ADIANTAMENTO */}
          {tipo === 'adiantamento' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
              <div>
                <label className="block text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">
                  Quanto Já Foi Abatido? (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="text"
                    value={abatidoTexto}
                    onChange={(e) => setAbatidoTexto(e.target.value)}
                    placeholder="0,00"
                    className="w-full text-right font-mono font-bold text-sm pl-8 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">
                  Saldo Restante a Abater
                </label>
                <div className="px-3 py-2 text-sm font-bold font-mono text-amber-700 dark:text-amber-300 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800">
                  {formatarCentavos(
                    Math.max(0, parseValorParaCentavos(valorTexto) - parseValorParaCentavos(abatidoTexto))
                  )}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">
                  Observações do Adiantamento
                </label>
                <input
                  type="text"
                  value={observacaoAdiantamento}
                  onChange={(e) => setObservacaoAdiantamento(e.target.value)}
                  placeholder="Ex: Pagamento referente à primeira quinzena"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* 4. MATERIAL */}
          {tipo === 'material' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
              <div>
                <label className="block text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">
                  Quantidade
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={quantidade}
                  onChange={(e) => handleMudarUnitarioOuQtd(parseFloat(e.target.value) || 1, valorUnitarioTexto)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">
                  Valor Unitário (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2.5 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="text"
                    value={valorUnitarioTexto}
                    onChange={(e) => handleMudarUnitarioOuQtd(quantidade, e.target.value)}
                    placeholder="0,00"
                    className="w-full text-right font-mono font-bold text-sm pl-7 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">
                  Loja / Fornecedor
                </label>
                <input
                  type="text"
                  value={loja}
                  onChange={(e) => setLoja(e.target.value)}
                  placeholder="Nome da loja"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* 5. DÍVIDA */}
          {tipo === 'divida' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50">
              <div>
                <label className="block text-xs font-semibold text-purple-900 dark:text-purple-200 mb-1">
                  Vencimento
                </label>
                <input
                  type="date"
                  value={vencimento}
                  onChange={(e) => setVencimento(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-900 dark:text-purple-200 mb-1">
                  Relação da Dívida
                </label>
                <select
                  value={direcaoDivida}
                  onChange={(e) => setDirecaoDivida(e.target.value as DirecaoDivida)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="eu_devo">Eu devo a ela</option>
                  <option value="me_devem">Ela me deve</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-900 dark:text-purple-200 mb-1">
                  Status
                </label>
                <select
                  value={statusDivida}
                  onChange={(e) => setStatusDivida(e.target.value as StatusDivida)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="pendente">Pendente / Em Aberto</option>
                  <option value="paga">Paga / Quitada</option>
                </select>
              </div>
            </div>
          )}

          {/* Rodapé do modal */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            {lancamentoEmEdicao && onDuplicar ? (
              <button
                type="button"
                onClick={async () => {
                  if (confirm('Deseja duplicar este lançamento?')) {
                    await onDuplicar(lancamentoEmEdicao);
                    onClose();
                  }
                }}
                className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-emerald-600 cursor-pointer"
              >
                + Duplicar Lançamento
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSalvando}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isSalvando ? 'Salvando...' : lancamentoEmEdicao ? 'Salvar Alterações' : 'Adicionar Lançamento'}</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
