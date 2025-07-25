import * as cheerio from "cheerio";
import * as Dto from "./Dto";
import { FandomSearch } from "./constants";

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

	#getSearchData(webPage: string): Dto.Article[] {
		const $ = cheerio.load(webPage);
		const articles: Dto.Article[] = [];

		$('.unified-search__result__title').each((index: number, element: cheerio.Element): boolean | void => {
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
				throw new Error(`HTTP error! status: ${res.status}`);
			}
			return await res.text();
		} catch (error) {
			throw new Error(`Failed to download page: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

		$("p").each((index: number, element: cheerio.Element): void => {
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