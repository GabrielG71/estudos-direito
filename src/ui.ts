// Diálogos na própria interface (em vez de window.confirm / prompt).
import { h } from './dom';

export const CORES = ['#e2604f', '#ec8a3c', '#f2c14e', '#4cae6a', '#36b0b0', '#3f7fd8', '#8d66cf', '#e47aa8'];

function modal(content: (close: (v: unknown) => void) => HTMLElement[]): Promise<unknown> {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'dialog' });
    const close = (v: unknown) => {
      dlg.close();
      dlg.remove();
      resolve(v);
    };
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      close(null);
    });
    dlg.append(...content(close));
    document.body.append(dlg);
    dlg.showModal();
  });
}

export async function confirmar(titulo: string, texto: string, ok = 'Confirmar'): Promise<boolean> {
  const r = await modal((close) => [
    h('h2', {}, titulo),
    h('p', {}, texto),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', type: 'button', onclick: () => close(false) }, 'Cancelar'),
      h('button', { class: 'btn danger', type: 'button', autofocus: true, onclick: () => close(true) }, ok)),
  ]);
  return r === true;
}

export async function avisar(titulo: string, texto: string): Promise<void> {
  await modal((close) => [
    h('h2', {}, titulo),
    h('p', {}, texto),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', autofocus: true, onclick: () => close(true) }, 'Ok')),
  ]);
}

export interface SubjectForm { nome: string; cor: string }

/** Pede o nome da matéria e a cor (criar ou editar). */
export async function pedirMateria(titulo: string, inicial?: SubjectForm): Promise<SubjectForm | null> {
  const r = await modal((close) => {
    let cor = inicial?.cor ?? CORES[Math.floor(Math.random() * CORES.length)];
    const nome = h('input', { type: 'text', maxLength: 40, required: true, value: inicial?.nome ?? '', placeholder: 'Ex.: Direito Civil' });
    const swatches = CORES.map((c) =>
      h('button', {
        type: 'button', class: 'swatch', title: c, 'aria-label': `Cor ${c}`, style: { background: c },
        'aria-pressed': String(c === cor),
        onclick: () => {
          cor = c;
          swatches.forEach((s) => s.setAttribute('aria-pressed', String(s.title === cor)));
        },
      }),
    );
    const form = h('form', { class: 'stack' },
      h('h2', {}, titulo),
      h('label', {}, 'Nome da matéria', nome),
      h('div', {}, h('span', { class: 'label' }, 'Cor da sala'), h('div', { class: 'swatches' }, ...swatches)),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => close(null) }, 'Cancelar'),
        h('button', { class: 'btn primary', type: 'submit' }, 'Salvar')),
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = nome.value.trim();
      if (n) close({ nome: n, cor });
    });
    queueMicrotask(() => nome.focus());
    return [form];
  });
  return r as SubjectForm | null;
}
