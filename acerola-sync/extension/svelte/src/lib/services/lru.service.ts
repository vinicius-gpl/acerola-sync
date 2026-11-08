import { LRUCache } from 'lru-cache';

export interface LRUConfig<
	KeyType extends string | number = string | number,
	ValueType extends {} = {}
> {
	/**
	 * Número máximo estrito de itens mantidos em memória.
	 */
	max: number;
	dispose?: (value: ValueType, key: KeyType) => void;
}

/**
 * Uma abstração genérica de serviço LRU (Least Recently Used).
 * Funciona de forma estrita baseada em capacidade máxima, evictando o item
 * usado há mais tempo quando o limite é excedido.
 */
export class LRUService<KeyType extends string | number, ValueType extends {}> {
	private cache: LRUCache<KeyType, ValueType>;

	constructor(config: LRUConfig<KeyType, ValueType>) {
		this.cache = new LRUCache({
			max: config.max,
			dispose: (value, key) => {
				config.dispose?.(value, key);
				console.log(`[LRUService] 🗑️ EVICTING page ${key} (Cache limit reached)`);
			}
		});
	}

	/**
	 * Recupera um item do cache sem atualizar o status de "recentemente usado".
	 */
	peek(key: KeyType): ValueType | undefined {
		return this.cache.peek(key);
	}

	/**
	 * Recupera um item do cache e atualiza seu status para mais recentemente usado (MRU).
	 */
	get(key: KeyType): ValueType | undefined {
		return this.cache.get(key);
	}

	/**
	 * Define um item no cache e o torna o mais recentemente usado (MRU).
	 * Se o limite for excedido, o LRU mais antigo será removido.
	 */
	set(key: KeyType, value: ValueType): void {
		const isNew = !this.cache.has(key);
		this.cache.set(key, value);
		console.log(
			`[LRUService] SET key=${key} | size=${this.cache.size}/${this.cache.max} | new=${isNew}`
		);
	}

	/**
	 * Verifica a existência de um item no cache sem alterar sua recência.
	 */
	has(key: KeyType): boolean {
		return this.cache.has(key);
	}

	/**
	 * Retorna as chaves presentes, ordenadas internamente pela recência de inserção (LRU order no lru-cache).
	 */
	get keys(): KeyType[] {
		return Array.from(this.cache.keys());
	}

	/**
	 * Retorna todos os valores no cache.
	 */
	get values(): ValueType[] {
		return Array.from(this.cache.values());
	}

	/**
	 * Remove ativamente uma chave do cache.
	 */
	delete(key: KeyType): void {
		console.log(`[LRUService] DELETE key=${key}`);
		this.cache.delete(key);
	}

	/**
	 * Limpa o cache inteiramente.
	 */
	clear(): void {
		if (this.cache.size > 0) {
			console.log(`[LRUService] CLEAR cache (prev size: ${this.cache.size})`);
			this.cache.clear();
		}
	}

	get size(): number {
		return this.cache.size;
	}
}
