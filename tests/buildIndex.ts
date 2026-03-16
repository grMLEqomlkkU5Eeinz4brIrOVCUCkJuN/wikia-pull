import WikiaPull from "../src/WikiaPull";
import WikiIndex from "../src/WikiIndex";
import type { Article } from "../src/Dto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const FANDOM = "roblox-blackhawk-rescue-mission-5";
const LIMIT = 50;

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function main() {
	const wiki = new WikiaPull(FANDOM);

	// --- streamIndex: yields Article items via list=allpages (Special:AllPages equivalent) ---
	console.log(`Testing streamIndex (limit: ${LIMIT})...`);
	const streamed: Article[] = [];
	for await (const article of wiki.streamIndex(LIMIT)) {
		assert(typeof article.id === "string" && article.id.length > 0, "article.id must be non-empty string");
		assert(typeof article.title === "string" && article.title.length > 0, "article.title must be non-empty string");
		assert(typeof article.url === "string" && article.url.startsWith("https://"), "article.url must be https URL");
		console.log(`  [${streamed.length + 1}]`, article);
		streamed.push(article);
	}
	assert(streamed.length === LIMIT, `streamIndex should yield exactly ${LIMIT} entries`);
	console.log(`  ✓ streamIndex yielded ${streamed.length} valid Article items`);

	// --- buildIndex: collects into WikiIndex ---
	console.log(`\nTesting buildIndex (limit: ${LIMIT})...`);
	const index = await wiki.buildIndex(LIMIT);

	assert(index instanceof WikiIndex, "buildIndex should return a WikiIndex instance");
	assert(index.fandom === FANDOM, `fandom should be "${FANDOM}"`);
	assert(typeof index.createdAt === "string" && !isNaN(Date.parse(index.createdAt)), "createdAt should be a valid ISO date string");
	assert(index.articleCount === LIMIT, `articleCount should equal LIMIT (${LIMIT})`);
	assert(Array.isArray(index.entries) && index.entries.length === LIMIT, `entries should have ${LIMIT} items`);
	console.log("  Index entries:");
	index.entries.forEach((e, i) => console.log(`  [${i + 1}]`, e));
	console.log(`  ✓ WikiIndex structure valid`);

	// --- lookupById ---
	const first = index.entries[0];
	const byId = index.lookupById(first.id);
	assert(byId !== undefined, "lookupById should find an existing entry");
	assert(byId!.id === first.id, "lookupById should return the correct entry");
	assert(index.lookupById("__nonexistent__") === undefined, "lookupById should return undefined for unknown id");
	console.log("  ✓ lookupById");

	// --- lookupByTitle (case-insensitive) ---
	assert(index.lookupByTitle(first.title) !== undefined, "lookupByTitle exact match should work");
	assert(index.lookupByTitle(first.title.toUpperCase())?.id === first.id, "lookupByTitle should be case-insensitive");
	assert(index.lookupByTitle("__nonexistent__") === undefined, "lookupByTitle should return undefined for unknown title");
	console.log("  ✓ lookupByTitle (case-insensitive)");

	// --- searchByTitle ---
	const prefix = first.title.slice(0, 2);
	const hits = index.searchByTitle(prefix);
	assert(hits.length >= 1, `searchByTitle("${prefix}") should return at least one result`);
	assert(hits.every((e) => e.title.toLowerCase().startsWith(prefix.toLowerCase())), "all searchByTitle results should match the prefix");
	assert(index.searchByTitle("__nonexistent__").length === 0, "searchByTitle should return empty array for unknown prefix");
	console.log(`  ✓ searchByTitle ("${prefix}" → ${hits.length} hit(s))`);

	// --- save / load round-trip ---
	const tmpFile = path.join(os.tmpdir(), `wikia-pull-test-${Date.now()}.json`);
	try {
		index.save(tmpFile);
		assert(fs.existsSync(tmpFile), "save should create the JSON file");

		const loaded = WikiIndex.load(tmpFile);
		assert(loaded instanceof WikiIndex, "load should return a WikiIndex instance");
		assert(loaded.fandom === index.fandom, "loaded fandom should match original");
		assert(loaded.createdAt === index.createdAt, "loaded createdAt should match original");
		assert(loaded.articleCount === index.articleCount, "loaded articleCount should match original");
		assert(loaded.entries.length === index.entries.length, "loaded entries.length should match original");
		assert(loaded.lookupById(first.id)?.title === first.title, "lookupById should work on reloaded index");
		assert(loaded.lookupByTitle(first.title.toUpperCase())?.id === first.id, "lookupByTitle should work on reloaded index");
		console.log("  ✓ save / load round-trip");
	} finally {
		if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
	}

	console.log("\nAll buildIndex tests passed.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
