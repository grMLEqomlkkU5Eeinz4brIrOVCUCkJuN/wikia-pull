import { WikiaPull } from "../index";

const brm5Wiki = new WikiaPull("roblox-blackhawk-rescue-mission-5", 10);

const startTime = Date.now();
brm5Wiki.searchResults("PoD").then(results => {
	console.log(results);

	console.log(`Fetched ${results.length} search results in ${Date.now() - startTime}ms.`);
});