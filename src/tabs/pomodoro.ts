import { getBySubject, type Subject } from '../db';
import { formatMinutes, h, today } from '../dom';
import { assinar, formatar, iniciar, ler, parar, pausar, restanteMs, salvarConfig } from '../pomodoro';
import type { View } from '../views/types';

export async function pomodoro(subject: Subject): Promise<View> {
  const el = h('div', { class: 'pomodoro' });
  const relogio = h('div', { class: 'relogio', role: 'timer', 'aria-live': 'off' });
  const fase = h('div', { class: 'fase' });
  const botoes = h('div', { class: 'acoes' });
  const aviso = h('p', { class: 'dica' });
  const totais = h('p', { class: 'totais' });
  const foco = h('input', { type: 'number', min: 1, max: 180, value: String(ler().foco), 'aria-label': 'Minutos de foco' });
  const pausa = h('input', { type: 'number', min: 1, max: 180, value: String(ler().pausa), 'aria-label': 'Minutos de pausa' });
  const config = h('form', { class: 'linha-form' },
    h('label', {}, 'Foco (min)', foco), h('label', {}, 'Pausa (min)', pausa),
    h('button', { class: 'btn', type: 'submit' }, 'Salvar tempos'));
  config.addEventListener('submit', async (e) => {
    e.preventDefault();
    await salvarConfig(Number(foco.value), Number(pausa.value));
    foco.value = String(ler().foco);
    pausa.value = String(ler().pausa);
  });

  async function atualizarTotais() {
    const sessoes = await getBySubject('sessions', subject.id);
    const total = sessoes.reduce((s, x) => s + x.minutos, 0);
    const inicioHoje = new Date(`${today()}T00:00:00`).getTime();
    const hoje = sessoes.filter((x) => x.em >= inicioHoje).reduce((s, x) => s + x.minutos, 0);
    totais.replaceChildren(
      h('span', {}, 'Total acumulado: ', h('strong', {}, formatMinutes(total))),
      h('span', {}, 'Hoje: ', h('strong', {}, formatMinutes(hoje))),
      h('span', {}, 'Sessões: ', h('strong', {}, String(sessoes.length))));
  }

  function desenhar() {
    const p = ler();
    const emOutra = p.subjectId !== null && p.subjectId !== subject.id && (p.rodando || p.restante !== (p.fase === 'foco' ? p.foco : p.pausa) * 60_000);
    relogio.textContent = formatar(restanteMs());
    fase.textContent = p.fase === 'foco' ? 'Foco' : 'Pausa';
    fase.className = `fase ${p.fase}`;
    aviso.textContent = emOutra ? 'O pomodoro está em andamento em outra sala. Termine ou pare lá para usar aqui.' : '';
    botoes.replaceChildren(
      p.rodando
        ? h('button', { class: 'btn primary', type: 'button', onclick: pausar }, 'Pausar')
        : h('button', { class: 'btn primary', type: 'button', disabled: emOutra, onclick: () => iniciar(subject.id) }, 'Iniciar'),
      h('button', { class: 'btn', type: 'button', disabled: emOutra, onclick: () => void parar() }, 'Parar e zerar'));
    if (document.activeElement !== foco && document.activeElement !== pausa) {
      foco.value = String(p.foco);
      pausa.value = String(p.pausa);
    }
  }

  const desassinar = assinar(desenhar);
  const aoRegistrar = (e: Event) => {
    if ((e as CustomEvent<{ subjectId: string }>).detail.subjectId === subject.id) void atualizarTotais();
  };
  document.addEventListener('sessao-registrada', aoRegistrar);

  el.append(fase, relogio, botoes, aviso, totais,
    h('p', { class: 'dica' }, 'Os minutos de foco completos entram no total desta matéria. Ao parar antes do fim, só os minutos cheios já estudados são contados.'),
    config);
  desenhar();
  await atualizarTotais();
  return { el, destroy() { desassinar(); document.removeEventListener('sessao-registrada', aoRegistrar); } };
}
