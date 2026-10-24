# Bronx I.A — tarefas para a próxima sessão

Use esta lista para retomar o desenvolvimento. A imagem de referência do
calendário está salva em [`docs/references/pdl-calendar-example.png`](./docs/references/pdl-calendar-example.png).
O material do Scoutr.gg fornecido pelo usuário é referência de funcionalidades
e princípios de privacidade, não uma especificação para copiar marca, textos,
interface ou implementação.

## Estado das prioridades

### 1. Calendário de PDL e resultados

- **Importação automática implementada no app e Worker Cloudflare.** Após
  configurar o Riot ID e a plataforma, o app consulta no início e a cada
  15 minutos até 20 partidas solo ranqueadas recentes (Match-V5), resolve o
  Riot ID com Account-V1 e atualiza elo/PDL com League-V4. O botão
  **Carregar partidas anteriores** permite paginar para partidas mais antigas.
  As partidas ficam em armazenamento local e são deduplicadas por Match ID.
  Selecionar um dia expande seus jogos, campeões e resultados. O app não pede
  URL de Worker ao jogador; uma URL de serviço precisa ser configurada no build.
- **Implantação ainda necessária.** O usuário não tem uma chave Riot. Para
  desenvolvimento, pode obter uma chave temporária no portal Riot; para
  distribuição pública, deve registrar o produto e obter uma chave de produção
  aprovada. O Worker mantém a chave como secret; nunca colocá-la no Electron.
  Para compilar uma versão distribuível, definir `BRONX_RIOT_SYNC_URL` como
  endereço HTTPS do Worker antes do build. A configuração no código não
  substitui a implantação do serviço nem fornece uma chave Riot.
- O app só calcula a variação por partida quando tem snapshots observados do
  mesmo elo/divisão antes e depois, identifica exatamente uma nova partida e o
  snapshot anterior tem até duas horas. A API oficial não fornece LP histórico
  por partida; sem esses snapshots, o delta fica indisponível, sem estimativas.
- Os ícones dos campeões vêm dos assets locais e aparecem em baixa opacidade.
  O cadastro manual continua disponível para correções e notas.
- Os registros ficam em armazenamento local versionado; dados antigos são
  migrados em memória e preservados ao salvar. Dados inválidos ou falhas de
  armazenamento são informados sem sobrescrever registros existentes.
- Antes de publicar: revisar registro/aprovação do produto e políticas Riot,
  chave de produção, endpoint/Worker configurado no build, limites de taxa e
  aviso de não endosso.
- Não adicionar scraping, credenciais de conta, leitura de memória, estimativa
  de MMR ou uma alternativa ao ranqueamento oficial.

### Próxima prioridade: lembretes de wards e visão

- Verificar se a Live Client Data API expõe o número de cargas de sentinela do
  jogador e em qual formato/frequência, antes de desenhar o lembrete.
- Implementar um aviso configurável quando houver cargas disponíveis (por
  exemplo, duas trinkets), com cooldown, deduplicação e opção de pausar para
  evitar spam.
- Fazer um protótipo separado para avaliar se pixels do minimapa permitem
  inferir arbustos próximos sem visão e uma oportunidade de ward. Só emitir
  essa recomendação quando houver sinal observável confiável; ausência de
  informação não equivale a falta de visão.
- Se a visão local não sustentar essa inferência, manter o lembrete baseado
  apenas nas cargas de ward e comunicar claramente a limitação.

### 3. Melhorar o coach local de minimapa

- Usar como referência técnica a abordagem descrita: processamento local da
  imagem visível, detecção HSV de marcadores e matching/template por campeão.
  Comparar com o detector atual e validar com amostras de resoluções, HUDs e
  campeões diferentes antes de substituir qualquer parte.
- Medir custo e latência para a captura/análise atual de 4 FPS; avaliar 6 FPS
  como alvo experimental, não como requisito fixo. Registrar falsos positivos,
  misses, estabilidade de posição e uso de CPU antes de aumentar a frequência.
- Priorizar alertas de roam: detectar um campeão visível saindo da lane e
  acompanhar sua localização apenas enquanto continuar visível. Não prever
  posição após desaparecer do minimapa.
- Dar contexto aos alertas com região observada (lane, rio ou acampamento) e
  reduzir repetição: cooldown por evento/região, transição estável e no máximo
  duas recomendações ativas ao mesmo tempo.
- Definir uma forma simples de habilitar/desabilitar alertas, manter o overlay
  não intrusivo e preservar os controles de diagnóstico/calibração.

## Backlog de produto inspirado nas referências

Estes itens não devem atrasar as prioridades acima; cada um exige avaliação de
viabilidade, regras aplicáveis e privacidade antes de implementação.

- **Diretrizes contextuais:** começar com regras locais explicáveis baseadas em
  eventos e dados disponíveis (fase do jogo, objetivos, visão confirmada).
  Manter até duas sugestões prioritárias, substituindo-as quando o contexto
  mudar. Não criar um “cérebro de IA na nuvem” sem decisão explícita: isso
  enviaria estado da partida a terceiros e exigiria consentimento, minimização
  de dados, custo e revisão dos termos.
- **Consulta pré-partida de adversários:** verificar disponibilidade e
  condições da Riot API, chave, rate limits e dados permitidos; nunca pedir ou
  coletar senha/token da conta. Limitar resultados ao necessário e deixar
  explícito o que é estimativa e qual período de dados foi usado.
- **Preparação de seleção de campeões:** tratar como investigação futura.
  Confirmar interfaces e políticas autorizadas antes de integrar o cliente;
  não automatizar picks, runas ou itens nem enviar entradas ao jogo sem uma
  decisão de escopo e compatibilidade.
- **Destaques pós-partida:** avaliar apenas como recurso opt-in futuro, com
  captura local, controles claros de início/parada, retenção e exclusão dos
  arquivos. Não gravar nem enviar clipes automaticamente.

## Voz local sem provedor pago

- Removido o ElevenLabs, incluindo chave, síntese remota, interface e IPC.
- Mantidas as vozes instaladas no Windows e adicionadas as vozes Piper pt-BR
  Faber, Cadu e Jeff. A prévia inicia o download explícito do modelo escolhido
  (cerca de 63 MB); depois a síntese acontece no dispositivo.
- Os modelos estão fixados numa revisão do repositório público e o arquivo ONNX
  é verificado por SHA-256 antes de ser armazenado. Os cartões individuais
  listam os respectivos conjuntos de dados como CC0.
- A naturalidade das três vozes ainda precisa ser avaliada pelo usuário usando
  a prévia. Não imitar vozes de dubladores/personagens sem autorização.

## Princípios técnicos e de privacidade

- Continuar usando apenas imagem visível e APIs locais/oficiais autorizadas;
  não ler memória, acessar arquivos do jogo, injetar código nem automatizar
  entradas.
- Processar pixels no dispositivo por padrão. Se uma futura função precisar
  de nuvem, pedir consentimento explícito, informar os campos enviados e manter
  a função desligada por padrão.
- Distinguir fatos observados de hipóteses; exibir confiança/diagnóstico quando
  necessário e não anunciar posições de inimigos não visíveis.
- Evitar spam com estabilidade mínima, deduplicação e limite de diretivas.

## Critérios para encerrar

- Registrar fontes consultadas, limitações e decisões de viabilidade antes de
  depender de APIs de terceiros.
- Não armazenar credenciais em `localStorage`, logs, repositório ou mensagens.
- Para qualquer implementação, validar o comportamento solicitado, preservar
  o processamento local por padrão e manter alertas acessíveis e não repetitivos.
- Rodar `npm run typecheck`, `npm run build` e `git diff --check` após alterações.
