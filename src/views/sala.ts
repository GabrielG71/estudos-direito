import { getOne, type Subject } from '../db';
import { h } from '../dom';
import { assinar, ler } from '../pomodoro';
import { criarCena } from '../scene';
import { arquivos } from '../tabs/arquivos';
import { flashcards } from '../tabs/flashcards';
import { notas } from '../tabs/notas';
import { pomodoro } from '../tabs/pomodoro';
import { tarefas } from '../tabs/tarefas';
import { apagarMateria, editarMateria } from './lobby';
import type { View } from './types';

const ABAS: { id: string; titulo: string; montar: (s: Subject) => Promise<View> | View }[] = [
  { id: 'notas', titulo: 'Anotações', montar: notas },
  { id: 'arquivos', titulo: 'Arquivos & Links', montar: arquivos },
  { id: 'pomodoro', titulo: 'Pomodoro', montar: pomodoro },
  { id: 'flashcards', titulo: 'Flashcards', montar: flashcards },
  { id: 'tarefas', titulo: 'Tarefas e provas', montar: tarefas },
];

export async function sala(id: string, abaId: string | undefined): Promise<View | null> {
  const subject = await getOne('subjects', id);
  if (!subject) return null;
  const aba = ABAS.find((a) => a.id === abaId) ?? ABAS[0];

  const canvas = h('canvas', { class: 'cena', 'aria-label': `Sala de ${subject.nome}`, role: 'img' });
  const cena = criarCena(canvas, subject);
  // O boneco estuda (lê) enquanto o pomodoro de foco desta sala está rodando.
  const sincronizar = () => {
    const p = ler();
    cena.estudando(p.rodando && p.fase === 'foco' && p.subjectId === subject.id);
  };
  sincronizar();
  const desassinar = assinar(sincronizar);

  const painel = h('section', { class: 'painel', id: 'painel', role: 'tabpanel', 'aria-label': aba.titulo });
  let conteudo: View | null = null;
  const montagem = Promise.resolve(aba.montar(subject)).then((v) => {
    conteudo = v;
    painel.append(v.el);
  });

  const el = h('main', { class: 'page', style: { '--cor': subject.cor } },
    h('header', { class: 'topo' },
      h('a', { class: 'btn', href: '#/' }, '← Salas'),
      h('h1', { class: 'sala-nome' }, subject.nome),
      h('div', { class: 'acoes' },
        h('button', { class: 'btn small', type: 'button', onclick: async () => { if (await editarMateria(subject)) window.dispatchEvent(new HashChangeEvent('hashchange')); } }, 'Renomear'),
        h('button', { class: 'btn small danger', type: 'button', onclick: async () => { if (await apagarMateria(subject)) location.hash = '#/'; } }, 'Apagar'))),
    h('div', { class: 'cena-box' }, canvas),
    h('nav', { class: 'abas', role: 'tablist' },
      ...ABAS.map((a) =>
        h('a', { class: 'aba', role: 'tab', href: `#/sala/${id}/${a.id}`, 'aria-selected': String(a.id === aba.id) }, a.titulo))),
    painel,
  );

  return {
    el,
    async destroy() {
      desassinar();
      cena.parar();
      await montagem;
      await conteudo?.destroy();
    },
  };
}
