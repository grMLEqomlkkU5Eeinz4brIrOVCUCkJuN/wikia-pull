import * as cheerio from "cheerio";
import * as Dto from "./Dto";
import { FandomSearch } from "./constants";
import type { Element } from "domhandler";
import WikiIndex from "./WikiIndex";

// Define a more complete article type that includes the scraped content
interface EnrichedArticle extends Dto.Article {
	img?: string;
	images?: string[];
	article?: string;
	rawContent?: string;
	rawHtml?: string;
	rawPageContent?: string;
}

interface GetArticleOptions {
	images?: boolean;
	rawContent?: boolean;
	rawPageContent?: boolean;
}

const DEFAULT_HEADERS = {
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

type CheerioAPI = ReturnType<typeof cheerio.load>;

class WikiaPull {
	wikiUrl: string;
	limit: number;

	constructor(fandom: string, limit: number = 1) {
		this.limit = parseInt(limit.toString());
		this.wikiUrl = "https://" + fandom + ".fandom.com";
	}

	// Fetch a page of titles from the Fandom MediaWiki API (AllPages)
	async #fetchAllPagesBatch(apcontinue?: string): Promise<{ articles: Dto.Article[]; next?: string }> {
		const params = new URLSearchParams({
			action: "query",
			list: "allpages",
			aplimit: "max",
			format: "json",
		});
		if (apcontinue) params.set("apcontinue", apcontinue);

		const apiUrl = `${this.wikiUrl}/api.php?${params.toString()}`;
		const res = await fetch(apiUrl, { headers: DEFAULT_HEADERS });
		if (!res.ok) throw new Error(`AllPages API error: ${res.status}`);
		const data: unknown = await res.json();

		// Narrow the expected response shape
		interface AllPagesPageItem { pageid: number; ns: number; title: string }
		interface AllPagesResponse {
			batchcomplete?: string;
			continue?: { apcontinue?: string };
			query?: { allpages?: AllPagesPageItem[] };
		}

		const payload = data as AllPagesResponse;
		const pages = payload.query?.allpages ?? [];
		const articles: Dto.Article[] = pages.map((p) => ({
			id: String(p.pageid),
			title: p.title,
			url: `${this.wikiUrl}/wiki/${encodeURIComponent(p.title.replace(/\s/g, "_"))}`,
		}));

		return {
			articles,
			next: payload.continue?.apcontinue,
		};
	}

	// List all article stubs (url/id/title) up to an optional max count
	async listAllArticles(maxItems?: number): Promise<Dto.Article[]> {
		const collected: Dto.Article[] = [];
		let cursor: string | undefined = undefined;

		while (true) {
			const { articles, next } = await this.#fetchAllPagesBatch(cursor);
			for (const a of articles) {
				collected.push(a);
				if (typeof maxItems === "number" && collected.length >= maxItems) {
					return collected;
				}
			}
			if (!next) break;
			cursor = next;
		}

		return collected;
	}

	// Return the exact number of content pages (articles) reported by MediaWiki statistics
	async getArticleCount(): Promise<number> {
		const params = new URLSearchParams({
			action: "query",
			meta: "siteinfo",
			siprop: "statistics",
			format: "json",
		});
		const apiUrl = `${this.wikiUrl}/api.php?${params.toString()}`;
		const res = await fetch(apiUrl, { headers: DEFAULT_HEADERS });
		if (!res.ok) throw new Error(`SiteInfo API error: ${res.status}`);
		const data: unknown = await res.json();
		interface StatsResponse { query?: { statistics?: { articles?: number } } }
		const payload = data as StatsResponse;
		const articles = payload.query?.statistics?.articles;
		if (typeof articles !== "number") {
			throw new Error("Failed to read article count from site statistics");
		}
		return articles;
	}

	// Get full content for all articles (useful for RAG). Optionally limit total items.
	async getAllArticles(maxItems?: number, options?: GetArticleOptions): Promise<EnrichedArticle[]> {
		const list = await this.listAllArticles(maxItems);
		const results: EnrichedArticle[] = [];
		for (let i = 0; i < list.length; i++) {
			results.push(await this.getArticle(list[i], options));
		}
		return results;
	}

	// Async generator variant to stream results progressively
	async *streamAllArticles(maxItems?: number, options?: GetArticleOptions): AsyncGenerator<EnrichedArticle> {
		let produced = 0;
		let cursor: string | undefined = undefined;
		while (true) {
			const { articles, next } = await this.#fetchAllPagesBatch(cursor);
			for (const article of articles) {
				const enriched = await this.getArticle(article, options);
				yield enriched;
				produced++;
				if (typeof maxItems === "number" && produced >= maxItems) {
					return;
				}
			}
			if (!next) return;
			cursor = next;
		}
	}

	#getSearchData(webPage: string): Dto.Article[] {
		const $ = cheerio.load(webPage);
		const articles: Dto.Article[] = [];

		$('.unified-search__result__title').each((index: number, element: Element): boolean | void => {
			if (index >= this.limit) return false; // break when limit reached

			const $element = $(element);
			const url: string = $element.prop('href') || '';
			const id: string = $element.prop('data-page-id') || '';
			const title: string = $element.prop('data-title') || '';

			const article: Dto.Article = { url, id, title };

			if (article.id) {
				articles.push(article);
			}
		});

		return articles;
	}

	async #downloadPage(pageUrl: string): Promise<string> {
		try {
			const res = await fetch(pageUrl, { headers: DEFAULT_HEADERS });
			if (!res.ok) {
				throw new Error(`HTTP error ${res.status} while fetching ${pageUrl}`);
			}
			return await res.text();
		} catch (error) {
			throw new Error(`Failed to download page (${pageUrl}): ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	// Convert HTML tables to markdown tables preserving structure for vector search / RAG
	#tableToMarkdown($: CheerioAPI, table: Element): string {
		const rows: string[][] = [];
		$(table).find("tr").each((_: number, tr: Element) => {
			const cells: string[] = [];
			$(tr).find("th, td").each((_: number, cell: Element) => {
				cells.push($(cell).text().replace(/\s+/g, " ").trim());
			});
			if (cells.length > 0) rows.push(cells);
		});
		if (rows.length === 0) return "";

		// Normalize column count
		const maxCols = Math.max(...rows.map(r => r.length));
		for (const row of rows) {
			while (row.length < maxCols) row.push("");
		}

		const lines: string[] = [];
		lines.push("| " + rows[0].join(" | ") + " |");
		lines.push("| " + rows[0].map(() => "---").join(" | ") + " |");
		for (let i = 1; i < rows.length; i++) {
			lines.push("| " + rows[i].join(" | ") + " |");
		}
		return lines.join("\n");
	}

	// Extract structured text from HTML, converting tables to markdown and preserving headers/lists
	#extractStructuredText($: CheerioAPI): string {
		const parts: string[] = [];

		$("body > *, .mw-parser-output > *").each((_: number, el: Element) => {
			const tag = (el as unknown as { tagName: string }).tagName?.toLowerCase();
			const $el = $(el);

			if (tag === "table" || $el.find("table").length > 0) {
				// Process tables within this element
				const tables = tag === "table" ? $el : $el.find("table");
				tables.each((_: number, tbl: Element) => {
					const md = this.#tableToMarkdown($, tbl);
					if (md) parts.push(md);
				});
			} else if (/^h[1-6]$/.test(tag)) {
				const level = parseInt(tag[1]);
				const text = $el.text().trim();
				if (text) parts.push("#".repeat(level) + " " + text);
			} else if (tag === "ul" || tag === "ol") {
				$el.find("li").each((i: number, li: Element) => {
					const text = $(li).text().replace(/\s+/g, " ").trim();
					if (text) parts.push(tag === "ol" ? `${i + 1}. ${text}` : `- ${text}`);
				});
			} else {
				const text = $el.text().replace(/\s+/g, " ").trim();
				if (text) parts.push(text);
			}
		});

		return parts.join("\n\n");
	}

	async getArticle(article: Dto.Article, options?: GetArticleOptions): Promise<EnrichedArticle> {
		if (!article.id && !article.title) {
			throw new Error("Article id or title is required");
		}

		const params = new URLSearchParams({
			action: "parse",
			format: "json",
			prop: "text",
		});
		if (article.id) {
			params.set("pageid", article.id);
		} else {
			params.set("page", article.title);
		}

		const apiUrl = `${this.wikiUrl}/api.php?${params.toString()}`;
		const res = await fetch(apiUrl, { headers: DEFAULT_HEADERS });
		if (!res.ok) throw new Error(`Parse API error: ${res.status}`);
		const data: unknown = await res.json();

		interface ParseResponse { parse?: { title?: string; pageid?: number; text?: { "*": string } } }
		const payload = data as ParseResponse;
		const htmlText = payload.parse?.text?.["*"] ?? "";

		const $ = cheerio.load(htmlText);

		const enrichedArticle: EnrichedArticle = {
			...article,
			img: $('.pi-image-thumbnail').prop("src") || $('.image').prop("href") || undefined,
		};

		if (options?.images) {
			const images: string[] = [];
			$('img').each((_: number, el: Element) => {
				const src = $(el).attr('src');
				if (src) images.push(src);
			});
			enrichedArticle.images = images;
		}

		// rawPageContent: full structured text with NOTHING stripped (before any cleanup)
		if (options?.rawPageContent) {
			enrichedArticle.rawPageContent = this.#extractStructuredText($);
		}

		$("aside").remove();
		$(".cquote").remove();
		$("gallery").remove();

		if (options?.rawContent) {
			enrichedArticle.rawHtml = $.html();
			enrichedArticle.rawContent = this.#extractStructuredText($);
		}

		const textParagraphs: string[] = [];
		$("p").each((_: number, element: Element): void => {
			const paragraphText = $(element).text();
			if (paragraphText.replace(/\s/g, "") !== "") {
				textParagraphs.push(paragraphText);
			}
		});

		enrichedArticle.article = textParagraphs
			.join(" ")
			.replace(/(\r\n|\n|\r)|(\[\d+\])/gm, "");

		return enrichedArticle;
	}

	async fetch(search_query: string): Promise<string> {
		const searchUrl: string = this.wikiUrl + FandomSearch + encodeURIComponent(search_query);
		return await this.#downloadPage(searchUrl);
	}

	async searchResults(query: string): Promise<Dto.Article[]> {
		const params = new URLSearchParams({
			action: "query",
			list: "search",
			srsearch: query,
			srlimit: String(this.limit),
			format: "json",
		});
		const apiUrl = `${this.wikiUrl}/api.php?${params.toString()}`;
		const res = await fetch(apiUrl, { headers: DEFAULT_HEADERS });
		if (!res.ok) throw new Error(`Search API error: ${res.status}`);
		const data: unknown = await res.json();

		interface SearchItem { pageid: number; title: string }
		interface SearchResponse { query?: { search?: SearchItem[] } }
		const payload = data as SearchResponse;
		const items = payload.query?.search ?? [];
		if (items.length === 0) throw new Error("No articles found");

		return items.map((item) => ({
			id: String(item.pageid),
			title: item.title,
			url: `${this.wikiUrl}/wiki/${encodeURIComponent(item.title.replace(/\s/g, "_"))}`,
		}));
	}

	async search(query: string, options?: GetArticleOptions) :Promise<EnrichedArticle[]> {
		const articles = await this.searchResults(query);
		const articleData: EnrichedArticle[] = [];
		for (let i = 0; i < articles.length; i++) {
			articleData.push(await this.getArticle(articles[i], options))
		}

		return articleData;
	}

	// Async generator that yields Article items one by one using list=allpages
	// (the API equivalent of Special:AllPages), filtered to namespace 0
	// non-redirects. No in-memory structure is built — pipe directly into a
	// database, file, or any other sink of your choice.
	async *streamIndex(maxItems?: number): AsyncGenerator<Dto.Article> {
		let produced = 0;
		let cursor: string | undefined = undefined;

		while (true) {
			const params = new URLSearchParams({
				action: "query",
				list: "allpages",
				aplimit: "max",
				apnamespace: "0",
				apfilterredir: "nonredirects",
				format: "json",
			});
			if (cursor) params.set("apcontinue", cursor);

			const apiUrl = `${this.wikiUrl}/api.php?${params.toString()}`;
			const res = await fetch(apiUrl, { headers: DEFAULT_HEADERS });
			if (!res.ok) throw new Error(`AllPages API error: ${res.status}`);
			const data: unknown = await res.json();

			interface AllPagesPageItem { pageid: number; ns: number; title: string }
			interface AllPagesResponse {
				continue?: { apcontinue?: string };
				query?: { allpages?: AllPagesPageItem[] };
			}

			const payload = data as AllPagesResponse;
			const pages = payload.query?.allpages ?? [];

			for (const p of pages) {
				yield {
					id: String(p.pageid),
					title: p.title,
					url: `${this.wikiUrl}/wiki/${encodeURIComponent(p.title.replace(/\s/g, "_"))}`,
				};
				produced++;
				if (typeof maxItems === "number" && produced >= maxItems) return;
			}

			cursor = payload.continue?.apcontinue;
			if (!cursor) return;
		}
	}

	// Convenience wrapper around streamIndex that collects all entries into an
	// in-memory WikiIndex (with O(1) lookups by id/title). For large wikis or
	// custom storage prefer streamIndex instead.
	async buildIndex(maxItems?: number): Promise<WikiIndex> {
		const entries: Dto.Article[] = [];
		for await (const article of this.streamIndex(maxItems)) {
			entries.push(article);
		}
		const fandom = this.wikiUrl.replace("https://", "").replace(".fandom.com", "");
		return new WikiIndex({
			fandom,
			createdAt: new Date().toISOString(),
			articleCount: entries.length,
			entries,
		});
	}

}

export default WikiaPull;
export type { EnrichedArticle, GetArticleOptions };