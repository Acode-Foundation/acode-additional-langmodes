import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function findGrammarFiles(dir, files = []) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			findGrammarFiles(fullPath, files);
		} else if (entry.isFile() && entry.name.endsWith(".grammar")) {
			files.push(fullPath);
		}
	}
	return files;
}

const languagesDir = path.resolve("src/languages");
const grammarFiles = findGrammarFiles(languagesDir);

for (const grammarFile of grammarFiles) {
	const dir = path.dirname(grammarFile);
	const outFile = path.join(dir, "parser.js");
	const relIn = path.relative(process.cwd(), grammarFile);
	const relOut = path.relative(process.cwd(), outFile);

	console.log(`Compiling ${relIn} -> ${relOut}`);
	try {
		execSync(`lezer-generator "${grammarFile}" -o "${outFile}"`, {
			stdio: "inherit",
		});
	} catch (error) {
		console.error(`Error compiling ${relIn}`);
		process.exit(1);
	}
}
