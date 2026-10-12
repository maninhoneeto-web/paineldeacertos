import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Plus, Camera, FileText, ShieldCheck, Database, Settings, 
  Trash2, Edit2, Check, X, Tag, MoreHorizontal, ArrowRightLeft, Sparkles, AlertTriangle, Percent
} from 'lucide-react';
import { 
  Acerto, Lancamento, ImagemComprovante, HistoricoItem, PessoaTab, 
  TipoLancamento, LinhaConferenciaOCR, ResultadoOCR, ConfigDivisaoLucros 
} from '../types';
import { TabGeral } from './TabGeral';
import { TabPessoa } from './TabPessoa';
import { TabDivisaoLucros } from './TabDivisaoLucros';
import { ConferenceModal } from './ConferenceModal';
import { LancamentoFormModal } from './LancamentoFormModal';
import { PdfExportModal } from './PdfExportModal';
import { AgenteFinanceiroModal } from './AgenteFinanceiroModal';
import { BackupModal } from './BackupModal';
import { PWAInstallButton } from './PWAInstallButton';
import { comprimirImagem } from '../utils/imageCompressor';
import { extrairDadosAcertoComGemini } from '../services/geminiOcr';
import { 
  salvarAcerto, salvarLancamento, salvarMultiplosLancamentos, excluirLancamento, 
  salvarImagem, verificarImagemDuplicada, excluirImagem, registrarHistorico, 
  listarLancamentosPorAcerto, listarImagensPorAcerto, listarHistoricoPorAcerto,
  salvarConfig, obterConfig
} from '../services/db';

interface AcertoViewProps {
  acerto: Acerto;
  onVoltar: () => void;
  onAtualizarAcerto: (acertoAtualizado: Acerto) => void;
}

export const AcertoView: React.FC<AcertoViewProps> = ({
  acerto,
  onVoltar,
  onAtualizarAcerto,
}) => {
  // Aba ativa: 'geral' ou ID da pessoa
  const [abaAtiva, setAbaAtiva] = useState<string>('geral');
  const [subAbaAtiva, setSubAbaAtiva] = useState<string>('resumo');

  // Estado dos dados vinculados
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [imagens, setImagens] = useState<ImagemComprovante[]>([]);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Modais
  const [modalLancamentoAberto, setModalLancamentoAberto] = useState(false);
  const [tipoPreSelecionado, setTipoPreSelecionado] = useState<TipoLancamento>('saida');
  const [lancamentoEmEdicao, setLancamentoEmEdicao] = useState<Lancamento | null>(null);

  const [modalPdfAberto, setModalPdfAberto] = useState(false);
  const [pdfPessoaIdFoco, setPdfPessoaIdFoco] = useState<string | undefined>(undefined);

  const [modalAgenteAberto, setModalAgenteAberto] = useState(false);
  const [modalBackupAberto, setModalBackupAberto] = useState(false);

  // Gerenciamento de Nova Pessoa
  const [modalNovaPessoa, setModalNovaPessoa] = useState(false);
  const [nomeNovaPessoa, setNomeNovaPessoa] = useState('');
  const [papelNovaPessoa, setPapelNovaPessoa] = useState('');

  // Estado do Upload e OCR da Imagem
  const [isProcessandoImagem, setIsProcessandoImagem] = useState(false);
  const [statusProcessamentoTexto, setStatusProcessamentoTexto] = useState('');
  const [dadosConferencia, setDadosConferencia] = useState<{
    imagemDataUrl: string;
    imagemHash: string;
    nomeArquivo: string;
    tamanhoBytes: number;
    tipoDocumentoIdentificado?: string;
    tituloSugerido?: string;
    pessoasIdentificadas?: string[];
    totalEscritoCentavos?: number;
    totalEscritoFormatado?: string;
    observacoesOCR?: string;
    linhasIniciais: LinhaConferenciaOCR[];
    isDuplicada: boolean;
  } | null>(null);

  // Toast com opção de DESFAZER exclusão
  const [toastDesfazer, setToastDesfazer] = useState<{
    mensagem: string;
    itemExcluido: Lancamento;
  } | null>(null);

  // Carregar dados e continuar exatamente de onde parou
  useEffect(() => {
    let montado = true;
    async function carregarDados() {
      setCarregando(true);
      try {
        const [lancs, imgs, hist, ultimaAba] = await Promise.all([
          listarLancamentosPorAcerto(acerto.id),
          listarImagensPorAcerto(acerto.id),
          listarHistoricoPorAcerto(acerto.id),
          obterConfig<string>(`aba_${acerto.id}`),
        ]);

        if (montado) {
          setLancamentos(lancs);
          setImagens(imgs);
          setHistorico(hist);
          if (ultimaAba && (ultimaAba === 'geral' || acerto.pessoas.some((p) => p.id === ultimaAba))) {
            setAbaAtiva(ultimaAba);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados do acerto:', err);
      } finally {
        if (montado) setCarregando(false);
      }
    }
    carregarDados();
    return () => { montado = false; };
  }, [acerto.id]);

  // Salvar última aba ativa para continuidade perfeita
  const handleTrocarAba = (novaAba: string) => {
    setAbaAtiva(novaAba);
    setSubAbaAtiva('resumo');
    salvarConfig(`aba_${acerto.id}`, novaAba);
  };

  // Recarregar dados após modificações
  const recarregarTudo = async () => {
    const [lancs, imgs, hist] = await Promise.all([
      listarLancamentosPorAcerto(acerto.id),
      listarImagensPorAcerto(acerto.id),
      listarHistoricoPorAcerto(acerto.id),
    ]);
    setLancamentos(lancs);
    setImagens(imgs);
    setHistorico(hist);
  };

  // -------------------------------------------------------------
  // FLUXO DO ENVIO DE IMAGEM & OCR COM GEMINI
  // -------------------------------------------------------------
  const handleUploadImagens = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsProcessandoImagem(true);
    setStatusProcessamentoTexto(`Comprimindo imagem (1/${files.length})...`);

    try {
      const file = files[0];
      const imagemProcessada = await comprimirImagem(file);

      setStatusProcessamentoTexto('Verificando histórico e duplicidades...');
      const duplicada = await verificarImagemDuplicada(acerto.id, imagemProcessada.hash);

      setStatusProcessamentoTexto('Consultando inteligência do Gemini para ler o comprovante...');

      const nomesPessoas = acerto.pessoas.map((p) => p.nome);
      const pessoaAtual = acerto.pessoas.find((p) => p.id === abaAtiva)?.nome || '';

      const ocr = await extrairDadosAcertoComGemini({
        imageBase64: imagemProcessada.dataUrl,
        mimeType: 'image/jpeg',
        knownPersons: nomesPessoas,
        currentPerson: pessoaAtual,
      });

      // Monta as linhas para a tela de conferência
      const linhasConferencia: LinhaConferenciaOCR[] = (ocr.linhas || []).map((l, idx) => {
        let idPessoaDestino = abaAtiva !== 'geral' ? abaAtiva : acerto.pessoas[0]?.id || 'geral';
        if (l.pessoaSugerida) {
          const match = acerto.pessoas.find((p) =>
            p.nome.toLowerCase().includes(l.pessoaSugerida!.toLowerCase())
          );
          if (match) idPessoaDestino = match.id;
        }

        return {
          id: 'ocr_' + Date.now() + '_' + idx,
          data: l.data || ocr.dataGeral || new Date().toISOString().slice(0, 10),
          descricao: l.descricao || 'Item lido pela IA',
          quantidade: l.quantidade || 1,
          valorCentavos: l.valorCentavos || 0,
          valorOriginalTexto: l.valorOriginalTexto,
          tipoSugerido: l.tipoSugerido || 'saida',
          categoria: l.categoria || acerto.categorias[0] || 'Geral',
          formaPagamento: (l.formaPagamento as any) || 'Pix',
          pessoaId: idPessoaDestino,
          pessoaSugeridaNome: l.pessoaSugerida,
          confianca: l.confianca || 'alta',
          loja: l.loja || ocr.estabelecimentoOuLoja,
          dividaDeQuem: l.dividaDeQuem || 'eu_devo',
          incluir: true,
        };
      });

      setDadosConferencia({
        imagemDataUrl: imagemProcessada.dataUrl,
        imagemHash: imagemProcessada.hash,
        nomeArquivo: file.name,
        tamanhoBytes: imagemProcessada.tamanhoComprimidoBytes,
        tipoDocumentoIdentificado: ocr.tipoDocumento,
        tituloSugerido: ocr.tituloSugeridoAcerto,
        pessoasIdentificadas: ocr.todasPessoasIdentificadas || [],
        totalEscritoCentavos: ocr.totalEscritoNaAnotacaoCentavos || 0,
        totalEscritoFormatado: ocr.totalEscritoFormatado,
        observacoesOCR: ocr.observacoes,
        linhasIniciais: linhasConferencia,
        isDuplicada: !!duplicada,
      });
    } catch (err: any) {
      console.error(err);
      alert('Aviso: ' + (err.message || 'Verifique a conexão e tente novamente.'));
    } finally {
      setIsProcessandoImagem(false);
      setStatusProcessamentoTexto('');
    }
  };

  // Salvar resultado confirmado da Tela de Conferência
  const handleConfirmarConferencia = async (dados: {
    tituloAcerto?: string;
    pessoasAtualizadas: PessoaTab[];
    linhas: LinhaConferenciaOCR[];
    imagemDataUrl: string;
    imagemHash: string;
    nomeArquivo: string;
    tamanhoBytes: number;
    tipoDocumento: string;
    totalEscritoCentavos: number;
    observacoes: string;
  }) => {
    // Se novas pessoas foram criadas na conferência, atualiza o acerto
    if (dados.pessoasAtualizadas && dados.pessoasAtualizadas.length !== acerto.pessoas.length) {
      const acertoComPessoas: Acerto = {
        ...acerto,
        pessoas: dados.pessoasAtualizadas,
      };
      await salvarAcerto(acertoComPessoas);
      onAtualizarAcerto(acertoComPessoas);
    }

    const imagemId = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const pessoaFotoId = abaAtiva !== 'geral' ? abaAtiva : dados.linhas[0]?.pessoaId || 'geral';

    const lancamentosParaSalvar: Lancamento[] = [];
    const lancamentosIds: string[] = [];

    for (const linha of dados.linhas) {
      const lid = 'lanc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      lancamentosIds.push(lid);

      lancamentosParaSalvar.push({
        id: lid,
        acertoId: acerto.id,
        pessoaId: linha.pessoaId,
        tipo: linha.tipoSugerido,
        data: linha.data,
        descricao: linha.descricao,
        valorCentavos: linha.valorCentavos,
        categoria: linha.categoria,
        formaPagamento: linha.formaPagamento,
        loja: linha.loja,
        quantidade: linha.quantidade,
        imagemId,
        confianca: linha.confianca,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const novaImagem: ImagemComprovante = {
      id: imagemId,
      acertoId: acerto.id,
      pessoaId: pessoaFotoId,
      dataUrl: dados.imagemDataUrl,
      hash: dados.imagemHash,
      nomeArquivo: dados.nomeArquivo,
      tamanhoBytes: dados.tamanhoBytes,
      tipoDocumentoIdentificado: dados.tipoDocumento,
      totalEscritoCentavos: dados.totalEscritoCentavos,
      observacoes: dados.observacoes,
      lancamentosGeradosIds: lancamentosIds,
      createdAt: new Date().toISOString(),
    };

    await salvarImagem(novaImagem);
    await salvarMultiplosLancamentos(lancamentosParaSalvar);

    await registrarHistorico({
      acertoId: acerto.id,
      pessoaId: pessoaFotoId !== 'geral' ? pessoaFotoId : undefined,
      acao: 'upload_imagem',
      tipoItem: 'imagem',
      detalhes: `Comprovante "${dados.nomeArquivo}" lido pela IA gerando ${lancamentosParaSalvar.length} lançamentos organizados.`,
    });

    setDadosConferencia(null);
    await recarregarTudo();
  };

  // -------------------------------------------------------------
  // OPERAÇÕES DE LANÇAMENTO (CRIAR, EDITAR, DUPLICAR, MOVER, EXCLUIR)
  // -------------------------------------------------------------
  const handleSalvarLancamento = async (lancamento: Lancamento) => {
    const isEdicao = lancamentos.some((l) => l.id === lancamento.id);
    await salvarLancamento(lancamento);

    await registrarHistorico({
      acertoId: acerto.id,
      pessoaId: lancamento.pessoaId,
      acao: isEdicao ? 'edicao' : 'criacao',
      tipoItem: 'lancamento',
      detalhes: `${isEdicao ? 'Editou' : 'Adicionou'} ${lancamento.tipo}: ${lancamento.descricao}`,
    });

    setLancamentoEmEdicao(null);
    setModalLancamentoAberto(false);
    await recarregarTudo();
  };

  const handleDuplicarLancamento = async (lancamento: Lancamento) => {
    const novo: Lancamento = {
      ...lancamento,
      id: 'lanc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      descricao: `${lancamento.descricao} (Cópia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await salvarLancamento(novo);
    await registrarHistorico({
      acertoId: acerto.id,
      pessoaId: novo.pessoaId,
      acao: 'criacao',
      tipoItem: 'lancamento',
      detalhes: `Duplicou lançamento: ${novo.descricao}`,
    });
    await recarregarTudo();
  };

  const handleMoverLancamento = async (lancamentoId: string, novaPessoaId: string, novoTipo?: TipoLancamento) => {
    const lanc = lancamentos.find((l) => l.id === lancamentoId);
    if (!lanc) return;

    const atualizado: Lancamento = {
      ...lanc,
      pessoaId: novaPessoaId,
      tipo: novoTipo || lanc.tipo,
      updatedAt: new Date().toISOString(),
    };

    await salvarLancamento(atualizado);
    const pessoaDest = acerto.pessoas.find((p) => p.id === novaPessoaId)?.nome || 'Geral';
    await registrarHistorico({
      acertoId: acerto.id,
      pessoaId: novaPessoaId,
      acao: 'edicao',
      tipoItem: 'lancamento',
      detalhes: `Moveu "${lanc.descricao}" para ${pessoaDest}.`,
    });
    await recarregarTudo();
  };

  const handleExcluirLancamento = async (id: string) => {
    const lanc = lancamentos.find((l) => l.id === id);
    if (!lanc) return;

    if (!confirm(`Deseja excluir o lançamento "${lanc.descricao}"?`)) return;

    await excluirLancamento(id);
    await registrarHistorico({
      acertoId: acerto.id,
      pessoaId: lanc.pessoaId,
      acao: 'exclusao',
      tipoItem: 'lancamento',
      detalhes: `Excluiu lançamento: ${lanc.descricao}`,
    });

    // Guardar para Desfazer
    setToastDesfazer({
      mensagem: `Lançamento "${lanc.descricao}" excluído.`,
      itemExcluido: lanc,
    });

    await recarregarTudo();
  };

  const handleDesfazerExclusao = async () => {
    if (!toastDesfazer) return;
    await salvarLancamento(toastDesfazer.itemExcluido);
    await registrarHistorico({
      acertoId: acerto.id,
      pessoaId: toastDesfazer.itemExcluido.pessoaId,
      acao: 'criacao',
      tipoItem: 'lancamento',
      detalhes: `Desfez exclusão de: ${toastDesfazer.itemExcluido.descricao}`,
    });
    setToastDesfazer(null);
    await recarregarTudo();
  };

  // Excluir Imagem
  const handleExcluirImagem = async (id: string) => {
    await excluirImagem(id);
    await registrarHistorico({
      acertoId: acerto.id,
      acao: 'exclusao',
      tipoItem: 'imagem',
      detalhes: `Excluiu foto de comprovante.`,
    });
    await recarregarTudo();
  };

  // -------------------------------------------------------------
  // GERENCIAR PESSOAS / ABAS
  // -------------------------------------------------------------
  const handleAdicionarPessoa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeNovaPessoa.trim()) return;

    const cores = ['#059669', '#0284c7', '#7c3aed', '#d97706', '#dc2626', '#4f46e5', '#0d9488'];
    const cor = cores[acerto.pessoas.length % cores.length];

    const novaPessoa: PessoaTab = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      nome: nomeNovaPessoa.trim(),
      papel: papelNovaPessoa.trim() || undefined,
      cor,
      ordem: acerto.pessoas.length,
    };

    const atualizado: Acerto = {
      ...acerto,
      pessoas: [...acerto.pessoas, novaPessoa],
    };

    await salvarAcerto(atualizado);
    onAtualizarAcerto(atualizado);
    setNomeNovaPessoa('');
    setPapelNovaPessoa('');
    setModalNovaPessoa(false);
    handleTrocarAba(novaPessoa.id);
  };

  const handleRenomearPessoa = async (pessoaId: string, novoNome: string) => {
    const atualizado: Acerto = {
      ...acerto,
      pessoas: acerto.pessoas.map((p) => (p.id === pessoaId ? { ...p, nome: novoNome } : p)),
    };
    await salvarAcerto(atualizado);
    onAtualizarAcerto(atualizado);
  };

  const handleExcluirPessoa = async (pessoaId: string) => {
    const p = acerto.pessoas.find((item) => item.id === pessoaId);
    if (!p) return;

    if (!confirm(`Tem certeza que deseja excluir a aba de "${p.nome}"? Os lançamentos desta pessoa não serão apagados, mas a aba deixará de existir.`)) {
      return;
    }

    const atualizado: Acerto = {
      ...acerto,
      pessoas: acerto.pessoas.filter((item) => item.id !== pessoaId),
    };
    await salvarAcerto(atualizado);
    onAtualizarAcerto(atualizado);
    handleTrocarAba('geral');
  };

  const handleSalvarConfigLucros = async (config: ConfigDivisaoLucros) => {
    const atualizado: Acerto = {
      ...acerto,
      configDivisaoLucros: config,
    };
    await salvarAcerto(atualizado);
    onAtualizarAcerto(atualizado);
    await recarregarTudo();
  };

  const pessoaAtiva = acerto.pessoas.find((p) => p.id === abaAtiva);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      
      {/* CABEÇALHO DO ACERTO */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onVoltar}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Voltar para a lista de acertos"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black truncate text-slate-900 dark:text-white">
                  {acerto.titulo}
                </h1>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  acerto.status === 'aberto'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  {acerto.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Início: {new Date(acerto.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} • {acerto.pessoas.length} pessoas
              </p>
            </div>
          </div>

          {/* BOTÕES DE AÇÃO SUPERIORES */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* PWA Install */}
            <PWAInstallButton />

            {/* Agente Financeiro */}
            <button
              onClick={() => setModalAgenteAberto(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
              title="Agente de auditoria contábil e alertas"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden md:inline">Agente Financeiro</span>
            </button>

            {/* Gerar PDF */}
            <button
              onClick={() => {
                setPdfPessoaIdFoco(undefined);
                setModalPdfAberto(true);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
              title="Exportar PDF do acerto"
            >
              <FileText className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Gerar PDF</span>
            </button>

            {/* Backup */}
            <button
              onClick={() => setModalBackupAberto(true)}
              className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition cursor-pointer"
              title="Backup completo"
            >
              <Database className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* NAVEGAÇÃO DAS ABAS POR PESSOA COM BOTÃO "+ NOVA PESSOA" E "DIVISÃO DE LUCROS" */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-1 flex items-center gap-1 overflow-x-auto scrollbar-none">
          {/* Aba Geral (sempre a primeira) */}
          <button
            onClick={() => handleTrocarAba('geral')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold whitespace-nowrap transition border-b-2 cursor-pointer ${
              abaAtiva === 'geral'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>GERAL</span>
          </button>

          {/* Aba DIVISÃO DE LUCROS */}
          <button
            onClick={() => handleTrocarAba('divisao_lucros')}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold whitespace-nowrap transition border-b-2 cursor-pointer ${
              abaAtiva === 'divisao_lucros'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40'
            }`}
          >
            <Percent className="w-3.5 h-3.5 text-emerald-500" />
            <span>DIVISÃO DE LUCROS</span>
          </button>

          {/* Abas individuais de cada pessoa */}
          {acerto.pessoas.map((p) => {
            const isAtiva = abaAtiva === p.id;
            return (
              <div key={p.id} className="relative flex items-center group">
                <button
                  onClick={() => handleTrocarAba(p.id)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold whitespace-nowrap transition border-b-2 cursor-pointer ${
                    isAtiva
                      ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: p.cor || '#059669' }}
                  />
                  <span>{p.nome}</span>
                </button>
              </div>
            );
          })}

          {/* Botão + Nova Pessoa */}
          <button
            onClick={() => setModalNovaPessoa(true)}
            className="flex items-center gap-1 px-3 py-1.5 ml-1 rounded-xl text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 whitespace-nowrap transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova pessoa</span>
          </button>
        </div>
      </header>

      {/* CORPO PRINCIPAL */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {carregando ? (
          <div className="p-16 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium">Carregando acerto e conferências...</p>
          </div>
        ) : abaAtiva === 'geral' ? (
          <TabGeral
            acerto={acerto}
            lancamentos={lancamentos}
            onSelecionarPessoa={(id) => handleTrocarAba(id)}
            onNovaPessoa={() => setModalNovaPessoa(true)}
            onUploadImagem={handleUploadImagens}
            isEnviandoImagem={isProcessandoImagem}
          />
        ) : abaAtiva === 'divisao_lucros' ? (
          <TabDivisaoLucros
            acerto={acerto}
            lancamentos={lancamentos}
            onSalvarConfigLucros={handleSalvarConfigLucros}
            onExportarPdf={() => {
              setPdfPessoaIdFoco(undefined);
              setModalPdfAberto(true);
            }}
          />
        ) : pessoaAtiva ? (
          <TabPessoa
            acerto={acerto}
            pessoa={pessoaAtiva}
            lancamentos={lancamentos}
            imagens={imagens.filter((img) => img.pessoaId === pessoaAtiva.id)}
            historico={historico.filter((h) => !h.pessoaId || h.pessoaId === pessoaAtiva.id)}
            subAbaAtiva={subAbaAtiva}
            onMudarSubAba={setSubAbaAtiva}
            onNovoLancamento={(tipo) => {
              setTipoPreSelecionado(tipo || 'saida');
              setLancamentoEmEdicao(null);
              setModalLancamentoAberto(true);
            }}
            onEditarLancamento={(l) => {
              setLancamentoEmEdicao(l);
              setModalLancamentoAberto(true);
            }}
            onExcluirLancamento={handleExcluirLancamento}
            onDuplicarLancamento={handleDuplicarLancamento}
            onMoverLancamento={handleMoverLancamento}
            onUploadImagem={handleUploadImagens}
            onExcluirImagem={handleExcluirImagem}
            onRenomearPessoa={handleRenomearPessoa}
            onExcluirPessoa={handleExcluirPessoa}
            onGerarPdfPessoa={() => {
              setPdfPessoaIdFoco(pessoaAtiva.id);
              setModalPdfAberto(true);
            }}
            isEnviandoImagem={isProcessandoImagem}
          />
        ) : null}
      </main>

      {/* INDICADOR DE CARREGAMENTO DO GEMINI */}
      {isProcessandoImagem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 text-center shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              Analisando Comprovante com IA
            </h4>
            <p className="text-xs text-slate-500">
              {statusProcessamentoTexto || 'Extraindo valores, datas, descrições e total do documento...'}
            </p>
          </div>
        </div>
      )}

      {/* TELA DE CONFERÊNCIA OBRIGATÓRIA (IMAGEM X TABELA EDITÁVEL) */}
      {dadosConferencia && (
        <ConferenceModal
          isOpen={true}
          onClose={() => setDadosConferencia(null)}
          acerto={acerto}
          tituloSugerido={dadosConferencia.tituloSugerido}
          pessoasIdentificadas={dadosConferencia.pessoasIdentificadas}
          pessoaAtualId={abaAtiva !== 'geral' ? abaAtiva : acerto.pessoas[0]?.id || 'geral'}
          imagemDataUrl={dadosConferencia.imagemDataUrl}
          imagemHash={dadosConferencia.imagemHash}
          nomeArquivo={dadosConferencia.nomeArquivo}
          tamanhoBytes={dadosConferencia.tamanhoBytes}
          tipoDocumentoIdentificado={dadosConferencia.tipoDocumentoIdentificado}
          totalEscritoCentavos={dadosConferencia.totalEscritoCentavos}
          totalEscritoFormatado={dadosConferencia.totalEscritoFormatado}
          observacoesOCR={dadosConferencia.observacoesOCR}
          linhasIniciais={dadosConferencia.linhasIniciais}
          isDuplicada={dadosConferencia.isDuplicada}
          onConfirmar={handleConfirmarConferencia}
        />
      )}

      {/* MODAL LANÇAMENTO MANUAL / EDITAR */}
      {modalLancamentoAberto && (
        <LancamentoFormModal
          isOpen={modalLancamentoAberto}
          onClose={() => {
            setModalLancamentoAberto(false);
            setLancamentoEmEdicao(null);
          }}
          acerto={acerto}
          pessoaAtualId={abaAtiva !== 'geral' ? abaAtiva : acerto.pessoas[0]?.id || 'geral'}
          tipoPreSelecionado={tipoPreSelecionado}
          lancamentoEmEdicao={lancamentoEmEdicao}
          onSalvar={handleSalvarLancamento}
          onDuplicar={handleDuplicarLancamento}
        />
      )}

      {/* MODAL EXPORTAR PDF */}
      {modalPdfAberto && (
        <PdfExportModal
          isOpen={modalPdfAberto}
          onClose={() => setModalPdfAberto(false)}
          acerto={acerto}
          lancamentos={lancamentos}
          imagens={imagens}
          pessoaPreSelecionadaId={pdfPessoaIdFoco}
        />
      )}

      {/* MODAL AGENTE FINANCEIRO */}
      {modalAgenteAberto && (
        <AgenteFinanceiroModal
          isOpen={modalAgenteAberto}
          onClose={() => setModalAgenteAberto(false)}
          acerto={acerto}
          lancamentos={lancamentos}
          onSelecionarPessoa={(id) => {
            handleTrocarAba(id);
            setModalAgenteAberto(false);
          }}
        />
      )}

      {/* MODAL BACKUP */}
      {modalBackupAberto && (
        <BackupModal
          isOpen={modalBackupAberto}
          onClose={() => setModalBackupAberto(false)}
          onBackupRestaurado={recarregarTudo}
        />
      )}

      {/* MODAL NOVA PESSOA */}
      {modalNovaPessoa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
              Adicionar Nova Pessoa ao Acerto
            </h3>
            <form onSubmit={handleAdicionarPessoa} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Nome da Pessoa ou Fornecedor *
                </label>
                <input
                  type="text"
                  value={nomeNovaPessoa}
                  onChange={(e) => setNomeNovaPessoa(e.target.value)}
                  placeholder="Ex: Carlos Eletricista, Loja Baratão, etc."
                  required
                  autoFocus
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Papel ou Função (Opcional)
                </label>
                <input
                  type="text"
                  value={papelNovaPessoa}
                  onChange={(e) => setPapelNovaPessoa(e.target.value)}
                  placeholder="Ex: Pedreiro, Fornecedor, Pintor, Parceiro"
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNovaPessoa(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Adicionar Pessoa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST DE DESFAZER EXCLUSÃO */}
      {toastDesfazer && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 animate-slide-up">
          <span className="text-xs font-medium">{toastDesfazer.mensagem}</span>
          <button
            onClick={handleDesfazerExclusao}
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
          >
            DESFAZER
          </button>
          <button
            onClick={() => setToastDesfazer(null)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

    </div>
  );
};
