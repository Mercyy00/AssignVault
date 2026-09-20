import JSZip from "jszip";

export interface FileVerificationResult {
  isValid: boolean;
  format: "docx" | "pdf";
  error?: string;
  zip?: JSZip;
}

const MAX_ZIP_ENTRIES = 500;
const MAX_UNCOMPRESSED_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Verify that the uploaded buffer is a genuine .docx or .pdf file.
 * Inspects raw magic bytes and internal archive structures rather than trusting MIME types.
 */
export async function verifyUploadedFile(
  buffer: Buffer,
  filename?: string
): Promise<FileVerificationResult> {
  if (filename && !/\.(docx|pdf)$/i.test(filename)) {
    return {
      isValid: false,
      format: "docx",
      error: "Only .docx and .pdf files are supported.",
    };
  }

  if (!buffer || buffer.length === 0) {
    return { isValid: false, format: "docx", error: "The uploaded file is empty." };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      format: "docx",
      error: "File size exceeds the 10 MB limit.",
    };
  }

  // 1. Check if it is a PDF by inspecting magic bytes %PDF (0x25 0x50 0x44 0x46)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { isValid: true, format: "pdf" };
  }

  // 2. Check if it is a DOCX (PKZip archive)
  // Standard zip file header starts with PK\x03\x04 or PK\x05\x06 (empty)
  const isZipHeader =
    buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;

  if (!isZipHeader) {
    return {
      isValid: false,
      format: "docx",
      error:
        "The uploaded file is not a valid Word document (.docx) or PDF (.pdf). Please upload a genuine file.",
    };
  }

  try {
    const zip = await JSZip.loadAsync(buffer);
    const files = Object.keys(zip.files);

    // Zip bomb check: max entry count
    if (files.length > MAX_ZIP_ENTRIES) {
      return {
        isValid: false,
        format: "docx",
        error: "Corrupt or unsafe file: Archive contains too many entries (zip bomb protection).",
      };
    }

    // Zip bomb check: total uncompressed size
    let totalUncompressedSize = 0;
    for (const fileKey of files) {
      const entry = zip.files[fileKey];
      // Note: _data.uncompressedSize is available on JSZip internal objects
      // Alternatively, check size when decompressing or read metadata
      const entryData = (entry as unknown as { _data?: { uncompressedSize?: number } })._data;
      const size = entryData?.uncompressedSize ?? 0;
      totalUncompressedSize += size;
      if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE_BYTES) {
        return {
          isValid: false,
          format: "docx",
          error:
            "Corrupt or unsafe file: Uncompressed content exceeds 50 MB (zip bomb protection).",
        };
      }
    }

    // Check required DOCX parts: [Content_Types].xml and word/document.xml
    const hasContentTypes = zip.file("[Content_Types].xml") !== null;
    const hasDocumentXml = zip.file("word/document.xml") !== null;

    if (!hasContentTypes || !hasDocumentXml) {
      return {
        isValid: false,
        format: "docx",
        error:
          "The file is a zip archive but is missing required Word document parts ([Content_Types].xml or word/document.xml).",
      };
    }

    return { isValid: true, format: "docx", zip };
  } catch {
    return {
      isValid: false,
      format: "docx",
      error:
        "The document archive could not be read or is corrupted. Please ensure it is a valid .docx file.",
    };
  }
}
