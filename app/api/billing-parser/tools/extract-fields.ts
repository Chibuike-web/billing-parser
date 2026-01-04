import { tool } from "ai";
import z from "zod";

export const extractFields = tool({
	description: "Extract key fields from the provided document text",
	inputSchema: z.array(
		z.object({
			text: z.string().describe("The text content of the document"),
			classification: z
				.string()
				.describe("The classification of the document, e.g., invoice, receipt, unknown"),
		})
	),
});
