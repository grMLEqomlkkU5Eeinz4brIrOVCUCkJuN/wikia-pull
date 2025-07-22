import { WikiaPull } from "../index";

const brm5Wiki = new WikiaPull("roblox-blackhawk-rescue-mission-5");
const startTime = Date.now();

brm5Wiki.search("PoD").then(results => {
	console.log(results[0]["title"]);

	console.log(`Fetched ${results.length} articles in ${Date.now() - startTime}ms.`);
});