import { tool } from "ai";
import z from "zod";

export const classifyDocument = tool({
	description: "Classify the type of the provided document",
	inputSchema: z.object({
		texts: z.array(z.string()).describe("Array of document text contents to classify"),
	}),
	execute: async ({ texts }) => {
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
		return { results };
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
];
