# Acerola Sync — Extensão de navegador

> Notas de estudo sobre como uma extensão funciona e o que muda no Acerola Sync, que é de uso pessoal e **não será publicado em loja**.

## 1. Contextos isolados

Uma extensão não é um app único. Cada entrypoint em `extension/svelte/src/entrypoints/` vira um contexto separado, com JavaScript, memória e ciclo de vida próprios.

| Contexto | O que é | Estado |
|---|---|---|
| **background** | Service worker sem tela e sem DOM. Fala com o server, agenda tarefas e recebe mensagens. | `background.ts` |
| **popup** | Janela que abre ao clicar no ícone. | `popup/` |
| **página da extensão** | Aba inteira (`chrome-extension://<id>/<pagina>.html`), candidata à tela com a lista de animes e mangás. | a fazer |
| **sidepanel / options** | Painel lateral e página de configurações. | a fazer |
| **content script** | Código injetado nos sites de anime e mangá para detectar o episódio ou capítulo aberto. | a fazer |

Os contextos não compartilham variáveis. A comunicação é por mensagens (`browser.runtime.sendMessage` / `onMessage`).

## 2. Ciclo de vida (Manifest V3)

- **Background:** o Chrome encerra o service worker depois de ~30 s sem atividade.
  - Variável global não sobrevive.
  - `setInterval` longo não funciona; agendamento é com `browser.alarms`.
  - Estado que precisa durar vai para o `storage`.
- **Popup:** fecha ao perder o foco, o componente Svelte é desmontado e remonta do zero na próxima abertura. Nada importante pode ficar só em `$state`.
- **Impacto no projeto:** pequeno, porque debounce, outbox e lote do AniList ficam no server. A extensão só envia o evento ("vi o episódio 5").

## 3. Storage

- `localStorage` existe no popup e nas páginas, mas **não existe no service worker**.
- O padrão é `browser.storage.local` (assíncrono, visível em todos os contextos). O projeto usa o wrapper `storage` de `wxt/utils/storage`, com chaves em `lib/constants/storage-keys.ts`.
- **Pendência:** o paraglide usa a estratégia `localStorage`. Funciona no popup, mas não no background.

## 4. Manifest e permissões

Tudo que a extensão faz precisa ser declarado no manifest, gerado pelo WXT a partir do `wxt.config.ts`.

| Permissão | Para quê | Estado |
|---|---|---|
| `storage` | Tema, modo e cache | já declarada |
| `alarms` | Tarefas agendadas no background | a fazer |
| `identity` | Login OAuth (`launchWebAuthFlow`) | a fazer |
| `host_permissions` | Sites dos content scripts e a URL do server | a fazer |

## 5. Segurança

- O MV3 proíbe código remoto, `eval` e script inline. Tudo vai no bundle.
- Tudo dentro da extensão é legível por quem tiver os arquivos. Nenhum segredo fica nela: o client secret e o token do AniList ficam no server (ver `ARQUITETURA.md`).

## 6. Chamadas de rede e CORS

- Requisições feitas pelo **content script** seguem o CORS do site onde ele roda.
- Requisições feitas pelo **background**, com `host_permissions` para a URL do server, não sofrem bloqueio de CORS.
- Fluxo adotado:

```
content script (site) ──msg──▶ background ──fetch + JWT──▶ server (Rust) ──lote──▶ AniList
                                   ▲                          │
popup / páginas (Svelte) ───msg────┘                       Postgres
```

## 7. Login OAuth

- `browser.identity.launchWebAuthFlow` abre o login do AniList.
- No Chrome, o redirect é `https://<id-da-extensao>.chromiumapp.org/`. Esse endereço precisa estar cadastrado no app do AniList.
- A extensão só repassa o `code` ao server, que faz a troca pelo token.
- No Firefox o redirect é diferente. O WXT abstrai parte da API, mas não essa URL.

## 8. Diferenças em relação ao acerola-reader (Tauri)

| Tauri (reader) | Extensão (sync) |
|---|---|
| Rust no cliente via `invoke()` | Só TypeScript e APIs do navegador; `fetch` para a API |
| Acesso ao disco | Sem acesso ao disco |
| Uma janela, um processo de UI | Vários contextos isolados que trocam mensagens |
| `$app/*` do SvelteKit | Svelte puro montado em cada entrypoint (`main.ts`) |

## 9. Uso pessoal, sem publicação

A Chrome Web Store cobra US$ 5 uma vez e faz revisão. Isso só é necessário para publicar, então não se aplica aqui.

### 9.1 Chrome (sem custo)

1. `npm run build` em `acerola-sync/`.
2. Abrir `chrome://extensions` e ligar o **Modo do desenvolvedor**.
3. **Carregar sem compactação** → selecionar `extension/.output/chrome-mv3`.

A extensão fica instalada de forma permanente.

### 9.2 Firefox (se for usar)

O Firefox normal só carrega extensão sem assinatura como temporária, que some ao reiniciar. Alternativas gratuitas:

- Assinar pela AMO como **não listada**: é grátis e a extensão não aparece na loja.
- Usar Developer Edition ou Nightly com `xpinstall.signatures.required = false` em `about:config`.

### 9.3 O que muda por não publicar

1. **ID da extensão.** Sem compactação, o ID é calculado a partir do caminho da pasta. Se a pasta mudar, o ID muda e quebra o redirect do OAuth e o CORS do server. Solução: fixar uma `key` no manifest.
2. **Atualização.** Não existe atualização automática: `npm run build` e depois o botão de recarregar em `chrome://extensions`.
3. **Sem revisão de loja.** Os scripts `zip` e `zip:firefox` só servem se um dia houver publicação.

## 10. Desenvolvimento e testes

- `npm run dev` abre um Chromium com a extensão carregada.
  - Popup e páginas recarregam na hora.
  - Mudanças no background ou em content scripts recarregam a extensão inteira.
- O e2e com Playwright carrega `.output/chrome-mv3` e só funciona no Chromium (`extension/tests/e2e/`).

## 11. Pendências

- [ ] Fixar a `key` no manifest para ter ID estável.
- [ ] Decidir as telas: popup + página dashboard, sidepanel ou ambos.
- [ ] Canal de mensagens entre contextos e o background.
- [ ] Primeiro content script (adapter de site).
- [ ] Trocar a estratégia `localStorage` do paraglide nos contextos sem DOM.
- [ ] Decidir se os scripts de Firefox continuam.
