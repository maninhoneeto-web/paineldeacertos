import React, { useState } from 'react';
import { X, Download, Upload, Database, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { exportarBackup, importarBackup } from '../services/db';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackupRestaurado: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  onBackupRestaurado,
}) => {
  const [isExportando, setIsExportando] = useState(false);
  const [isImportando, setIsImportando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExportar = async () => {
    setIsExportando(true);
    setErro(null);
    setMensagemSucesso(null);
    try {
      const jsonBackup = await exportarBackup();
      const blob = new Blob([jsonBackup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dataStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `backup_acerto_facil_${dataStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMensagemSucesso('Backup completo exportado e baixado com sucesso!');
    } catch (e: any) {
      setErro('Erro ao exportar backup: ' + (e.message || 'Erro desconhecido.'));
    } finally {
      setIsExportando(false);
    }
  };

  const handleImportarArquivo = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setErro('Por favor, selecione um arquivo de backup com extensão .json válido.');
      return;
    }

    if (!confirm('Atenção: A restauração de backup adicionará e atualizará os acertos, lançamentos e fotos salvas. Deseja prosseguir?')) {
      return;
    }

    setIsImportando(true);
    setErro(null);
    setMensagemSucesso(null);

    try {
      const texto = await file.text();
      const resultado = await importarBackup(texto);
      setMensagemSucesso(`Backup restaurado com sucesso! ${resultado.acertosCount} acertos, ${resultado.lancamentosCount} lançamentos e ${resultado.imagensCount} comprovantes recuperados.`);
      onBackupRestaurado();
    } catch (e: any) {
      setErro('Falha ao restaurar backup: ' + (e.message || 'Arquivo corrompido ou formato incompatível.'));
    } finally {
      setIsImportando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Backup Completo dos Dados
              </h3>
              <p className="text-xs text-slate-500">
                Guarde seus acertos, comprovantes e fotos em segurança
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="p-5 space-y-4 text-xs sm:text-sm">
          
          {mensagemSucesso && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
              <span>{mensagemSucesso}</span>
            </div>
          )}

          {erro && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />
              <span>{erro}</span>
            </div>
          )}

          {/* Opção 1: Exportar */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Exportar Arquivo de Backup</span>
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Gera um arquivo JSON contendo todos os acertos, lançamentos, histórico e imagens compactadas para você salvar no Google Drive, celular ou pen drive.
            </p>
            <button
              onClick={handleExportar}
              disabled={isExportando}
              className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isExportando ? 'Preparando arquivo...' : 'Baixar Backup Completo'}</span>
            </button>
          </div>

          {/* Opção 2: Importar / Restaurar */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" />
              <span>Restaurar Backup</span>
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Carregue um arquivo JSON gerado anteriormente pelo AcertoFácil para restaurar todas as informações em outro celular ou computador.
            </p>
            <label className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-xs transition cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{isImportando ? 'Restaurando...' : 'Selecionar Arquivo JSON'}</span>
              <input
                type="file"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportarArquivo(file);
                }}
                disabled={isImportando}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Todos os dados são armazenados localmente no seu navegador via IndexedDB.</span>
          </div>

        </div>

        {/* Rodapé */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
