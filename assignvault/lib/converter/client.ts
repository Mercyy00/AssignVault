export interface ConvertSuccess {
  success: true;
  docxBuffer: Buffer;
}

export interface ConvertError {
  success: false;
  error: string;
  statusCode: number;
  isBusyOrOffline?: boolean;
}

export type ConvertResult = ConvertSuccess | ConvertError;

/**
 * Call the Python FastAPI PDF-to-DOCX microservice to convert a text-based PDF assignment.
 * Implements timeout protection, connection failure masking, and structured error reporting.
 */
export async function convertPdfToDocx(
  pdfBuffer: Buffer,
  filename: string = "assignment.pdf"
): Promise<ConvertResult> {
  const converterUrl =
    process.env.CONVERTER_URL || "http://127.0.0.1:8000";
  const apiKey =
    process.env.CONVERTER_API_KEY || "development-secret-key-12345";

  const endpoint = `${converterUrl.replace(/\/+$/, "")}/convert`;

  try {
    const formData = new FormData();
    const pdfBlob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
    formData.append("file", pdfBlob, filename);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 65_000);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
        },
        body: formData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const status = response.status;
      let errorDetail = "Conversion service encountered an error.";

      try {
        const errorJson = await response.json();
        if (errorJson && typeof errorJson.detail === "string") {
          errorDetail = errorJson.detail;
        } else if (errorJson && typeof errorJson.error === "string") {
          errorDetail = errorJson.error;
        }
      } catch {
        const errorText = await response.text();
        if (errorText && errorText.length < 200) {
          errorDetail = errorText;
        }
      }

      console.error(
        `[PDF Converter Service Error] HTTP ${status} from ${endpoint}: ${errorDetail}`
      );

      return {
        success: false,
        statusCode: status,
        error: errorDetail,
      };
    }

    const arrayBuf = await response.arrayBuffer();
    const docxBuffer = Buffer.from(arrayBuf);

    return {
      success: true,
      docxBuffer,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[PDF Converter Unreachable/Timeout] Error contacting ${endpoint}:`, message);

    return {
      success: false,
      statusCode: 503,
      isBusyOrOffline: true,
      error: "Conversion service is busy, please try again.",
    };
  }
}
