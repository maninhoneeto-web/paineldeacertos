import React, { useState } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, Clock, Package, AlertCircle, 
  Image as ImageIcon, History, Plus, Camera, Upload, Trash2, Edit2, Copy, 
  ArrowRightLeft, CheckCircle2, ChevronDown, Eye, AlertTriangle, FileText, UserCheck
} from 'lucide-react';
import { PessoaTab, Lancamento, ImagemComprovante, HistoricoItem, TipoLancamento, Acerto } from '../types';
import { formatarCentavos, calcularTotaisPessoa } from '../utils/currency';

interface TabPessoaProps {
  acerto: Acerto;
  pessoa: PessoaTab;
  lancamentos: Lancamento[];
  imagens: ImagemComprovante[];
  historico: HistoricoItem[];
  subAbaAtiva: string;
  onMudarSubAba: (subAba: string) => void;
  onNovoLancamento: (tipoPre?: TipoLancamento) => void;
  onEditarLancamento: (lancamento: Lancamento) => void;
  onExcluirLancamento: (id: string) => void;
  onDuplicarLancamento: (lancamento: Lancamento) => void;
  onMoverLancamento: (lancamentoId: string, novaPessoaId: string, novoTipo?: TipoLancamento) => void;
  onUploadImagem: (files: FileList | null) => void;
  onExcluirImagem: (id: string) => void;
  onRenomearPessoa: (pessoaId: string, novoNome: string) => void;
  onExcluirPessoa: (pessoaId: string) => void;
  onGerarPdfPessoa: () => void;
  isEnviandoImagem: boolean;
}

export const TabPessoa: React.FC<TabPessoaProps> = ({
  acerto,
  pessoa,
  lancamentos,
  imagens,
  historico,
  subAbaAtiva,
  onMudarSubAba,
  onNovoLancamento,
  onEditarLancamento,
  onExcluirLancamento,
  onDuplicarLancamento,
  onMoverLancamento,
  onUploadImagem,
  onExcluirImagem,
  onRenomearPessoa,
  onExcluirPessoa,
  onGerarPdfPessoa,
  isEnviandoImagem,
}) => {
  const [modalMoverId, setModalMoverId] = useState<string | null>(null);
  const [imagemVisualizacao, setImagemVisualizacao] = useState<ImagemComprovante | null>(null);
  const [editandoNome, setEditandoNome] = useState(false);
  const [novoNome, setNovoNome] = useState(pessoa.nome);

  const totais = calcularTotaisPessoa(pessoa, lancamentos);

  const subAbas = [
    { id: 'resumo', label: 'Resumo', icon: DollarSign },
    { id: 'entradas', label: 'Entradas', icon: TrendingUp },
    { id: 'saidas', label: 'Saídas', icon: TrendingDown },
    { id: 'adiantamentos', label: 'Adiantamentos', icon: Clock },
    { id: 'materiais', label: 'Materiais', icon: Package },
    { id: 'dividas', label: 'Dívidas', icon: AlertCircle },
    { id: 'imagens', label: `Imagens (${imagens.length})`, icon: ImageIcon },
    { id: 'historico', label: 'Histórico', icon: History },
  ];

  const handleSalvarNome = () => {
    if (novoNome.trim() && novoNome.trim() !== pessoa.nome) {
      onRenomearPessoa(pessoa.id, novoNome.trim());
    }
    setEditandoNome(false);
  };

  const lancamentosPessoa = lancamentos.filter((l) => l.pessoaId === pessoa.id);

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* CABEÇALHO DA PESSOA COM FRASE DE DESTAQUE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-base shadow-sm shrink-0"
            style={{ backgroundColor: pessoa.cor || '#059669' }}
          >
            {pessoa.nome.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              {editandoNome ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    className="text-base font-bold px-2 py-1 rounded-lg border border-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    autoFocus
                  />
                  <button
                    onClick={handleSalvarNome}
                    className="px-2 py-1 text-xs font-bold bg-emerald-600 text-white rounded-lg"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                    {pessoa.nome}
                  </h2>
                  <button
                    onClick={() => { setNovoNome(pessoa.nome); setEditandoNome(true); }}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                    title="Renomear pessoa"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {pessoa.papel && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {pessoa.papel}
                </span>
              )}
            </div>
            
            {/* FRASE EM DESTAQUE OBRIGATÓRIA */}
            <div className="mt-1">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-wide ${
                totais.statusRelacao === 'pessoa_deve'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                  : totais.statusRelacao === 'usuario_deve'
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
              }`}>
                {totais.fraseDestaque}
              </span>
            </div>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO PRINCIPAIS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Enviar Imagem Grande */}
          <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-sm transition cursor-pointer">
            <Camera className="w-4 h-4" />
            <span>{isEnviandoImagem ? 'Lendo...' : 'Enviar Foto'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                onUploadImagem(e.target.files);
                e.target.value = '';
              }}
              disabled={isEnviandoImagem}
              className="hidden"
            />
          </label>

          {/* Botão Novo Lançamento Manual */}
          <button
            onClick={() => onNovoLancamento(subAbaAtiva === 'resumo' ? 'saida' : (subAbaAtiva as TipoLancamento))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-semibold text-xs sm:text-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Lançamento</span>
          </button>

          {/* Gerar PDF desta Pessoa */}
          <button
            onClick={onGerarPdfPessoa}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs sm:text-sm transition cursor-pointer"
            title="Gerar relatório em PDF desta pessoa"
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* SUB-ABAS HORIZONTAIS COM SCROLL SUAVE */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-slate-800">
        {subAbas.map((sub) => {
          const Icon = sub.icon;
          const isAtiva = subAbaAtiva === sub.id;

          return (
            <button
              key={sub.id}
              onClick={() => onMudarSubAba(sub.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-xs sm:text-sm font-bold whitespace-nowrap transition border-b-2 cursor-pointer ${
                isAtiva
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{sub.label}</span>
            </button>
          );
        })}
      </div>

      {/* CONTEÚDO DA SUB-ABA SELECIONADA */}

      {/* 1. SUB-ABA RESUMO */}
      {subAbaAtiva === 'resumo' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Entradas</span>
              <div className="text-base sm:text-lg font-bold font-mono text-emerald-600">
                {formatarCentavos(totais.totalEntradasCentavos)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Saídas</span>
              <div className="text-base sm:text-lg font-bold font-mono text-rose-600">
                {formatarCentavos(totais.totalSaidasCentavos)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Adiantamentos</span>
              <div className="text-base sm:text-lg font-bold font-mono text-amber-600">
                {formatarCentavos(totais.totalAdiantamentosCentavos)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Materiais</span>
              <div className="text-base sm:text-lg font-bold font-mono text-blue-600">
                {formatarCentavos(totais.totalMateriaisCentavos)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Saldo Final</span>
              <div className={`text-base sm:text-lg font-bold font-mono ${
                totais.saldoCentavos > 0 ? 'text-emerald-600' : totais.saldoCentavos < 0 ? 'text-rose-600' : 'text-slate-600'
              }`}>
                {formatarCentavos(totais.saldoCentavos)}
              </div>
            </div>

          </div>

          {/* Explicação Didática da Conta para o Usuário */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed space-y-1">
            <p className="font-bold text-slate-800 dark:text-slate-200">
              Como foi calculado este acerto com {pessoa.nome}:
            </p>
            <p>
              • <strong>Dinheiro adiantado para a pessoa:</strong> {formatarCentavos(totais.totalAdiantamentosCentavos)}
            </p>
            <p>
              • <strong>Despesas comprovadas pagas por ela (Saídas + Materiais):</strong> {formatarCentavos(totais.totalSaidasCentavos + totais.totalMateriaisCentavos)}
            </p>
            <p>
              • <strong>Dívidas pendentes:</strong> Que ela me deve: {formatarCentavos(totais.totalDividasMeDevemCentavos)} | Que eu devo a ela: {formatarCentavos(totais.totalDividasEuDevoCentavos)}
            </p>
            <p className="pt-1 font-semibold text-slate-700 dark:text-slate-300">
              = Resultado do Acerto: <span className="font-bold">{totais.fraseDestaque}</span>
            </p>
          </div>

          {/* Últimos Lançamentos desta Pessoa */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Todos os Lançamentos ({lancamentosPessoa.length})
            </h4>
            <TabelaGenericaLancamentos
              lancamentos={lancamentosPessoa}
              acerto={acerto}
              pessoa={pessoa}
              onEditar={onEditarLancamento}
              onExcluir={onExcluirLancamento}
              onDuplicar={onDuplicarLancamento}
              onAbrirMover={(id) => setModalMoverId(id)}
            />
          </div>
        </div>
      )}

      {/* 2. SUB-ABA ENTRADAS */}
      {subAbaAtiva === 'entradas' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              Entradas registradas ({lancamentosPessoa.filter((l) => l.tipo === 'entrada').length})
            </span>
            <button
              onClick={() => onNovoLancamento('entrada')}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
            >
              + Nova Entrada
            </button>
          </div>

          <TabelaGenericaLancamentos
            lancamentos={lancamentosPessoa.filter((l) => l.tipo === 'entrada')}
            acerto={acerto}
            pessoa={pessoa}
            onEditar={onEditarLancamento}
            onExcluir={onExcluirLancamento}
            onDuplicar={onDuplicarLancamento}
            onAbrirMover={(id) => setModalMoverId(id)}
          />
        </div>
      )}

      {/* 3. SUB-ABA SAÍDAS */}
      {subAbaAtiva === 'saidas' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              Saídas e despesas ({lancamentosPessoa.filter((l) => l.tipo === 'saida').length})
            </span>
            <button
              onClick={() => onNovoLancamento('saida')}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold cursor-pointer"
            >
              + Nova Saída
            </button>
          </div>

          <TabelaGenericaLancamentos
            lancamentos={lancamentosPessoa.filter((l) => l.tipo === 'saida')}
            acerto={acerto}
            pessoa={pessoa}
            onEditar={onEditarLancamento}
            onExcluir={onExcluirLancamento}
            onDuplicar={onDuplicarLancamento}
            onAbrirMover={(id) => setModalMoverId(id)}
          />
        </div>
      )}

      {/* 4. SUB-ABA ADIANTAMENTOS */}
      {subAbaAtiva === 'adiantamentos' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              Adiantamentos e Vales ({lancamentosPessoa.filter((l) => l.tipo === 'adiantamento').length})
            </span>
            <button
              onClick={() => onNovoLancamento('adiantamento')}
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold cursor-pointer"
            >
              + Novo Adiantamento
            </button>
          </div>

          <TabelaGenericaLancamentos
            lancamentos={lancamentosPessoa.filter((l) => l.tipo === 'adiantamento')}
            acerto={acerto}
            pessoa={pessoa}
            onEditar={onEditarLancamento}
            onExcluir={onExcluirLancamento}
            onDuplicar={onDuplicarLancamento}
            onAbrirMover={(id) => setModalMoverId(id)}
          />
        </div>
      )}

      {/* 5. SUB-ABA MATERIAIS */}
      {subAbaAtiva === 'materiais' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              Materiais e Insumos ({lancamentosPessoa.filter((l) => l.tipo === 'material').length})
            </span>
            <button
              onClick={() => onNovoLancamento('material')}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer"
            >
              + Novo Material
            </button>
          </div>

          <TabelaGenericaLancamentos
            lancamentos={lancamentosPessoa.filter((l) => l.tipo === 'material')}
            acerto={acerto}
            pessoa={pessoa}
            onEditar={onEditarLancamento}
            onExcluir={onExcluirLancamento}
            onDuplicar={onDuplicarLancamento}
            onAbrirMover={(id) => setModalMoverId(id)}
          />
        </div>
      )}

      {/* 6. SUB-ABA DÍVIDAS */}
      {subAbaAtiva === 'dividas' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              Dívidas e Pendências ({lancamentosPessoa.filter((l) => l.tipo === 'divida').length})
            </span>
            <button
              onClick={() => onNovoLancamento('divida')}
              className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold cursor-pointer"
            >
              + Nova Dívida
            </button>
          </div>

          <TabelaGenericaLancamentos
            lancamentos={lancamentosPessoa.filter((l) => l.tipo === 'divida')}
            acerto={acerto}
            pessoa={pessoa}
            onEditar={onEditarLancamento}
            onExcluir={onExcluirLancamento}
            onDuplicar={onDuplicarLancamento}
            onAbrirMover={(id) => setModalMoverId(id)}
          />
        </div>
      )}

      {/* 7. SUB-ABA IMAGENS */}
      {subAbaAtiva === 'imagens' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Galeria de Comprovantes de {pessoa.nome}
              </h4>
              <p className="text-xs text-slate-500">
                Cada foto fica ligada aos lançamentos que gerou.
              </p>
            </div>
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Enviar Foto</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => onUploadImagem(e.target.files)}
                className="hidden"
              />
            </label>
          </div>

          {imagens.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <ImageIcon className="w-10 h-10 text-slate-400 mx-auto mb-2 stroke-1" />
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                Nenhum comprovante enviado para esta pessoa ainda.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Envie fotos de recibos, cadernos de obras ou comprovantes Pix para a IA extrair automaticamente.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {imagens.map((img) => (
                <div
                  key={img.id}
                  className="group relative rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xs"
                >
                  <img
                    src={img.dataUrl}
                    alt={img.nomeArquivo}
                    className="w-full h-36 object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="p-2 bg-white dark:bg-slate-900 text-xs">
                    <p className="font-semibold truncate text-slate-900 dark:text-white">
                      {img.nomeArquivo}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(img.createdAt).toLocaleDateString('pt-BR')} • {img.tipoDocumentoIdentificado || 'Recibo'}
                    </p>
                  </div>
                  {/* Overlay buttons */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => setImagemVisualizacao(img)}
                      className="p-1.5 rounded-lg bg-black/70 text-white hover:bg-black transition cursor-pointer"
                      title="Ver ampliada"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Excluir imagem "${img.nomeArquivo}"?`)) {
                          onExcluirImagem(img.id);
                        }
                      }}
                      className="p-1.5 rounded-lg bg-rose-600/80 text-white hover:bg-rose-700 transition cursor-pointer"
                      title="Excluir imagem"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. SUB-ABA HISTÓRICO */}
      {subAbaAtiva === 'historico' && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Registro de Auditoria de {pessoa.nome}
          </h4>

          {historico.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              Nenhuma alteração registrada ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {historico.map((h) => (
                <div
                  key={h.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                >
                  <History className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {h.detalhes}
                    </p>
                    <span className="text-[10px] text-slate-400">
                      {new Date(h.timestamp).toLocaleString('pt-BR')} • Ação: {h.acao}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL DE MOVER LANÇAMENTO PARA OUTRA PESSOA / OUTRA SEÇÃO */}
      {modalMoverId && (
        <ModalMoverLancamento
          lancamentoId={modalMoverId}
          acerto={acerto}
          pessoaAtualId={pessoa.id}
          onClose={() => setModalMoverId(null)}
          onConfirmar={(novaPessoaId, novoTipo) => {
            onMoverLancamento(modalMoverId, novaPessoaId, novoTipo);
            setModalMoverId(null);
          }}
        />
      )}

      {/* MODAL DE IMAGEM AMPLIADA */}
      {imagemVisualizacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="relative max-w-3xl w-full bg-slate-900 rounded-2xl overflow-hidden p-4">
            <button
              onClick={() => setImagemVisualizacao(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black"
            >
              ✕
            </button>
            <img
              src={imagemVisualizacao.dataUrl}
              alt="Visualização"
              className="max-h-[80vh] w-auto mx-auto object-contain rounded-lg"
            />
            <div className="mt-3 text-center text-white text-xs">
              <p className="font-bold">{imagemVisualizacao.nomeArquivo}</p>
              {imagemVisualizacao.totalEscritoCentavos ? (
                <p className="text-emerald-400 mt-0.5">
                  Total identificado: {formatarCentavos(imagemVisualizacao.totalEscritoCentavos)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// Componente Tabela de Lançamentos com Ações de 1 Toque
interface TabelaProps {
  lancamentos: Lancamento[];
  acerto: Acerto;
  pessoa: PessoaTab;
  onEditar: (l: Lancamento) => void;
  onExcluir: (id: string) => void;
  onDuplicar: (l: Lancamento) => void;
  onAbrirMover: (id: string) => void;
}

const TabelaGenericaLancamentos: React.FC<TabelaProps> = ({
  lancamentos,
  acerto,
  pessoa,
  onEditar,
  onExcluir,
  onDuplicar,
  onAbrirMover,
}) => {
  if (lancamentos.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
        <FileText className="w-8 h-8 mx-auto mb-1 stroke-1" />
        <p className="text-xs font-medium">Nenhum lançamento nesta seção.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {lancamentos.map((l) => {
          return (
            <div
              key={l.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition gap-2"
            >
              {/* Esquerda: Tipo, Data, Descrição e Detalhes */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span
                  className={`mt-1 shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    l.tipo === 'entrada'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : l.tipo === 'saida'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                      : l.tipo === 'adiantamento'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      : l.tipo === 'material'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                  }`}
                >
                  {l.tipo}
                </span>

                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {l.descricao}
                  </p>
                  
                  {/* Linha de Metadados detalhados */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span>{new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    
                    {l.categoria && <span>• {l.categoria}</span>}
                    {l.formaPagamento && <span>• {l.formaPagamento}</span>}
                    {l.quemPagou && <span>• Pago por: {l.quemPagou}</span>}
                    {l.loja && <span>• Loja: {l.loja}</span>}
                    {l.quantidade && l.quantidade > 1 && <span>• Qtd: {l.quantidade}</span>}
                    
                    {l.tipo === 'adiantamento' && (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        • Abatido: {formatarCentavos(l.abatidoCentavos || 0)} (Falta {formatarCentavos(Math.max(0, l.valorCentavos - (l.abatidoCentavos || 0)))})
                      </span>
                    )}

                    {l.tipo === 'divida' && (
                      <span className="text-purple-600 dark:text-purple-400 font-medium">
                        • Vence: {l.vencimento ? new Date(l.vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data'} ({l.direcaoDivida === 'eu_devo' ? 'Eu devo' : 'Me devem'}) - {l.statusDivida}
                      </span>
                    )}

                    {l.imagemId && (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                        • 📎 Com comprovante
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Direita: Valor e Ações de 1 Toque */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <span className={`font-mono font-bold text-sm sm:text-base ${
                  l.tipo === 'entrada' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'
                }`}>
                  {formatarCentavos(l.valorCentavos)}
                </span>

                {/* Barra de Ações com 1 toque */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                  {/* Editar */}
                  <button
                    onClick={() => onEditar(l)}
                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer"
                    title="Editar lançamento"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Duplicar */}
                  <button
                    onClick={() => onDuplicar(l)}
                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer"
                    title="Duplicar lançamento"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  {/* Mover para outra aba ou pessoa */}
                  <button
                    onClick={() => onAbrirMover(l.id)}
                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer"
                    title="Mover para outra pessoa ou seção"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* Excluir com 1 toque */}
                  <button
                    onClick={() => onExcluir(l.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="Excluir lançamento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Modal de 1 toque para Mover Lançamento
interface ModalMoverProps {
  lancamentoId: string;
  acerto: Acerto;
  pessoaAtualId: string;
  onClose: () => void;
  onConfirmar: (novaPessoaId: string, novoTipo?: TipoLancamento) => void;
}

const ModalMoverLancamento: React.FC<ModalMoverProps> = ({
  acerto,
  pessoaAtualId,
  onClose,
  onConfirmar,
}) => {
  const [destPessoaId, setDestPessoaId] = useState(pessoaAtualId);
  const [destTipo, setDestTipo] = useState<TipoLancamento>('saida');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          Mover Lançamento com 1 Toque
        </h3>
        
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-500 font-semibold mb-1">Mover para a Pessoa / Aba:</label>
            <select
              value={destPessoaId}
              onChange={(e) => setDestPessoaId(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {acerto.pessoas.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-semibold mb-1">Alterar Seção / Tipo (Opcional):</label>
            <select
              value={destTipo}
              onChange={(e) => setDestTipo(e.target.value as TipoLancamento)}
              className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="saida">Saída</option>
              <option value="entrada">Entrada</option>
              <option value="adiantamento">Adiantamento</option>
              <option value="material">Material</option>
              <option value="divida">Dívida</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(destPessoaId, destTipo)}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
          >
            Confirmar Movimentação
          </button>
        </div>
      </div>
    </div>
  );
};
