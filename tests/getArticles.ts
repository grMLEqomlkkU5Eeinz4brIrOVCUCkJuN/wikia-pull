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

	// --- getArticle: with rawContent ---
	console.log("Testing getArticle() with { rawContent: true }...");
	const articleWithRaw = await wiki.getArticle(results[0], { rawContent: true });

	assert(typeof articleWithRaw.rawContent === "string" && articleWithRaw.rawContent.length > 0, "rawContent should be a non-empty string when requested");
	assert(typeof articleWithRaw.rawHtml === "string" && articleWithRaw.rawHtml.length > 0, "rawHtml should be a non-empty string when requested");
	assert(articleWithRaw.rawHtml!.includes("<"), "rawHtml should contain HTML tags");
	assert(articleWithRaw.rawContent!.length >= articleWithRaw.article!.length, "rawContent should be at least as long as article text");
	assert(typeof articleWithRaw.article === "string" && articleWithRaw.article.length > 0, "article text should still be present with rawContent option");

	console.log(`  ✓ getArticle with rawContent: ${articleWithRaw.rawContent!.length} chars text, ${articleWithRaw.rawHtml!.length} chars HTML`);

	// --- getArticle: without rawContent should not have raw fields ---
	assert(article.rawContent === undefined, "rawContent should be undefined when not requested");
	assert(article.rawHtml === undefined, "rawHtml should be undefined when not requested");
	console.log("  ✓ rawContent/rawHtml are undefined when not requested");

	// --- getArticle: with both images and rawContent ---
	console.log("Testing getArticle() with { images: true, rawContent: true }...");
	const articleWithBoth = await wiki.getArticle(results[0], { images: true, rawContent: true });

	assert(Array.isArray(articleWithBoth.images), "images should be present when both options used");
	assert(typeof articleWithBoth.rawContent === "string" && articleWithBoth.rawContent.length > 0, "rawContent should be present when both options used");
	assert(typeof articleWithBoth.rawHtml === "string" && articleWithBoth.rawHtml.length > 0, "rawHtml should be present when both options used");
	console.log(`  ✓ getArticle with both options: ${articleWithBoth.images!.length} images, ${articleWithBoth.rawContent!.length} chars raw`);

	console.log("\nAll getArticle tests passed.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
