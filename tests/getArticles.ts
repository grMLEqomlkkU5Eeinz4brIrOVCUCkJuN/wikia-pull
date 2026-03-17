import { WikiaPull } from "../index";

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function main() {
	const wiki = new WikiaPull("roblox-blackhawk-rescue-mission-5", 10);

	const results = await wiki.searchResults("PoD");
	assert(results.length > 0, "need at least one search result to test getArticle");

	// --- getArticle: without images ---
	console.log("Testing getArticle()...");
	const startTime = Date.now();
	const article = await wiki.getArticle(results[0]);
	const elapsed = Date.now() - startTime;

	assert(typeof article.title === "string" && article.title.length > 0, "article should have a non-empty title");
	assert(typeof article.id === "string" && article.id.length > 0, "article should have a non-empty id");
	assert(typeof article.url === "string" && article.url.startsWith("https://"), "article should have an https URL");
	assert(typeof article.article === "string" && article.article.length > 0, "article should have body text");
	assert(article.images === undefined, "images should be undefined when not requested");
	// img is the legacy single-image field — can be string or undefined
	assert(article.img === undefined || typeof article.img === "string", "img should be undefined or a string");

	console.log(`  ✓ getArticle returned "${article.title}" in ${elapsed}ms`);
	console.log(`  ✓ article text length: ${article.article!.length} chars`);
	console.log(`  ✓ img: ${article.img || "none"}`);

	// --- getArticle: with images ---
	console.log("Testing getArticle() with { images: true }...");
	const articleWithImages = await wiki.getArticle(results[0], { images: true });

	assert(Array.isArray(articleWithImages.images), "images should be an array when requested");
	for (const imgUrl of articleWithImages.images!) {
		assert(typeof imgUrl === "string" && imgUrl.length > 0, "each image URL should be a non-empty string");
	}
	assert(typeof articleWithImages.article === "string" && articleWithImages.article.length > 0, "article text should still be present with images option");

	console.log(`  ✓ getArticle with images returned ${articleWithImages.images!.length} image(s)`);

	console.log("\nAll getArticle tests passed.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
