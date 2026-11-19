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

// "Test on an open tab" from the custom site's advanced mode: reads the site's most recent tab
// and shows what the configuration pulls from it, before saving.

export type SiteTestResult =
	| { status: 'no-tab' }
	| { status: 'error'; message: string }
	| {
			status: 'ok';
			url: string;
			id: string | null;
			progress: number | null;
			/** Where the page seems to show the number, when the configuration found nothing. */
			suggestion: ProgressSuggestion | null;
	  };

/** What the configuration pulls from the page. Kept apart from the tab so it can be tested. */
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
 * Runs on the site's most recent open tab. The domain permission must have been requested on
 * click, before calling this.
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
