# Estudos de Direito

Site estático para estudar Direito. Cada matéria é uma **sala em pixel art** com um boneco; dentro da sala ficam as
ferramentas de estudo:

- **Anotações**: várias por matéria, com salvamento automático.
- **Arquivos & Links**: PDFs e imagens guardados no navegador (abrir, baixar, apagar) e links com título.
- **Pomodoro**: 25/5 configurável; soma os minutos estudados por matéria.
- **Flashcards**: frente/verso e modo revisar com caixas de Leitner (acertou sobe de caixa, errou volta para a 1).
- **Tarefas e provas**: com data opcional, ordenadas por data.

Tudo fica salvo no **navegador** (IndexedDB). Não há servidor, conta, IA nem chamadas de rede. Use **Exportar backup**
no lobby para guardar um JSON com tudo (arquivos incluídos) e **Importar backup** para restaurar: a importação
substitui os dados atuais, depois de um aviso.

> Os dados pertencem a este navegador e a este endereço. Limpar os dados do site apaga tudo, então exporte um backup de
> vez em quando.

## Como rodar

Requer Node 22.12 ou mais novo.

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:5173
npm run build      # confere os tipos e gera dist/
npm run preview    # serve dist/ em http://localhost:4173
```

## Como subir na Vercel

1. Suba o repositório para o GitHub e importe-o em [vercel.com/new](https://vercel.com/new).
2. A Vercel detecta o Vite sozinha: *Build Command* `npm run build`, *Output Directory* `dist`. Não precisa de
   `vercel.json` nem de variáveis de ambiente (o roteamento usa `#/`, então funciona em hospedagem estática).

## Estrutura

```
src/art/     pixel art procedural (bonecos, piso, parede, móveis), aparada do Habblaud
src/scene.ts a sala: cenário e o boneco passeando
src/db.ts    IndexedDB (matérias, notas, arquivos, links, flashcards, tarefas, sessões, config)
src/tabs/    uma ferramenta por arquivo
src/views/   lobby e sala
```

## Créditos e licença

Os bonecos, o piso, as paredes, os móveis e o desenho da sala vêm do **[Habblaud](https://github.com/marmottajr/habblaud)**,
de Márcio Junior (MIT), no módulo `client/src/art/` e na paleta da interface. Foi usada a versão 1.0.3 (branch `main`,
commit `faa1a01`). O código aproveitado foi aparado e adaptado para este projeto.

Texto de licença do Habblaud, copiado do `README.pt-BR.md` dele (seção "Licença", linhas 1201 a 1204):

> [MIT](LICENSE). As imagens em `client/public/assets` (logotipo, ilustrações, quadros e pôsteres) foram geradas com
> IA para este projeto e convertidas em pixel art pelos scripts de `scripts/assets/`.

Aqui não foi copiada nenhuma dessas imagens: os bonecos, o piso, as paredes e os móveis são pixel art **gerada por
código** (README.pt-BR.md do Habblaud, linha 866), e a interface não usa imagem nenhuma.

A fonte [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans) (SIL OFL 1.1), usada só no título, vem do
pacote npm `@fontsource/pixelify-sans`.

Licença: [MIT](LICENSE), com o copyright original de Márcio Junior mantido.
