import { WikiaPull } from "../index";

const brm5Wiki = new WikiaPull("roblox-blackhawk-rescue-mission-5", 10);

brm5Wiki.searchResults('PoD').then(results => {
	const startTime = Date.now();
	brm5Wiki.getArticle(results[0]).then(article => {
		console.log(article)

		console.log(`Fetched 1 article in ${Date.now() - startTime}ms.`);
	})
});