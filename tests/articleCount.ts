import WikiaPull from "../src/WikiaPull";

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function main() {
	const fandom = process.argv[2] || "roblox-blackhawk-rescue-mission-5";
	const wiki = new WikiaPull(fandom);

	console.log("Testing getArticleCount()...");
	const count = await wiki.getArticleCount();

	assert(typeof count === "number", "count should be a number");
	assert(Number.isInteger(count), "count should be an integer");
	assert(count > 0, "count should be positive");

	console.log(`  ✓ article count for ${fandom}: ${count}`);

	// Verify a second call returns the same value (API consistency)
	const count2 = await wiki.getArticleCount();
	assert(count2 === count, "repeated calls should return the same count");
	console.log("  ✓ repeated call returns same count");

	console.log("\nAll articleCount tests passed.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
