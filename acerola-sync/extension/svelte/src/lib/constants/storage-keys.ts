/** Chaves do `chrome.storage.local` (via storage do WXT) — o equivalente ao `store-plugin.ts` do acerola-reader. */
export const STORAGE_KEYS = {
	mode: 'local:mode',
	/** Endereço do server (ex.: `https://sync.acerola.app`). */
	serverUrl: 'local:serverUrl',
	/** Token de sessão do server + perfil. Nunca vai para o `storage.sync`. */
	session: 'local:session',
	/** Última tela aberta, para reabrir onde parou. */
	lastPage: 'local:lastPage',
	/** Sites embutidos desligados pelo usuário. */
	disabledSites: 'local:disabledSites',
	/** Segundos numa página de capítulo antes de marcar como lido. */
	mangaDelaySeconds: 'local:mangaDelaySeconds',
	/** Cópia dos sites personalizados do server, para o background registrar os scripts. */
	customSites: 'local:customSites',
	/** Obra que o aviso do site pediu para abrir no popup (`{ mediaId, at }`); vale por 30s. */
	pendingMedia: 'local:pendingMedia',
	/** Onde o botão fixo fica em cada site (`{ [host]: FabPosition }`); igual nos dois PCs. */
	fabPositions: 'sync:fabPositions'
} as const;
