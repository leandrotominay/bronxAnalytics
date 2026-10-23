# Contexto para continuar o Bronx Analytics

Este documento registra o estado do projeto para retomar o trabalho em outra
sessão. Leia-o junto com `README.md` e confira o código atual antes de alterar
comportamentos: este companion é um protótipo visual, não um detector validado
em partidas reais.

As tarefas priorizadas para a próxima sessão estão em
[`TODO-PROXIMA-SESSAO.md`](./TODO-PROXIMA-SESSAO.md), incluindo a referência
visual [`docs/references/pdl-calendar-example.png`](./docs/references/pdl-calendar-example.png).

## Objetivo do projeto

Aplicativo desktop local para acompanhar uma janela do League of Legends e
mostrar avisos visuais/sonoros. A ideia inclui avisos de lanes que saem de
visão, localização aproximada do jungler no minimapa e, futuramente, timers
de feitiços de invocador.

O roster agora vem da Live Client Data API local (sem TAB); o app usa o ícone
Data Dragon do jungler e a imagem visível do minimapa para tentar localizá-lo.
Não ler memória do jogo, injetar código no cliente, automatizar entradas ou
tentar inferir a posição de inimigos não visíveis.

## Tecnologia e execução

- Electron 45, TypeScript, electron-vite e Vite.
- Nome visível: **Bronx Analytics**. O monograma original vermelho com “B”
  está em `resources/bronx-analytics.ico` e é usado como ícone da janela.
- A interface agora é um dashboard escuro com acentos crimson. O botão
  **Modo desenvolvedor** oculta/exibe o painel técnico e os controles de
  calibração sem alterar alertas sonoros; o botão interno pausa o áudio.
- Janela principal inicial: 1120×820, mínimo 760×620.
- Renderer faz a captura local da imagem autorizada, Canvas, detecção visual,
  OCR local com Tesseract e interface.
- Main process enumera janelas e aplica whitelist à janela do League; preload
  expõe uma API pequena por IPC.
- Main process consulta `127.0.0.1:2999` com o certificado raiz publicado pela
  Riot; a validação TLS permanece habilitada. O renderer recebe somente os
  campeões e posições dos adversários, além do lado local azul/vermelho
  necessário para rotular campos aliados/inimigos; não recebe nomes ou dados
  completos.
- Vozes de alerta usam `SpeechSynthesisUtterance` com as vozes instaladas no
  Windows. É grátis, local e não envia texto de alertas a um provedor de nuvem;
  o usuário pode escolher voz, velocidade e tom. A integração paga ElevenLabs
  foi removida. Alertas visuais continuam publicados num overlay transparente,
  click-through.
- Ícones oficiais locais estão em `src/renderer/assets/champions/`, com
  manifesto `src/renderer/assets/champions.json` (Data Dragon 16.21.1).
- Comandos: `npm run dev`, `npm run typecheck`, `npm run build`.
- Workspace / repositório Git: `C:\Users\leand\generalUsage`.

## Como o fluxo funciona hoje

1. O app procura uma janela cujo título corresponda a
   `League of Legends (TM) Client`; o usuário inicia a captura pelo botão Start.
2. A captura usa `getDisplayMedia` e frames locais. A análise roda a cada
   250 ms, com a captura configurada para 4 FPS.
3. O OCR local tenta ler o cronômetro. Ao reconhecer 01:20, ativa a análise de
   lanes; se a captura começar mais tarde, a ativação ocorre quando o
   cronômetro for reconhecido. O tracker do jungler começa assim que a API
   identificar o jungler, independentemente do OCR. O TAB não é necessário.
4. O roster vem da Live Client Data API no processo principal do Electron,
   filtrando o time do jogador ativo. A consulta usa o certificado raiz oficial
   da Riot e nunca desativa a validação TLS. Os cartões exibem os campeões,
   ícones locais Data Dragon e as posições expostas pela API; posições ausentes
   ou duplicadas são marcadas como desconhecidas.
5. O usuário pode corrigir manualmente uma lane desconhecida ou incorreta; a
   correção permanece enquanto a API atualiza os outros dados da partida.
   Identificar e atribuir o jungler não depende mais de abrir o TAB.
6. O tracker compara o ícone local Data Dragon do jungler com a imagem do
   minimapa e exige duas leituras estáveis antes de alertar uma nova região.
   A classificação agora separa rios superior/central/inferior, lanes,
   covis do Barão/Dragão e os acampamentos Blue, Red, Gromp, Lobos, Acúleos e
   Krugues dos lados azul e vermelho. O rótulo aliado/inimigo vem do lado
   local da Live Client API (`ORDER` = azul; `CHAOS` = vermelho). Essas áreas
   usam âncoras geométricas aproximadas, não coordenadas do jogo, e ainda
   precisam ser comparadas a capturas reais.
7. O sistema de alertas de lanes analisa componentes de pixels vermelhos e
   contagens por região. Esse detector não identifica campeão e pode errar.
   O recorte de contagem usa agora o mesmo minimapa calibrado pelo usuário,
   mantendo coordenadas normalizadas alinhadas com o mapa; o painel e o
   manifesto diagnóstico registram contagens TOP/MID/BOT e estado dos timers.
   A amostra de 13:41 só tinha o status do matcher do jungler (`found`), sem
   estados de presença/ausência das lanes, portanto não permite comprovar se
   um laner foi visto antes de sumir. Nas amostras de 14:03 e 14:04, o BOT
   tinha timer de ausência, mas a busca por jogador tentava encontrar lane
   `"bot"` enquanto o roster registra a posição como `"adc"`, bloqueando o
   alerta antes de chamar `announceEvent`. `findLanePlayer` agora normaliza
   essa correspondência. O timer do TOP era zero nas capturas.

## Arquivos principais

- `src/renderer/src/main.ts`: captura, OCR do cronômetro, consulta periódica do
  roster via IPC, correções manuais, calibração do minimapa e alertas.
- `src/renderer/index.html`: controles, roster, diálogo de calibração do minimapa.
- `src/renderer/src/style.css`: interface, retratos circulares e diálogo.
- `src/renderer/index.html` e `src/renderer/src/style.css` também incluem
  painel de diagnóstico, formulário para anotar o resultado esperado e prévia
  do candidato encontrado no minimapa.
- `src/renderer/overlay.html`, `src/renderer/src/overlay.ts` e
  `src/renderer/src/overlay.css`: overlay de avisos.
- `src/main/index.ts`: janela Electron, seleção/captura autorizada, OCR, IPC e
  salvamento de amostras que o usuário solicitar.
- `src/main/live-client-data.ts`: HTTPS local com certificado validado,
  validação da resposta e filtragem do time adversário.
- `src/main/riotgames-certificate.ts`: raiz TLS publicada pela Riot.
- `src/shared/live-client-data.ts`: contrato tipado do roster filtrado.
- `src/preload/index.ts`: API IPC exposta com `contextBridge`, incluindo
  salvamento controlado de amostras.
- `src/renderer/assets/champions.json` e `src/renderer/assets/champions/`:
  catálogo local de retratos.
- `README.md`: descrição geral e limitações; revise após mudanças funcionais.

## Estado atual e calibração

- A interface **Ajustar minimapa** permite mover/redimensionar o recorte
  examinado pelo rastreador. A calibração é armazenada por resolução.
- A calibração do minimapa é salva em `localStorage`, separada pela dimensão
  real do frame (`largura x altura`). O ícone local Data Dragon agora é o
  template do jungler; sua semelhança com o marcador do minimapa ainda precisa
  ser medida em partidas reais.
- O usuário reportou que o Nocturne não foi rastreado/anunciado no mapa.
  Confirmar numa partida se a API retorna `position: "JUNGLE"`, se o ícone
  Data Dragon corresponde ao marcador do minimapa e se a região calibrada
  contém a área inteira do mapa.
- O usuário está mudando de modo janela para **tela cheia com bordas**. A
  captura poderá ter proporção, bordas e dimensões diferentes; recalibrar
  primeiro nessa configuração. Não assumir que `1920x1080` foi realmente o
  tamanho do frame capturado: medir `video.videoWidth` e `video.videoHeight`.
- O modo **Diagnóstico** pausa a fala, mas mantém o overlay visual de alertas
  ativo para permitir validar notificações enquanto se capturam amostras. O
  painel mostra dimensões reais do frame, status do roster pela API, região
  do minimapa, contagens/timers por lane e status da última busca.
- Diagnóstico começa desligado em cada abertura; ajustar o minimapa não deve
  ativar esse modo nem silenciar a fala.
- **Salvar amostra diagnóstica** solicita uma pasta pelo diálogo nativo e, só
  após ação explícita, cria um diretório com timestamp: `manifest.json`, frame
  completo e minimapa recortado. O manifesto registra dimensões, leituras do
  OCR, roster, calibrações, scores e rótulos esperados de campeão/zona. Não há
  gravação automática nem upload.
- **Ajustar minimapa** move/redimensiona o recorte e não depende do TAB.

## Problemas conhecidos / riscos técnicos

1. **API ainda não testada numa partida ativa:** confirmar certificado, resposta
   real, filtro do time e disponibilidade dos campos de posição no jogo. Erros
   devem permanecer visíveis; não desabilitar TLS como contorno.
2. **Tracker do minimapa:** procura anel vermelho e compara a região interna
   com o template. UI do mapa, zoom, transparência/recorte circular, resolução,
   ícones sobrepostos e qualidade dos frames podem impedir o matching.
3. **Posições ausentes/ambíguas:** a API pode retornar posição vazia. O app
   marca essa posição como desconhecida e não escolhe esse jogador como
   jungler até uma correção manual.
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
8. **Relógio do HUD:** a amostra nova mostra o timer no extremo superior
   direito. Os recortes antigos incluíam área demais; o recorte compacto agora
   leu `02:28` na amostra e as leituras brutas/confiança são guardadas no
   painel e manifesto. Ainda é necessário validar no jogo ao vivo.

## Próximos passos recomendados

1. Com uma partida ativa, iniciar captura e confirmar que a API retorna os
   cinco campeões inimigos e as lanes corretas sem abrir o TAB.
2. Verificar como o app trata `position` vazio/duplicado, fazer correções
   manuais e confirmar que elas permanecem durante as atualizações.
3. Confirmar que a API só preenche roster; localização continua baseada no
   minimapa visível. Ajustar o minimapa para conter só a área útil.
4. Confirmar que o OCR avança corretamente no modo tela cheia com bordas.
5. Salvar amostras explícitas de várias partidas e medir acertos, falsos
   alertas, abstenções e latência. Não inferir posições inimigas ocultas.
6. Verificar que o perfil de calibração reaparece após fechar/reabrir e muda
   quando as dimensões reais do frame mudam.
7. Rodar `npm run typecheck` e `npm run build` após mudanças.

## Histórico recente relevante

- A detecção anterior pelo TAB repetia campeões incorretos e foi substituída
  pela API local e pelos ícones oficiais Data Dragon.
- O usuário confirmou que o Nocturne jungler chegou a aparecer como campeão
  detectado, porém não recebeu localização/alerta de minimapa.
- Na última validação executada, `npm run typecheck` e `npm run build`
  passaram. Isso valida compilação, não precisão visual na partida.
- Diagnóstico e salvamento local foram implementados, mas precisam ser usados
  pelo usuário para validar detecção e métricas em várias capturas reais.
- A amostra `src/renderer/assets/league-diagnostic-2026-10-23T13-06-13-195Z/`
  contém um frame 1920×1080. O timer visível é `02:28`, mas o manifesto
  registrou `gameClockSeconds: 80`, indício de que o OCR anterior ficou
  desatualizado antes de salvar. O recorte novo (`left: 0.955`, `width: 0.043`,
  `height: 0.032`) leu `02:28`; o parser também passou a aceitar texto ruidoso,
  como `03:16 19191`. O painel e novos manifestos agora incluem texto bruto,
  confiança do OCR. Nesta amostra, `scoreboardVisible` é false e
  `minimapScan.status` é `not-run`; ela valida o relógio, não o reconhecimento
  do jungler.
- A API Live Client Data está integrada pelo endpoint local `allgamedata`,
  consultado a cada 2,5 segundos durante a captura. Ela fornece campeão,
  equipe e `position`, mas não coordenadas do minimapa. A integração filtra o
  time local usando identificadores do próprio payload, sem expor nomes de
  jogadores ao renderer. Ainda precisa ser testada numa partida ativa.
- A posição do jungler só é considerada válida quando a API retorna uma lane
  única ou quando o usuário a corrige manualmente. Se `position` vier vazio ou
  houver lanes duplicadas, o cartão mostra posição não informada e o rastreador
  não escolhe um jungler arbitrário.
- A classificação de regiões agora emite alerta apenas ao confirmar duas
  leituras estáveis numa região nova; leituras incertas continuam sendo
  descartadas. O matcher mantém o limite conservador de score `0.13` e margem
  mínima `0.02`: amostras anteriores com scores de `0.16` a `0.21` ainda não
  serão aceitas. Não aumentar esses limites sem validar os falsos positivos
  contra capturas rotuladas.
