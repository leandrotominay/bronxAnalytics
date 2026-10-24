<div align="center">
  <img src="src/renderer/assets/bronx-jhin.png" alt="Arte do Bronx I.A" width="720" />
  <h1>Bronx I.A</h1>
  <p><strong>O companion de League of Legends focado no jungler.</strong></p>
  <p>Posição observada no minimapa, contexto de objetivos e histórico ranqueado em uma interface desktop.</p>
  <p><code>CARVÃO</code> · <code>COBRE</code> · <code>ÂMBAR</code></p>
</div>

---

## Acompanhe o que importa

O Bronx I.A combina dados locais da partida com leitura visual do
minimapa para destacar o jungler adversário. A proposta é manter a tela
centrada no que acontece na selva: sem alertas de desaparecimento de top,
mid ou bot. Quando o jungler deixa de ser detectado, o overlay marca com `?`
o último ponto observado no minimapa e informa a região por voz e na tela.
Na tela inicial, os atalhos levam à partida e ao calendário, com destaque para
a IA de detecção de jungler ainda em desenvolvimento.

| Recurso | O que faz |
| --- | --- |
| **Rastreamento do jungler** | Identifica apenas o jungler pela posição informada na partida ou pelo feitiço Golpear e procura somente o retrato dele no minimapa. Os outros jogadores não são rastreados. |
| **Posição observada** | Mostra as regiões, acampamentos e covis de objetivo onde o ícone do jungler é confirmado em leituras consecutivas, mesmo quando ele está se movendo. |
| **Última posição observada** | Após duas leituras consecutivas sem detectar o jungler, exibe um `?` no ponto em que ele foi visto pela última vez e avisa na tela e por voz. O marcador é removido quando ele volta a ser detectado. |
| **Contexto de gank** | Ao detectar o jungler numa rota, sinaliza uma possibilidade — nunca afirma que um gank vai acontecer. |
| **Objetivos** | Usa o cronômetro para alertar sobre Vastilarvas, Arauto (14:30/15:00) e Barão (19:00/20:00). O full clear usa o melhor tempo registrado para o jungler inimigo na patch mais recente da planilha de clears. São previsões, não confirmações de conclusão de acampamentos ou surgimento real do objetivo. |
| **Calendário ranqueado** | Importa partidas solo ranqueadas automaticamente e reúne resultados e snapshots de elo/PDL. |
| **Voz local** | Faber e Jeff originais do Piper pt-BR, Alba e Azelma do Pocket TTS em português ou vozes instaladas no Windows. Os modelos são baixados na primeira prévia e depois ficam em cache local. A síntese e o texto dos alertas permanecem no dispositivo. |

### Vozes Pocket TTS

As vozes Alba e Azelma usam o pacote
[pocket-tts-js](https://github.com/vlapky/pocket-tts-js) (MIT) e o bundle ONNX em português de
[vlapky/pocket-tts-onnx](https://huggingface.co/vlapky/pocket-tts-onnx), cuja
licença publicada é CC BY 4.0. Os créditos e atribuições aplicáveis às vozes
devem acompanhar os respectivos dados e a licença do bundle; consulte também
o projeto original [Kyutai Pocket TTS](https://github.com/kyutai-labs/pocket-tts).

A primeira prévia pode baixar cerca de 180 MB de modelos e dados de voz do
Hugging Face. Esses são arquivos públicos gratuitos; não há serviço pago de
síntese. O runtime ONNX Web acompanha o aplicativo e o texto dos alertas é
processado localmente. Os arquivos de voz ficam no cache local do aplicativo
para uso posterior offline. A conexão é necessária na primeira configuração.

> **Em desenvolvimento:** a leitura do minimapa usa o retrato do campeão e
> regiões geométricas aproximadas. Escala, qualidade de imagem e ícones
> sobrepostos podem causar falhas. O marcador representa somente a última
> posição visualmente confirmada; não estima movimentos ou posições ocultas.

Os itens **Wireless Champion Select**, **Spells Timing** e **Sugestão de Pick**
na navegação são apenas espaços reservados para futuras funcionalidades e
permanecem desativados.

## Começar

Requer Windows, Node.js e npm. Na pasta do projeto:

```powershell
npm install
npm run dev
```

Para verificar tipos e gerar a versão de produção:

```powershell
npm run typecheck
npm run build
```

Abra o League of Legends e entre em uma partida. O app procura a janela do
jogo; pressione **Iniciar** para autorizar a captura visível. A captura
e a análise do minimapa acontecem localmente, e a captura termina pelo botão
**Encerrar**.

## Calendário e Riot ID

Na página **Calendário**, informe seu Riot ID (`Nome#TAG`) e plataforma. O app
consulta partidas ranqueadas pela API oficial da Riot por meio do serviço de
sincronização do Bronx; não é necessário informar um endereço de Worker. O
aplicativo não pede senha da Riot.

Cada consulta busca até 20 partidas solo ranqueadas para respeitar os limites
da API da Riot. Se houver mais histórico, use **Carregar partidas anteriores**
para buscar páginas mais antigas. Selecione um dia no calendário para expandir
os jogos daquela data, com campeão, horário, duração, K/D/A, KDA, CS, ouro e
dano a campeões. Os filtros semanal, mensal e anual alternam a escala do
calendário; na visão anual, selecione um mês para detalhá-lo.

O PDL exibido como saldo diário e do período é uma estimativa configurável:
informe o PDL ganho por vitória e o perdido por derrota; remakes não entram na
conta. O ganho real varia por partida e a Riot não fornece esse valor no
histórico. Variações individuais só são exibidas quando podem ser observadas
por snapshots de elo.
Após uma sincronização bem-sucedida, o perfil mostra o Riot ID conectado e um
botão **Desconectar**. Desconectar remove o vínculo e mantém o histórico local.

O app não inclui uma chave Riot. Para habilitar sincronização:

1. Crie uma chave de desenvolvimento no [Riot Developer Portal](https://developer.riotgames.com/).
2. Configure o Worker em `workers/riot-sync`; para desenvolvimento local, crie
   `workers/riot-sync/.dev.vars` com `RIOT_API_KEY=<sua-chave>`.
3. Execute `npm run worker:dev` para testar localmente ou faça login no
   Cloudflare, configure `RIOT_API_KEY` como secret e publique com
   `npm run worker:deploy`.
4. Ao criar uma versão distribuível, defina `BRONX_RIOT_SYNC_URL` como a URL
   HTTPS do Worker antes de executar `npm run build`. No PowerShell:

   ```powershell
   $env:BRONX_RIOT_SYNC_URL = 'https://seu-worker.workers.dev'
   npm run build
   ```

   O endereço fica configurado na versão do app, não é solicitado aos jogadores
   e não é um segredo. Uma compilação de distribuição sem essa variável não terá
   sincronização habilitada. Em desenvolvimento, o app usa
   `http://localhost:8787` quando a variável não está definida.

Chaves de desenvolvimento expiram e não servem para uma distribuição pública.
Antes de publicar o produto, siga os requisitos de registro e aprovação da
Riot. Nunca coloque uma chave em arquivos do renderer, preload, builds ou no
repositório.

A API de partidas não fornece o PDL histórico de cada jogo. O calendário só
associa uma variação de PDL quando existem snapshots observados antes e depois
da partida, sob as condições de consistência implementadas. Quando não há
dados suficientes, a variação fica indisponível em vez de ser estimada.
O elo é exibido em texto; emblemas ranqueados só serão adicionados a partir de
uma fonte de assets autorizada pela Riot.

## Privacidade e limites

- Frames de jogo e dados da API local ficam no dispositivo; imagens só são
  exportadas quando você solicita uma amostra diagnóstica.
- O Riot ID e a plataforma são enviados ao serviço de sincronização configurado
  para a consulta.
  A chave da Riot permanece como secret do Worker, fora do aplicativo desktop.
- A detecção visual é experimental e reporta apenas sinais observáveis na tela.
  Ela não lê memória, não injeta código no cliente e não automatiza gameplay.
- Diagnósticos e ajustes do minimapa ficam disponíveis no modo desenvolvedor.

O uso da API local e a distribuição do produto estão sujeitos às políticas
atuais da Riot Games. Bronx I.A não é endossado pela Riot Games e não
reflete as opiniões da Riot Games nem de qualquer pessoa oficialmente
envolvida na produção ou gestão de propriedades da Riot Games. Riot Games e
todas as propriedades associadas são marcas comerciais ou marcas registradas
da Riot Games, Inc.

## Tecnologias e referências

- Electron, TypeScript e Vite
- [Documentação das APIs de League of Legends](https://developer.riotgames.com/docs/lol)
- [Políticas para desenvolvedores Riot](https://developer.riotgames.com/policies/general)
- [Piper — vozes pt-BR](https://huggingface.co/rhasspy/piper-voices)

---

<div align="center">
  <sub>Construído para manter o foco na selva. Posição observada, não adivinhada.</sub>
</div>
