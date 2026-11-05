export interface View {
  el: HTMLElement;
  /** Libera timers, laços de animação e salva o que estiver pendente. */
  destroy(): void | Promise<void>;
}
