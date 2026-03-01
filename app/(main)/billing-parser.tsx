"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Loader, Paperclip, Send, Square, X } from "lucide-react";
import { ChangeEvent, startTransition, useOptimistic, useRef, useState } from "react";
import pdfIcon from "@/file-formats/pdf.svg";
import docIcon from "@/file-formats/doc.svg";
import jpgIcon from "@/file-formats/jpg.svg";
import pngIcon from "@/file-formats/png.svg";
import Image, { StaticImageData } from "next/image";
import { cn } from "@/lib/cn";
import { OutputType } from "@/lib/schemas/output-schema";
import { ToolEvent } from "../api/billing-parser/tools/types";
import { UploadedFiles } from "./types";

const fileIcon: Record<string, StaticImageData> = {
	pdf: pdfIcon,
	doc: docIcon,
	jpg: jpgIcon,
	jpeg: jpgIcon,
	png: pngIcon,
};

type FileItem = UploadedFiles & {
	id: string;
	size: number;
	status: "uploading" | "completed" | "failed";
};

export default function BillingParserClient() {
	const { messages, sendMessage, setMessages, status, stop } = useChat({
		transport: new DefaultChatTransport({
			api: "/api/billing-parser",
		}),
		onError: (error) => {
			setUiError(error.message);
		},
	});

	const [files, setFiles] = useState<FileItem[]>([]);
	const [uploadError, setUploadError] = useState("");
	const [optimisticFiles, setOptimisticFiles] = useOptimistic(files);
	const [uiError, setUiError] = useState("");
	const fileRef = useRef<HTMLInputElement>(null);
	const dropzoneRef = useRef<HTMLDivElement>(null);
	const [active, setActive] = useState(false);

	const handleFiles = (browserFiles: File[]) => {
		const optimisticItems = browserFiles.map((f) => ({
			id: crypto.randomUUID(),
			name: f.name,
			size: f.size,
			status: "uploading",
		})) as FileItem[];

		startTransition(async () => {
			setOptimisticFiles((prev) => [...prev, ...optimisticItems]);

			try {
				if (!browserFiles.length) {
					throw new Error("Select valid file");
				}
				const formData = new FormData();
				browserFiles.forEach((f) => formData.append("file", f));

				const res = await fetch("/api/billing-parser/upload", {
					method: "POST",
					body: formData,
				});

				const data = await res.json();
				if (!res.ok) {
					alert(data.error);
					throw new Error("Issue uploading file");
				}

				await new Promise((r) => setTimeout(r, 2000));
				startTransition(() => {
					setFiles((prev) => [
						...prev,
						...data.files.map((f: UploadedFiles) => ({
							...f,
							status: "completed",
						})),
					]);
				});
			} catch {
				alert("Upload failed");
				startTransition(() => {
					setOptimisticFiles((prev) =>
						prev.map((f) => ({
							...f,
							status: "failed",
						})),
					);
				});
			}
		});
	};

	const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
		const lists = e.target.files;
		if (!lists || lists.length === 0) {
			setUploadError("Please select a valid file");
			return;
		}
		const browserFiles = Array.from(lists);

		const fileExtensions = browserFiles.map((file) => file.name.split(".").pop()?.toLowerCase());
		const allowedTypes = ["pdf", "png", "jpg", "doc", "docx"];

		for (const ext of fileExtensions) {
			if (!ext || !allowedTypes.includes(ext)) {
				alert("Invalid file type. Only PDF, PNG, JPG, DOCX and DOC are allowed.");
				e.target.value = "";
				return;
			}
		}

		e.target.value = "";

		handleFiles(browserFiles);
	};

	const handleSubmit = async () => {
		if (!files.length) {
			alert("Please upload at least one file");
			return;
		}

		setMessages([]);

		const messageParts = [];

		for (const file of files) {
			messageParts.push({
				type: "file" as const,
				mediaType: file.mediaType,
				url: file.url,
			});
		}

		if (messageParts.length > 0) {
			sendMessage({ parts: messageParts });
			setFiles([]);
			setUiError("");
			if (fileRef.current) fileRef.current.value = "";
		}
	};

	return (
		<main
			ref={dropzoneRef}
			className="px-6 flex flex-col h-dvh"
			onDragEnter={(e) => {
				e.preventDefault();
				setActive(true);
			}}
			onDragOver={(e) => {
				e.preventDefault();
				setActive(true);
			}}
			onDragLeave={(e) => {
				e.preventDefault();
				if (!dropzoneRef.current?.contains(e.relatedTarget as Node)) {
					setActive(false);
				}
			}}
			onDrop={(e) => {
				e.preventDefault();
				setActive(false);
				handleFiles(Array.from(e.dataTransfer.files));
			}}
		>
			<div
				className={cn(
					"fixed inset-0 w-screen h-screen flex items-center justify-center bg-white transition-opacity",
					active ? "opacity-50" : "opacity-0 pointer-events-none",
				)}
			>
				<div className="text-center">
					<p className="text-lg font-medium text-gray-900">Drop files here</p>
					<p className="text-sm text-gray-500 mt-1">PDF, PNG, JPG, DOC, DOCX</p>
				</div>
			</div>
			{messages.length > 0 && (
				<div className="mt-10 pb-40 space-y-4 max-w-2xl mx-auto w-full">
					{messages.map((message) => (
						<div key={message.id} className="space-y-2">
							{message.parts.map((part, i) => {
								const hasDocuments = message.parts.some((p) => p.type === "data-document-agent");

								if (
									hasDocuments &&
									(part.type === "data-started" ||
										part.type === "data-delta" ||
										part.type === "data-finished")
								) {
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
									case "data-document-agent": {
										const { status, document } = part.data as {
											status: "streaming" | "done";
											document?: Partial<OutputType>;
										};

										if (!document?.classification || !Array.isArray(document.classification)) {
											return null;
										}

										return (
											<div key={i} className="space-y-4">
												{document.classification.map((item, idx) => (
													<DocumentCard key={idx} item={item as Item} />
												))}

												{status === "streaming" && (
													<p className="text-xs text-gray-400">Processing…</p>
												)}
											</div>
										);
									}
								}

								return null;
							})}
						</div>
					))}
					<div className="space-y-4">{uiError && <pre>{uiError}</pre>} </div>
				</div>
			)}

			<div className="h-full flex items-center justify-center w-full">
				<div
					className={cn(
						"border border-gray-200 bg-white rounded-[18px] p-4 gap-2 flex flex-col w-full max-w-2xl",
						messages.length > 0 && "fixed bottom-10 mt-20 w-[calc(100%-48px)]",
					)}
				>
					{optimisticFiles.length > 0 && (
						<div className="flex gap-2 flex-wrap">
							{optimisticFiles?.map((file) => {
								const ext = file.name.split(".").pop()?.toLowerCase() as string;
								const icon = fileIcon[ext] ?? pdfIcon;

								return (
									<div
										key={file.id}
										className={cn(
											"flex items-center gap-2 px-2 py-2 border border-gray-200 rounded-[12px] relative",
										)}
									>
										<div className="flex gap-2 items-center w-full max-w-[270px]">
											<Image src={icon.src} className="size-8" alt="" width={32} height={32} />
											<div className="overflow-hidden">
												<p className="truncate text-sm">{file.name}</p>
												<div className="flex items-center gap-1.5">
													<p className="text-xs text-gray-500">{ext.toUpperCase()}</p>
													{file.status === "uploading" && (
														<p className="text-xs animate-pulse text-gray-500">Uploading....</p>
													)}
													{file.status === "completed" && (
														<p className="text-xs text-green-500">Completed</p>
													)}
												</div>
											</div>
										</div>
										<button
											className="absolute right-1 top-1"
											onClick={() =>
												setFiles((prev) => prev && prev?.filter((f) => f.id !== file.id))
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
					)}
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
							className="sr-only disabled:cursor-not-allowed"
							onChange={handleFileChange}
							disabled={status === "streaming" || status === "submitted"}
							multiple
						/>

						<button
							disabled={status === "submitted"}
							onClick={status === "streaming" ? stop : handleSubmit}
							className="bg-gray-800 text-white p-2 rounded-[8px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-800/25 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{status === "submitted" ? (
								<Loader className="size-4 animate-spin" />
							) : status === "streaming" ? (
								<Square className="size-4" />
							) : (
								<Send className="size-4" />
							)}
						</button>
					</div>
				</div>
			</div>
			{uploadError && <p className="text-red-500">{uploadError}</p>}
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

function DocumentCard({ item }: { item: Partial<Item> }) {
	const { classification, fields } = item;

	return (
		<div className="rounded-[16px] border border-gray-200 bg-white p-4 space-y-3">
			<div className="flex items-center justify-between">
				<span className="text-sm font-semibold capitalize">{classification}</span>
				<span className="text-xs text-gray-400">Detected</span>
			</div>

			<div className="space-y-2">
				<Field label="Invoice Number" value={fields?.invoiceNumber} />
				<Field label="Due Date" value={fields?.dueDate} />
				<Field label="Total Amount" value={fields?.totalAmount} />
				<Field label="Amount Paid" value={fields?.totalPaid} />
				<Field label="Payment Method" value={fields?.paymentMethod} />
			</div>

			{fields?.rawTextPreview && (
				<details className="text-xs text-gray-500">
					<summary className="cursor-pointer">View extracted text</summary>
					<p className="mt-2 whitespace-pre-wrap">{fields?.rawTextPreview}</p>
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
