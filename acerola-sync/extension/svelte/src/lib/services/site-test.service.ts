import type { CustomSiteInput } from '$lib/api/types';
import {
	progressFromSnapshot,
	snapshotPage,
	suggestProgress,
	type PageSnapshot,
	type ProgressSuggestion
} from '$lib/tracking/progress-source';
import { parseProgress } from '$lib/tracking/types';
import { browser } from 'wxt/browser';

// "Testar numa aba aberta" do modo avançado do site personalizado: lê a aba do site mais
// recente e mostra o que a configuração tira dela, antes de salvar.

export type SiteTestResult =
	| { status: 'no-tab' }
	| { status: 'error'; message: string }
	| {
			status: 'ok';
			url: string;
			id: string | null;
			progress: number | null;
			/** Onde a página parece mostrar o número, quando a configuração não achou. */
			suggestion: ProgressSuggestion | null;
	  };

/** O que a configuração tira da página. Separado da aba para dar para testar. */
export function evaluateSnapshot(
	site: Pick<CustomSiteInput, 'urlPattern' | 'progressSource' | 'progressPattern'>,
	snapshot: PageSnapshot
): Extract<SiteTestResult, { status: 'ok' }> {
	let groups: Record<string, string> | null = null;
	try {
		groups = new RegExp(site.urlPattern).exec(snapshot.url)?.groups ?? null;
	} catch {
		groups = null;
	}
	const progress =
		(site.progressSource ?? 'url') === 'url'
			? parseProgress(groups?.progress)
			: progressFromSnapshot(site, snapshot);
	return {
		status: 'ok',
		url: snapshot.url,
		id: groups?.id ?? null,
		progress,
		suggestion: progress ? null : suggestProgress(snapshot)
	};
}

/**
 * Roda na aba aberta mais recente do site. A permissão do domínio precisa ter sido pedida no
 * clique, antes de chamar isto.
 */
export async function testSiteOnTab(site: CustomSiteInput): Promise<SiteTestResult> {
	try {
		const tabs = await browser.tabs.query({ url: site.matchPattern });
		const tab = tabs
			.filter((tab) => tab.id !== undefined)
			.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];
		if (!tab?.id) return { status: 'no-tab' };
		const [injection] = await browser.scripting.executeScript({
			target: { tabId: tab.id },
			func: snapshotPage,
			args: [site.progressSelector?.trim() || null]
		});
		const snapshot = injection?.result as PageSnapshot | undefined;
		if (!snapshot) return { status: 'error', message: 'no result' };
		return evaluateSnapshot(site, snapshot);
	} catch (error) {
		return { status: 'error', message: error instanceof Error ? error.message : String(error) };
	}
}
