import { gateway, ToolLoopAgent, wrapLanguageModel } from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const model = wrapLanguageModel({
	model: gateway("openai/gpt-5.2"),
	middleware: devToolsMiddleware(),
});

const uploadDir = path.resolve("uploads");
export async function POST(req: Request) {
	try {
		const form = await req.json();
		const result = form.messages[0].parts;
		const messages = result.map((item: any) => {
			return {
				text: item.text,
				type: item.type,
				mediaType: item.mediaType,
				url: item.url,
			};
		});

		if (!existsSync(uploadDir)) {
			throw new Error("Directory does not exist");
		}

		const fileObject = [];

		for (const message of messages) {
			console.log(message.url);
			const imagePath = message.url;
			if (!existsSync(imagePath)) {
				throw new Error("Image does not exist");
			}
			const fileBuffer = readFileSync(imagePath);
			fileObject.push({
				type: "file",
				mediaType: inferMime(imagePath),
				data: fileBuffer,
			});
		}
		console.log("fileObject", fileObject);
	} catch (error) {
		console.log(error);
		return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
	}
}

const billingParserAgent = new ToolLoopAgent({
	model,
	instructions: "",
});

export function inferMime(path: string): string {
	if (path.endsWith(".pdf")) return "application/pdf";
	if (path.endsWith(".docx") || path.endsWith(".doc"))
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
	if (path.endsWith(".png")) return "image/png";
	if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
	return "application/octet-stream";
}
