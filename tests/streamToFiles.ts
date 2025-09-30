import WikiaPull from "../src/WikiaPull";
import * as fs from "fs";
import * as path from "path";

async function main() {
	const fandom = process.argv[2] || "roblox-blackhawk-rescue-mission-5";
	const max = process.argv[3] ? parseInt(process.argv[3], 10) : 10;
	const outputDir = process.argv[4] || "./output";

	const wiki = new WikiaPull(fandom);

	// Create output directory if it doesn't exist
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}

	console.log(`Streaming up to ${max} articles from ${fandom}.fandom.com to ${outputDir}/...`);

	let successCount = 0;
	let errorCount = 0;
	const errors: string[] = [];

	for await (const article of wiki.streamAllArticles(max)) {
		try {
			// Create filename from title (sanitize for filesystem)
			const filename = article.title
				.replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars
				.replace(/\s+/g, '_') // Replace spaces with underscores
				.substring(0, 100); // Limit length

			const filepath = path.join(outputDir, `${filename}.txt`);
			
			// Write article content to file
			const content = `Title: ${article.title}
URL: ${article.url}
ID: ${article.id}
Image: ${article.img || 'None'}

Content:
${article.article || 'No content available'}`;

			fs.writeFileSync(filepath, content, 'utf8');
			console.log(`✓ ${successCount + 1}: ${article.title} -> ${filename}.txt`);
			successCount++;
		} catch (error) {
			errorCount++;
			const errorMsg = `Failed to write ${article.title}: ${error instanceof Error ? error.message : 'Unknown error'}`;
			errors.push(errorMsg);
			console.error(`✗ ${errorMsg}`);
		}
	}

	console.log(`\nSummary:`);
	console.log(`- Successfully wrote: ${successCount} files`);
	console.log(`- Errors: ${errorCount}`);
	
	if (errors.length > 0) {
		console.log(`\nErrors:`);
		errors.forEach(err => console.log(`  - ${err}`));
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
