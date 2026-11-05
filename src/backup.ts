// Backup: um JSON com tudo; os arquivos (Blob) vão em base64. Importar SUBSTITUI os dados.
import { STORES, readAll, replaceAll, type Dump, type FileRec } from './db';

const FORMATO = 'estudos-direito-backup';
const VERSAO = 1;

interface FileJson extends Omit<FileRec, 'blob'> { base64: string }

function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64ParaBlob(b64: string, tipo: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

export async function gerarBackup(): Promise<Blob> {
  const dump = await readAll();
  const files: FileJson[] = await Promise.all(
    dump.files.map(async ({ blob, ...resto }) => ({ ...resto, base64: await blobParaBase64(blob) })),
  );
  const json = JSON.stringify({ formato: FORMATO, versao: VERSAO, exportadoEm: new Date().toISOString(), dados: { ...dump, files } });
  return new Blob([json], { type: 'application/json' });
}

export function baixar(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface BackupLido { dump: Dump; resumo: string }

/** Lê e valida o arquivo; não grava nada. Lança Error com mensagem em PT-BR se estiver inválido. */
export async function lerBackup(arquivo: File): Promise<BackupLido> {
  let raw: unknown;
  try {
    raw = JSON.parse(await arquivo.text());
  } catch {
    throw new Error('Este arquivo não é um backup válido (JSON ilegível).');
  }
  const o = raw as { formato?: unknown; versao?: unknown; dados?: Record<string, unknown> };
  if (o?.formato !== FORMATO || typeof o.dados !== 'object' || o.dados === null) {
    throw new Error('Este arquivo não parece um backup do Estudos de Direito.');
  }
  if (o.versao !== VERSAO) throw new Error('Versão de backup não suportada.');
  const dados = o.dados;
  for (const s of STORES) {
    if (!Array.isArray(dados[s])) throw new Error(`Backup incompleto: faltam dados de "${s}".`);
    for (const rec of dados[s] as unknown[]) {
      if (typeof (rec as { id?: unknown })?.id !== 'string') throw new Error(`Backup corrompido em "${s}".`);
    }
  }
  const files = (dados.files as FileJson[]).map(({ base64, ...resto }) => {
    if (typeof base64 !== 'string') throw new Error('Backup corrompido: arquivo sem conteúdo.');
    return { ...resto, blob: base64ParaBlob(base64, resto.tipo) };
  });
  const dump = { ...dados, files } as unknown as Dump;
  const resumo = `${dump.subjects.length} matéria(s), ${dump.notes.length} anotação(ões), ${files.length} arquivo(s), ${dump.flashcards.length} flashcard(s), ${dump.tasks.length} tarefa(s)`;
  return { dump, resumo };
}

export const aplicarBackup = (b: BackupLido): Promise<void> => replaceAll(b.dump);
