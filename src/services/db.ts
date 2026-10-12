/**
 * Camada de persistência local em IndexedDB com suporte a imagens em alta resolução,
 * auditoria automática de alterações e backup completo.
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

let dbPromise: Promise<IDBPDatabase<AcertoFácilDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<AcertoFácilDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AcertoFácilDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store: Acertos
        if (!db.objectStoreNames.contains('acertos')) {
          const acertosStore = db.createObjectStore('acertos', { keyPath: 'id' });
          acertosStore.createIndex('by-status', 'status');
          acertosStore.createIndex('by-updatedAt', 'updatedAt');
        }

        // Store: Lançamentos
        if (!db.objectStoreNames.contains('lancamentos')) {
          const lancamentosStore = db.createObjectStore('lancamentos', { keyPath: 'id' });
          lancamentosStore.createIndex('by-acerto', 'acertoId');
          lancamentosStore.createIndex('by-pessoa', 'pessoaId');
          lancamentosStore.createIndex('by-tipo', 'tipo');
        }

        // Store: Imagens
        if (!db.objectStoreNames.contains('imagens')) {
          const imagensStore = db.createObjectStore('imagens', { keyPath: 'id' });
          imagensStore.createIndex('by-acerto', 'acertoId');
          imagensStore.createIndex('by-pessoa', 'pessoaId');
          imagensStore.createIndex('by-hash', 'hash');
        }

        // Store: Histórico
        if (!db.objectStoreNames.contains('historico')) {
          const historicoStore = db.createObjectStore('historico', { keyPath: 'id' });
          historicoStore.createIndex('by-acerto', 'acertoId');
          historicoStore.createIndex('by-timestamp', 'timestamp');
        }

        // Store: Configurações
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config');
        }
      },
    });
  }
  return dbPromise;
}

// -------------------------------------------------------------
// OPERAÇÕES: ACERTOS
// -------------------------------------------------------------

export async function listarAcertos(): Promise<Acerto[]> {
  const db = await getDB();
  const list = await db.getAll('acertos');
  return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function obterAcerto(id: string): Promise<Acerto | undefined> {
  const db = await getDB();
  return db.get('acertos', id);
}

export async function salvarAcerto(acerto: Acerto): Promise<void> {
  const db = await getDB();
  acerto.updatedAt = new Date().toISOString();
  await db.put('acertos', acerto);
}

export async function excluirAcerto(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['acertos', 'lancamentos', 'imagens', 'historico'], 'readwrite');
  
  await tx.objectStore('acertos').delete(id);

  // Excluir lançamentos relacionados
  const lancamentos = await tx.objectStore('lancamentos').index('by-acerto').getAllKeys(id);
  for (const k of lancamentos) {
    await tx.objectStore('lancamentos').delete(k);
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
}

export async function duplicarAcerto(id: string): Promise<Acerto> {
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

  // Duplicar também os lançamentos
  const lancamentosOriginais = await db.getAllFromIndex('lancamentos', 'by-acerto', id);
  for (const l of lancamentosOriginais) {
    const novoLancamentoId = 'lanc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    await db.put('lancamentos', {
      ...l,
      id: novoLancamentoId,
      acertoId: novoId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
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
// OPERAÇÕES: LANÇAMENTOS
// -------------------------------------------------------------

export async function listarLancamentosPorAcerto(acertoId: string): Promise<Lancamento[]> {
  const db = await getDB();
  const lancs = await db.getAllFromIndex('lancamentos', 'by-acerto', acertoId);
  return lancs.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}

export async function salvarLancamento(lancamento: Lancamento): Promise<void> {
  const db = await getDB();
  lancamento.updatedAt = new Date().toISOString();
  await db.put('lancamentos', lancamento);

  // Atualiza updatedAt do acerto pai
  const acerto = await db.get('acertos', lancamento.acertoId);
  if (acerto) {
    acerto.updatedAt = new Date().toISOString();
    await db.put('acertos', acerto);
  }
}

export async function salvarMultiplosLancamentos(lancamentos: Lancamento[]): Promise<void> {
  if (lancamentos.length === 0) return;
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
  }

  await tx.done;
}

export async function excluirLancamento(id: string): Promise<Lancamento | undefined> {
  const db = await getDB();
  const l = await db.get('lancamentos', id);
  if (l) {
    await db.delete('lancamentos', id);

    // Se estiver vinculado a imagem, podemos atualizar a lista de IDs na imagem
    if (l.imagemId) {
      const img = await db.get('imagens', l.imagemId);
      if (img) {
        img.lancamentosGeradosIds = img.lancamentosGeradosIds.filter((lid) => lid !== id);
        await db.put('imagens', img);
      }
    }
  }
  return l;
}

// -------------------------------------------------------------
// OPERAÇÕES: IMAGENS
// -------------------------------------------------------------

export async function listarImagensPorAcerto(acertoId: string): Promise<ImagemComprovante[]> {
  const db = await getDB();
  const imagens = await db.getAllFromIndex('imagens', 'by-acerto', acertoId);
  return imagens.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function salvarImagem(imagem: ImagemComprovante): Promise<void> {
  const db = await getDB();
  await db.put('imagens', imagem);
}

export async function verificarImagemDuplicada(acertoId: string, hash: string): Promise<ImagemComprovante | undefined> {
  const db = await getDB();
  const imagens = await db.getAllFromIndex('imagens', 'by-hash', hash);
  return imagens.find((img) => img.acertoId === acertoId);
}

export async function excluirImagem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('imagens', id);
}

// -------------------------------------------------------------
// OPERAÇÕES: HISTÓRICO DE AUDITORIA
// -------------------------------------------------------------

export async function registrarHistorico(item: Omit<HistoricoItem, 'id' | 'timestamp'>): Promise<void> {
  const db = await getDB();
  const id = 'hist_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const registro: HistoricoItem = {
    ...item,
    id,
    timestamp: new Date().toISOString(),
  };
  await db.put('historico', registro);
}

export async function listarHistoricoPorAcerto(acertoId: string, pessoaId?: string): Promise<HistoricoItem[]> {
  const db = await getDB();
  const lista = await db.getAllFromIndex('historico', 'by-acerto', acertoId);
  const filtrada = pessoaId ? lista.filter((h) => !h.pessoaId || h.pessoaId === pessoaId) : lista;
  return filtrada.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// -------------------------------------------------------------
// CONFIGURAÇÕES & CONTINUIDADE
// -------------------------------------------------------------

export async function salvarConfig(chave: string, valor: any): Promise<void> {
  const db = await getDB();
  await db.put('config', valor, chave);
}

export async function obterConfig<T>(chave: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get('config', chave);
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

  return JSON.stringify(backup, null, 2);
}

export async function importarBackup(jsonString: string): Promise<{ acertosCount: number; lancamentosCount: number; imagensCount: number }> {
  const parsed = JSON.parse(jsonString) as BackupCompleto;
  if (!parsed.acertos || !Array.isArray(parsed.acertos)) {
    throw new Error('Arquivo de backup inválido: formato incompatível.');
  }

  const db = await getDB();
  const tx = db.transaction(['acertos', 'lancamentos', 'imagens', 'historico'], 'readwrite');

  // Insere ou atualiza acertos
  for (const a of parsed.acertos) {
    await tx.objectStore('acertos').put(a);
  }

  // Insere ou atualiza lançamentos
  if (parsed.lancamentos && Array.isArray(parsed.lancamentos)) {
    for (const l of parsed.lancamentos) {
      await tx.objectStore('lancamentos').put(l);
    }
  }

  // Insere imagens
  if (parsed.imagens && Array.isArray(parsed.imagens)) {
    for (const img of parsed.imagens) {
      await tx.objectStore('imagens').put(img);
    }
  }

  // Insere histórico
  if (parsed.historico && Array.isArray(parsed.historico)) {
    for (const h of parsed.historico) {
      await tx.objectStore('historico').put(h);
    }
  }

  await tx.done;

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
  const acertos = await listarAcertos();
  if (acertos.length > 0) return;

  const hoje = new Date().toISOString().slice(0, 10);
  const acertoId = 'acerto_demo_obra_1';

  const demoAcerto: Acerto = {
    id: acertoId,
    titulo: 'Reforma Comercial & Obra Galpão Sul',
    dataInicio: hoje,
    status: 'aberto',
    observacoes: 'Controle de adiantamentos da equipe, compra de materiais na Loja Silva e acerto semanal.',
    pessoas: [
      { id: 'p_joao', nome: 'João Pedreiro', papel: 'Empreiteiro', cor: '#059669', ordem: 0 },
      { id: 'p_maria', nome: 'Maria Pintora', papel: 'Acabamento', cor: '#7c3aed', ordem: 1 },
      { id: 'p_loja', nome: 'Loja Silva Materiais', papel: 'Fornecedor', cor: '#d97706', ordem: 2 },
    ],
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

  await salvarAcerto(demoAcerto);

  const lancamentosIniciais: Lancamento[] = [
    // João: adiantamento recebido de R$ 800,00
    {
      id: 'lanc_1',
      acertoId,
      pessoaId: 'p_joao',
      tipo: 'adiantamento',
      data: hoje,
      descricao: 'Adiantamento semanal (Vale Pix)',
      valorCentavos: 80000,
      abatidoCentavos: 0,
      observacaoAdiantamento: 'Repasse adiantado para semana 1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    // João: despesa com ferramentas R$ 150,00 que ele pagou do bolso
    {
      id: 'lanc_2',
      acertoId,
      pessoaId: 'p_joao',
      tipo: 'saida',
      data: hoje,
      descricao: 'Discos de corte e brocas comprados na ferragem',
      valorCentavos: 15000,
      categoria: 'Ferramentas',
      quemPagou: 'João',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    // Maria: adiantamento de R$ 400,00
    {
      id: 'lanc_3',
      acertoId,
      pessoaId: 'p_maria',
      tipo: 'adiantamento',
      data: hoje,
      descricao: 'Adiantamento de início de pintura',
      valorCentavos: 40000,
      abatidoCentavos: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    // Loja Silva: Material comprado com nota
    {
      id: 'lanc_4',
      acertoId,
      pessoaId: 'p_loja',
      tipo: 'material',
      data: hoje,
      descricao: '20 sacos de cimento CP-II e 3m areia média',
      item: 'Cimento CP-II 50kg',
      quantidade: 20,
      valorUnitarioCentavos: 3850,
      valorCentavos: 77000,
      loja: 'Loja Silva Materiais',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    // Loja Silva: Dívida a pagar (boleto a vencer)
    {
      id: 'lanc_5',
      acertoId,
      pessoaId: 'p_loja',
      tipo: 'divida',
      data: hoje,
      descricao: 'Boleto faturado para 15 dias ref. cimento',
      valorCentavos: 77000,
      vencimento: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
      statusDivida: 'pendente',
      direcaoDivida: 'eu_devo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  await salvarMultiplosLancamentos(lancamentosIniciais);

  await registrarHistorico({
    acertoId,
    acao: 'criacao',
    tipoItem: 'acerto',
    detalhes: 'Acerto inicial de demonstração criado com sucesso.',
  });
}
