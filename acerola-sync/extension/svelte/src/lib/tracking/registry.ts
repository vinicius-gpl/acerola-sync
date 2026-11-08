import { crunchyroll } from './sites/crunchyroll';
import { mangadex } from './sites/mangadex';
import { netflix } from './sites/netflix';
import { sakuraMangas } from './sites/sakuramangas';
import type { SiteAdapter } from './types';

/** Sites embutidos. Os personalizados são montados em tempo de execução (`sites/custom.ts`). */
export const BUILT_IN_SITES: SiteAdapter[] = [sakuraMangas, mangadex, crunchyroll, netflix];
