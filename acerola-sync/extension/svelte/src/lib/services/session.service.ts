import { createApi, type Api } from '$lib/api/client';
import type { UserProfile } from '$lib/api/types';
import { STORAGE_KEYS } from '$lib/constants/storage-keys';
import { storage } from 'wxt/utils/storage';

export type StoredSession = {
	token: string;
	user: UserProfile;
};

export async function getServerUrl(): Promise<string | null> {
	return storage.getItem<string>(STORAGE_KEYS.serverUrl);
}

export async function getSession(): Promise<StoredSession | null> {
	return storage.getItem<StoredSession>(STORAGE_KEYS.session);
}

export async function saveSession(session: StoredSession | null): Promise<void> {
	if (session) await storage.setItem(STORAGE_KEYS.session, session);
	else await storage.removeItem(STORAGE_KEYS.session);
}

/** Cliente com a sessão salva, ou `null` se falta o server ou o login. */
export async function getAuthedApi(): Promise<Api | null> {
	const [serverUrl, session] = await Promise.all([getServerUrl(), getSession()]);
	if (!serverUrl || !session) return null;
	return createApi(serverUrl, session.token);
}
