import { crunchyroll } from './sites/crunchyroll';
import { mangadex } from './sites/mangadex';
import { netflix } from './sites/netflix';
import { sakuraMangas } from './sites/sakuramangas';
import type { SiteAdapter } from './types';

/** Built-in sites. Custom ones are built at runtime (`sites/custom.ts`). */
export const BUILT_IN_SITES: SiteAdapter[] = [sakuraMangas, mangadex, crunchyroll, netflix];
