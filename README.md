# wikia-pull

> A TypeScript implementation of [HermitPurple](https://github.com/Soft-Wet-Bot/HermitPurple), a Fandom/Wikia scraper originally written in JavaScript by [GeopJr](https://github.com/GeopJr).

**wikia-pull** allows you to search and fetch article data from MediaWiki-based platforms like Fandom and Wikia. It’s built with TypeScript for better type safety, maintainability, and developer experience.

Realistically there is no real difference between this and hermit purple, other than the ts and that hermit purple defaults to the jojo wikia.

---

## 📦 Installation

```bash
npm install wikia-pull
# or
yarn add wikia-pull
```

---

## ⚙️ Requirements

- Node.js 18+
- [cheerio](https://www.npmjs.com/package/cheerio) (installed automatically as a dependency)

---

## ✨ Features

* Search Fandom/Wikia sites by keyword
* Fetch full article summaries and metadata
* Enumerate all pages via MediaWiki API (great for RAG corpora)
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

---

## 🧰 API Reference

### Constructor

```ts
new WikiaPull(fandom: string, limit?: number)
```
- `fandom`: The subdomain of the Fandom wiki (e.g., "jojo").
- `limit`: Maximum number of search results to return (default: 1).

### Methods

- `search(query: string): Promise<EnrichedArticle[]>`
  - Searches and returns detailed articles (with summary and image).
- `searchResults(query: string): Promise<Article[]>`
  - Returns raw search result metadata only.
- `getArticle(article: Article): Promise<EnrichedArticle>`
  - Fetches a single article by its URL and enriches it with summary and image.
- `listAllArticles(maxItems?: number): Promise<Article[]>`
  - Returns an array of all article stubs (url/id/title). Use `maxItems` to stop early.
- `getAllArticles(maxItems?: number): Promise<EnrichedArticle[]>`
  - Returns enriched articles for all pages (may be slow on large wikis). Use `maxItems` to limit.
- `streamAllArticles(maxItems?: number): AsyncGenerator<EnrichedArticle>`
  - Async generator that yields enriched articles progressively, useful for streaming ingestion.
- `getArticleCount(): Promise<number>`
  - Returns the exact article count using MediaWiki site statistics.
- `streamIndex(maxItems?: number): AsyncGenerator<Article>`
  - Async generator that yields `Article` items using `list=allpages` (the API equivalent of `Special:AllPages`), filtered to namespace 0 non-redirects. No in-memory structure is built — pipe directly into a database, file, or any other sink.
- `buildIndex(maxItems?: number): Promise<WikiIndex>`
  - Convenience wrapper around `streamIndex` that collects all entries into an in-memory `WikiIndex` with O(1) lookups. For large wikis or custom storage use `streamIndex` instead.

### `WikiIndex`

Returned by `buildIndex`. Holds the full index in memory and provides fast lookups.

- `lookupById(id: string): Article | undefined` — O(1) lookup by MediaWiki page ID.
- `lookupByTitle(title: string): Article | undefined` — O(1) case-insensitive exact title match.
- `searchByTitle(prefix: string): Article[]` — returns all entries whose title starts with `prefix` (case-insensitive).
- `save(filepath: string): void` — serializes the index to a JSON file so it can be reloaded without re-scraping.
- `WikiIndex.load(filepath: string): WikiIndex` — deserializes a previously saved index from a JSON file.

### Types

```ts
interface Article {
  url: string;
  id: string;
  title: string;
}

interface EnrichedArticle extends Article {
  img?: string;
  article?: string;
}
```

---

## 🧪 Testing & Examples

Example scripts are available in the `tests/` directory:
- `search.ts` — Fetches and prints enriched articles for a query.
- `searchResults.ts` — Prints raw search result metadata.
- `getArticles.ts` — Fetches and prints a single enriched article from search results.
- `allItems.ts` — Enumerates or streams all pages; handy for building RAG datasets.
- `articleCount.ts` — Prints the exact number of articles via site statistics.
- `streamToFiles.ts` — Streams enriched articles and writes each to a text file.
- `buildIndex.ts` — Tests `streamIndex` and `buildIndex`: validates `Article` fields, lookups, prefix search, and save/load round-trip.

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