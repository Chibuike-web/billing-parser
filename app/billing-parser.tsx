"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Paperclip, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import pdfIcon from "@/file-formats/pdf.svg";
import docIcon from "@/file-formats/doc.svg";
import jpgIcon from "@/file-formats/jpg.svg";
import pngIcon from "@/file-formats/png.svg";
import { StaticImageData } from "next/image";

const fileIcon: Record<string, StaticImageData> = {
	pdf: pdfIcon,
	doc: docIcon,
	jpg: jpgIcon,
	png: pngIcon,
};

export default function BillingParserClient() {
	const { messages, sendMessage, status, error } = useChat({
		transport: new DefaultChatTransport({
			api: "/api/billing-parser",
		}),
	});

	const [files, setFiles] = useState<File[]>([]);
	const [prompt, setPrompt] = useState("");
	const [uploadError, setUploadError] = useState("");
	const fileRef = useRef<HTMLInputElement>(null);

	console.log(messages);

	const handleSubmit = async () => {
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
			setPrompt("");
			if (fileRef.current) {
				fileRef.current.value = "";
			}
		}
	};
	return (
		<main className="px-6">
			<div className="border border-gray-200 rounded-[18px] p-4 gap-2 max-w-2xl mx-auto flex flex-col mt-20">
				<div className="flex gap-2 flex-wrap">
					{files?.map((file) => {
						const ext = file.name.split(".").pop()?.toLowerCase() as string;
						return (
							<div
								key={file.name}
								className="flex items-center gap-2 px-2 py-2 border border-gray-200 rounded-[12px] relative"
							>
								<div className="flex gap-2 items-center w-full max-w-[270px]">
									<img src={fileIcon[ext].src} className="size-8" alt="" />
									<div className="overflow-hidden">
										<p className="truncate text-sm">{file.name}</p>
										<p className="text-xs text-gray-500">{file.type.split("/")[1].toUpperCase()}</p>
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
		</main>
	);
}
