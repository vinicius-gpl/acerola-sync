// Espelho dos payloads do server (`server/src/cmd/events` e `data/models`). Datas vêm em UTC
// (ISO 8601); a tela converte para o horário de São Paulo.

export type MediaType = 'ANIME' | 'MANGA';

export type EntryStatus = 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING';

export const ENTRY_STATUSES: EntryStatus[] = [
	'CURRENT',
	'PLANNING',
	'COMPLETED',
	'PAUSED',
	'DROPPED',
	'REPEATING'
];

export type UserProfile = {
	id: number;
	name: string;
	avatarUrl: string | null;
	siteUrl: string | null;
};

export type Media = {
	id: number;
	idMal: number | null;
	mediaType: MediaType;
	format: string | null;
	status: string | null;
	titleRomaji: string | null;
	titleEnglish: string | null;
	titleNative: string | null;
	titleUserPreferred: string;
	synonyms: string[];
	description: string | null;
	episodes: number | null;
	chapters: number | null;
	volumes: number | null;
	duration: number | null;
	season: string | null;
	seasonYear: number | null;
	averageScore: number | null;
	genres: string[];
	isAdult: boolean;
	countryOfOrigin: string | null;
	coverUrl: string | null;
	coverColor: string | null;
	bannerUrl: string | null;
	siteUrl: string | null;
	nextAiringEpisode: number | null;
	nextAiringAt: string | null;
	anilistUpdatedAt: string | null;
	syncedAt: string;
	startYear: number | null;
	/** Daqui para baixo, só depois que a obra é aberta (detalhe). */
	source: string | null;
	studios: string[];
	/** `YYYY-MM-DD`; data parcial do AniList cai no dia/mês 1. */
	startDate: string | null;
	endDate: string | null;
	externalLinks: ExternalLink[];
	relations: MediaRelation[];
};

export type ExternalLink = {
	site: string;
	url: string;
	/** `STREAMING`, `INFO` ou `SOCIAL`. */
	kind: string | null;
	language: string | null;
};

export type MediaRelation = {
	relationType: string;
	id: number;
	mediaType: MediaType;
	format: string | null;
	status: string | null;
	title: string;
	coverUrl: string | null;
};

/** Última página de um site em que a obra foi marcada. */
export type LastVisit = {
	source: string;
	url: string;
	progress: number;
	createdAt: string;
};

export type Entry = {
	userId: number;
	mediaId: number;
	anilistEntryId: number | null;
	status: EntryStatus;
	progress: number;
	progressVolumes: number;
	/** 0–100. */
	score: number;
	repeat: number;
	private: boolean;
	notes: string | null;
	startedAt: string | null;
	completedAt: string | null;
	anilistUpdatedAt: string | null;
	updatedAt: string;
	/** Mudou aqui e ainda não chegou no AniList. */
	dirty: boolean;
	pushAttempts: number;
	lastPushError: string | null;
};

export type EntryWithMedia = Entry & { media: Media };

export type SavedEntry = EntryWithMedia & { pending: boolean };

export type EntryPatch = Partial<
	Pick<Entry, 'status' | 'progress' | 'progressVolumes' | 'score' | 'notes' | 'private'>
>;

export type SearchHit = {
	media: Media;
	entry: Entry | null;
	source: 'LOCAL' | 'ANILIST';
};

export type MediaDetail = {
	media: Media;
	entry: Entry | null;
	visits: LastVisit[];
};

export type SyncSettings = {
	userId: number;
	scheduleEnabled: boolean;
	/** `HH:MM:SS` em UTC. */
	scheduleTimes: string[];
	lastScheduledSlot: string | null;
	updatedAt: string;
	lastPullAt: string | null;
	lastFullSyncAt: string | null;
	/** Lista inteira automática a cada N horas; `0` = só no botão. */
	fullSyncEveryHours: number;
};

export type SyncRun = {
	id: number;
	trigger: 'MANUAL' | 'SCHEDULED' | 'LOGIN';
	status: 'RUNNING' | 'SUCCESS' | 'FAILED';
	startedAt: string;
	finishedAt: string | null;
	entriesPulled: number;
	entriesPushed: number;
	entriesRemoved: number;
	error: string | null;
	/** `INCREMENTAL` puxa só o que mudou; `FULL` puxa a lista inteira. */
	mode: 'FULL' | 'INCREMENTAL';
	anilistRequests: number;
};

export type SyncLog = {
	id: number;
	runId: number;
	level: 'INFO' | 'WARN' | 'ERROR';
	message: string;
	createdAt: string;
};

export type SyncLogs = {
	run: SyncRun;
	logs: SyncLog[];
};

export type EntrySort = 'updated' | 'title' | 'score' | 'progress' | 'average' | 'year';

/** Filtros da lista; todos aplicados no server. */
export type EntryFilters = {
	q: string;
	sort: EntrySort;
	formats: string[];
	genres: string[];
	year: number | null;
	mediaStatuses: string[];
};

/** O que existe na lista para filtrar. */
export type EntryFacets = {
	genres: string[];
	formats: string[];
	years: number[];
};

export type EntryCount = {
	mediaType: MediaType;
	status: EntryStatus;
	count: number;
};

export type SyncStatus = {
	settings: SyncSettings;
	runs: SyncRun[];
	running: boolean;
	pendingEntries: number;
};

export type SiteMapping = {
	site: string;
	identifier: string;
	mediaId: number;
	title: string;
	source: 'AUTO' | 'MANUAL';
};

export type Resolved = {
	mapping: SiteMapping;
	media: Media;
	entry: Entry | null;
};

export type SkipReason = 'INVALID_PROGRESS' | 'ALREADY_AHEAD' | 'ALREADY_COMPLETED';

export type TrackResult = {
	applied: boolean;
	skipReason: SkipReason | null;
	saved: SavedEntry | null;
};

export type HistoryItem = {
	id: number;
	mediaId: number;
	progress: number;
	previous: number;
	source: string;
	url: string | null;
	createdAt: string;
	title: string;
	coverUrl: string | null;
	mediaType: MediaType;
};

/** De onde sai o número do capítulo/episódio: URL, título da página ou um elemento. */
export type ProgressSource = 'url' | 'title' | 'selector';

export type CustomSite = {
	id: string;
	name: string;
	mediaType: MediaType;
	matchPattern: string;
	urlPattern: string;
	titleSelector: string | null;
	enabled: boolean;
	/** Busca do site com `{title}` no lugar do título (botão "abrir no site" da obra). */
	searchUrl?: string | null;
	/** Ausente em sites antigos: `url`. */
	progressSource?: ProgressSource;
	/** Elemento com o número (fonte `selector`). */
	progressSelector?: string | null;
	/** Regex que tira o número do texto lido (grupo `progress`, o primeiro grupo ou o todo). */
	progressPattern?: string | null;
};

export type CustomSiteInput = Omit<CustomSite, 'id'>;

export type LoginResult = {
	sessionToken: string;
	user: UserProfile;
};
