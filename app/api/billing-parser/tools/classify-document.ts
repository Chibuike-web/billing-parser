import { tool, UIMessage, UIMessageStreamWriter } from "ai";
import z from "zod";

interface Params {
	writer: UIMessageStreamWriter<UIMessage<never>>;
}

export const classifyDocument = ({ writer }: Params) =>
	tool({
		description: "Classify the type of the provided document",
		inputSchema: z.object({
			texts: z.array(z.string()).describe("Array of document text contents to classify"),
		}),
		execute: async ({ texts }, { toolCallId }) => {
			writer.write({
				type: "data-started",
				data: {
					event: "started",
					tool: "classifyDocument",
					toolCallId,
					message: "Starting classification",
				},
			});
			const results = texts.map((t) => {
				const hasInvoiceSignal = invoiceSignals.some((signal) => t.toLowerCase().includes(signal));
				const hasReceiptSignal = receiptSignals.some((signal) => t.toLowerCase().includes(signal));
				if (hasInvoiceSignal) {
					return { text: t, classification: "invoice" };
				}
				if (hasReceiptSignal) {
					return { text: t, classification: "receipt" };
				}
				return { text: t, classification: "unknown" };
			});

			writer.write({
				type: "data-completed",
				data: {
					event: "completed",
					tool: "classifyDocument",
					toolCallId,
					count: results.length,
					message: "Completed classfication",
				},
			});

			return { classifications: results };
		},
	});

const invoiceSignals = [
	"invoice",
	"invoice number",
	"invoice no",
	"bill to",
	"due date",
	"amount due",
	"payment terms",
	"net 7",
	"net 14",
	"net 30",
];

const receiptSignals = [
	"receipt",
	"paid",
	"payment received",
	"thank you for your purchase",
	"cash",
	"change",
	"balance 0",
	"pos",
	"terminal",
	"transaction was successful",
	"quickteller",
	"bill payment",
];
