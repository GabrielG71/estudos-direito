import { del, getBySubject, put, uid, type Note, type Subject } from '../db';
import { debounced, h } from '../dom';
import { confirmar } from '../ui';
import type { View } from '../views/types';

export async function notas(subject: Subject): Promise<View> {
  let lista = (await getBySubject('notes', subject.id)).sort((a, b) => b.atualizadoEm - a.atualizadoEm);
  let atual: Note | null = lista[0] ?? null;
  const el = h('div', { class: 'duas-colunas' });
  let salvar = debounced(() => {}, 0);

  function montar() {
    const itens = h('ul', { class: 'lista-notas' },
      ...lista.map((n) =>
        h('li', {},
          h('button', {
            type: 'button', class: 'item-nota', 'aria-current': String(n.id === atual?.id),
            onclick: async () => { salvar.flush(); atual = n; montar(); },
          }, h('strong', {}, n.titulo || 'Sem título'), h('small', {}, new Date(n.atualizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })))),
      ),
    );
    const lateral = h('aside', { class: 'lateral' },
      h('button', { class: 'btn primary', type: 'button', onclick: nova }, 'Nova anotação'),
      lista.length ? itens : h('p', { class: 'dica' }, 'Nenhuma anotação ainda.'));
    el.replaceChildren(lateral, atual ? editor(atual) : h('div', { class: 'vazio' }, h('p', {}, 'Crie uma anotação para começar.')));
  }

  function editor(n: Note): HTMLElement {
    const status = h('span', { class: 'status' }, 'Salvo');
    const titulo = h('input', { type: 'text', value: n.titulo, placeholder: 'Título', 'aria-label': 'Título da anotação', maxLength: 120 });
    const corpo = h('textarea', { value: n.corpo, placeholder: 'Escreva aqui. Salva sozinho.', 'aria-label': 'Texto da anotação' });
    const gravar = async () => {
      n.titulo = titulo.value;
      n.corpo = corpo.value;
      n.atualizadoEm = Date.now();
      await put('notes', n);
      status.textContent = 'Salvo';
      // Atualiza título/data na lista sem recriar o editor (preserva foco e cursor).
      const item = el.querySelector('[aria-current="true"]');
      if (item) item.replaceChildren(h('strong', {}, n.titulo || 'Sem título'), h('small', {}, new Date(n.atualizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })));
    };
    salvar = debounced(() => void gravar(), 500);
    const alterou = () => { status.textContent = 'Salvando…'; salvar.call(); };
    titulo.addEventListener('input', alterou);
    corpo.addEventListener('input', alterou);
    return h('div', { class: 'editor' },
      titulo, corpo,
      h('div', { class: 'barra' }, status,
        h('button', {
          class: 'btn small danger', type: 'button',
          onclick: async () => {
            if (!(await confirmar('Apagar anotação?', `"${n.titulo || 'Sem título'}" será apagada.`, 'Apagar'))) return;
            salvar.cancel();
            await del('notes', n.id);
            lista = lista.filter((x) => x.id !== n.id);
            atual = lista[0] ?? null;
            montar();
          },
        }, 'Apagar')));
  }

  async function nova() {
    salvar.flush();
    const n: Note = { id: uid(), subjectId: subject.id, titulo: '', corpo: '', atualizadoEm: Date.now() };
    await put('notes', n);
    lista = [n, ...lista];
    atual = n;
    montar();
    el.querySelector('input')?.focus();
  }

  montar();
  const aoSair = () => salvar.flush();
  window.addEventListener('pagehide', aoSair);
  return { el, destroy: () => { window.removeEventListener('pagehide', aoSair); salvar.flush(); } };
}
