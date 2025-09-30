import WikiaPull from "../src/WikiaPull";

async function main() {
	const fandom = process.argv[2] || "roblox-blackhawk-rescue-mission-5";
	const max = process.argv[3] ? parseInt(process.argv[3], 10) : 20;

	const wiki = new WikiaPull(fandom);

	const total = await wiki.getArticleCount();
	console.log(`This wiki reports ${total} articles.`);
	console.log(`Listing up to ${max} articles from ${fandom}.fandom.com ...`);
	const stubs = await wiki.listAllArticles(max);
	console.log(`Got ${stubs.length} stubs. First:`, stubs[0]);

	console.log(`\nStreaming up to ${max} enriched articles...`);
	let count = 0;
	for await (const article of wiki.streamAllArticles(max)) {
		console.log(`#${++count}:`, article.title, '-', article.url);
	}
	console.log(`Streamed ${count} articles.`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});


