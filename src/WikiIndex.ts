import * as fs from "fs";
import type { Article } from "./Dto";

interface IndexData {
	fandom: string;
	createdAt: string;
	articleCount: number;
	entries: Article[];
}

class WikiIndex {
	readonly fandom: string;
	readonly createdAt: string;
	readonly articleCount: number;
	readonly entries: Article[];

	readonly #byId: Map<string, Article>;
	readonly #byTitle: Map<string, Article>;

	constructor(data: IndexData) {
		this.fandom = data.fandom;
		this.createdAt = data.createdAt;
		this.articleCount = data.articleCount;
		this.entries = data.entries;

		this.#byId = new Map(data.entries.map((e) => [e.id, e]));
		this.#byTitle = new Map(data.entries.map((e) => [e.title.toLowerCase(), e]));
	}

	// O(1) lookup by MediaWiki page ID
	lookupById(id: string): Article | undefined {
		return this.#byId.get(id);
	}

	// O(1) case-insensitive exact title lookup
	lookupByTitle(title: string): Article | undefined {
		return this.#byTitle.get(title.toLowerCase());
	}

	// Returns all entries whose title starts with the given prefix (case-insensitive)
	searchByTitle(prefix: string): Article[] {
		const lower = prefix.toLowerCase();
		const results: Article[] = [];
		for (const [key, entry] of this.#byTitle) {
			if (key.startsWith(lower)) results.push(entry);
		}
		return results;
	}

	// Serialize the index to a JSON file for reuse without re-scraping
	save(filepath: string): void {
		const data: IndexData = {
			fandom: this.fandom,
			createdAt: this.createdAt,
			articleCount: this.articleCount,
			entries: this.entries,
		};
		fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf8");
	}

	// Deserialize a previously saved index from a JSON file
	static load(filepath: string): WikiIndex {
		const raw = fs.readFileSync(filepath, "utf8");
		const data = JSON.parse(raw) as IndexData;
		return new WikiIndex(data);
	}
}

export default WikiIndex;
