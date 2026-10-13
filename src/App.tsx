/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Acerto, StatusAcerto, PessoaTab, LinhaConferenciaOCR, ImagemComprovante, Lancamento } from './types';
import { 
  listarAcertos, obterAcerto, salvarAcerto, duplicarAcerto, excluirAcerto, 
  salvarImagem, salvarMultiplosLancamentos, registrarHistorico,
  inicializarDadosSeNecessario, salvarConfig, obterConfig 
} from './services/db';
import { AcertosList } from './components/AcertosList';
import { AcertoView } from './components/AcertoView';
import { BackupModal } from './components/BackupModal';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
  const [acertos, setAcertos] = useState<Acerto[]>([]);
  const [acertoAtivoId, setAcertoAtivoId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [modalBackupGlobal, setModalBackupGlobal] = useState(false);

  // Inicialização e recuperação da continuidade do usuário
  useEffect(() => {
    async function inicializar() {
      setCarregando(true);
      try {
        await inicializarDadosSeNecessario();
        const lista = await listarAcertos();
        setAcertos(lista);

        // Continua de onde parou
        const ultimoId = await obterConfig<string>('ultimoAcertoAtivoId');
        if (ultimoId && lista.some((a) => a.id === ultimoId)) {
          setAcertoAtivoId(ultimoId);
        }
      } catch (err) {
        console.error('Erro na inicialização do AcertoFácil:', err);
      } finally {
        setCarregando(false);
      }
    }
    inicializar();
  }, []);

  const recarregarAcertos = async () => {
    const lista = await listarAcertos();
    setAcertos(lista);
  };

  const handleSelecionarAcerto = (id: string) => {
    setAcertoAtivoId(id);
    salvarConfig('ultimoAcertoAtivoId', id);
  };

  const handleVoltarParaLista = () => {
    setAcertoAtivoId(null);
    salvarConfig('ultimoAcertoAtivoId', null);
    recarregarAcertos();
  };

  const handleCriarAcerto = async (dados: {
    titulo: string;
    dataInicio: string;
    observacoes: string;
    pessoasIniciais: string[];
  }) => {
    const id = 'acerto_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const cores = ['#059669', '#0284c7', '#7c3aed', '#d97706', '#dc2626', '#4f46e5', '#0d9488'];

    const pessoas: PessoaTab[] = dados.pessoasIniciais.map((nome, idx) => ({
      id: 'p_' + Date.now() + '_' + idx,
      nome,
      cor: cores[idx % cores.length],
      ordem: idx,
    }));

    const novoAcerto: Acerto = {
      id,
      titulo: dados.titulo,
      dataInicio: dados.dataInicio,
      status: 'aberto',
      observacoes: dados.observacoes,
      pessoas,
      categorias: [
        'Mão de Obra',
        'Material de Construção',
        'Alimentação',
        'Combustível',
        'Ferramentas',
        'Transporte',
        'Outros',
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await salvarAcerto(novoAcerto);
    await recarregarAcertos();
    handleSelecionarAcerto(id);
  };

  const handleCriarAcertoCompletoPorFoto = async (dados: {
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
  }) => {
    const acertoId = 'acerto_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const imagemId = 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

    const novoAcerto: Acerto = {
      id: acertoId,
      titulo: dados.titulo || 'Acerto Organizado por Foto',
      dataInicio: new Date().toISOString().slice(0, 10),
      status: 'aberto',
      observacoes: dados.observacoes || 'Criado e organizado automaticamente por IA a partir de folha de acerto.',
      pessoas: dados.pessoas,
      categorias: [
        'Mão de Obra',
        'Material de Construção',
        'Alimentação',
        'Combustível',
        'Ferramentas',
        'Transporte',
        'Outros',
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await salvarAcerto(novoAcerto);

    const lancamentosParaSalvar: Lancamento[] = [];
    const lancamentosIds: string[] = [];

    for (const linha of dados.linhas) {
      const lid = 'lanc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      lancamentosIds.push(lid);
      lancamentosParaSalvar.push({
        id: lid,
        acertoId,
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
      acertoId,
      pessoaId: dados.pessoas[0]?.id || 'geral',
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
      acertoId,
      acao: 'criacao',
      tipoItem: 'acerto',
      detalhes: `Acerto criado e estruturado automaticamente por IA com ${dados.pessoas.length} abas de pessoas e ${lancamentosParaSalvar.length} lançamentos.`,
    });

    await recarregarAcertos();
    handleSelecionarAcerto(acertoId);
  };

  const handleDuplicarAcerto = async (id: string) => {
    await duplicarAcerto(id);
    await recarregarAcertos();
  };

  const handleAlterarStatus = async (id: string, novoStatus: StatusAcerto) => {
    const a = await obterAcerto(id);
    if (a) {
      a.status = novoStatus;
      await salvarAcerto(a);
      await recarregarAcertos();
    }
  };

  const handleExcluirAcerto = async (id: string) => {
    await excluirAcerto(id);
    if (acertoAtivoId === id) {
      setAcertoAtivoId(null);
    }
    await recarregarAcertos();
  };

  const handleAtualizarAcerto = async (acertoAtualizado: Acerto) => {
    await salvarAcerto(acertoAtualizado);
    setAcertos((prev) =>
      prev.map((a) => (a.id === acertoAtualizado.id ? acertoAtualizado : a))
    );
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-2xl font-black mb-4 shadow-xl animate-pulse">
          R$
        </div>
        <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-2" />
        <p className="text-xs text-slate-400 font-medium">Inicializando AcertoFácil...</p>
      </div>
    );
  }

  const acertoAtivo = acertos.find((a) => a.id === acertoAtivoId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {acertoAtivo ? (
        <AcertoView
          acerto={acertoAtivo}
          onVoltar={handleVoltarParaLista}
          onAtualizarAcerto={handleAtualizarAcerto}
        />
      ) : (
        <AcertosList
          acertos={acertos}
          onSelecionarAcerto={handleSelecionarAcerto}
          onCriarAcerto={handleCriarAcerto}
          onCriarAcertoPorFoto={handleCriarAcertoCompletoPorFoto}
          onDuplicarAcerto={handleDuplicarAcerto}
          onAlterarStatus={handleAlterarStatus}
          onExcluirAcerto={handleExcluirAcerto}
          onAbrirBackup={() => setModalBackupGlobal(true)}
        />
      )}

      {/* Modal de Backup acessível de qualquer lugar */}
      {modalBackupGlobal && (
        <BackupModal
          isOpen={modalBackupGlobal}
          onClose={() => setModalBackupGlobal(false)}
          onBackupRestaurado={recarregarAcertos}
        />
      )}

      {/* Indicador de Status Offline */}
      <OfflineIndicator />
    </div>
  );
}
