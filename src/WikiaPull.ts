import * as cheerio from "cheerio";
import * as Dto from "./Dto";
import { FandomSearch } from "./constants";
import type { Element } from "domhandler";

// Define a more complete article type that includes the scraped content
interface EnrichedArticle extends Dto.Article {
	img?: string;
	article?: string;
}

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
		const res = await fetch(apiUrl);
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
		const res = await fetch(apiUrl);
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
	async getAllArticles(maxItems?: number): Promise<EnrichedArticle[]> {
		const list = await this.listAllArticles(maxItems);
		const results: EnrichedArticle[] = [];
		for (let i = 0; i < list.length; i++) {
			results.push(await this.getArticle(list[i]));
		}
		return results;
	}

	// Async generator variant to stream results progressively
	async *streamAllArticles(maxItems?: number): AsyncGenerator<EnrichedArticle> {
		let produced = 0;
		let cursor: string | undefined = undefined;
		while (true) {
			const { articles, next } = await this.#fetchAllPagesBatch(cursor);
			for (const article of articles) {
				const enriched = await this.getArticle(article);
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
			const res = await fetch(pageUrl);
			if (!res.ok) {
				throw new Error(`HTTP error ${res.status} while fetching ${pageUrl}`);
			}
			return await res.text();
		} catch (error) {
			throw new Error(`Failed to download page (${pageUrl}): ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	async getArticle(article: Dto.Article): Promise<EnrichedArticle> {
		// Better property checking
		if (!article.url) {
			throw new Error("Article URL is required");
		}

		const webPage = await this.#downloadPage(article.url);
		const $ = cheerio.load(webPage);

		// Create enriched article with proper typing
		const enrichedArticle: EnrichedArticle = {
			...article, // spread the original article properties
			img: $('.pi-image-thumbnail').prop("src") || $('.image').prop("href") || undefined,
		};

		// Clean up the DOM
		$("aside").remove();
		$(".cquote").remove();
		$("gallery").remove();

		// Extract text content with proper typing
		const textParagraphs: string[] = [];

		$("p").each((index: number, element: Element): void => {
			const paragraphText = $(element).text();
			// Only add non-empty paragraphs (after removing whitespace)
			if (paragraphText.replace(/\s/g, "") !== "") {
				textParagraphs.push(paragraphText);
			}
		});

		// Clean and join the text
		enrichedArticle.article = textParagraphs
			.join(" ")
			.replace(/(\r\n|\n|\r)|(\[\d+\])/gm, ""); // remove newlines and numeric anchors

		return enrichedArticle;
	}

	async fetch(search_query: string): Promise<string> {
		const searchUrl: string = this.wikiUrl + FandomSearch + encodeURIComponent(search_query);
		return await this.#downloadPage(searchUrl);
	}

	async searchResults(query: string): Promise<Dto.Article[]> {
		const webPage = await this.fetch(query);
		const articles: Dto.Article[] = this.#getSearchData(webPage);
		if (articles.length === 0) throw new Error("No articles found");
		return articles;
	}

	async search(query: string) :Promise<EnrichedArticle[]> {
		const articles = await this.searchResults(query);
		const articleData: EnrichedArticle[] = [];
		for (let i = 0; i < articles.length; i++) {
			articleData.push(await this.getArticle(articles[i]))
		}

		return articleData;
	}

}

export default WikiaPull;