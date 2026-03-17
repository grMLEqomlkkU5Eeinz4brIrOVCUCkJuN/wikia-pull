import { WikiaPull } from "../index";

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function main() {
	const wiki = new WikiaPull("roblox-blackhawk-rescue-mission-5");

	// --- search: returns enriched articles ---
	console.log("Testing search()...");
	const startTime = Date.now();
	const results = await wiki.search("PoD");
	const elapsed = Date.now() - startTime;

	assert(Array.isArray(results), "search should return an array");
	assert(results.length > 0, "search should return at least one result");

	const first = results[0];
	assert(typeof first.title === "string" && first.title.length > 0, "result should have a non-empty title");
	assert(typeof first.id === "string" && first.id.length > 0, "result should have a non-empty id");
	assert(typeof first.url === "string" && first.url.startsWith("https://"), "result should have an https URL");
	assert(typeof first.article === "string" && first.article.length > 0, "result should have article text");
	assert(first.images === undefined, "images should be undefined when not requested");

	console.log(`  ✓ search returned ${results.length} enriched article(s) in ${elapsed}ms`);
	console.log(`  ✓ first result: "${first.title}"`);

	// --- search with images option ---
	console.log("Testing search() with { images: true }...");
	const withImages = await wiki.search("PoD", { images: true });
	assert(withImages.length > 0, "search with images should return results");

	const firstWithImages = withImages[0];
	assert(Array.isArray(firstWithImages.images), "images should be an array when requested");
	assert(typeof firstWithImages.article === "string" && firstWithImages.article.length > 0, "article text should still be present with images option");
	console.log(`  ✓ search with images returned ${firstWithImages.images!.length} image(s)`);

	console.log("\nAll search tests passed.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
