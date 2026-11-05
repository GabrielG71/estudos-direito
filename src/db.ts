// Armazenamento local (IndexedDB), sem biblioteca. Cada registro tem `id`; o que pertence a uma matéria
// tem `subjectId` (índice). Apagar a matéria apaga os filhos na mesma transação.

export interface Subject { id: string; nome: string; cor: string; criadoEm: number }
export interface Note { id: string; subjectId: string; titulo: string; corpo: string; atualizadoEm: number }
export interface FileRec { id: string; subjectId: string; nome: string; tipo: string; blob: Blob }
export interface LinkRec { id: string; subjectId: string; titulo: string; url: string }
export interface Flashcard { id: string; subjectId: string; frente: string; verso: string; caixa: number }
export interface Task { id: string; subjectId: string; texto: string; data?: string; feito: boolean }
export interface Session { id: string; subjectId: string; minutos: number; em: number }
export interface Config { id: string; foco: number; pausa: number }

export interface Schema {
  subjects: Subject;
  notes: Note;
  files: FileRec;
  links: LinkRec;
  flashcards: Flashcard;
  tasks: Task;
  sessions: Session;
  config: Config;
}
export type StoreName = keyof Schema;

export const STORES: StoreName[] = ['subjects', 'notes', 'files', 'links', 'flashcards', 'tasks', 'sessions', 'config'];
/** Stores cujos registros dependem de uma matéria. */
export const CHILD_STORES: StoreName[] = ['notes', 'files', 'links', 'flashcards', 'tasks', 'sessions'];

const DB_NAME = 'estudos-direito';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        const store = db.createObjectStore(name, { keyPath: 'id' });
        if (CHILD_STORES.includes(name)) store.createIndex('subjectId', 'subjectId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const done = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Roda `fn` numa transação e resolve quando ela confirma (commit). */
async function run<T>(names: StoreName[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => Promise<T> | T): Promise<T> {
  const db = await open();
  const tx = db.transaction(names, mode);
  const finished = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transação cancelada'));
  });
  const result = await fn(tx);
  await finished;
  return result;
}

export const uid = (): string => crypto.randomUUID();

export function getAll<S extends StoreName>(store: S): Promise<Schema[S][]> {
  return run([store], 'readonly', (tx) => done(tx.objectStore(store).getAll() as IDBRequest<Schema[S][]>));
}

export function getOne<S extends StoreName>(store: S, id: string): Promise<Schema[S] | undefined> {
  return run([store], 'readonly', (tx) => done(tx.objectStore(store).get(id) as IDBRequest<Schema[S] | undefined>));
}

export function getBySubject<S extends StoreName>(store: S, subjectId: string): Promise<Schema[S][]> {
  return run([store], 'readonly', (tx) =>
    done(tx.objectStore(store).index('subjectId').getAll(subjectId) as IDBRequest<Schema[S][]>),
  );
}

export async function put<S extends StoreName>(store: S, value: Schema[S]): Promise<void> {
  await run([store], 'readwrite', (tx) => done(tx.objectStore(store).put(value)));
}

export async function del(store: StoreName, id: string): Promise<void> {
  await run([store], 'readwrite', (tx) => done(tx.objectStore(store).delete(id)));
}

/** Apaga a matéria e tudo que pertence a ela. */
export async function deleteSubject(id: string): Promise<void> {
  await run(['subjects', ...CHILD_STORES], 'readwrite', async (tx) => {
    tx.objectStore('subjects').delete(id);
    for (const name of CHILD_STORES) {
      const keys = await done(tx.objectStore(name).index('subjectId').getAllKeys(id));
      for (const k of keys) tx.objectStore(name).delete(k);
    }
  });
}

export type Dump = { [S in StoreName]: Schema[S][] };

export async function readAll(): Promise<Dump> {
  const entries = await Promise.all(STORES.map(async (s) => [s, await getAll(s)] as const));
  return Object.fromEntries(entries) as unknown as Dump;
}

/** Substitui TUDO pelo conteúdo de `dump`, numa transação só: ou entra tudo ou nada. */
export async function replaceAll(dump: Dump): Promise<void> {
  await run(STORES, 'readwrite', (tx) => {
    for (const name of STORES) {
      const store = tx.objectStore(name);
      store.clear();
      for (const rec of dump[name]) store.put(rec);
    }
  });
}
