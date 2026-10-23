# Contexto para continuar o League Event Companion

Este documento registra o estado do projeto para retomar o trabalho em outra
sessão. Leia-o junto com `README.md` e confira o código atual antes de alterar
comportamentos: este companion é um protótipo visual, não um detector validado
em partidas reais.

## Objetivo do projeto

Aplicativo desktop local para acompanhar uma janela do League of Legends e
mostrar avisos visuais/sonoros. A ideia inclui avisos de lanes que saem de
visão, localização aproximada do jungler no minimapa e, futuramente, timers
de feitiços de invocador.

O trabalho atual está concentrado em fazer a captura do TAB, reconhecer os
retratos inimigos de forma confiável, permitir corrigir manualmente campeões e
lanes, e usar o retrato confirmado do jungler para tentar localizá-lo no
minimapa. Não ler memória do jogo, injetar código no cliente, automatizar
entradas ou tentar inferir a posição de inimigos não visíveis.

## Tecnologia e execução

- Electron 45, TypeScript, electron-vite e Vite.
- Renderer faz a captura local da imagem autorizada, Canvas, detecção visual,
  OCR local com Tesseract e interface.
- Main process enumera janelas e aplica whitelist à janela do League; preload
  expõe uma API pequena por IPC.
- Voz usa `SpeechSynthesisUtterance`; alertas visuais são publicados num overlay
  transparente, click-through.
- Ícones oficiais locais estão em `src/renderer/assets/champions/`, com
  manifesto `src/renderer/assets/champions.json` (Data Dragon 16.21.1).
- Comandos: `npm run dev`, `npm run typecheck`, `npm run build`.
- Workspace: `C:\Users\leand\generalUsage`. Não é um repositório Git.

## Como o fluxo funciona hoje

1. O app procura uma janela cujo título corresponda a
   `League of Legends (TM) Client`; o usuário inicia a captura pelo botão Start.
2. A captura usa `getDisplayMedia` e frames locais. A análise roda a cada
   250 ms, com a captura configurada para 4 FPS.
3. O OCR local tenta ler o cronômetro. Ao reconhecer 01:20, ativa a análise de
   lanes e avisa para apertar TAB. Se a captura começar mais tarde, a ativação
   ocorre quando o cronômetro for reconhecido.
4. A abertura do TAB é detectada por uma heurística de pixels dourados em uma
   região central da imagem. Dois frames confirmam a abertura; então aparecem
   cinco cartões e o companion anuncia “Inimigos detectados com sucesso”.
5. Enquanto o placar está aberto, cada linha usa um círculo configurável para
   recortar o retrato. A comparação local com o catálogo gera uma sugestão após
   três leituras estáveis e com score/margem suficientes. O app **não confirma
   automaticamente**: o usuário precisa confirmar a sugestão ou escolher um
   campeão no seletor.
6. As cinco lanes podem ser corrigidas por seletor/arrastar. A atribuição
   JUNGLE deve estar correta para usar aquele retrato no rastreamento.
7. O tracker procura o retrato do jungler no minimapa, exige estabilidade em
   leituras consecutivas e classifica a posição em top, rio superior, mid, rio
   inferior ou bot. A classificação e a busca ainda são heurísticas.
8. O sistema de alertas de lanes analisa componentes de pixels vermelhos e
   contagens por região. Esse detector não identifica campeão e pode errar.

## Arquivos principais

- `src/renderer/src/main.ts`: fluxo da captura e cronômetro, detecção do TAB,
  matching de campeões, editor de roster, calibração de recortes, heurísticas
  do minimapa e alertas.
- `src/renderer/index.html`: controles, roster, diálogo de calibração.
- `src/renderer/src/style.css`: interface, retratos circulares e diálogo.
- `src/renderer/overlay.html`, `src/renderer/src/overlay.ts` e
  `src/renderer/src/overlay.css`: overlay de avisos.
- `src/main/index.ts`: janela Electron, seleção/captura autorizada, OCR e IPC.
- `src/preload/index.ts`: API IPC exposta com `contextBridge`.
- `src/renderer/assets/champions.json` e `src/renderer/assets/champions/`:
  catálogo local de retratos.
- `README.md`: descrição geral e limitações; revise após mudanças funcionais.

## Estado atual e calibração

- A interface de ajuste chama-se **Ajustar recortes do TAB**. Com a captura
  rodando e o placar visível, a prévia mostra círculos para as cinco linhas;
  arraste o círculo e ajuste o tamanho. A opção **Minimapa** mostra um quadrado
  que define a região examinada pelo rastreador.
- As posições dos retratos e do minimapa são salvas em `localStorage`,
  separadas pela dimensão real do frame capturado (`largura x altura`). Isso
  deve permitir perfis diferentes para janela e tela cheia com bordas, mas
  esse fluxo ainda não foi validado no modo novo.
- O círculo é usado tanto no catálogo quanto no recorte confirmado da partida.
  Uma sugestão confirmada com o retrato capturado do placar fornece a imagem
  usada pelo tracker; escolher manualmente um campeão que não tenha sugestão
  disponível usa o ícone Data Dragon como fallback.
- A janela de calibração mostra, por linha, candidato, erro e margem. Esses
  números servem para diagnosticar o recorte e o matcher, mas os limites atuais
  ainda são provisórios; não foram medidos numa série de capturas reais.
- O usuário reportou que o Nocturne foi reconhecido no TAB mas não foi
  rastreado/anunciado no mapa. Antes de dizer que isso foi corrigido, confirmar
  que o cartão está atribuído a JUNGLE, que a imagem usada como template é a
  captura circular correta, que o recorte do minimapa cobre o mapa inteiro sem
  bordas, e que o formato/tamanho do ícone com anel vermelho corresponde aos
  pressupostos do matcher.
- O usuário está mudando de modo janela para **tela cheia com bordas**. A
  captura poderá ter proporção, bordas e dimensões diferentes; recalibrar
  primeiro nessa configuração. Não assumir que `1920x1080` foi realmente o
  tamanho do frame capturado: medir `video.videoWidth` e `video.videoHeight`.
- A detecção de TAB usa uma fração fixa de pixels dourados numa região central.
  Deve ser retestada na configuração fullscreen/bordas, pois o placar pode
  mudar de posição/tamanho por escala da interface.

## Problemas conhecidos / riscos técnicos

1. **Reconhecimento ainda não validado:** a busca compara amostras de cor
   pequenas e pode confundir campeões parecidos. Resultado incerto deve
   permanecer como sugestão ou desconhecido, nunca trocar silenciosamente o
   campeão confirmado.
2. **Calibração é parte necessária do funcionamento:** não há uma captura de
   referência versionada nem testes de imagem. Sem validar que cada círculo
   contém só o portrait, ajuste de thresholds não resolve a causa raiz.
3. **Tracker do minimapa:** procura anel vermelho e compara a região interna
   com o template. UI do mapa, zoom, transparência/recorte circular, resolução,
   ícones sobrepostos e qualidade dos frames podem impedir o matching.
4. **Custo de CPU:** `findPortraitOnMinimap` percorre o minimapa e vários
   tamanhos/posições. A busca é chamada para o jungler e pode também rodar para
   várias lanes; medir o custo antes de expandir a busca ou adicionar mais
   templates. Evitar varrer o minimapa inteiro em cada frame.
5. **Alertas de lane podem ser falsos:** a contagem de pixels vermelhos não
   equivale a uma detecção de campeão. O retrato no minimapa foi adicionado
   como mitigação quando há retrato identificado, mas também é um matcher
   experimental.
6. **Resolução de captura x resolução do monitor:** caches devem usar as
   dimensões do vídeo capturado, não resolução configurada no Windows nem
   valor presumido pelo usuário.
7. **Consistência entre documentação e código:** o README pode dizer “segunda
   linha” e “captura” de forma mais categórica que o código realmente garante.
   Ao retomar, inspecionar o estado atual e atualizar as afirmações obsoletas.

## Próximos passos recomendados

1. Iniciar o app e captura na nova configuração de tela cheia com bordas.
   Registrar dimensões reais do frame e confirmar que o preview mostra o jogo
   sem crop inesperado.
2. Abrir TAB e usar a ferramenta para ajustar os cinco círculos. Confirmar
   visualmente que o retrato inteiro cabe dentro do círculo em todas as linhas;
   anotar tamanho/posição e resultados de erro/margem.
3. Corrigir uma linha por vez e confirmar os cinco campeões reais. Depois
   certificar-se de que o jungler correto está em JUNGLE; não atribuir o
   candidato automaticamente.
4. Ajustar o quadrado de minimapa para conter apenas a área do mapa, incluindo
   posições de top, rio, mid e bot. Capturar imagens em que o Nocturne esteja
   visível e comparar o template do placar com o ícone do minimapa.
5. Adicionar um modo de diagnóstico visual que mostre os candidatos do
   minimapa, score e posição escolhida, sem emitir áudio até o resultado ser
   confirmado em frames consecutivos. Se não achar, diferenciar “nenhum anel
   vermelho válido”, “score ruim” e “resultado ambíguo”.
6. Só depois de medições reais ajustar o algoritmo/limites. Preferir matching
   por cor/forma normalizado e score com margem; se o portrait do minimapa não
   conservar detalhe suficiente, avaliar reconhecimento de padrão usando
   capturas anotadas. Não buscar posições inimigas ocultas.
7. Confirmar o cache: calibrar, fechar/reabrir o app e verificar que perfil
   reaparece; mudar dimensão do frame e confirmar que usa outro perfil.
8. Rodar `npm run typecheck` e `npm run build` após mudanças.

## Histórico recente relevante

- O app inicialmente identificava campeões automaticamente, mas repetia
  campeões incorretos. A lógica foi alterada para exigir leituras repetidas e
  confirmação manual.
- Limites mais estritos reduziram falsos positivos, mas também deixaram muitas
  linhas sem identificação; por isso foi adicionada calibração explícita dos
  retratos.
- Uma captura compartilhada mostrava Ornn repetido em linhas distintas. A
  sugestão manual substituiu atribuição automática, mas ainda precisa ser
  conferida com a captura real.
- O usuário confirmou que o Nocturne jungler chegou a aparecer como campeão
  detectado, porém não recebeu localização/alerta de minimapa.
- Na última validação executada, `npm run typecheck` e `npm run build`
  passaram. Isso valida compilação, não precisão visual na partida.
