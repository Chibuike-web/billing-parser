import { tool } from "ai";
import { createWorker } from "tesseract.js";
import { z } from "zod";

export const runOCR = tool({
	description: "Run OCR on the provided files",
	inputSchema: z.object({
		files: z.array(
			z.object({
				type: z.string(),
				mediaType: z.string(),
				data: z.string().describe("Base64 encoded string of the file content"),
			})
		),
	}),
	execute: async ({ files }) => {
		const processedFiles = files.map((f) => ({
			...f,
			data: Buffer.from(f.data, "base64"),
		}));

		const results = await ocr(processedFiles);
		return {
			results,
		};
	},
});

async function ocr(files: { type: string; mediaType: string; data: Buffer }[]) {
	const worker = await createWorker("eng");

	const result = [];
	for (const file of files) {
		try {
			const {
				data: { text },
			} = await worker.recognize(file.data);
			result.push(text);
		} catch (error) {
			console.error(error);
		}
	}
	await worker.terminate();
	return result;
}
