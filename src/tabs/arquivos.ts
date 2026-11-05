import { baixar } from '../backup';
import { del, getBySubject, put, uid, type FileRec, type LinkRec, type Subject } from '../db';
import { formatBytes, h } from '../dom';
import { avisar, confirmar } from '../ui';
import type { View } from '../views/types';

const ACEITOS = 'application/pdf,image/*';

/** Só http(s): evita `javascript:` e afins em links salvos. Sem esquema, assume https. */
export function normalizarUrl(txt: string): string | null {
  const t = txt.trim();
  if (!t) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export async function arquivos(subject: Subject): Promise<View> {
  let files = (await getBySubject('files', subject.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  let links = (await getBySubject('links', subject.id)).sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  const el = h('div', { class: 'duas-secoes' });

  function montar() {
    const input = h('input', { type: 'file', accept: ACEITOS, multiple: true, hidden: true });
    input.addEventListener('change', async () => {
      const recebidos = [...(input.files ?? [])];
      input.value = '';
      for (const f of recebidos) {
        const ok = f.type === 'application/pdf' || f.type.startsWith('image/');
        if (!ok) { await avisar('Tipo não aceito', `"${f.name}" não é PDF nem imagem.`); continue; }
        const rec: FileRec = { id: uid(), subjectId: subject.id, nome: f.name, tipo: f.type, blob: f };
        try {
          await put('files', rec);
          files.push(rec);
        } catch {
          await avisar('Não foi possível salvar', `"${f.name}" não coube no armazenamento do navegador.`);
        }
      }
      files.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      montar();
    });

    const titulo = h('input', { type: 'text', placeholder: 'Título (ex.: Código Civil)', maxLength: 120, required: true, 'aria-label': 'Título do link' });
    const url = h('input', { type: 'text', placeholder: 'https://…', required: true, 'aria-label': 'Endereço do link', inputMode: 'url' });
    const form = h('form', { class: 'linha-form' }, titulo, url, h('button', { class: 'btn primary', type: 'submit' }, 'Adicionar link'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const href = normalizarUrl(url.value);
      if (!href) { await avisar('Endereço inválido', 'Use um endereço http:// ou https://.'); return; }
      const l: LinkRec = { id: uid(), subjectId: subject.id, titulo: titulo.value.trim(), url: href };
      await put('links', l);
      links.push(l);
      links.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
      montar();
    });

    el.replaceChildren(
      h('section', {},
        h('h2', {}, 'Arquivos'),
        h('p', { class: 'dica' }, 'PDFs e imagens ficam guardados neste navegador (não vão para a internet).'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => input.click() }, 'Enviar arquivo'), input,
        files.length
          ? h('ul', { class: 'itens' }, ...files.map(linhaArquivo))
          : h('p', { class: 'dica' }, 'Nenhum arquivo ainda.')),
      h('section', {},
        h('h2', {}, 'Links'),
        form,
        links.length
          ? h('ul', { class: 'itens' }, ...links.map(linhaLink))
          : h('p', { class: 'dica' }, 'Nenhum link ainda.')),
    );
  }

  function linhaArquivo(f: FileRec) {
    return h('li', { class: 'item' },
      h('span', { class: 'item-texto' }, h('strong', {}, f.nome), h('small', {}, `${f.tipo === 'application/pdf' ? 'PDF' : 'Imagem'} · ${formatBytes(f.blob.size)}`)),
      h('button', { class: 'btn small', type: 'button', onclick: () => abrir(f) }, 'Abrir'),
      h('button', { class: 'btn small', type: 'button', onclick: () => baixar(f.blob, f.nome) }, 'Baixar'),
      h('button', {
        class: 'btn small danger', type: 'button',
        onclick: async () => {
          if (!(await confirmar('Apagar arquivo?', `"${f.nome}" será removido deste navegador.`, 'Apagar'))) return;
          await del('files', f.id);
          files = files.filter((x) => x.id !== f.id);
          montar();
        },
      }, 'Apagar'));
  }

  function linhaLink(l: LinkRec) {
    return h('li', { class: 'item' },
      h('span', { class: 'item-texto' }, h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, l.titulo), h('small', {}, l.url)),
      h('button', {
        class: 'btn small danger', type: 'button',
        onclick: async () => {
          if (!(await confirmar('Apagar link?', `"${l.titulo}" será removido.`, 'Apagar'))) return;
          await del('links', l.id);
          links = links.filter((x) => x.id !== l.id);
          montar();
        },
      }, 'Apagar'));
  }

  montar();
  return { el, destroy() {} };
}

function abrir(f: FileRec): void {
  const url = URL.createObjectURL(f.blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
