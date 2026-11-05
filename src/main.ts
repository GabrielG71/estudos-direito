import '@fontsource/pixelify-sans/400.css';
import './style.css';
import { carregarConfig } from './pomodoro';
import { h } from './dom';
import { lobby } from './views/lobby';
import { sala } from './views/sala';
import type { View } from './views/types';

// Rotas por hash (#/ e #/sala/<id>/<aba>): funcionam em hospedagem estática sem configuração extra.
const app = document.getElementById('app')!;
let atual: View | null = null;
let ordem = 0;

async function rota(): Promise<void> {
  const minha = ++ordem;
  const [, tipo, id, aba] = location.hash.replace(/^#/, '').split('/');
  const anterior = atual;
  atual = null;
  await anterior?.destroy();
  let view: View | null = null;
  try {
    view = tipo === 'sala' && id ? await sala(id, aba) : await lobby();
    if (!view) {
      location.hash = '#/';
      return;
    }
  } catch (e) {
    console.error(e);
    app.replaceChildren(h('main', { class: 'page' }, h('p', { class: 'vazio' }, 'Não foi possível abrir o armazenamento do navegador. Verifique se o modo privado ou o bloqueio de dados do site está ativo.')));
    return;
  }
  if (minha !== ordem) {
    await view.destroy(); // outra navegação passou na frente
    return;
  }
  atual = view;
  app.replaceChildren(view.el);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => void rota());
void carregarConfig().catch(console.error);
void rota();
