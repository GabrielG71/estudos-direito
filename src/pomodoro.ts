// Relógio do pomodoro, fora da tela: continua rodando se a pessoa trocar de aba ou de sala.
// Usa o horário de término (não contagem de ticks), então não atrasa com a aba em segundo plano.
import { getOne, put, uid, type Config } from './db';

export type Fase = 'foco' | 'pausa';
export interface Estado {
  subjectId: string | null;
  fase: Fase;
  rodando: boolean;
  /** Fim previsto (ms) quando rodando. */
  fim: number;
  /** Tempo restante (ms) quando parado. */
  restante: number;
  foco: number;
  pausa: number;
}

const PADRAO = { foco: 25, pausa: 5 };
const estado: Estado = { subjectId: null, fase: 'foco', rodando: false, fim: 0, restante: PADRAO.foco * 60_000, foco: PADRAO.foco, pausa: PADRAO.pausa };
const ouvintes = new Set<() => void>();
const avisarTodos = () => ouvintes.forEach((f) => f());
let timer = 0;
const tituloOriginal = document.title;

export const ler = (): Readonly<Estado> => estado;
export function assinar(f: () => void): () => void {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

export const restanteMs = (): number => (estado.rodando ? Math.max(0, estado.fim - Date.now()) : estado.restante);

export async function carregarConfig(): Promise<void> {
  const c = await getOne('config', 'pomodoro');
  if (c) {
    estado.foco = c.foco;
    estado.pausa = c.pausa;
    if (!estado.rodando) reiniciarFase();
  }
  avisarTodos();
}

export async function salvarConfig(foco: number, pausa: number): Promise<void> {
  estado.foco = clamp(foco);
  estado.pausa = clamp(pausa);
  const c: Config = { id: 'pomodoro', foco: estado.foco, pausa: estado.pausa };
  await put('config', c);
  if (!estado.rodando) reiniciarFase();
  avisarTodos();
}

const clamp = (n: number): number => Math.min(180, Math.max(1, Math.round(n) || 1));
const duracao = (f: Fase): number => (f === 'foco' ? estado.foco : estado.pausa) * 60_000;

function reiniciarFase(): void {
  estado.restante = duracao(estado.fase);
}

export function iniciar(subjectId: string): void {
  if (estado.rodando) return;
  // Relógio zerado: começa nesta sala. Com tempo já gasto (pausado), continua na sala em que começou.
  if (estado.restante === duracao(estado.fase) || !estado.subjectId) estado.subjectId = subjectId;
  estado.rodando = true;
  estado.fim = Date.now() + estado.restante;
  timer = window.setInterval(tick, 250);
  atualizarTitulo();
  avisarTodos();
}

export function pausar(): void {
  if (!estado.rodando) return;
  estado.restante = restanteMs();
  estado.rodando = false;
  window.clearInterval(timer);
  atualizarTitulo();
  avisarTodos();
}

/** Zera a fase atual. No foco, os minutos completos já estudados são registrados. */
export async function parar(): Promise<void> {
  const gastoMs = duracao(estado.fase) - restanteMs();
  const subjectId = estado.subjectId;
  pausar();
  const min = Math.floor(gastoMs / 60_000);
  if (estado.fase === 'foco' && subjectId && min >= 1) await registrar(subjectId, min);
  reiniciarFase();
  estado.subjectId = null;
  avisarTodos();
}

async function registrar(subjectId: string, minutos: number): Promise<void> {
  await put('sessions', { id: uid(), subjectId, minutos, em: Date.now() });
  document.dispatchEvent(new CustomEvent('sessao-registrada', { detail: { subjectId } }));
}

function tick(): void {
  if (restanteMs() > 0) {
    atualizarTitulo();
    avisarTodos();
    return;
  }
  const subjectId = estado.subjectId;
  const fase = estado.fase;
  pausar();
  bip();
  if (fase === 'foco' && subjectId) void registrar(subjectId, estado.foco);
  estado.fase = fase === 'foco' ? 'pausa' : 'foco';
  reiniciarFase();
  if (estado.fase === 'foco') estado.subjectId = null;
  avisarTodos();
}

export function formatar(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function atualizarTitulo(): void {
  document.title = estado.rodando ? `${formatar(restanteMs())} · ${estado.fase === 'foco' ? 'Foco' : 'Pausa'}` : tituloOriginal;
}

/** Avisa o fim da fase com dois bips curtos (WebAudio local, sem arquivo de áudio). */
function bip(): void {
  try {
    const ctx = new AudioContext();
    [0, 0.25].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.2);
    });
    setTimeout(() => void ctx.close(), 800);
  } catch {
    /* sem áudio disponível: tudo bem */
  }
}
