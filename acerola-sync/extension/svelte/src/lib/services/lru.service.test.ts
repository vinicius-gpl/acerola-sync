import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LRUService } from './lru.service';

describe('LRUService', () => {
	let cacheInstance: LRUService<number, { id: number }>;

	beforeEach(() => {
		cacheInstance = new LRUService({ max: 3 });
	});

	it('should store and retrieve items correctly', () => {
		const itemData = { id: 1 };
		cacheInstance.set(1, itemData);
		expect(cacheInstance.get(1)).toEqual(itemData);
	});

	it('should evict the least recently used item when max capacity is reached', () => {
		const items = [1, 2, 3, 4];

		items.forEach((itemIndex) => {
			cacheInstance.set(itemIndex, { id: itemIndex });
		});

		// Capacity is 3, so item 1 must be removed after adding item 4
		expect(cacheInstance.size).toBe(3);
		expect(cacheInstance.has(1)).toBe(false);
		expect(cacheInstance.has(2)).toBe(true);
		expect(cacheInstance.has(3)).toBe(true);
		expect(cacheInstance.has(4)).toBe(true);
	});

	it('should update eviction priority when accessing an item with get()', () => {
		cacheInstance.set(1, { id: 1 });
		cacheInstance.set(2, { id: 2 });
		cacheInstance.set(3, { id: 3 });

		// Access item 1 to move it to the most recently used position
		cacheInstance.get(1);

		// Adding item 4 must now remove item 2 (least recently used) instead of item 1
		cacheInstance.set(4, { id: 4 });

		expect(cacheInstance.has(2)).toBe(false);
		expect(cacheInstance.has(1)).toBe(true);
	});

	it('should NOT update eviction priority when accessing an item with peek()', () => {
		cacheInstance.set(1, { id: 1 });
		cacheInstance.set(2, { id: 2 });
		cacheInstance.set(3, { id: 3 });

		// Peek item 1 (read-only, no priority update)
		cacheInstance.peek(1);

		// Adding item 4 must still remove item 1 as the oldest
		cacheInstance.set(4, { id: 4 });

		expect(cacheInstance.has(1)).toBe(false);
	});

	it('should clear all items when clear() is called', () => {
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		cacheInstance.set(1, { id: 1 });
		cacheInstance.clear();

		expect(cacheInstance.size).toBe(0);
		expect(cacheInstance.has(1)).toBe(false);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('CLEAR cache (prev size: 1)'));

		logSpy.mockRestore();
	});

	it('deletes a specific key without affecting the others', () => {
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		cacheInstance.set(1, { id: 1 });
		cacheInstance.set(2, { id: 2 });

		cacheInstance.delete(1);

		expect(cacheInstance.has(1)).toBe(false);
		expect(cacheInstance.has(2)).toBe(true);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('DELETE key=1'));

		logSpy.mockRestore();
	});

	it('does not log (or need to clear) an already-empty cache', () => {
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		cacheInstance.clear();

		expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('CLEAR cache'));
		logSpy.mockRestore();
	});

	it('logs whether set() inserted a new key or updated an existing one', () => {
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		cacheInstance.set(1, { id: 1 });
		expect(logSpy).toHaveBeenLastCalledWith(expect.stringContaining('new=true'));

		cacheInstance.set(1, { id: 1 });
		expect(logSpy).toHaveBeenLastCalledWith(expect.stringContaining('new=false'));

		logSpy.mockRestore();
	});

	it('logs the evicted key when the cache goes over capacity', () => {
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		[1, 2, 3, 4].forEach((key) => cacheInstance.set(key, { id: key }));

		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('EVICTING page 1'));
		logSpy.mockRestore();
	});

	it('should return keys in most-recently-used order', () => {
		const insertionSequence = [1, 2, 3];
		insertionSequence.forEach((key) => cacheInstance.set(key, { id: key }));

		// The most recent comes first
		expect(cacheInstance.keys).toEqual([3, 2, 1]);
	});

	it('should return the values in the cache', () => {
		cacheInstance.set(1, { id: 1 });
		cacheInstance.set(2, { id: 2 });

		expect(cacheInstance.values).toEqual([{ id: 2 }, { id: 1 }]);
	});
});
