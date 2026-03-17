import { WikiaPull } from "../index";

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function main() {
	const wiki = new WikiaPull("roblox-blackhawk-rescue-mission-5", 10);

	// --- searchResults: returns raw article metadata ---
	console.log("Testing searchResults()...");
	const startTime = Date.now();
	const results = await wiki.searchResults("PoD");
	const elapsed = Date.now() - startTime;

	assert(Array.isArray(results), "searchResults should return an array");
	assert(results.length > 0, "searchResults should return at least one result");
	assert(results.length <= 10, "searchResults should respect the limit");

	for (const result of results) {
		assert(typeof result.id === "string" && result.id.length > 0, "result should have a non-empty id");
		assert(typeof result.title === "string" && result.title.length > 0, "result should have a non-empty title");
		assert(typeof result.url === "string" && result.url.startsWith("https://"), "result should have an https URL");
		// searchResults returns raw Article, not EnrichedArticle
		assert(!("article" in result), "raw search results should not have article text");
		assert(!("img" in result), "raw search results should not have img");
	}

	console.log(`  ✓ searchResults returned ${results.length} result(s) in ${elapsed}ms`);
	console.log(`  ✓ all results have valid id, title, and url`);

	console.log("\nAll searchResults tests passed.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
