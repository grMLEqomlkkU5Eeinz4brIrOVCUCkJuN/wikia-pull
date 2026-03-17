import WikiaPull from "../src/WikiaPull";

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function main() {
	const fandom = process.argv[2] || "roblox-blackhawk-rescue-mission-5";
	const max = process.argv[3] ? parseInt(process.argv[3], 10) : 20;
	const wiki = new WikiaPull(fandom);

	// --- getArticleCount ---
	console.log("Testing getArticleCount()...");
	const total = await wiki.getArticleCount();
	assert(Number.isInteger(total) && total > 0, "article count should be a positive integer");
	console.log(`  ✓ wiki reports ${total} articles`);

	// --- listAllArticles ---
	console.log(`Testing listAllArticles(${max})...`);
	const stubs = await wiki.listAllArticles(max);
	assert(Array.isArray(stubs), "listAllArticles should return an array");
	assert(stubs.length > 0 && stubs.length <= max, `should return between 1 and ${max} stubs`);
	for (const stub of stubs) {
		assert(typeof stub.id === "string" && stub.id.length > 0, "stub should have non-empty id");
		assert(typeof stub.title === "string" && stub.title.length > 0, "stub should have non-empty title");
		assert(typeof stub.url === "string" && stub.url.startsWith("https://"), "stub should have https URL");
	}
	console.log(`  ✓ listAllArticles returned ${stubs.length} stubs`);

	// --- streamAllArticles without images ---
	console.log(`Testing streamAllArticles(${max})...`);
	let count = 0;
	for await (const article of wiki.streamAllArticles(max)) {
		assert(typeof article.title === "string" && article.title.length > 0, "streamed article should have title");
		assert(typeof article.article === "string", "streamed article should have article text");
		assert(article.images === undefined, "images should be undefined when not requested");
		count++;
	}
	assert(count > 0 && count <= max, `should stream between 1 and ${max} articles`);
	console.log(`  ✓ streamAllArticles yielded ${count} enriched articles`);

	// --- streamAllArticles with images ---
	console.log(`Testing streamAllArticles(3, { images: true })...`);
	let imgCount = 0;
	for await (const article of wiki.streamAllArticles(3, { images: true })) {
		assert(Array.isArray(article.images), "images should be an array when requested");
		assert(typeof article.article === "string", "article text should still be present");
		imgCount++;
	}
	assert(imgCount > 0 && imgCount <= 3, "should stream between 1 and 3 articles with images");
	console.log(`  ✓ streamAllArticles with images yielded ${imgCount} articles`);

	// --- getAllArticles ---
	console.log(`Testing getAllArticles(3)...`);
	const all = await wiki.getAllArticles(3);
	assert(Array.isArray(all), "getAllArticles should return an array");
	assert(all.length > 0 && all.length <= 3, "should return between 1 and 3 articles");
	for (const a of all) {
		assert(typeof a.title === "string" && a.title.length > 0, "article should have title");
		assert(typeof a.article === "string", "article should have article text");
	}
	console.log(`  ✓ getAllArticles returned ${all.length} enriched articles`);

	// --- getAllArticles with images ---
	console.log(`Testing getAllArticles(3, { images: true })...`);
	const allWithImages = await wiki.getAllArticles(3, { images: true });
	assert(allWithImages.length > 0, "getAllArticles with images should return results");
	for (const a of allWithImages) {
		assert(Array.isArray(a.images), "images should be an array when requested");
	}
	console.log(`  ✓ getAllArticles with images returned ${allWithImages.length} articles`);

	console.log("\nAll allItems tests passed.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
