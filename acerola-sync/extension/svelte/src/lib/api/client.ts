import type {
	CustomSite,
	CustomSiteInput,
	EntryPatch,
	EntryWithMedia,
	HistoryItem,
	LoginResult,
	MediaDetail,
	MediaType,
	Resolved,
	SavedEntry,
	SearchHit,
	SiteMapping,
	EntryCount,
	EntryFacets,
	EntryFilters,
	SyncLogs,
	SyncRun,
	SyncSettings,
	SyncStatus,
	TrackResult,
	UserProfile
} from './types';

/** Erro do server no formato `{ errorType, message }`, ou de rede (`status` 0). */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly errorType: string,
		message: string
	) {
		super(message);
		this.name = 'ApiError';
	}

	get isUnauthorized() {
		return this.status === 401 && this.errorType === 'unauthorized';
	}
}

export function normalizeServerUrl(url: string): string {
	return url.trim().replace(/\/+$/, '');
}

type Query = Record<string, string | number | boolean | undefined | null>;

function withQuery(path: string, query?: Query): string {
	if (!query) return path;
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
	}
	const search = params.toString();
	return search ? `${path}?${search}` : path;
}

/** Filtros da lista na query string do server (listas separadas por vírgula). */
export function filterQuery(filters: Partial<EntryFilters> = {}) {
	const list = (items?: string[]) => (items?.length ? items.join(',') : undefined);
	return {
		q: filters.q?.trim() || undefined,
		sort: filters.sort && filters.sort !== 'updated' ? filters.sort : undefined,
		format: list(filters.formats),
		genre: list(filters.genres),
		year: filters.year ?? undefined,
		mediaStatus: list(filters.mediaStatuses)
	};
}

/**
 * Cliente da API do server. Popup e background usam o mesmo cliente; o content script nunca
 * fala com o server direto (passa pelo background, que tem a host permission).
 */
export function createApi(serverUrl: string, sessionToken?: string | null, fetcher = fetch) {
	const base = normalizeServerUrl(serverUrl);

	async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
		if (body !== undefined) headers['Content-Type'] = 'application/json';

		let response: Response;
		try {
			response = await fetcher(`${base}${path}`, {
				method,
				headers,
				body: body === undefined ? undefined : JSON.stringify(body)
			});
		} catch (error) {
			throw new ApiError(0, 'network', error instanceof Error ? error.message : String(error));
		}

		if (response.status === 204) return undefined as T;

		const text = await response.text();
		const data = text ? safeJson(text) : null;
		if (!response.ok) {
			const payload = (data ?? {}) as { errorType?: string; message?: string };
			throw new ApiError(
				response.status,
				payload.errorType ?? 'http',
				payload.message ?? `HTTP ${response.status}`
			);
		}
		return data as T;
	}

	return {
		health: () => request<{ status: string; version: string }>('GET', '/health'),
		/** Client ID do AniList, vindo do `.env` do server. */
		authConfig: () => request<{ anilistClientId: string }>('GET', '/auth/config'),

		login: (accessToken: string, device: string) =>
			request<LoginResult>('POST', '/auth/login', { accessToken, device }),
		logout: () => request<void>('POST', '/auth/logout'),
		me: () => request<UserProfile>('GET', '/me'),

		entries: (
			query: {
				mediaType?: MediaType;
				status?: string;
				filters?: Partial<EntryFilters>;
				limit?: number;
				offset?: number;
			} = {}
		) => {
			const { filters, ...rest } = query;
			return request<EntryWithMedia[]>(
				'GET',
				withQuery('/entries', { ...rest, ...filterQuery(filters) })
			);
		},
		/** Contagem por status, com os mesmos filtros da lista. */
		entryCounts: (query: { mediaType?: MediaType; filters?: Partial<EntryFilters> } = {}) =>
			request<EntryCount[]>(
				'GET',
				withQuery('/entries/counts', {
					mediaType: query.mediaType,
					...filterQuery(query.filters)
				})
			),
		entryFacets: (mediaType?: MediaType) =>
			request<EntryFacets>('GET', withQuery('/entries/facets', { mediaType })),
		updateEntry: (mediaId: number, patch: EntryPatch) =>
			request<SavedEntry>('PATCH', `/entries/${mediaId}`, patch),
		deleteEntry: (mediaId: number) => request<void>('DELETE', `/entries/${mediaId}`),
		/** Manda a pendência da obra e puxa de novo a obra e a entrada do AniList. */
		syncEntry: (mediaId: number) => request<MediaDetail>('POST', `/entries/${mediaId}/sync`),

		search: (q: string, mediaType?: MediaType, remote = false) =>
			request<SearchHit[]>('GET', withQuery('/media/search', { q, mediaType, remote })),
		media: (mediaId: number) => request<MediaDetail>('GET', `/media/${mediaId}`),

		/** Começa o sync e volta na hora; o andamento vem por `syncLogs`. */
		sync: (full = false) => request<SyncRun>('POST', withQuery('/sync', { full: full || null })),
		syncLogs: (runId: number, after = 0) =>
			request<SyncLogs>('GET', withQuery(`/sync/runs/${runId}/logs`, { after })),
		syncStatus: () => request<SyncStatus>('GET', '/sync/status'),
		saveFullSyncInterval: (hours: number) =>
			request<SyncSettings>('PUT', '/sync/full-interval', { hours }),
		saveSchedule: (enabled: boolean, times: string[]) =>
			request<SyncSettings>('PUT', '/sync/schedule', { enabled, times }),

		resolve: (input: {
			site: string;
			identifier: string;
			title: string;
			mediaType: MediaType;
			anilistId?: number | null;
		}) => request<Resolved | null>('POST', '/track/resolve', input),
		track: (input: { site: string; mediaId: number; progress: number; url?: string }) =>
			request<TrackResult>('POST', '/track/progress', input),
		saveMapping: (input: { site: string; identifier: string; mediaId: number; title?: string }) =>
			request<SiteMapping>('PUT', '/track/mapping', input),
		deleteMapping: (site: string, identifier: string) =>
			request<void>('DELETE', withQuery('/track/mapping', { site, identifier })),
		history: (limit = 50) => request<HistoryItem[]>('GET', withQuery('/history', { limit })),

		customSites: () => request<CustomSite[]>('GET', '/custom-sites'),
		createCustomSite: (input: CustomSiteInput) =>
			request<CustomSite>('POST', '/custom-sites', input),
		updateCustomSite: (id: string, input: CustomSiteInput) =>
			request<CustomSite>('PUT', `/custom-sites/${id}`, input),
		deleteCustomSite: (id: string) => request<void>('DELETE', `/custom-sites/${id}`)
	};
}

export type Api = ReturnType<typeof createApi>;

function safeJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}
