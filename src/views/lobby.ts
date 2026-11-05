import { aplicarBackup, baixar, gerarBackup, lerBackup } from '../backup';
import { deleteSubject, getAll, put, uid, type Session, type Subject, type Task } from '../db';
import { h, formatMinutes } from '../dom';
import { criarCena } from '../scene';
import { avisar, confirmar, pedirMateria } from '../ui';
import type { View } from './types';

/** Renomear/editar e apagar uma matéria; devolve true se algo mudou. */
export async function editarMateria(s: Subject): Promise<boolean> {
  const r = await pedirMateria('Editar sala', { nome: s.nome, cor: s.cor });
  if (!r) return false;
  await put('subjects', { ...s, nome: r.nome, cor: r.cor });
  return true;
}

export async function apagarMateria(s: Subject): Promise<boolean> {
  const ok = await confirmar(
    `Apagar "${s.nome}"?`,
    'A sala some junto com as anotações, arquivos, links, flashcards, tarefas e o tempo de estudo dela. Não dá para desfazer.',
    'Apagar tudo',
  );
  if (ok) await deleteSubject(s.id);
  return ok;
}

export async function lobby(): Promise<View> {
  const el = h('main', { class: 'page' });
  const cenas: { parar(): void }[] = [];

  async function render() {
    cenas.splice(0).forEach((c) => c.parar());
    const [subjects, sessions, tasks] = await Promise.all([getAll('subjects'), getAll('sessions'), getAll('tasks')]);
    subjects.sort((a, b) => a.criadoEm - b.criadoEm);
    const minutos = soma(sessions);
    const pendentes = contar(tasks);

    const importar = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    importar.addEventListener('change', async () => {
      const arq = importar.files?.[0];
      importar.value = '';
      if (!arq) return;
      try {
        const lido = await lerBackup(arq);
        const ok = await confirmar(
          'Importar backup?',
          `Isto SUBSTITUI tudo o que está salvo neste navegador (matérias, anotações, arquivos, flashcards, tarefas e tempo de estudo) pelo conteúdo do arquivo: ${lido.resumo}. Faça um backup antes se quiser guardar os dados atuais.`,
          'Substituir tudo',
        );
        if (!ok) return;
        await aplicarBackup(lido);
        await render();
        await avisar('Backup importado', 'Os dados foram substituídos.');
      } catch (e) {
        await avisar('Não foi possível importar', e instanceof Error ? e.message : 'Erro desconhecido.');
      }
    });

    const grade = subjects.length
      ? h('div', { class: 'grid' }, ...subjects.map((s) => cartao(s)))
      : h('div', { class: 'vazio' },
          h('p', { class: 'grande' }, 'Nenhuma sala ainda.'),
          h('p', {}, 'Cada matéria vira uma sala com um boneco. Comece criando a primeira.'),
          h('button', { class: 'btn primary', type: 'button', onclick: criar }, 'Nova sala'));

    el.replaceChildren(
      h('header', { class: 'topo' },
        h('h1', { class: 'logo' }, 'Estudos de Direito'),
        h('div', { class: 'acoes' },
          h('button', { class: 'btn primary', type: 'button', onclick: criar }, 'Nova sala'),
          h('button', { class: 'btn', type: 'button', onclick: exportar }, 'Exportar backup'),
          h('button', { class: 'btn', type: 'button', onclick: () => importar.click() }, 'Importar backup'),
          importar)),
      grade,
    );

    function cartao(s: Subject) {
      const canvas = h('canvas', { class: 'cena', 'aria-hidden': 'true' });
      cenas.push(criarCena(canvas, s));
      const pend = pendentes.get(s.id) ?? 0;
      return h('article', { class: 'card', style: { '--cor': s.cor } },
        h('a', { class: 'card-link', href: `#/sala/${s.id}`, 'aria-label': `Entrar na sala ${s.nome}` }, canvas),
        h('div', { class: 'card-corpo' },
          h('h2', {}, h('a', { href: `#/sala/${s.id}` }, s.nome)),
          h('p', { class: 'meta' }, `${formatMinutes(minutos.get(s.id) ?? 0)} estudados · ${pend} tarefa${pend === 1 ? '' : 's'} pendente${pend === 1 ? '' : 's'}`),
          h('div', { class: 'acoes' },
            h('button', { class: 'btn small', type: 'button', onclick: async () => { if (await editarMateria(s)) await render(); } }, 'Renomear'),
            h('button', { class: 'btn small danger', type: 'button', onclick: async () => { if (await apagarMateria(s)) await render(); } }, 'Apagar'))));
    }
  }

  async function criar() {
    const r = await pedirMateria('Nova sala');
    if (!r) return;
    const s: Subject = { id: uid(), nome: r.nome, cor: r.cor, criadoEm: Date.now() };
    await put('subjects', s);
    location.hash = `#/sala/${s.id}`;
  }

  async function exportar() {
    try {
      const nome = `estudos-direito-${new Date().toISOString().slice(0, 10)}.json`;
      baixar(await gerarBackup(), nome);
    } catch (e) {
      await avisar('Não foi possível exportar', e instanceof Error ? e.message : 'Erro desconhecido.');
    }
  }

  await render();
  return { el, destroy: () => cenas.forEach((c) => c.parar()) };
}

function soma(sessions: Session[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sessions) m.set(s.subjectId, (m.get(s.subjectId) ?? 0) + s.minutos);
  return m;
}

function contar(tasks: Task[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tasks) if (!t.feito) m.set(t.subjectId, (m.get(t.subjectId) ?? 0) + 1);
  return m;
}
