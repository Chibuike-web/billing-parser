import z from "zod";

export const outputSchema = z.object({
	classification: z.array(
		z.object({
			classification: z.enum(["invoice", "receipt", "unknown"]),
			fields: z.object({
				invoiceNumber: z.string().nullable(),
				dueDate: z.string().nullable(),
				totalAmount: z.string().nullable(),
				totalPaid: z.string().nullable(),
				paymentMethod: z.string().nullable(),
				rawTextPreview: z.string().nullable(),
			}),
		}),
	),
});

export type OutputType = z.infer<typeof outputSchema>;
