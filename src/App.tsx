/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Acerto, StatusAcerto, PessoaTab } from './types';
import { 
  listarAcertos, obterAcerto, salvarAcerto, duplicarAcerto, excluirAcerto, 
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

  const handleAtualizarAcerto = (acertoAtualizado: Acerto) => {
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
