import { tool, UIMessage, UIMessageStreamWriter } from "ai";
import z from "zod";

interface Params {
	writer: UIMessageStreamWriter<UIMessage<never>>;
}

export const extractFields = ({ writer }: Params) =>
	tool({
		description: "Extract key fields from the provided document text",
		inputSchema: z.object({
			classifications: z.array(
				z.object({
					text: z.string().describe("The text content of the document"),
					classification: z
						.string()
						.describe("The classification of the document, e.g., invoice, receipt, unknown"),
				}),
			),
		}),
		execute: async ({ classifications }, { toolCallId }) => {
			writer.write({
				type: "data-started",
				data: {
					event: "started",
					tool: "extractFields",
					toolCallId,
					message: "Starting field extraction",
				},
			});

			const extracted = classifications.map(({ text, classification }) => {
				if (classification === "invoice") {
					return {
						classification,
						fields: {
							invoiceNumber: extract(text, [/invoice\s*(no|number)[:\s]*([A-Z0-9-]+)/i]),
							dueDate: extract(text, [/due\s*date[:\s]*([A-Z0-9\/-]+)/i]),
							totalAmount: extract(text, [/amount\s*due[:\s]*([\d,.]+)/i]),
						},
					};
				}

				if (classification === "receipt") {
					return {
						classification,
						fields: {
							totalPaid: extract(text, [
								/total[:\s]*([\d,.]+)/i,
								/amount\s*₦?\s*([\d,.]+)/i,
								/paid[:\s]*₦?\s*([\d,.]+)/i,
							]),
							paymentMethod: extract(text, [/(bill payment)/i, /(cash|pos|card|transfer)/i]),
						},
					};
				}

				return {
					classification: "unknown",
					fields: {
						rawTextPreview: text.slice(0, 200),
					},
				};
			});

			writer.write({
				type: "data-completed",
				data: {
					event: "completed",
					tool: "extractFields",
					toolCallId,
					count: extracted.length,
					results: extracted,
				},
			});

			return { results: extracted };
		},
	});

function extract(text: string, patterns: RegExp[]) {
	for (const pattern of patterns) {
		const match = text.match(pattern);
		if (match?.[2] || match?.[1]) {
			return match[2] ?? match[1];
		}
	}
	return null;
}
