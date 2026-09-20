import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { convertPdfToDocx } from "./client.ts";

describe("Step 4: PDF Converter Client", () => {
  it("should return a friendly 503 error when converter service is unreachable", async () => {
    // Point to an unused local port to simulate offline service
    process.env.CONVERTER_URL = "http://127.0.0.1:58888";
    process.env.CONVERTER_API_KEY = "test-key";

    const dummyPdf = Buffer.from("%PDF-1.7\nDummy content");
    const result = await convertPdfToDocx(dummyPdf, "sample.pdf");

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.statusCode, 503);
    assert.strictEqual(result.isBusyOrOffline, true);
    assert.strictEqual(result.error, "Conversion service is busy, please try again.");
  });

  it("should successfully convert a genuine PDF when service is running", async () => {
    // Reset to live local converter on port 8000
    process.env.CONVERTER_URL = "http://127.0.0.1:8000";
    process.env.CONVERTER_API_KEY = "development-secret-key-12345";

    // Minimal text PDF
    const validPdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n" +
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n" +
      "4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 72 712 Td (Hello AssignVault) Tj ET\nendstream\nendobj\n" +
      "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n" +
      "xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000212 00000 n \n0000000305 00000 n \n" +
      "trailer<</Size 6/Root 1 0 R>>\nstartxref\n378\n%%EOF"
    );

    const result = await convertPdfToDocx(validPdf, "hello.pdf");
    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.ok(result.docxBuffer);
      assert.ok(result.docxBuffer.length > 0);
      // Verify PKZip header
      assert.strictEqual(result.docxBuffer[0], 0x50);
      assert.strictEqual(result.docxBuffer[1], 0x4b);
    }
  });

  it("should return 422 with scanned message when PDF has no selectable text", async () => {
    process.env.CONVERTER_URL = "http://127.0.0.1:8000";
    process.env.CONVERTER_API_KEY = "development-secret-key-12345";

    // Blank PDF with zero text
    const blankPdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n" +
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n" +
      "xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n" +
      "trailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF"
    );

    const result = await convertPdfToDocx(blankPdf, "scan.pdf");
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.statusCode, 422);
    assert.ok(result.error.includes("scan"));
  });
});
