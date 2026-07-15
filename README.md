# wikia-pull

> A TypeScript implementation of [HermitPurple](https://github.com/Soft-Wet-Bot/HermitPurple), a Fandom/Wikia scraper originally written in JavaScript by [GeopJr](https://github.com/GeopJr).
> Which is also why there are emojis and 

**wikia-pull** allows you to search and fetch article data from MediaWiki-based platforms like Fandom and Wikia. It’s built with TypeScript for better type safety, maintainability, and developer experience in addition to features built for RAG ingestion in mind.

---

## 📦 Installation

```bash
npm install wikia-pull
# or
yarn add wikia-pull
```

---

## ⚙️ Requirements

- Node.js 22+
- [cheerio](https://www.npmjs.com/package/cheerio) (installed automatically as a dependency)

---

## ✨ Features

* Search Fandom/Wikia sites by keyword
* Fetch full article summaries and metadata
* Enumerate all pages via MediaWiki API (great for RAG corpora)
* **Table structure preservation**: HTML tables get converted to markdown for vector search and RAG systems that actually need structure
* **Multiple extraction modes**: pick what you need. `article` for paragraphs, `rawContent` for structured text (tables/headers/lists), or `rawPageContent` for literally everything
* Supports both CommonJS and ESModule usage
* Handles sites with disabled APIs or custom structures

---

## 🚀 Usage

### ESModule / TypeScript

```ts
import { WikiaPull } from 'wikia-pull';

const wiki = new WikiaPull("jojo", 1); // "jojo" fandom, 1 result
const results = await wiki.search('Josuke Higashikata');
console.log(results);
```

### CommonJS

```js
const { WikiaPull } = require('wikia-pull');

const wiki = new WikiaPull("jojo", 1);
wiki.search('Josuke Higashikata').then(console.log);
```

### Enumerate all pages (stubs only)

```ts
import { WikiaPull } from 'wikia-pull';

const wiki = new WikiaPull('jojo');
// Returns an array of { id, title, url }
const stubs = await wiki.listAllArticles(1000); // optional limit
console.log('Got', stubs.length, 'stubs');
```

### Fetch all articles with content (batch)

```ts
import { WikiaPull } from 'wikia-pull';

const wiki = new WikiaPull('jojo');
// Returns an array of enriched articles with img and article text
const articles = await wiki.getAllArticles(50); // optional limit
console.log('First:', articles[0]);
```

### Fetch articles with images

```ts
import { WikiaPull } from 'wikia-pull';

const wiki = new WikiaPull('jojo');
const results = await wiki.search('Josuke Higashikata', { images: true });
console.log(results[0].images); // ["https://...", "https://...", ...]
// article text stays clean. images go to their own field
```

The `{ images: true }` option works with `getArticle`, `search`, `getAllArticles`, and `streamAllArticles`.

### Fetch articles with raw content (tables, lists, headers)

By default, only `<p>` tags end up in the `article` field. tables, lists, headers get stripped. want them? pass `{ rawContent: true }` to get structured content with markdown tables:

```ts
import { WikiaPull } from 'wikia-pull';

const wiki = new WikiaPull('jojo');
const results = await wiki.search('Josuke Higashikata', { rawContent: true });

console.log(results[0].rawContent); // Structured text with markdown tables, headers, lists
console.log(results[0].rawHtml);    // Cleaned HTML with structure preserved
console.log(results[0].article);    // still there. paragraph-only text, untouched
```

Tables are converted to markdown format for optimal vector search and RAG performance:

```
| Name | Stand | Part |
| --- | --- | --- |
| Josuke | Crazy Diamond | 4 |
| Giorno | Gold Experience | 5 |
```

Headers become `## Heading`, lists become `- item` or `1. item`.

Note: `rawContent` still strips infobox sidebars (`<aside>`), quote styling (`.cquote`), and galleries before extraction. If you need absolutely everything, use `rawPageContent` instead.

The `{ rawContent: true }` option works with `getArticle`, `search`, `getAllArticles`, and `streamAllArticles`. Both options can be combined: `{ images: true, rawContent: true }`.

### Fetch complete unfiltered page content

Want the whole page with nothing removed? use `{ rawPageContent: true }`. keeps infoboxes, quotes, galleries, tables. everything. good for RAG when you actually need every detail:

```ts
import { WikiaPull } from 'wikia-pull';

const wiki = new WikiaPull('jojo');
const results = await wiki.search('Josuke Higashikata', { rawPageContent: true });

console.log(results[0].rawPageContent); // Complete page content, nothing removed
console.log(results[0].article);        // still there. paragraphs only
```

`rawPageContent` uses the same structured extraction as `rawContent` (markdown tables, headers, lists) but runs **before** any DOM cleanup, so infobox data, quotes, and gallery captions are all included.

All options can be combined: `{ images: true, rawContent: true, rawPageContent: true }`.

### Stream articles (preferred for large RAG ingestions)

```ts
import { WikiaPull } from 'wikia-pull';

const wiki = new WikiaPull('jojo');
let count = 0;
for await (const article of wiki.streamAllArticles(100)) {
  // Send incrementally to a vector DB or file sink
  console.log(`#${++count}`, article.title, '-', article.url);
}
```

### Get exact article count

```ts
import { WikiaPull } from 'wikia-pull';

const wiki = new WikiaPull('jojo');
const total = await wiki.getArticleCount();
console.log('This wiki reports', total, 'articles');
```

### Build an in-memory index

```ts
import { WikiaPull } from 'wikia-pull';

const wiki = new WikiaPull('jojo');
const index = await wiki.buildIndex(); // optional limit: buildIndex(1000)

// O(1) lookups
const page = index.lookupById('11883');
const page2 = index.lookupByTitle('Josuke Higashikata'); // case-insensitive

// Prefix search
const hits = index.searchByTitle('Jos');

// Persist to disk and reload later (avoids re-scraping)
index.save('./jojo-index.json');
const loaded = WikiIndex.load('./jojo-index.json');
```

### Stream index entries into your own storage

`streamIndex` uses `list=allpages` (the API equivalent of `Special:AllPages`) to
yield raw `Article` items one by one without building any in-memory structure.
Use it to write entries directly into a database, file, vector store, or any
other sink.

```ts
import { WikiaPull } from 'wikia-pull';

const wiki = new WikiaPull('jojo');

for await (const article of wiki.streamIndex()) {
  // article: { id, title, url }
  await db.collection('pages').insertOne(article);
}
```

SQLite example:

```ts
import Database from 'better-sqlite3';
import { WikiaPull } from 'wikia-pull';

const db = new Database('wiki.db');
db.exec(`CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  title TEXT,
  url TEXT
)`);
const insert = db.prepare(
  'INSERT OR REPLACE INTO pages VALUES (@id, @title, @url)'
);

const wiki = new WikiaPull('jojo');
for await (const article of wiki.streamIndex()) {
  insert.run(article);
}
```

---

## 📄 Example Output

```json
[
  {
    "id": "11883",
    "url": "https://jojo.fandom.com/wiki/Josuke_Higashikata_(JoJolion)",
    "img": "https://static.wikia.nocookie.net/jjba/images/d/d2/Jo2uke.png",
    "article": "The tentatively-named Josuke Higashikata...",
    "title": "Josuke Higashikata"
  }
]
```

With `{ images: true }`:

```json
[
  {
    "id": "11883",
    "url": "https://jojo.fandom.com/wiki/Josuke_Higashikata_(JoJolion)",
    "img": "https://static.wikia.nocookie.net/jjba/images/d/d2/Jo2uke.png",
    "images": [
      "https://static.wikia.nocookie.net/jjba/images/d/d2/Jo2uke.png",
      "https://static.wikia.nocookie.net/jjba/images/a/ab/Example.png"
    ],
    "article": "The tentatively-named Josuke Higashikata...",
    "title": "Josuke Higashikata"
  }
]
```

With `{ rawContent: true }`:

```json
[
  {
    "id": "11883",
    "url": "https://jojo.fandom.com/wiki/Josuke_Higashikata_(JoJolion)",
    "img": "https://static.wikia.nocookie.net/jjba/images/d/d2/Jo2uke.png",
    "rawContent": "## Appearance\n\nJosuke is a ...\n\n| Stand | User | Part |\n| --- | --- | --- |\n| Crazy Diamond | Josuke | 4 |",
    "rawHtml": "<html><head></head><body><h2>Appearance</h2><p>Josuke is a...</p><table>...</table></body></html>",
    "article": "The tentatively-named Josuke Higashikata...",
    "title": "Josuke Higashikata"
  }
]
```

With `{ rawPageContent: true }`:

```json
[
  {
    "id": "11883",
    "url": "https://jojo.fandom.com/wiki/Josuke_Higashikata_(JoJolion)",
    "img": "https://static.wikia.nocookie.net/jjba/images/d/d2/Jo2uke.png",
    "rawPageContent": "Josuke Higashikata\n\nHeight: 179 cm\nWeight: 65 kg\n\n## Appearance\n\nJosuke is a ...\n\n| Stand | User | Part |\n| --- | --- | --- |\n| Crazy Diamond | Josuke | 4 |",
    "article": "The tentatively-named Josuke Higashikata...",
    "title": "Josuke Higashikata"
  }
]
```

---

## 🧰 API Reference

### Constructor

```ts
new WikiaPull(fandom: string, limit?: number)
```
- `fandom`: The subdomain of the Fandom wiki (e.g., "jojo").
- `limit`: Maximum number of search results to return (default: 1).

### Methods

- `search(query: string, options?: GetArticleOptions): Promise<EnrichedArticle[]>`
  - Searches and returns detailed articles (with summary and image).
- `searchResults(query: string): Promise<Article[]>`
  - Returns raw search result metadata only.
- `getArticle(article: Article, options?: GetArticleOptions): Promise<EnrichedArticle>`
  - Fetches a single article by its URL and enriches it with summary and image.
- `listAllArticles(maxItems?: number): Promise<Article[]>`
  - Returns an array of all article stubs (url/id/title). Use `maxItems` to stop early.
- `getAllArticles(maxItems?: number, options?: GetArticleOptions): Promise<EnrichedArticle[]>`
  - Returns enriched articles for all pages (may be slow on large wikis). Use `maxItems` to limit.
- `streamAllArticles(maxItems?: number, options?: GetArticleOptions): AsyncGenerator<EnrichedArticle>`
  - Async generator that yields enriched articles progressively, useful for streaming ingestion.
- `getArticleCount(): Promise<number>`
  - Returns the exact article count using MediaWiki site statistics.
- `streamIndex(maxItems?: number): AsyncGenerator<Article>`
  - yields articles from `list=allpages` (no fancy in-memory index built). filters to namespace 0, skips redirects. pipe straight into your database, file, wherever you need them.
- `buildIndex(maxItems?: number): Promise<WikiIndex>`
  - Convenience wrapper around `streamIndex` that collects all entries into an in-memory `WikiIndex` with O(1) lookups. For large wikis or custom storage use `streamIndex` instead.

### `WikiIndex`

Returned by `buildIndex`. Holds the full index in memory and provides fast lookups.

- `lookupById(id: string): Article | undefined` - instant lookup by MediaWiki page ID (O(1))
- `lookupByTitle(title: string): Article | undefined` - exact title match, case-insensitive (O(1))
- `searchByTitle(prefix: string): Article[]` - finds all entries starting with that prefix (case-insensitive)
- `save(filepath: string): void` - saves the index to JSON so you can reload it later without re-scraping
- `WikiIndex.load(filepath: string): WikiIndex` - loads a previously saved index from a JSON file

### Types

```ts
interface Article {
  url: string;
  id: string;
  title: string;
}

interface EnrichedArticle extends Article {
  img?: string;             // Single primary image (from infobox or first image)
  images?: string[];        // All image URLs from the page (when { images: true })
  article?: string;         // Paragraph-only text (default extraction)
  rawContent?: string;      // Structured text with markdown tables/headers/lists, sidebar/quote/gallery stripped (when { rawContent: true })
  rawHtml?: string;         // Cleaned HTML with structure preserved (when { rawContent: true })
  rawPageContent?: string;  // Complete structured text with NOTHING stripped (when { rawPageContent: true })
}

interface GetArticleOptions {
  images?: boolean;          // When true, extracts all image URLs into the images field
  rawContent?: boolean;      // When true, extracts structured content into rawContent and rawHtml (strips sidebars/quotes/galleries)
  rawPageContent?: boolean;  // When true, extracts complete page content with nothing removed into rawPageContent
}
```

---

## 🧪 Testing & Examples

Test scripts with assertions are available in the `tests/` directory:
- `search.ts` - validates `search()` with `{ images: true }`, `{ rawContent: true }`, `{ rawPageContent: true }`. checks the enriched article fields.
- `searchResults.ts` - tests `searchResults()`. verifies raw metadata and limit behavior work right.
- `getArticles.ts` - validates `getArticle()` with all the options: images, rawContent, rawPageContent, and combinations. checks every field.
- `allItems.ts` - tests `listAllArticles`, `streamAllArticles`, `getAllArticles`. with and without the images option.
- `articleCount.ts` - validates `getArticleCount()` returns a positive integer and stays consistent.
- `streamToFiles.ts` - streams articles with images to temp files. verifies the content, then cleans up.
- `buildIndex.ts` - tests `streamIndex` and `buildIndex` together. validates Article fields, lookups, prefix search, and the save/load round-trip.

### RAG-oriented enumeration example

```ts
import { WikiaPull } from 'wikia-pull';

const wiki = new WikiaPull("jojo");

// 1) Just list article stubs
const stubs = await wiki.listAllArticles(1000); // limit to 1000 for demo
console.log(stubs.length, stubs[0]);

// 2) Stream enriched content (preferred for large ingestions)
let count = 0;
for await (const article of wiki.streamAllArticles(100)) { // limit to 100 for demo
  // send to your vector store, files, etc.
  console.log(article.title, article.url);
  count++;
}
console.log("streamed", count);
```

### Stream to files example

```ts
import { WikiaPull } from 'wikia-pull';
import * as fs from 'fs';
import * as path from 'path';

const wiki = new WikiaPull('jojo');
const outDir = './output';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let n = 0;
for await (const article of wiki.streamAllArticles(25)) {
  const filename = article.title.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').slice(0, 100);
  const filepath = path.join(outDir, `${filename}.txt`);
  const content = `Title: ${article.title}\nURL: ${article.url}\nID: ${article.id}\nImage: ${article.img || 'None'}\n\n${article.article || ''}`;
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Saved #${++n}:`, filepath);
}
```

---

## ⚠️ Error Handling

- Throws an error if no articles are found for a query.
- Throws an error if a network request fails or an article URL is missing.
- Errors include the failing URL when possible, e.g. `HTTP error 404 while fetching https://<wiki>/...`.
- For streaming, consider try/catch per item to skip transient failures and continue ingestion.

---

## 🙏 Credits

This project is a TypeScript implementation (with additional features) of
[**HermitPurple**](https://github.com/Soft-Wet-Bot/HermitPurple) by [**GeopJr**](https://github.com/GeopJr).

Inspired by [@yimura/scraper](https://github.com/Yimura/Scraper).
Original license applies. See below.

---

## 📝 License

ISC License
Copyright (c) 2020 GeopJr

Rewritten in TypeScript as **wikia-pull** by grml