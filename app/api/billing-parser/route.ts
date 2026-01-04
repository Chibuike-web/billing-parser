import { gateway, Output, stepCountIs, ToolLoopAgent, wrapLanguageModel } from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { runOCR } from "./tools/run-ocr";
import { classifyDocument } from "./tools/classify-document";
import z from "zod";

const model = wrapLanguageModel({
	model: gateway("openai/gpt-5.2"),
	middleware: devToolsMiddleware(),
});

const uploadDir = path.resolve("uploads");
export async function POST(req: Request) {
	try {
		const form = await req.json();
		const result = form.messages[0].parts;
		const fileObjects = [];

		const textParts = result.filter(
			(item: { type: string; text?: string }) => typeof item.text === "string"
		);
		fileObjects.push(...textParts);

		const fileParts = result.filter((item: { type: string; mediaType: string; url: string }) => {
			return (
				item.type === "file" && typeof item.url === "string" && typeof item.mediaType === "string"
			);
		});

		if (!existsSync(uploadDir)) {
			throw new Error("Directory does not exist");
		}

		for (const file of fileParts) {
			if (!existsSync(file.url)) {
				throw new Error("Image does not exist");
			}
			const fileBuffer = readFileSync(file.url);
			fileObjects.push({
				type: "file",
				mediaType: inferMime(file.url),
				data: fileBuffer.toString("base64"),
			});
		}
		const output = await billingParserAgent.generate({
			messages: [
				{
					role: "user",
					content: fileObjects,
				},
			],
		});
		console.log("result", output.output);
	} catch (error) {
		console.log(error instanceof Error ? error.message : "Unknown error");
		return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
	}
}

const billingParserAgent = new ToolLoopAgent({
	model,
	instructions: ``,
	tools: { runOCR, classifyDocument },
	stopWhen: stepCountIs(10),
	output: Output.object({
		schema: z.object({
			classification: z.array(z.object({ text: z.string(), classification: z.string() })),
		}),
	}),
});

export function inferMime(path: string): string {
	if (path.endsWith(".pdf")) return "application/pdf";
	if (path.endsWith(".docx") || path.endsWith(".doc"))
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
	if (path.endsWith(".png")) return "image/png";
	if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
	return "application/octet-stream";
}
