import { del, getBySubject, put, uid, type Flashcard, type Subject } from '../db';
import { h } from '../dom';
import { confirmar } from '../ui';
import type { View } from '../views/types';

const CAIXAS = 5;

/** Leitner simples: acertou sobe uma caixa (até a 5); errou volta para a 1. */
export const proximaCaixa = (caixa: number, acertou: boolean): number => (acertou ? Math.min(CAIXAS, caixa + 1) : 1);

function embaralhar<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function flashcards(subject: Subject): Promise<View> {
  let cartas = await getBySubject('flashcards', subject.id);
  const el = h('div', {});

  function lista(editando: Flashcard | null = null) {
    const frente = h('textarea', { rows: 3, placeholder: 'Frente (pergunta)', required: true, value: editando?.frente ?? '', 'aria-label': 'Frente do cartão' });
    const verso = h('textarea', { rows: 3, placeholder: 'Verso (resposta)', required: true, value: editando?.verso ?? '', 'aria-label': 'Verso do cartão' });
    const form = h('form', { class: 'stack' }, frente, verso,
      h('div', { class: 'acoes' },
        h('button', { class: 'btn primary', type: 'submit' }, editando ? 'Salvar cartão' : 'Adicionar cartão'),
        editando && h('button', { class: 'btn', type: 'button', onclick: () => lista() }, 'Cancelar')));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (editando) {
        editando.frente = frente.value.trim();
        editando.verso = verso.value.trim();
        await put('flashcards', editando);
      } else {
        const c: Flashcard = { id: uid(), subjectId: subject.id, frente: frente.value.trim(), verso: verso.value.trim(), caixa: 1 };
        await put('flashcards', c);
        cartas.push(c);
      }
      lista();
    });

    const porCaixa = Array.from({ length: CAIXAS }, (_, i) => cartas.filter((c) => c.caixa === i + 1).length);
    el.replaceChildren(
      h('div', { class: 'revisar-topo' },
        h('div', { class: 'caixas' }, ...porCaixa.map((n, i) => h('span', { class: 'caixa' }, `Caixa ${i + 1}: `, h('strong', {}, String(n))))),
        h('button', { class: 'btn primary', type: 'button', disabled: !cartas.length, onclick: revisar }, 'Revisar')),
      form,
      cartas.length
        ? h('ul', { class: 'itens' }, ...cartas.map((c) =>
            h('li', { class: 'item' },
              h('span', { class: 'item-texto' }, h('strong', {}, c.frente), h('small', {}, `Caixa ${c.caixa} · ${c.verso}`)),
              h('button', { class: 'btn small', type: 'button', onclick: () => lista(c) }, 'Editar'),
              h('button', {
                class: 'btn small danger', type: 'button',
                onclick: async () => {
                  if (!(await confirmar('Apagar cartão?', 'O cartão será removido.', 'Apagar'))) return;
                  await del('flashcards', c.id);
                  cartas = cartas.filter((x) => x.id !== c.id);
                  lista();
                },
              }, 'Apagar'))))
        : h('p', { class: 'dica' }, 'Nenhum flashcard ainda.'));
    if (editando) el.querySelector('textarea')?.focus();
  }

  function revisar() {
    // Caixas mais baixas primeiro (o que você mais erra); dentro de cada caixa, ordem aleatória.
    const fila = embaralhar([...cartas]).sort((a, b) => a.caixa - b.caixa);
    let i = 0;
    let acertos = 0;
    let virado = false;

    function passo() {
      if (i >= fila.length) {
        el.replaceChildren(h('div', { class: 'vazio' },
          h('p', { class: 'grande' }, 'Revisão concluída'),
          h('p', {}, `Você acertou ${acertos} de ${fila.length}.`),
          h('button', { class: 'btn primary', type: 'button', onclick: () => lista() }, 'Voltar aos cartões')));
        return;
      }
      const c = fila[i];
      const resposta = async (acertou: boolean) => {
        c.caixa = proximaCaixa(c.caixa, acertou);
        if (acertou) acertos++;
        await put('flashcards', c);
        i++;
        virado = false;
        passo();
      };
      const carta = h('button', {
        class: `carta ${virado ? 'verso' : ''}`, type: 'button', 'aria-label': virado ? 'Verso do cartão' : 'Virar cartão',
        onclick: () => { virado = !virado; passo(); },
      }, h('small', {}, virado ? 'Verso' : 'Frente (clique para virar)'), h('span', {}, virado ? c.verso : c.frente));
      el.replaceChildren(
        h('div', { class: 'revisar-topo' },
          h('span', {}, `Cartão ${i + 1} de ${fila.length} · Caixa ${c.caixa}`),
          h('button', { class: 'btn small', type: 'button', onclick: () => lista() }, 'Sair')),
        carta,
        virado
          ? h('div', { class: 'acoes centro' },
              h('button', { class: 'btn danger', type: 'button', onclick: () => void resposta(false) }, 'Errei'),
              h('button', { class: 'btn primary', type: 'button', onclick: () => void resposta(true) }, 'Acertei'))
          : h('div', { class: 'acoes centro' }, h('button', { class: 'btn', type: 'button', onclick: () => { virado = true; passo(); } }, 'Virar')));
    }
    passo();
  }

  lista();
  return { el, destroy() {} };
}
