"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Paperclip, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import pdfIcon from "@/file-formats/pdf.svg";
import docIcon from "@/file-formats/doc.svg";
import jpgIcon from "@/file-formats/jpg.svg";
import pngIcon from "@/file-formats/png.svg";
import Image, { StaticImageData } from "next/image";
import { cn } from "@/lib/cn";
import { OutputType } from "@/lib/schemas/output-schema";
import { ToolEvent } from "../api/billing-parser/tools/types";

const fileIcon: Record<string, StaticImageData> = {
	pdf: pdfIcon,
	doc: docIcon,
	jpg: jpgIcon,
	jpeg: jpgIcon,
	png: pngIcon,
};

export default function BillingParserClient() {
	const { messages, sendMessage, setMessages, status } = useChat({
		transport: new DefaultChatTransport({
			api: "/api/billing-parser",
		}),

		onError: (error) => {
			setUiError(error.message);
		},
	});

	const [files, setFiles] = useState<File[]>([]);
	const [prompt, setPrompt] = useState("");
	const [uploadError, setUploadError] = useState("");
	const [uiError, setUiError] = useState("");
	const fileRef = useRef<HTMLInputElement>(null);

	const handleSubmit = async () => {
		setMessages([]);

		if (!files.length && !prompt) {
			setUploadError("");
			return;
		}
		let uploadedFiles: { url: string; mediaType: string }[] = [];

		if (files.length) {
			const formData = new FormData();
			files.forEach((file) => formData.append("file", file));

			const res = await fetch("/api/billing-parser/upload", {
				method: "POST",
				body: formData,
			});

			if (!res.ok) {
				setUploadError("Unable to upload files");
				return;
			}

			const data = await res.json();
			uploadedFiles = data.files;
		}
		const messageParts = [];

		if (files) {
			for (const file of uploadedFiles) {
				messageParts.push({
					type: "file" as const,
					mediaType: file.mediaType,
					url: file.url,
				});
			}
		}
		if (prompt) {
			messageParts.push({
				type: "text" as const,
				text: prompt,
			});
		}

		if (messageParts.length > 0) {
			sendMessage({ parts: messageParts });
			setFiles([]);
			setUiError("");
			setPrompt("");
			if (fileRef.current) {
				fileRef.current.value = "";
			}
		}
	};
	return (
		<main className="px-6">
			<div className="max-w-2xl mx-auto">
				<div className="mt-6 mb-20 space-y-4">
					{messages.map((message) => (
						<div key={message.id} className="space-y-2">
							{message.parts.map((part, i) => {
								const hasText = message.parts.some((p) => p.type === "text");
								if (hasText && part.type.startsWith("data-")) {
									return null;
								}
								switch (part.type) {
									case "data-delta":
									case "data-started":
									case "data-finished": {
										const step = formatStep(part.data as ToolEvent);
										if (!step) return null;

										return (
											<div
												key={i}
												className="flex items-start gap-3 rounded-[12px] border border-gray-200 bg-gray-50 px-3 py-2"
											>
												<span
													className={`mt-1 size-2 rounded-full ${
														step.status === "done"
															? "bg-emerald-500"
															: step.status === "started"
																? "bg-blue-500"
																: "bg-amber-400"
													}`}
												/>
												<div className="flex flex-col">
													<p className="text-sm font-medium capitalize">
														{step.label.replace(/([A-Z])/g, " $1")}
													</p>
													{step.detail && <p className="text-xs text-gray-600">{step.detail}</p>}
												</div>
											</div>
										);
									}
									case "text": {
										let parsedData: OutputType | null = null;

										try {
											parsedData = JSON.parse(part.text);
										} catch {
											return null;
										}
										if (!parsedData?.classification || !Array.isArray(parsedData.classification)) {
											return null;
										}

										return (
											<div key={i} className="space-y-4">
												{parsedData.classification.map((item, idx: number) => (
													<DocumentCard key={idx} item={item} />
												))}
											</div>
										);
									}
								}

								return null;
							})}
						</div>
					))}
				</div>
				<div className="space-y-4">
					{status && (
						<div>
							<h3>Status</h3>
							<pre>{status}</pre>
						</div>
					)}

					{uiError && (
						<div>
							<h3>Error</h3>
							<pre>{uiError}</pre>
						</div>
					)}
				</div>

				<div
					className={cn(
						"border border-gray-200 bg-white rounded-[18px] p-4 gap-2  flex flex-col mt-20",
						messages.length > 0 && "fixed bottom-10 max-w-2xl w-full",
					)}
				>
					<div className="flex gap-2 flex-wrap">
						{files?.map((file) => {
							const ext = file.name.split(".").pop()?.toLowerCase() as string;
							return (
								<div
									key={file.name}
									className="flex items-center gap-2 px-2 py-2 border border-gray-200 rounded-[12px] relative"
								>
									<div className="flex gap-2 items-center w-full max-w-[270px]">
										<Image
											src={fileIcon[ext].src}
											className="size-8"
											alt=""
											width={32}
											height={32}
										/>
										<div className="overflow-hidden">
											<p className="truncate text-sm">{file.name}</p>
											<p className="text-xs text-gray-500">
												{file.type.split("/")[1].toUpperCase()}
											</p>
										</div>
									</div>
									<button
										className="absolute right-1 top-1"
										onClick={() =>
											setFiles((prev) => prev && prev?.filter((f) => f.name !== file.name))
										}
									>
										<span className="size-4 flex items-center justify-center cursor-pointer bg-gray-800 rounded-full">
											<X className="size-3 text-white" />
										</span>
									</button>
								</div>
							);
						})}
					</div>

					<textarea
						className="flex-1 field-sizing-content resize-none focus:outline-none"
						ref={(el) => el?.focus()}
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
					></textarea>
					<div className="flex w-full justify-between">
						<label
							htmlFor="file"
							tabIndex={0}
							role="button"
							aria-label="Upload files"
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									document.getElementById("file")?.click();
								}
							}}
							className="p-2 block rounded-[8px] cursor-pointer focus:outline-none hover:bg-gray-800/10 focus:ring-2 focus:ring-gray-800/25 focus:ring-offset-2"
						>
							<Paperclip className="size-4 text-gray-500" />
						</label>
						<input
							type="file"
							id="file"
							ref={fileRef}
							className="sr-only"
							onChange={(e) => {
								setFiles((prev) => prev && [...prev, ...(e.target.files ?? [])]);
							}}
							multiple
						/>

						<button
							disabled={status === "streaming"}
							className="bg-gray-800 text-white p-2 rounded-[8px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-800/25 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
							onClick={handleSubmit}
						>
							<Send className="size-4" />
						</button>
					</div>
				</div>
				{uploadError && <p className="text-red-500">{uploadError}</p>}
			</div>
		</main>
	);
}

type Item = {
	classification: "unknown" | "invoice" | "receipt";
	fields: {
		invoiceNumber: string | null;
		dueDate: string | null;
		totalAmount: string | null;
		totalPaid: string | null;
		paymentMethod: string | null;
		rawTextPreview: string | null;
	};
};

type ToolStep = {
	label: string;
	status: "started" | "progress" | "done";
	detail?: string;
};

function formatStep(data: ToolEvent): ToolStep | null {
	if (data.event === "started") {
		return {
			label: data.tool,
			status: "started",
			detail: data.message,
		};
	}

	if (data.event === "completed") {
		return {
			label: data.tool,
			status: "done",
			detail: "Completed",
		};
	}

	if (data.event === "image-detected") {
		return {
			label: data.tool,
			status: "progress",
			detail: `Detected ${data.mediaType}`,
		};
	}

	return null;
}

function DocumentCard({ item }: { item: Item }) {
	const { classification, fields } = item;

	return (
		<div className="rounded-[16px] border border-gray-200 bg-white p-4 space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-sm font-semibold capitalize">{classification}</span>
				<span className="text-xs text-gray-400">Detected</span>
			</div>

			<div className="space-y-2">
				<Field label="Invoice Number" value={fields.invoiceNumber} />
				<Field label="Due Date" value={fields.dueDate} />
				<Field label="Total Amount" value={fields.totalAmount} />
				<Field label="Amount Paid" value={fields.totalPaid} />
				<Field label="Payment Method" value={fields.paymentMethod} />
			</div>

			{fields.rawTextPreview && (
				<details className="text-xs text-gray-500">
					<summary className="cursor-pointer">View extracted text</summary>
					<p className="mt-2 whitespace-pre-wrap">{fields.rawTextPreview}</p>
				</details>
			)}
		</div>
	);
}

function Field({ label, value }: { label: string; value?: string | null }) {
	if (!value) return null;

	return (
		<div className="flex justify-between text-sm">
			<span className="text-gray-500">{label}</span>
			<span className="font-medium text-gray-900">{value}</span>
		</div>
	);
}
