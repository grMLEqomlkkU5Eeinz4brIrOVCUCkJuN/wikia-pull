import WikiaPull from "../src/WikiaPull";

async function main() {
	// Default to the fandom you're currently using in other tests
	const fandom = process.argv[2] || "roblox-blackhawk-rescue-mission-5";
	const wiki = new WikiaPull(fandom);

	const count = await wiki.getArticleCount();
	console.log(`Article count for ${fandom}: ${count}`);

	if (!Number.isInteger(count) || count <= 0) {
		throw new Error(`Invalid article count returned: ${count}`);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});


