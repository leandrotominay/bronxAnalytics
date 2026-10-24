# Contexto da aplicação Bronx I.A

## Objetivo

Bronx I.A é um companion desktop para League of Legends. Ele lê somente a
captura de tela autorizada pelo usuário e APIs locais/oficiais; não lê memória
do jogo, não injeta código no cliente e não automatiza entradas.

Leia também o [README](./README.md) para instalação, configuração do Worker,
privacidade e limitações.

## Estrutura

- `src/main/`: processo principal Electron, OCR Tesseract, acesso à Live Client
  Data API e consultas externas necessárias.
- `src/preload/`: ponte IPC limitada entre o processo principal e as janelas.
- `src/renderer/`: interface, captura visível, OCR do relógio/chat, análise do
  minimapa, voz e páginas da aplicação.
- `src/shared/`: tipos compartilhados entre main, preload e renderer.
- `src/renderer/assets/champions.json` e `champions/`: catálogo e retratos
  usados pelo tracker, calendário e timers.
- `workers/riot-sync/`: Worker Cloudflare para sincronização do calendário
  ranqueado com APIs oficiais da Riot.
- `resources/`: recursos da aplicação Electron, incluindo o ícone da janela.

## Funcionalidades atuais

- **Jungler Tracker:** identifica o jungler pela Live Client Data API e procura
  apenas o retrato dele na imagem visível do minimapa. Posições são observações
  aproximadas, não localização de inimigos ocultos.
- **Flash Timing:** página independente na navegação. OCR local acompanha o chat
  durante a captura, identifica pings de Flash pelo nome do campeão e mostra
  cooldown de 300 segundos no painel e no overlay do jogo. Funciona para todos
  os campeões inimigos, não apenas para o jungler.
- **Alertas por tempo:** full clear usa o melhor tempo registrado na patch mais
  recente da planilha configurada; também há alertas de objetivos.
- **Calendário ranqueado:** consulta o Worker configurado no build e mantém
  histórico local.
- **Voz local:** vozes instaladas no Windows e modelos locais Piper/Pocket TTS.
- **Overlay:** janela Electron transparente, click-through e sempre no topo,
  usada para alertas, marcadores e timers.

## Fluxos e pontos de entrada

- `src/main/index.ts`: inicializa janelas, valida IPC, OCR e serviços locais.
- `src/preload/index.ts`: expõe operações tipadas ao renderer.
- `src/renderer/src/main.ts`: inicializa captura, tracker, timers e alertas.
- `src/renderer/src/overlay.ts`: desenha eventos recebidos no overlay.
- `src/renderer/src/ranked-calendar.ts`: navegação entre páginas e calendário.
- `src/renderer/src/spell-timing.ts`: interpreta linhas de ping OCR e resolve
  nomes de campeões.
- `src/renderer/index.html`: páginas e elementos da interface.

## Desenvolvimento e validação

Requer Windows, Node.js e npm. Na raiz do projeto:

```powershell
npm install
npm run dev
npm run typecheck
npm run build
```

O instalador Windows NSIS é configurado em `package.json`; sua tela de
boas-vindas e textos ficam em `build/installer.nsh`, com a arte lateral
`resources/installer-sidebar.bmp`. `npm run dist:win` gera o instalador em
`release/`.

`node_modules/` contém dependências necessárias. `out/` é saída gerada e
ignorável pelo Git; é recriada pelo build. O estado em `workers/riot-sync/.wrangler/`
é gerado pelo desenvolvimento local do Worker e pode conter estado de execução.
Não remover dependências ou estado local sem verificar antes o impacto.

## Cuidados de manutenção

- Preserve o processamento local por padrão e valide entradas IPC.
- OCR é custoso: relógio e chat compartilham uma fila exclusiva; relógio é lido
  a cada 2 segundos e o chat a cada 5 segundos.
- Captura e análise do minimapa só rodam quando a captura autorizada está ativa.
- Não confunda sinal observado com previsão ou confirmação. Use erros visíveis,
  sem ocultar falhas com valores padrão que pareçam sucesso.
- Assets de campeões são usados por glob; não remover imagens individuais sem
  verificar catálogo e referências.
- Chaves da Riot ficam como secret no Worker. Nunca incluí-las no renderer,
  preload, build ou repositório.
- Rode typecheck e build após mudanças; valide comportamento em partida real
  quando a alteração depender de OCR ou captura.
