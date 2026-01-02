import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export async function POST(req: Request) {
	try {
		const uploadDir = path.resolve("uploads");
		if (!existsSync(uploadDir)) {
			mkdirSync(uploadDir, { recursive: true });
		}

		const form = await req.formData();
		const files = form.getAll("file");

		const uploadedFiles: {
			url: string;
			mediaType: string;
			name: string;
		}[] = [];

		for (const file of files) {
			if (!(file instanceof File)) {
				throw new Error("Invalid upload");
			}
			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			console.log(file.name);
			const savePath = path.join(uploadDir, file.name);
			writeFileSync(savePath, buffer);
			uploadedFiles.push({
				name: file.name,
				mediaType: file.type,
				url: `uploads/${file.name}`,
			});
		}

		return new Response(
			JSON.stringify({
				status: "success",
				message: "Files successfully uploaded",
				files: uploadedFiles,
			}),
			{ status: 200 }
		);
	} catch (error) {
		console.error(error);
		return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
	}
}
