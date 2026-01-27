import {
	gateway,
	Output,
	stepCountIs,
	wrapLanguageModel,
	createUIMessageStreamResponse,
	streamText,
	createUIMessageStream,
	UIMessageStreamWriter,
} from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { tools } from "./tools";
import { outputSchema } from "@/lib/schemas/output-schema";

const model = wrapLanguageModel({
	model: gateway("anthropic/claude-haiku-4.5"),
	middleware: devToolsMiddleware(),
});

const uploadDir = path.resolve("uploads");
export async function POST(req: Request) {
	try {
		const form = await req.json();
		const result = form.messages[0].parts;
		const fileObjects:
			| { type: "text"; text: string }
			| { type: "file"; mediaType: string; data: string }[] = [];

		const textParts = result.filter(
			(item: { type: string; text?: string }) => typeof item.text === "string",
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
			console.log("fileURL", file.url);
			const fileBuffer = readFileSync(file.url);
			fileObjects.push({
				type: "file",
				mediaType: inferMime(file.url),
				data: fileBuffer.toString("base64"),
			});
		}

		return createUIMessageStreamResponse({
			stream: createUIMessageStream({
				execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
					const result = streamText({
						model,
						messages: [
							{
								role: "user",
								content: fileObjects,
							},
						],
						tools: tools({ writer }),
						system: `
You are a document processing agent.

You must strictly follow this pipeline:

1. Always call separateDocuments first with all provided files.
2. Extract readable text from all non-image documents.
3. Merge all extracted text into logical document groups.
4. Call classifyDocument using the merged text array.
5. After classification, call extractFields for each classified document.
6. Return only structured JSON. No explanations. No markdown.

Rules:
- Never skip a step.
- Never classify before merging text.
- extractFields must respect the document classification.
- If a document type is unknown, extract only generic fields.
`,
						stopWhen: stepCountIs(10),
						output: Output.object({
							schema: outputSchema,
						}),
					});

					writer.merge(result.toUIMessageStream());
				},
				onError: (error) => `Custom error: ${Error.isError(error)}`,
			}),
		});
	} catch (error) {
		console.log(error instanceof Error ? error.message : "Unknown error");
		return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
	}
}

export function inferMime(path: string): string {
	if (path.endsWith(".pdf")) return "application/pdf";
	if (path.endsWith(".docx") || path.endsWith(".doc"))
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
	if (path.endsWith(".png")) return "image/png";
	if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
	return "application/octet-stream";
}
