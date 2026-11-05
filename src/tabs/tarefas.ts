import { del, getBySubject, put, uid, type Subject, type Task } from '../db';
import { formatDate, h, today } from '../dom';
import { confirmar } from '../ui';
import type { View } from '../views/types';

/** Pendentes primeiro, por data (sem data por último); feitas no fim, também por data. */
export function ordenar(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) =>
    Number(a.feito) - Number(b.feito) ||
    (a.data ?? '9999-99-99').localeCompare(b.data ?? '9999-99-99') ||
    a.texto.localeCompare(b.texto, 'pt-BR'));
}

export async function tarefas(subject: Subject): Promise<View> {
  let lista = await getBySubject('tasks', subject.id);
  const el = h('div', {});

  function montar() {
    const texto = h('input', { type: 'text', placeholder: 'Tarefa ou prova (ex.: Prova de Civil)', required: true, maxLength: 200, 'aria-label': 'Texto da tarefa' });
    const data = h('input', { type: 'date', 'aria-label': 'Data (opcional)' });
    const form = h('form', { class: 'linha-form' }, texto, data, h('button', { class: 'btn primary', type: 'submit' }, 'Adicionar'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const t: Task = { id: uid(), subjectId: subject.id, texto: texto.value.trim(), feito: false, ...(data.value ? { data: data.value } : {}) };
      await put('tasks', t);
      lista.push(t);
      montar();
    });
    const hoje = today();
    el.replaceChildren(form,
      lista.length
        ? h('ul', { class: 'itens' }, ...ordenar(lista).map((t) => {
            const atrasada = !t.feito && t.data !== undefined && t.data < hoje;
            const check = h('input', { type: 'checkbox', checked: t.feito, 'aria-label': `Marcar "${t.texto}" como feita` });
            check.addEventListener('change', async () => {
              t.feito = check.checked;
              await put('tasks', t);
              montar();
            });
            return h('li', { class: `item ${t.feito ? 'feito' : ''}` },
              check,
              h('span', { class: 'item-texto' },
                h('strong', {}, t.texto),
                t.data && h('small', { class: atrasada ? 'atrasada' : '' }, `${t.data === hoje ? 'Hoje' : formatDate(t.data)}${atrasada ? ' · atrasada' : ''}`)),
              h('button', {
                class: 'btn small danger', type: 'button',
                onclick: async () => {
                  if (!(await confirmar('Apagar tarefa?', `"${t.texto}" será removida.`, 'Apagar'))) return;
                  await del('tasks', t.id);
                  lista = lista.filter((x) => x.id !== t.id);
                  montar();
                },
              }, 'Apagar'));
          }))
        : h('p', { class: 'dica' }, 'Nenhuma tarefa ainda.'));
  }

  montar();
  return { el, destroy() {} };
}
