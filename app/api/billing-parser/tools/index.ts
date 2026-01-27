import { UIMessage, UIMessageStreamWriter } from "ai";
import { classifyDocument } from "./classify-document";
import { separateDocuments } from "./separate-documents";
import { extractFields } from "./extract-fields";

interface Params {
	writer: UIMessageStreamWriter<UIMessage<never>>;
}

export function tools({ writer }: Params) {
	return {
		separateDocuments: separateDocuments({ writer }),
		classifyDocument: classifyDocument({ writer }),
		extractFields: extractFields({ writer }),
	};
}
