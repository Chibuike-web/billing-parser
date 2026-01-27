import { tool, UIMessage, UIMessageStreamWriter } from "ai";
import { z } from "zod";

interface Params {
	writer: UIMessageStreamWriter<UIMessage<never>>;
}

export const separateDocuments = ({ writer }: Params) => {
	return tool({
		description: "Separate image files from text based documents",
		inputSchema: z.object({
			files: z.array(
				z.object({
					type: z.string(),
					mediaType: z.string(),
					data: z.string().describe("Extracted text or base64 encoded binary"),
				}),
			),
		}),
		execute: async ({ files }, { toolCallId }) => {
			writer.write({
				type: "data-started",
				data: {
					event: "started",
					tool: "separateDocuments",
					toolCallId,
					message: "Separating uploads",
				},
			});
			const images = [];
			const textFiles: { mediaType: string; data: string }[] = [];

			for (const file of files) {
				const hasData = typeof file.data === "string" && file.data.trim().length > 0;

				if (file.mediaType.startsWith("image/")) {
					if (!hasData) {
						continue;
					}
					images.push(file);

					writer.write({
						type: "data-delta",
						data: {
							event: "image-detected",
							tool: "separateDocuments",
							toolCallId,
							mediaType: file.mediaType,
						},
					});
				} else {
					textFiles.push(file);

					writer.write({
						type: "data-delta",
						data: {
							event: "text-detected",
							tool: "separateDocuments",
							toolCallId,
							mediaType: file.mediaType,
						},
					});
				}
			}

			writer.write({
				type: "data-completed",
				data: {
					event: "completed",
					tool: "separateDocuments",
					toolCallId,
					images,
					textFiles,
				},
			});

			return {
				images,
				textFiles,
			};
		},
	});
};
