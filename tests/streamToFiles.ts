import WikiaPull from "../src/WikiaPull";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function assert(condition: boolean, message: string): void {
	if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function main() {
	const fandom = process.argv[2] || "roblox-blackhawk-rescue-mission-5";
	const max = process.argv[3] ? parseInt(process.argv[3], 10) : 5;

	const wiki = new WikiaPull(fandom);

	// Use a temp directory so tests don't pollute the project
	const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "wikia-pull-stream-"));

	console.log(`Testing streamToFiles (${max} articles from ${fandom})...`);

	let successCount = 0;
	let errorCount = 0;

	for await (const article of wiki.streamAllArticles(max, { images: true })) {
		try {
			const filename = article.title
				.replace(/[<>:"/\\|?*]/g, '_')
				.replace(/\s+/g, '_')
				.substring(0, 100);

			const filepath = path.join(outputDir, `${filename}.txt`);

			const imageLines = (article.images && article.images.length > 0)
				? article.images.join("\n")
				: "None";

			const content = `Title: ${article.title}
URL: ${article.url}
ID: ${article.id}
Image: ${article.img || 'None'}
Images:
${imageLines}

Content:
${article.article || 'No content available'}`;

			fs.writeFileSync(filepath, content, 'utf8');

			// Verify the file was written and can be read back
			assert(fs.existsSync(filepath), `file should exist: ${filepath}`);
			const readBack = fs.readFileSync(filepath, 'utf8');
			assert(readBack.includes(article.title), "file should contain the article title");
			assert(readBack.includes("Images:"), "file should contain images section");

			console.log(`  ✓ ${successCount + 1}: ${article.title}`);
			successCount++;
		} catch (error) {
			errorCount++;
			console.error(`  ✗ Failed: ${article.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	assert(successCount > 0, "should have written at least one file");
	assert(errorCount === 0, `should have no errors, got ${errorCount}`);

	// Cleanup
	const files = fs.readdirSync(outputDir);
	for (const f of files) fs.unlinkSync(path.join(outputDir, f));
	fs.rmdirSync(outputDir);

	console.log(`  ✓ wrote and verified ${successCount} files (cleaned up)`);
	console.log("\nAll streamToFiles tests passed.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
