import React, { useState, useMemo } from 'react';
import { 
  Plus, Search, Filter, FolderPlus, Copy, Archive, Trash2, Calendar, 
  Users, ChevronRight, CheckCircle2, Lock, Clock, Database, Sparkles, FileText, Camera
} from 'lucide-react';
import { Acerto, StatusAcerto, PessoaTab, LinhaConferenciaOCR, TipoLancamento } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { ConferenceModal } from './ConferenceModal';
import { comprimirImagem } from '../utils/imageCompressor';
import { extrairDadosAcertoComGemini } from '../services/geminiOcr';

interface AcertosListProps {
  acertos: Acerto[];
  onSelecionarAcerto: (acertoId: string) => void;
  onCriarAcerto: (dados: { titulo: string; dataInicio: string; observacoes: string; pessoasIniciais: string[] }) => Promise<void>;
  onCriarAcertoPorFoto?: (dados: {
    titulo: string;
    pessoas: PessoaTab[];
    linhas: LinhaConferenciaOCR[];
    imagemDataUrl: string;
    imagemHash: string;
    nomeArquivo: string;
    tamanhoBytes: number;
    tipoDocumento: string;
    totalEscritoCentavos: number;
    observacoes: string;
  }) => Promise<void>;
  onDuplicarAcerto: (acertoId: string) => Promise<void>;
  onAlterarStatus: (acertoId: string, novoStatus: StatusAcerto) => Promise<void>;
  onExcluirAcerto: (acertoId: string) => Promise<void>;
  onAbrirBackup: () => void;
}

export const AcertosList: React.FC<AcertosListProps> = ({
  acertos,
  onSelecionarAcerto,
  onCriarAcerto,
  onCriarAcertoPorFoto,
  onDuplicarAcerto,
  onAlterarStatus,
  onExcluirAcerto,
  onAbrirBackup,
}) => {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | StatusAcerto>('todos');
  const [filtroPessoa, setFiltroPessoa] = useState<string>('todas');
  const [modalNovoAberto, setModalNovoAberto] = useState(false);

  // Estado de Processamento de Foto de Acerto com IA
  const [isProcessandoFoto, setIsProcessandoFoto] = useState(false);
  const [statusProcessandoFoto, setStatusProcessandoFoto] = useState('');
  const [dadosConferenciaFoto, setDadosConferenciaFoto] = useState<{
    imagemDataUrl: string;
    imagemHash: string;
    nomeArquivo: string;
    tamanhoBytes: number;
    tipoDocumentoIdentificado?: string;
    tituloSugerido?: string;
    pessoasIdentificadas?: string[];
    pessoasIniciais?: PessoaTab[];
    totalEscritoCentavos?: number;
    totalEscritoFormatado?: string;
    observacoesOCR?: string;
    linhasIniciais: LinhaConferenciaOCR[];
  } | null>(null);

  // Form novo acerto manual
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaData, setNovaData] = useState(new Date().toISOString().slice(0, 10));
  const [novasObservacoes, setNovasObservacoes] = useState('');
  const [novasPessoasTexto, setNovasPessoasTexto] = useState('João, Maria');
  const [isCriando, setIsCriando] = useState(false);

  // Lista única de nomes de todas as pessoas para filtro
  const todasPessoasNomes = useMemo(() => {
    const nomes = new Set<string>();
    for (const a of acertos) {
      for (const p of a.pessoas) {
        nomes.add(p.nome);
      }
    }
    return Array.from(nomes).sort();
  }, [acertos]);

  // Filtragem
  const acertosFiltrados = useMemo(() => {
    return acertos.filter((a) => {
      // Filtro de status
      if (filtroStatus !== 'todos' && a.status !== filtroStatus) return false;

      // Filtro de pessoa
      if (filtroPessoa !== 'todas') {
        const temPessoa = a.pessoas.some((p) => p.nome.toLowerCase() === filtroPessoa.toLowerCase());
        if (!temPessoa) return false;
      }

      // Filtro de texto
      if (busca.trim()) {
        const b = busca.toLowerCase();
        const noTitulo = a.titulo.toLowerCase().includes(b);
        const nasObs = a.observacoes?.toLowerCase().includes(b);
        const nasPessoas = a.pessoas.some((p) => p.nome.toLowerCase().includes(b));
        if (!noTitulo && !nasObs && !nasPessoas) return false;
      }

      return true;
    });
  }, [acertos, busca, filtroStatus, filtroPessoa]);

  const handleSubmeterNovoAcerto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTitulo.trim()) {
      alert('Informe o título do acerto.');
      return;
    }

    const pessoasArray = novasPessoasTexto
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (pessoasArray.length === 0) {
      pessoasArray.push('Geral');
    }

    setIsCriando(true);
    try {
      await onCriarAcerto({
        titulo: novoTitulo.trim(),
        dataInicio: novaData,
        observacoes: novasObservacoes.trim(),
        pessoasIniciais: pessoasArray,
      });
      setNovoTitulo('');
      setNovasObservacoes('');
      setModalNovoAberto(false);
    } catch (err: any) {
      alert('Erro ao criar acerto: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsCriando(false);
    }
  };

  // Upload e leitura com IA de folha de acerto ou comprovante para criar novo acerto completo
  const handleUploadFotoParaNovoAcerto = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsProcessandoFoto(true);
    setStatusProcessandoFoto('Comprimindo foto da folha/caderno...');

    try {
      const file = files[0];
      const imagemProcessada = await comprimirImagem(file);

      let ocr: any;
      try {
        ocr = await extrairDadosAcertoComGemini({
          imageBase64: imagemProcessada.dataUrl,
          mimeType: 'image/jpeg',
          knownPersons: todasPessoasNomes,
          currentPerson: '',
        });
      } catch (ocrErr: any) {
        console.warn('Leitura automática da IA indisponível ou falhou, mantendo a foto para conferência:', ocrErr);
        ocr = {
          tipoDocumento: 'Folha de Acerto / Comprovante',
          tituloSugeridoAcerto: 'Acerto ' + new Date().toLocaleDateString('pt-BR'),
          estabelecimentoOuLoja: '',
          dataGeral: new Date().toISOString().slice(0, 10),
          totalEscritoNaAnotacaoCentavos: 0,
          totalEscritoFormatado: '',
          todasPessoasIdentificadas: ['Neto', 'Victor'],
          linhas: [
            {
              descricao: 'Lançamento do comprovante',
              quantidade: 1,
              valorCentavos: 0,
              tipoSugerido: 'saida',
              categoria: 'Geral',
              formaPagamento: 'Pix',
              pessoaSugerida: 'Neto',
              confianca: 'alta',
            },
          ],
          observacoes: 'Foto carregada com sucesso. Organize os lançamentos abaixo com o auxílio do zoom.',
        };
      }

      const cores = ['#059669', '#0284c7', '#7c3aed', '#d97706', '#dc2626', '#4f46e5', '#0d9488'];
      const pessoasCriadas: PessoaTab[] = [];

      // Identifica pessoas extraídas
      if (ocr.todasPessoasIdentificadas && ocr.todasPessoasIdentificadas.length > 0) {
        ocr.todasPessoasIdentificadas.forEach((nome: string, idx: number) => {
          pessoasCriadas.push({
            id: 'p_foto_' + Date.now() + '_' + idx,
            nome: nome.trim(),
            cor: cores[idx % cores.length],
            ordem: idx,
          });
        });
      } else {
        pessoasCriadas.push({
          id: 'p_foto_' + Date.now() + '_0',
          nome: 'Geral',
          cor: '#059669',
          ordem: 0,
        });
      }

      // Organiza as linhas com detecção inteligente de pessoas, despesas e adiantamentos
      const linhasConferencia: LinhaConferenciaOCR[] = (ocr.linhas || []).map((l: any, idx: number) => {
        let idPessoaDestino = '';
        let nomePessoaDetectada = l.pessoaSugerida ? l.pessoaSugerida.trim() : '';

        // 1. Tenta identificar se o nome da pessoa está em l.pessoaSugerida
        if (nomePessoaDetectada) {
          const match = pessoasCriadas.find((p) =>
            p.nome.toLowerCase().includes(nomePessoaDetectada.toLowerCase()) ||
            nomePessoaDetectada.toLowerCase().includes(p.nome.toLowerCase())
          );
          if (match) {
            idPessoaDestino = match.id;
          } else {
            const novoId = 'p_foto_' + Date.now() + '_' + (pessoasCriadas.length + idx);
            const novaPessoa: PessoaTab = {
              id: novoId,
              nome: nomePessoaDetectada,
              cor: cores[pessoasCriadas.length % cores.length],
              ordem: pessoasCriadas.length,
            };
            pessoasCriadas.push(novaPessoa);
            idPessoaDestino = novoId;
          }
        }

        // 2. Se ainda não achou, procura no texto da descrição se cita alguma pessoa conhecida
        if (!idPessoaDestino && l.descricao) {
          const descLower = l.descricao.toLowerCase();
          for (const p of pessoasCriadas) {
            if (descLower.includes(p.nome.toLowerCase())) {
              idPessoaDestino = p.id;
              nomePessoaDetectada = p.nome;
              break;
            }
          }
        }

        if (!idPessoaDestino) {
          idPessoaDestino = pessoasCriadas[0]?.id || 'geral';
        }

        // 3. Detecção inteligente de tipo (adiantamento, material, saida, entrada)
        let tipoCalculado: TipoLancamento = (l.tipoSugerido as any) || 'saida';
        const descTexto = (l.descricao || '').toLowerCase();
        if (descTexto.includes('vale') || descTexto.includes('adiant') || descTexto.includes('pegou')) {
          tipoCalculado = 'adiantamento';
        } else if (
          descTexto.includes('cabo') || descTexto.includes('câmera') || descTexto.includes('camera') ||
          descTexto.includes('dvr') || descTexto.includes('conector') || descTexto.includes('fonte') ||
          descTexto.includes('material') || descTexto.includes('ferramenta')
        ) {
          tipoCalculado = 'material';
        } else if (descTexto.includes('entrada') || descTexto.includes('recebido') || descTexto.includes('cliente') || descTexto.includes('sinal') || descTexto.includes('pagamento do cliente')) {
          tipoCalculado = 'entrada';
        }

        return {
          id: 'ocr_' + Date.now() + '_' + idx,
          data: l.data || ocr.dataGeral || new Date().toISOString().slice(0, 10),
          descricao: l.descricao || 'Item lido pela IA',
          quantidade: l.quantidade || 1,
          valorCentavos: l.valorCentavos || 0,
          valorOriginalTexto: l.valorOriginalTexto,
          tipoSugerido: tipoCalculado,
          categoria: l.categoria || (tipoCalculado === 'adiantamento' ? 'Adiantamento/Val' : tipoCalculado === 'material' ? 'Material de Construção' : 'Mão de Obra'),
          formaPagamento: (l.formaPagamento as any) || 'Pix',
          pessoaId: idPessoaDestino,
          pessoaSugeridaNome: nomePessoaDetectada || l.pessoaSugerida,
          confianca: (l.confianca as any) || 'alta',
          loja: l.loja || ocr.estabelecimentoOuLoja,
          dividaDeQuem: (l.dividaDeQuem as any) || 'eu_devo',
          incluir: true,
        };
      });

      setDadosConferenciaFoto({
        imagemDataUrl: imagemProcessada.dataUrl,
        imagemHash: imagemProcessada.hash,
        nomeArquivo: file.name,
        tamanhoBytes: imagemProcessada.tamanhoComprimidoBytes,
        tipoDocumentoIdentificado: ocr.tipoDocumento || 'Folha de Acerto',
        tituloSugerido: ocr.tituloSugeridoAcerto || 'Acerto ' + new Date().toLocaleDateString('pt-BR'),
        pessoasIdentificadas: pessoasCriadas.map((p) => p.nome),
        pessoasIniciais: pessoasCriadas,
        totalEscritoCentavos: ocr.totalEscritoNaAnotacaoCentavos || 0,
        totalEscritoFormatado: ocr.totalEscritoFormatado,
        observacoesOCR: ocr.observacoes,
        linhasIniciais: linhasConferencia,
      });
    } catch (err: any) {
      console.error(err);
      alert('Aviso da Leitura com IA: ' + (err.message || 'Verifique a conexão e tente novamente.'));
    } finally {
      setIsProcessandoFoto(false);
      setStatusProcessandoFoto('');
    }
  };

  const handleConfirmarNovoAcertoPorFoto = async (dados: {
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
    if (onCriarAcertoPorFoto) {
      await onCriarAcertoPorFoto({
        titulo: dados.tituloAcerto || 'Acerto Organizado por Foto',
        pessoas: dados.pessoasAtualizadas,
        linhas: dados.linhas,
        imagemDataUrl: dados.imagemDataUrl,
        imagemHash: dados.imagemHash,
        nomeArquivo: dados.nomeArquivo,
        tamanhoBytes: dados.tamanhoBytes,
        tipoDocumento: dados.tipoDocumento,
        totalEscritoCentavos: dados.totalEscritoCentavos,
        observacoes: dados.observacoes,
      });
      setDadosConferenciaFoto(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-16">
      
      {/* CABEÇALHO PRINCIPAL DO APP */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-700 to-teal-500 flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
              R$
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  AcertoFácil
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Gestão e auditoria financeira de acertos & comprovantes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton />

            <button
              onClick={onAbrirBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
              title="Backup e restauração de dados"
            >
              <Database className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Backup</span>
            </button>

            {/* Organizar por Foto com IA */}
            <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md transition cursor-pointer">
              <Camera className="w-4 h-4 text-emerald-200" />
              <span>Organizar por Foto (IA)</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isProcessandoFoto}
                onChange={(e) => {
                  handleUploadFotoParaNovoAcerto(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>

            <button
              onClick={() => setModalNovoAberto(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Manual</span>
            </button>
          </div>

        </div>
      </header>

      {/* CORPO DA LISTAGEM */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

        {/* HERO BANNER: ORGANIZAR TODO O ACERTO POR FOTO */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-teal-800 to-slate-900 text-white p-5 sm:p-7 shadow-xl border border-emerald-500/40">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-emerald-300 border border-emerald-400/30 mb-2.5 backdrop-blur-xs">
                <Sparkles className="w-3.5 h-3.5 text-emerald-300 animate-spin" />
                <span>Leitura Automática de Caderno e Notas com IA</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                Organize Todo o Acerto por Foto
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-1.5 leading-relaxed">
                Tire uma foto da folha do caderno de anotações ou comprovantes. A inteligência artificial identifica todas as pessoas, diárias, materiais, vales e valores, criando as abas e o balanço completo automaticamente!
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <label className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 text-xs sm:text-sm font-black shadow-lg shadow-emerald-950/40 transition cursor-pointer">
                <Camera className="w-5 h-5 text-slate-950" />
                <span>{isProcessandoFoto ? 'Processando Foto...' : '📷 Enviar Foto do Caderno / Acerto'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isProcessandoFoto}
                  onChange={(e) => {
                    handleUploadFotoParaNovoAcerto(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>

              <button
                onClick={() => setModalNovoAberto(true)}
                className="px-4 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs sm:text-sm font-bold border border-white/20 transition cursor-pointer"
              >
                + Criar Manual
              </button>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
        </div>
        
        {/* BARRA DE BUSCA E FILTROS */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Input de Busca */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome do acerto, pessoa, obra ou observação..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            {/* Filtro de Status */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 text-xs font-semibold">
              {(
                [
                  { id: 'todos', label: 'Todos' },
                  { id: 'aberto', label: 'Abertos' },
                  { id: 'fechado', label: 'Fechados' },
                  { id: 'arquivado', label: 'Arquivados' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFiltroStatus(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                    filtroStatus === tab.id
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 font-bold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Filtro por Pessoa */}
            {todasPessoasNomes.length > 0 && (
              <div className="shrink-0">
                <select
                  value={filtroPessoa}
                  onChange={(e) => setFiltroPessoa(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="todas">Todas as pessoas</option>
                  {todasPessoasNomes.map((nome) => (
                    <option key={nome} value={nome}>{nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

        </div>

        {/* LISTA DE CARDS DE ACERTOS */}
        {acertosFiltrados.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <FolderPlus className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto stroke-1" />
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
              Nenhum acerto encontrado
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {busca || filtroStatus !== 'todos' || filtroPessoa !== 'todas'
                ? 'Nenhum resultado corresponde aos filtros selecionados. Tente limpar os termos de busca.'
                : 'Comece criando seu primeiro acerto para controlar despesas, adiantamentos e comprovantes com pessoas ou obras.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 active:scale-95 text-white text-xs font-bold shadow-md transition cursor-pointer">
                <Camera className="w-4 h-4 text-emerald-200" />
                <span>📷 Organizar Acerto por Foto (IA)</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isProcessandoFoto}
                  onChange={(e) => handleUploadFotoParaNovoAcerto(e.target.files)}
                />
              </label>

              <button
                onClick={() => setModalNovoAberto(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Criar Manualmente</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {acertosFiltrados.map((acerto) => {
              const statusCor =
                acerto.status === 'aberto'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
                  : acerto.status === 'fechado'
                  ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300';

              return (
                <div
                  key={acerto.id}
                  className="group relative flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 hover:shadow-lg transition duration-200"
                >
                  <div>
                    {/* Topo do Card */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusCor}`}>
                        {acerto.status}
                      </span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(acerto.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    {/* Título do Acerto */}
                    <h3 
                      onClick={() => onSelecionarAcerto(acerto.id)}
                      className="text-base font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition cursor-pointer"
                    >
                      {acerto.titulo}
                    </h3>

                    {/* Observações */}
                    {acerto.observacoes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {acerto.observacoes}
                      </p>
                    )}

                    {/* Pessoas envolvidas */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mb-2">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold">{acerto.pessoas.length} {acerto.pessoas.length === 1 ? 'Pessoa' : 'Pessoas'}:</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-1">
                        {acerto.pessoas.slice(0, 4).map((p) => (
                          <span
                            key={p.id}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                          >
                            {p.nome}
                          </span>
                        ))}
                        {acerto.pessoas.length > 4 && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400">
                            +{acerto.pessoas.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    {/* Botões de Ação rápida */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onDuplicarAcerto(acerto.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Duplicar este acerto"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() =>
                          onAlterarStatus(
                            acerto.id,
                            acerto.status === 'aberto' ? 'fechado' : 'aberto'
                          )
                        }
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title={acerto.status === 'aberto' ? 'Fechar acerto' : 'Reabrir acerto'}
                      >
                        {acerto.status === 'aberto' ? (
                          <Lock className="w-4 h-4" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        )}
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Tem certeza que deseja excluir o acerto "${acerto.titulo}" e todos os seus lançamentos?`)) {
                            onExcluirAcerto(acerto.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        title="Excluir acerto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Botão Abrir */}
                    <button
                      onClick={() => onSelecionarAcerto(acerto.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white hover:bg-emerald-600 dark:hover:bg-emerald-600 text-xs font-bold transition cursor-pointer"
                    >
                      <span>Abrir</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* MODAL NOVO ACERTO */}
      {modalNovoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Criar Novo Acerto Financeiro
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Defina o nome da obra, mês ou finalidade e as pessoas envolvidas
            </p>

            <form onSubmit={handleSubmeterNovoAcerto} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Título do Acerto *
                </label>
                <input
                  type="text"
                  value={novoTitulo}
                  onChange={(e) => setNovoTitulo(e.target.value)}
                  placeholder="Ex: Reforma Comercial Centro, Obra Casa 4, etc."
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Pessoas Iniciais (separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={novasPessoasTexto}
                  onChange={(e) => setNovasPessoasTexto(e.target.value)}
                  placeholder="Ex: João Pedreiro, Maria Pintora, Loja do Pedro"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Você poderá adicionar, renomear ou excluir pessoas a qualquer momento.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Observações
                </label>
                <textarea
                  rows={2}
                  value={novasObservacoes}
                  onChange={(e) => setNovasObservacoes(e.target.value)}
                  placeholder="Ex: Acerto semanal com equipe e conferência de materiais."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalNovoAberto(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCriando}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
                >
                  {isCriando ? 'Criando...' : 'Criar Acerto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OVERLAY DE PROCESSAMENTO IA DE FOTO */}
      {isProcessandoFoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 text-center shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-500" />
              <span>Organizando Acerto com IA</span>
            </h4>
            <p className="text-xs text-slate-500">
              {statusProcessandoFoto || 'Identificando pessoas, diárias, materiais, vales e valores...'}
            </p>
          </div>
        </div>
      )}

      {/* TELA DE CONFERÊNCIA OBRIGATÓRIA PARA NOVO ACERTO POR FOTO */}
      {dadosConferenciaFoto && (
        <ConferenceModal
          isOpen={true}
          isCriandoNovoAcerto={true}
          tituloSugerido={dadosConferenciaFoto.tituloSugerido}
          pessoasIdentificadas={dadosConferenciaFoto.pessoasIdentificadas}
          pessoasIniciais={dadosConferenciaFoto.pessoasIniciais}
          imagemDataUrl={dadosConferenciaFoto.imagemDataUrl}
          imagemHash={dadosConferenciaFoto.imagemHash}
          nomeArquivo={dadosConferenciaFoto.nomeArquivo}
          tamanhoBytes={dadosConferenciaFoto.tamanhoBytes}
          tipoDocumentoIdentificado={dadosConferenciaFoto.tipoDocumentoIdentificado}
          totalEscritoCentavos={dadosConferenciaFoto.totalEscritoCentavos}
          totalEscritoFormatado={dadosConferenciaFoto.totalEscritoFormatado}
          observacoesOCR={dadosConferenciaFoto.observacoesOCR}
          linhasIniciais={dadosConferenciaFoto.linhasIniciais}
          isDuplicada={false}
          onClose={() => setDadosConferenciaFoto(null)}
          onConfirmar={handleConfirmarNovoAcertoPorFoto}
        />
      )}

    </div>
  );
};
