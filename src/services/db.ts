/**
 * Camada de persistência local em IndexedDB com suporte a imagens em alta resolução,
 * persistência dupla (IndexedDB + LocalStorage Snapshot), logs detalhados de transação
 * para diagnóstico na Vercel / PWA, e prevenção de perda de dados.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Acerto, Lancamento, ImagemComprovante, HistoricoItem } from '../types';

interface AcertoFácilDB extends DBSchema {
  acertos: {
    key: string;
    value: Acerto;
    indexes: { 'by-status': string; 'by-updatedAt': string };
  };
  lancamentos: {
    key: string;
    value: Lancamento;
    indexes: { 'by-acerto': string; 'by-pessoa': string; 'by-tipo': string };
  };
  imagens: {
    key: string;
    value: ImagemComprovante;
    indexes: { 'by-acerto': string; 'by-pessoa': string; 'by-hash': string };
  };
  historico: {
    key: string;
    value: HistoricoItem;
    indexes: { 'by-acerto': string; 'by-timestamp': string };
  };
  config: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'acerto_facil_db';
const DB_VERSION = 1;

// Chaves de snapshot do LocalStorage para redundância dupla e contingência
const SNAPSHOT_KEY_ACERTOS = 'paineldeacertos_backup_acertos_v1';
const SNAPSHOT_KEY_LANCAMENTOS = 'paineldeacertos_backup_lancs_v1';

let dbPromise: Promise<IDBPDatabase<AcertoFácilDB>> | null = null;

// Solicita persistência de armazenamento ao navegador (evita que o iOS/Safari/Chrome apague dados sob pressão)
export async function solicitarPersistenciaArmazenamento(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && 'storage' in navigator && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      console.log(`%c[DB:Storage] Persistência permanente do navegador: ${isPersisted ? 'CONCEDIDA (Dados protegidos)' : 'PADRÃO'}`, 'color: #059669; font-weight: bold;');
      
      if ('estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usadoMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(2);
        const quotaMB = ((estimate.quota || 0) / (1024 * 1024)).toFixed(2);
        console.log(`%c[DB:Storage] Uso de disco: ${usadoMB} MB / ${quotaMB} MB disponíveis`, 'color: #0284c7;');
      }
      return isPersisted;
    }
  } catch (err) {
    console.warn('[DB:Storage] Aviso ao consultar persistência do navegador:', err);
  }
  return false;
}

export function getDB(): Promise<IDBPDatabase<AcertoFácilDB>> {
  if (!dbPromise) {
    const start = performance.now();
    console.log(`%c[DB:Init] Inicializando conexão com IndexedDB "${DB_NAME}" (v${DB_VERSION})...`, 'color: #7c3aed; font-weight: bold;');
    
    dbPromise = openDB<AcertoFácilDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`%c[DB:Upgrade] Executando upgrade de v${oldVersion} para v${newVersion}...`, 'color: #d97706; font-weight: bold;');

        // Store: Acertos
        if (!db.objectStoreNames.contains('acertos')) {
          console.log('[DB:Upgrade] Criando objectStore "acertos"');
          const acertosStore = db.createObjectStore('acertos', { keyPath: 'id' });
          acertosStore.createIndex('by-status', 'status');
          acertosStore.createIndex('by-updatedAt', 'updatedAt');
        }

        // Store: Lançamentos
        if (!db.objectStoreNames.contains('lancamentos')) {
          console.log('[DB:Upgrade] Criando objectStore "lancamentos"');
          const lancamentosStore = db.createObjectStore('lancamentos', { keyPath: 'id' });
          lancamentosStore.createIndex('by-acerto', 'acertoId');
          lancamentosStore.createIndex('by-pessoa', 'pessoaId');
          lancamentosStore.createIndex('by-tipo', 'tipo');
        }

        // Store: Imagens
        if (!db.objectStoreNames.contains('imagens')) {
          console.log('[DB:Upgrade] Criando objectStore "imagens"');
          const imagensStore = db.createObjectStore('imagens', { keyPath: 'id' });
          imagensStore.createIndex('by-acerto', 'acertoId');
          imagensStore.createIndex('by-pessoa', 'pessoaId');
          imagensStore.createIndex('by-hash', 'hash');
        }

        // Store: Histórico
        if (!db.objectStoreNames.contains('historico')) {
          console.log('[DB:Upgrade] Criando objectStore "historico"');
          const historicoStore = db.createObjectStore('historico', { keyPath: 'id' });
          historicoStore.createIndex('by-acerto', 'acertoId');
          historicoStore.createIndex('by-timestamp', 'timestamp');
        }

        // Store: Configurações
        if (!db.objectStoreNames.contains('config')) {
          console.log('[DB:Upgrade] Criando objectStore "config"');
          db.createObjectStore('config');
        }
      },
      blocked() {
        console.warn('%c[DB:Blocked] Conexão bloqueada! Outra aba ou Service Worker está mantendo uma versão anterior aberta.', 'color: #dc2626; font-weight: bold;');
      },
      blocking() {
        console.warn('%c[DB:Blocking] Esta aba está bloqueando uma nova versão do IndexedDB. Fechando conexão antiga...', 'color: #dc2626;');
        if (dbPromise) {
          dbPromise.then((db) => db.close());
          dbPromise = null;
        }
      },
      terminated() {
        console.error('%c[DB:Terminated] Conexão com IndexedDB encerrada abruptamente pelo navegador.', 'color: #dc2626; font-weight: bold;');
        dbPromise = null;
      },
    });

    dbPromise.then(() => {
      const dur = (performance.now() - start).toFixed(1);
      console.log(`%c[DB:Ready] Conexão com IndexedDB estabelecida com sucesso em ${dur}ms`, 'color: #059669; font-weight: bold;');
      solicitarPersistenciaArmazenamento();
    }).catch((err) => {
      console.error('%c[DB:Error] Falha crítica ao abrir IndexedDB:', 'color: #dc2626; font-weight: bold;', err);
    });
  }
  return dbPromise;
}

// -------------------------------------------------------------
// REDUNDÂNCIA DUPLA: LOCALSTORAGE SNAPSHOTS
// -------------------------------------------------------------

function sincronizarSnapshotAcertoLocalStorage(acerto: Acerto) {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY_ACERTOS);
    const map: Record<string, Acerto> = raw ? JSON.parse(raw) : {};
    map[acerto.id] = acerto;
    localStorage.setItem(SNAPSHOT_KEY_ACERTOS, JSON.stringify(map));
    console.log(`%c[DB:Snapshot] Acerto "${acerto.titulo}" espelhado no LocalStorage (${acerto.id})`, 'color: #0284c7;');
  } catch (err) {
    console.warn('[DB:Snapshot] Falha ao espelhar acerto no LocalStorage:', err);
  }
}

function removerSnapshotAcertoLocalStorage(id: string) {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY_ACERTOS);
    if (raw) {
      const map: Record<string, Acerto> = JSON.parse(raw);
      delete map[id];
      localStorage.setItem(SNAPSHOT_KEY_ACERTOS, JSON.stringify(map));
      console.log(`%c[DB:Snapshot] Acerto ${id} removido do LocalStorage`, 'color: #64748b;');
    }
  } catch (err) {
    console.warn('[DB:Snapshot] Falha ao remover acerto do LocalStorage:', err);
  }
}

function sincronizarSnapshotLancamentoLocalStorage(lancamento: Lancamento) {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY_LANCAMENTOS);
    const map: Record<string, Lancamento> = raw ? JSON.parse(raw) : {};
    map[lancamento.id] = lancamento;
    localStorage.setItem(SNAPSHOT_KEY_LANCAMENTOS, JSON.stringify(map));
  } catch (err) {
    console.warn('[DB:Snapshot] Falha ao espelhar lançamento no LocalStorage:', err);
  }
}

function sincronizarMultiplosLancamentosLocalStorage(lancamentos: Lancamento[]) {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY_LANCAMENTOS);
    const map: Record<string, Lancamento> = raw ? JSON.parse(raw) : {};
    for (const l of lancamentos) {
      map[l.id] = l;
    }
    localStorage.setItem(SNAPSHOT_KEY_LANCAMENTOS, JSON.stringify(map));
    console.log(`%c[DB:Snapshot] ${lancamentos.length} lançamentos espelhados no LocalStorage com sucesso`, 'color: #0284c7;');
  } catch (err) {
    console.warn('[DB:Snapshot] Falha ao espelhar múltiplos lançamentos no LocalStorage:', err);
  }
}

function removerSnapshotLancamentoLocalStorage(id: string) {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY_LANCAMENTOS);
    if (raw) {
      const map: Record<string, Lancamento> = JSON.parse(raw);
      delete map[id];
      localStorage.setItem(SNAPSHOT_KEY_LANCAMENTOS, JSON.stringify(map));
    }
  } catch (err) {
    console.warn('[DB:Snapshot] Falha ao remover lançamento do LocalStorage:', err);
  }
}

// -------------------------------------------------------------
// OPERAÇÕES: ACERTOS
// -------------------------------------------------------------

export async function listarAcertos(): Promise<Acerto[]> {
  const start = performance.now();
  try {
    console.log('%c[DB:Tx] Iniciando listarAcertos()...', 'color: #4f46e5;');
    const db = await getDB();
    const list = await db.getAll('acertos');

    // Reconciliação com LocalStorage
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY_ACERTOS);
      if (raw) {
        const snapshotMap: Record<string, Acerto> = JSON.parse(raw);
        let restaurados = 0;
        for (const snap of Object.values(snapshotMap)) {
          if (!list.some((a) => a.id === snap.id)) {
            await db.put('acertos', snap);
            list.push(snap);
            restaurados++;
          }
        }
        if (restaurados > 0) {
          console.log(`%c[DB:Reconciliação] ${restaurados} acertos restaurados do LocalStorage para o IndexedDB`, 'color: #059669; font-weight: bold;');
        }
      }
    } catch (recErr) {
      console.warn('[DB:Reconciliação] Aviso ao reconciliar acertos:', recErr);
    }

    // Atualiza snapshot
    try {
      const map: Record<string, Acerto> = {};
      list.forEach((a) => {
        map[a.id] = a;
      });
      localStorage.setItem(SNAPSHOT_KEY_ACERTOS, JSON.stringify(map));
    } catch {}

    const dur = (performance.now() - start).toFixed(1);
    console.log(`%c[DB:Tx] listarAcertos() retornou ${list.length} acertos em ${dur}ms`, 'color: #059669;');
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (err) {
    console.warn('%c[DB:Tx:Fallback] Falha ao listar do IndexedDB, recorrendo ao LocalStorage snapshot:', 'color: #d97706;', err);
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY_ACERTOS);
      if (raw) {
        const snapshotMap: Record<string, Acerto> = JSON.parse(raw);
        const fallbackList = Object.values(snapshotMap);
        console.log(`%c[DB:Tx:Fallback] Recuperados ${fallbackList.length} acertos do LocalStorage com sucesso`, 'color: #059669; font-weight: bold;');
        return fallbackList.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      }
    } catch {}
    return [];
  }
}

export async function obterAcerto(id: string): Promise<Acerto | undefined> {
  const start = performance.now();
  try {
    console.log(`[DB:Tx] obterAcerto(${id})...`);
    const db = await getDB();
    const acerto = await db.get('acertos', id);
    if (acerto) {
      console.log(`[DB:Tx] obterAcerto(${id}) concluído em ${(performance.now() - start).toFixed(1)}ms`);
      return acerto;
    }
  } catch (err) {
    console.warn(`[DB:Tx] Falha ao obter acerto ${id} no IndexedDB:`, err);
  }

  // Fallback para snapshot
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY_ACERTOS);
    if (raw) {
      const snapshotMap: Record<string, Acerto> = JSON.parse(raw);
      const achado = snapshotMap[id];
      if (achado) {
        console.log(`[DB:Tx:Fallback] Acerto ${id} encontrado no LocalStorage snapshot`);
        return achado;
      }
    }
  } catch {}
  return undefined;
}

export async function salvarAcerto(acerto: Acerto): Promise<void> {
  const start = performance.now();
  acerto.updatedAt = new Date().toISOString();
  console.log(`%c[DB:Tx] Salvando acerto "${acerto.titulo}" (${acerto.id})...`, 'color: #4f46e5; font-weight: bold;');

  // 1. Durabilidade imediata no LocalStorage
  sincronizarSnapshotAcertoLocalStorage(acerto);

  // 2. Persistência no IndexedDB
  try {
    const db = await getDB();
    const tx = db.transaction('acertos', 'readwrite');
    await tx.objectStore('acertos').put(acerto);
    await tx.done;
    const dur = (performance.now() - start).toFixed(1);
    console.log(`%c[DB:Tx:Sucesso] Acerto "${acerto.titulo}" gravado no IndexedDB em ${dur}ms`, 'color: #059669; font-weight: bold;');
  } catch (err) {
    console.error(`%c[DB:Tx:Erro] Erro ao gravar acerto no IndexedDB (dados salvos com sucesso no LocalStorage snapshot):`, 'color: #dc2626;', err);
  }
}

export async function excluirAcerto(id: string): Promise<void> {
  const start = performance.now();
  console.log(`%c[DB:Tx] Excluindo acerto ${id} e todos os lançamentos vinculados...`, 'color: #dc2626;');
  removerSnapshotAcertoLocalStorage(id);

  try {
    const db = await getDB();
    const tx = db.transaction(['acertos', 'lancamentos', 'imagens', 'historico'], 'readwrite');
    
    await tx.objectStore('acertos').delete(id);

    // Excluir lançamentos relacionados
    const lancamentos = await tx.objectStore('lancamentos').index('by-acerto').getAllKeys(id);
    for (const k of lancamentos) {
      await tx.objectStore('lancamentos').delete(k);
      removerSnapshotLancamentoLocalStorage(k.toString());
    }

    // Excluir imagens relacionadas
    const imagens = await tx.objectStore('imagens').index('by-acerto').getAllKeys(id);
    for (const k of imagens) {
      await tx.objectStore('imagens').delete(k);
    }

    // Excluir histórico relacionado
    const historico = await tx.objectStore('historico').index('by-acerto').getAllKeys(id);
    for (const k of historico) {
      await tx.objectStore('historico').delete(k);
    }

    await tx.done;
    console.log(`%c[DB:Tx:Sucesso] Acerto ${id} excluído com sucesso em ${(performance.now() - start).toFixed(1)}ms (${lancamentos.length} lançamentos removidos)`, 'color: #059669;');
  } catch (err) {
    console.error(`[DB:Tx:Erro] Erro ao excluir acerto ${id}:`, err);
    throw err;
  }
}

export async function duplicarAcerto(id: string): Promise<Acerto> {
  console.log(`[DB:Tx] Duplicando acerto ${id}...`);
  const db = await getDB();
  const original = await db.get('acertos', id);
  if (!original) throw new Error('Acerto não encontrado para duplicação.');

  const novoId = 'acerto_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const novoAcerto: Acerto = {
    ...original,
    id: novoId,
    titulo: `${original.titulo} (Cópia)`,
    status: 'aberto',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await salvarAcerto(novoAcerto);

  const lancamentosOriginais = await db.getAllFromIndex('lancamentos', 'by-acerto', id);
  const lancamentosDuplicados: Lancamento[] = [];

  for (const l of lancamentosOriginais) {
    const novoLancamentoId = 'lanc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    lancamentosDuplicados.push({
      ...l,
      id: novoLancamentoId,
      acertoId: novoId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  if (lancamentosDuplicados.length > 0) {
    await salvarMultiplosLancamentos(lancamentosDuplicados);
  }

  await registrarHistorico({
    acertoId: novoId,
    acao: 'criacao',
    tipoItem: 'acerto',
    detalhes: `Acerto duplicado a partir de "${original.titulo}".`,
  });

  return novoAcerto;
}

// -------------------------------------------------------------
// OPERAÇÕES: LANÇAMENTOS (COM DUAL-LAYER PERSISTENCE)
// -------------------------------------------------------------

export async function listarLancamentosPorAcerto(acertoId: string): Promise<Lancamento[]> {
  const start = performance.now();
  console.log(`[DB:Tx] Listando lançamentos do acerto ${acertoId}...`);

  try {
    const db = await getDB();
    const lancs = await db.getAllFromIndex('lancamentos', 'by-acerto', acertoId);

    // Reconciliação com snapshot LocalStorage
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY_LANCAMENTOS);
      if (raw) {
        const snapshotMap: Record<string, Lancamento> = JSON.parse(raw);
        let restaurados = 0;
        for (const snap of Object.values(snapshotMap)) {
          if (snap.acertoId === acertoId && !lancs.some((l) => l.id === snap.id)) {
            await db.put('lancamentos', snap);
            lancs.push(snap);
            restaurados++;
          }
        }
        if (restaurados > 0) {
          console.log(`%c[DB:Reconciliação] ${restaurados} lançamentos recuperados do snapshot LocalStorage`, 'color: #059669; font-weight: bold;');
        }
      }
    } catch {}

    const dur = (performance.now() - start).toFixed(1);
    console.log(`%c[DB:Tx] listarLancamentosPorAcerto(${acertoId}): ${lancs.length} itens retornados em ${dur}ms`, 'color: #059669;');
    return lancs.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  } catch (err) {
    console.warn(`%c[DB:Tx:Fallback] Erro no IndexedDB ao listar lançamentos de ${acertoId}, lendo do LocalStorage:`, 'color: #d97706;', err);
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY_LANCAMENTOS);
      if (raw) {
        const snapshotMap: Record<string, Lancamento> = JSON.parse(raw);
        const filtrados = Object.values(snapshotMap).filter((l) => l.acertoId === acertoId);
        console.log(`%c[DB:Tx:Fallback] ${filtrados.length} lançamentos recuperados do LocalStorage snapshot`, 'color: #059669;');
        return filtrados.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      }
    } catch {}
    return [];
  }
}

export async function salvarLancamento(lancamento: Lancamento): Promise<void> {
  const start = performance.now();
  lancamento.updatedAt = new Date().toISOString();
  console.log(`%c[DB:Tx] Salvando lançamento "${lancamento.descricao}" (R$ ${(lancamento.valorCentavos / 100).toFixed(2)})`, 'color: #4f46e5;');

  // 1. Espelha no LocalStorage
  sincronizarSnapshotLancamentoLocalStorage(lancamento);

  // 2. Grava no IndexedDB
  try {
    const db = await getDB();
    const tx = db.transaction(['lancamentos', 'acertos'], 'readwrite');
    await tx.objectStore('lancamentos').put(lancamento);

    // Atualiza updatedAt do acerto pai
    const acerto = await tx.objectStore('acertos').get(lancamento.acertoId);
    if (acerto) {
      acerto.updatedAt = lancamento.updatedAt;
      await tx.objectStore('acertos').put(acerto);
      sincronizarSnapshotAcertoLocalStorage(acerto);
    }
    await tx.done;

    const dur = (performance.now() - start).toFixed(1);
    console.log(`%c[DB:Tx:Sucesso] Lançamento gravado no IndexedDB em ${dur}ms`, 'color: #059669;');
  } catch (err) {
    console.error(`%c[DB:Tx:Erro] Falha ao gravar lançamento no IndexedDB (salvo no LocalStorage):`, 'color: #dc2626;', err);
  }
}

export async function salvarMultiplosLancamentos(lancamentos: Lancamento[]): Promise<void> {
  if (lancamentos.length === 0) return;
  const start = performance.now();
  console.log(`%c[DB:Tx] Salvando lote de ${lancamentos.length} lançamentos...`, 'color: #4f46e5; font-weight: bold;');

  // 1. Espelha lote no LocalStorage
  sincronizarMultiplosLancamentosLocalStorage(lancamentos);

  // 2. Grava lote no IndexedDB
  try {
    const db = await getDB();
    const tx = db.transaction(['lancamentos', 'acertos'], 'readwrite');
    const now = new Date().toISOString();

    for (const l of lancamentos) {
      l.updatedAt = now;
      await tx.objectStore('lancamentos').put(l);
    }

    const acertoId = lancamentos[0].acertoId;
    const acerto = await tx.objectStore('acertos').get(acertoId);
    if (acerto) {
      acerto.updatedAt = now;
      await tx.objectStore('acertos').put(acerto);
      sincronizarSnapshotAcertoLocalStorage(acerto);
    }

    await tx.done;
    const dur = (performance.now() - start).toFixed(1);
    console.log(`%c[DB:Tx:Sucesso] Lote de ${lancamentos.length} lançamentos gravado com sucesso no IndexedDB em ${dur}ms`, 'color: #059669; font-weight: bold;');
  } catch (err) {
    console.error(`%c[DB:Tx:Erro] Falha ao gravar lote no IndexedDB (mantidos no LocalStorage):`, 'color: #dc2626;', err);
  }
}

export async function excluirLancamento(id: string): Promise<Lancamento | undefined> {
  const start = performance.now();
  console.log(`[DB:Tx] Excluindo lançamento ${id}...`);
  removerSnapshotLancamentoLocalStorage(id);

  try {
    const db = await getDB();
    const tx = db.transaction(['lancamentos', 'imagens'], 'readwrite');
    const l = await tx.objectStore('lancamentos').get(id);

    if (l) {
      await tx.objectStore('lancamentos').delete(id);

      if (l.imagemId) {
        const img = await tx.objectStore('imagens').get(l.imagemId);
        if (img) {
          img.lancamentosGeradosIds = img.lancamentosGeradosIds.filter((lid) => lid !== id);
          await tx.objectStore('imagens').put(img);
        }
      }
    }

    await tx.done;
    console.log(`[DB:Tx:Sucesso] Lançamento ${id} excluído em ${(performance.now() - start).toFixed(1)}ms`);
    return l;
  } catch (err) {
    console.error(`[DB:Tx:Erro] Erro ao excluir lançamento ${id}:`, err);
    throw err;
  }
}

// -------------------------------------------------------------
// OPERAÇÕES: IMAGENS
// -------------------------------------------------------------

export async function listarImagensPorAcerto(acertoId: string): Promise<ImagemComprovante[]> {
  try {
    const db = await getDB();
    const imagens = await db.getAllFromIndex('imagens', 'by-acerto', acertoId);
    console.log(`[DB:Tx] listarImagensPorAcerto(${acertoId}): ${imagens.length} fotos retornadas`);
    return imagens.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn('[DB:Tx] Erro ao listar imagens:', err);
    return [];
  }
}

export async function salvarImagem(imagem: ImagemComprovante): Promise<void> {
  const start = performance.now();
  console.log(`%c[DB:Tx] Salvando imagem/comprovante (${imagem.id}, ${(imagem.tamanhoBytes / 1024).toFixed(1)} KB)...`, 'color: #7c3aed;');
  try {
    const db = await getDB();
    const tx = db.transaction('imagens', 'readwrite');
    await tx.objectStore('imagens').put(imagem);
    await tx.done;
    console.log(`%c[DB:Tx:Sucesso] Imagem ${imagem.id} gravada no IndexedDB em ${(performance.now() - start).toFixed(1)}ms`, 'color: #059669;');
  } catch (err) {
    console.error('%c[DB:Tx:Erro] Erro ao salvar imagem no IndexedDB (possível cota excedida):', 'color: #dc2626;', err);
    throw err;
  }
}

export async function verificarImagemDuplicada(acertoId: string, hash: string): Promise<ImagemComprovante | undefined> {
  try {
    const db = await getDB();
    const imagens = await db.getAllFromIndex('imagens', 'by-hash', hash);
    return imagens.find((img) => img.acertoId === acertoId);
  } catch (err) {
    console.warn('[DB:Tx] Erro ao verificar duplicidade de imagem:', err);
    return undefined;
  }
}

export async function excluirImagem(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('imagens', id);
    console.log(`[DB:Tx] Imagem ${id} excluída`);
  } catch (err) {
    console.error('[DB:Tx] Erro ao excluir imagem:', err);
    throw err;
  }
}

// -------------------------------------------------------------
// OPERAÇÕES: HISTÓRICO DE AUDITORIA
// -------------------------------------------------------------

export async function registrarHistorico(item: Omit<HistoricoItem, 'id' | 'timestamp'>): Promise<void> {
  try {
    const db = await getDB();
    const id = 'hist_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const registro: HistoricoItem = {
      ...item,
      id,
      timestamp: new Date().toISOString(),
    };
    await db.put('historico', registro);
    console.log(`[DB:Auditoria] ${item.acao}: ${item.detalhes}`);
  } catch (err) {
    console.warn('[DB:Auditoria] Falha ao registrar log de histórico:', err);
  }
}

export async function listarHistoricoPorAcerto(acertoId: string, pessoaId?: string): Promise<HistoricoItem[]> {
  try {
    const db = await getDB();
    const lista = await db.getAllFromIndex('historico', 'by-acerto', acertoId);
    const filtrada = pessoaId ? lista.filter((h) => !h.pessoaId || h.pessoaId === pessoaId) : lista;
    return filtrada.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    console.warn('[DB:Auditoria] Erro ao listar histórico:', err);
    return [];
  }
}

// -------------------------------------------------------------
// CONFIGURAÇÕES & CONTINUIDADE
// -------------------------------------------------------------

export async function salvarConfig(chave: string, valor: any): Promise<void> {
  try {
    const db = await getDB();
    await db.put('config', valor, chave);
    console.log(`[DB:Config] Chave "${chave}" salva`);
  } catch (err) {
    console.warn(`[DB:Config] Erro ao salvar config "${chave}":`, err);
  }
}

export async function obterConfig<T>(chave: string): Promise<T | undefined> {
  try {
    const db = await getDB();
    return db.get('config', chave);
  } catch (err) {
    console.warn(`[DB:Config] Erro ao obter config "${chave}":`, err);
    return undefined;
  }
}

// -------------------------------------------------------------
// BACKUP COMPLETO: EXPORTAR E IMPORTAR
// -------------------------------------------------------------

export interface BackupCompleto {
  versao: number;
  geradoEm: string;
  app: string;
  acertos: Acerto[];
  lancamentos: Lancamento[];
  imagens: ImagemComprovante[];
  historico: HistoricoItem[];
}

export async function exportarBackup(): Promise<string> {
  console.log('%c[DB:Backup] Gerando exportação completa de dados...', 'color: #7c3aed; font-weight: bold;');
  const db = await getDB();
  const acertos = await db.getAll('acertos');
  const lancamentos = await db.getAll('lancamentos');
  const imagens = await db.getAll('imagens');
  const historico = await db.getAll('historico');

  const backup: BackupCompleto = {
    versao: 1,
    geradoEm: new Date().toISOString(),
    app: 'AcertoFácil',
    acertos,
    lancamentos,
    imagens,
    historico,
  };

  console.log(`%c[DB:Backup] Backup gerado com ${acertos.length} acertos, ${lancamentos.length} lançamentos e ${imagens.length} fotos`, 'color: #059669; font-weight: bold;');
  return JSON.stringify(backup, null, 2);
}

export async function importarBackup(jsonString: string): Promise<{ acertosCount: number; lancamentosCount: number; imagensCount: number }> {
  console.log('%c[DB:Backup] Importando arquivo de backup...', 'color: #7c3aed; font-weight: bold;');
  const parsed = JSON.parse(jsonString) as BackupCompleto;
  if (!parsed.acertos || !Array.isArray(parsed.acertos)) {
    throw new Error('Arquivo de backup inválido: formato incompatível.');
  }

  const db = await getDB();
  const tx = db.transaction(['acertos', 'lancamentos', 'imagens', 'historico'], 'readwrite');

  for (const a of parsed.acertos) {
    await tx.objectStore('acertos').put(a);
    sincronizarSnapshotAcertoLocalStorage(a);
  }

  if (parsed.lancamentos && Array.isArray(parsed.lancamentos)) {
    for (const l of parsed.lancamentos) {
      await tx.objectStore('lancamentos').put(l);
    }
    sincronizarMultiplosLancamentosLocalStorage(parsed.lancamentos);
  }

  if (parsed.imagens && Array.isArray(parsed.imagens)) {
    for (const img of parsed.imagens) {
      await tx.objectStore('imagens').put(img);
    }
  }

  if (parsed.historico && Array.isArray(parsed.historico)) {
    for (const h of parsed.historico) {
      await tx.objectStore('historico').put(h);
    }
  }

  await tx.done;
  console.log(`%c[DB:Backup:Sucesso] Importação concluída: ${parsed.acertos.length} acertos, ${parsed.lancamentos?.length || 0} lançamentos`, 'color: #059669; font-weight: bold;');

  return {
    acertosCount: parsed.acertos.length,
    lancamentosCount: parsed.lancamentos?.length || 0,
    imagensCount: parsed.imagens?.length || 0,
  };
}

// -------------------------------------------------------------
// DADOS INICIAIS (SEED) PARA PRIMEIRA EXECUÇÃO
// -------------------------------------------------------------

export async function inicializarDadosSeNecessario(): Promise<void> {
  console.log('%c[DB:Seed] Verificando dados iniciais...', 'color: #64748b;');
  const acertos = await listarAcertos();

  if (acertos.length > 0) {
    console.log(`[DB:Seed] Banco de dados já possui ${acertos.length} acertos existentes.`);
    // Sanitização de observações legadas com estimativas fixas de texto
    const cftv = acertos.find((a) => a.id === 'acerto_nds_cftv_digital');
    if (cftv) {
      let modificado = false;
      if (cftv.observacoes?.includes('Faturamento R$ 9.000,00')) {
        cftv.observacoes = 'Fechamento financeiro NDS CFTV Digital';
        modificado = true;
      }
      if (cftv.configDivisaoLucros?.faturamentoProjetoCentavos === 900000 || cftv.configDivisaoLucros?.usarPrecoFixo) {
        cftv.configDivisaoLucros.usarPrecoFixo = false;
        cftv.configDivisaoLucros.faturamentoProjetoCentavos = 0;
        cftv.configDivisaoLucros.taxaProjetoCentavos = 0;
        modificado = true;
      }
      if (modificado) {
        await salvarAcerto(cftv);
        console.log('[DB:Seed] Acerto legado sanitizado para modo dinâmico.');
      }
    }
    return;
  }

  console.log('%c[DB:Seed] Criando primeiro acerto de demonstração NDS CFTV Digital...', 'color: #059669; font-weight: bold;');
  const hoje = new Date().toISOString().slice(0, 10);
  const acertoId = 'acerto_nds_cftv_digital';

  const demoAcerto: Acerto = {
    id: acertoId,
    titulo: 'NDS CFTV Digital - Fechamento & Divisão de Lucros',
    dataInicio: hoje,
    status: 'aberto',
    observacoes: 'Fechamento financeiro NDS CFTV Digital',
    pessoas: [
      { id: 'p_neto', nome: 'Neto', papel: 'Sócio', cor: '#059669', ordem: 0 },
      { id: 'p_victor', nome: 'Victor', papel: 'Sócio', cor: '#0284c7', ordem: 1 },
    ],
    categorias: [
      'Mão de Obra',
      'Material de Construção',
      'Adiantamento/Val',
      'Alimentação',
      'Combustível',
      'Ferramentas',
      'Transporte',
      'Outros',
    ],
    configDivisaoLucros: {
      usarPrecoFixo: false,
      faturamentoProjetoCentavos: 0,
      taxaProjetoCentavos: 0,
      reservaEmergenciaPorcentagem: 0,
      participantes: [
        { id: 'part_neto', pessoaId: 'p_neto', nome: 'Neto', porcentagem: 50, descontarAdiantamentos: true },
        { id: 'part_victor', pessoaId: 'p_victor', nome: 'Victor', porcentagem: 50, descontarAdiantamentos: true },
      ],
      observacoes: '',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await salvarAcerto(demoAcerto);

  const lancamentosIniciais: Lancamento[] = [
    {
      id: 'lanc_cftv_materiais',
      acertoId,
      pessoaId: 'p_neto',
      tipo: 'saida',
      data: hoje,
      descricao: 'Cabos UTP, conectores BNC e baluns para CFTV',
      valorCentavos: 45000, // R$ 450,00
      categoria: 'Material de Construção',
      formaPagamento: 'Pix',
      quemPagou: 'Neto',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'lanc_vale_neto_601',
      acertoId,
      pessoaId: 'p_neto',
      tipo: 'adiantamento',
      data: hoje,
      descricao: 'Adiantamento/Val (Itatiaia)',
      valorCentavos: 60100, // R$ 601,00
      categoria: 'Adiantamento/Val',
      observacaoAdiantamento: 'Adiantamento pessoal debitado exclusivamente do saldo a receber do Neto. Não diminui a base de cálculo nem afeta o valor do Victor.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  await salvarMultiplosLancamentos(lancamentosIniciais);

  await registrarHistorico({
    acertoId,
    acao: 'criacao',
    tipoItem: 'acerto',
    detalhes: 'Fechamento financeiro NDS CFTV Digital inicializado com sucesso.',
  });
  console.log('%c[DB:Seed:Concluído] Dados iniciais carregados e protegidos com persistência dupla.', 'color: #059669; font-weight: bold;');
}
