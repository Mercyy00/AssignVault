import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { verifyUploadedFile } from "./verify.ts";
import { extractDocxText, crossCheckUploaderDetails } from "./extractText.ts";
import { checkRateLimit, resetRateLimits, hashIp } from "../security/rateLimit.ts";

// Helper to create synthetic in-memory DOCX archives
async function createSyntheticDocx(bodyXml) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
     <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
       <Default Extension="xml" ContentType="application/xml"/>
       <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
     </Types>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
     <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
       <w:body>${bodyXml}</w:body>
     </w:document>`
  );
  return await zip.generateAsync({ type: "nodebuffer" });
}

describe("Step 3: Upload Flow, Verification & Security", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  describe("1. File Verification & Authenticity", () => {
    it("should accept a valid synthetic .docx file", async () => {
      const buffer = await createSyntheticDocx(
        "<w:p><w:r><w:t>Roll: 24BCS042</w:t></w:r></w:p>"
      );
      const res = await verifyUploadedFile(buffer, "assignment.docx");
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.format, "docx");
      assert.ok(res.zip);
    });

    it("should accept a valid PDF by magic bytes", async () => {
      const pdfBuffer = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
      const res = await verifyUploadedFile(pdfBuffer, "assignment.pdf");
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.format, "pdf");
    });

    it("should reject a plain text file renamed to .docx", async () => {
      const fakeDocx = Buffer.from("Hello world, this is a plain text file pretending to be docx");
      const res = await verifyUploadedFile(fakeDocx, "fake.docx");
      assert.strictEqual(res.isValid, false);
      assert.ok(res.error?.includes("not a valid Word document"));
    });

    it("should reject a zip file missing word/document.xml", async () => {
      const zip = new JSZip();
      zip.file("[Content_Types].xml", "<Types></Types>");
      zip.file("notes.txt", "Some random notes");
      const buffer = await zip.generateAsync({ type: "nodebuffer" });

      const res = await verifyUploadedFile(buffer, "incomplete.docx");
      assert.strictEqual(res.isValid, false);
      assert.ok(res.error?.includes("missing required Word document parts"));
    });

    it("should reject an empty file", async () => {
      const emptyBuffer = Buffer.alloc(0);
      const res = await verifyUploadedFile(emptyBuffer, "empty.docx");
      assert.strictEqual(res.isValid, false);
      assert.ok(res.error?.includes("empty"));
    });
  });

  describe("2. Text Extraction & Run-Level Reconstruction", () => {
    it("should accurately extract text split across multiple runs", async () => {
      // "Jay" + "esh" + " " + "Ghagare" in separate <w:r> runs
      const body = `
        <w:p>
          <w:r><w:t>Jay</w:t></w:r>
          <w:r><w:t>esh</w:t></w:r>
          <w:r><w:t> </w:t></w:r>
          <w:r><w:t>Ghagare</w:t></w:r>
        </w:p>
        <w:p>
          <w:r><w:t>Roll No: </w:t></w:r>
          <w:r><w:t>24BCS042</w:t></w:r>
        </w:p>
      `;
      const buffer = await createSyntheticDocx(body);
      const zip = await JSZip.loadAsync(buffer);
      const extracted = await extractDocxText(zip);

      assert.ok(extracted.fullText.includes("Jayesh Ghagare"));
      assert.ok(extracted.fullText.includes("24BCS042"));
    });

    it("should handle tabs and line breaks within runs", async () => {
      const body = `
        <w:p>
          <w:r><w:t>Title</w:t><w:tab/><w:t>Page 1</w:t><w:br/><w:t>Subtitle</w:t></w:r>
        </w:p>
      `;
      const buffer = await createSyntheticDocx(body);
      const zip = await JSZip.loadAsync(buffer);
      const extracted = await extractDocxText(zip);

      assert.ok(extracted.fullText.includes("Title\tPage 1\nSubtitle"));
    });
  });

  describe("3. Identity Cross-Check (Name & Roll Number)", () => {
    it("should pass when roll number and full name are present", () => {
      const text = "BCS Practical Assignment 1\nName: Jayesh Prashant Ghagare\nRoll: 24BCS042";
      const res = crossCheckUploaderDetails(text, "Jayesh Prashant Ghagare", "24BCS042");
      assert.strictEqual(res.passed, true);
      assert.strictEqual(res.foundRoll, true);
      assert.strictEqual(res.foundName, true);
      assert.ok(res.matchedTokens.includes("jayesh"));
    });

    it("should pass when only roll number is present", () => {
      const text = "BCS Practical Assignment 1\nStudent Roll: 24BCS042\nDate: 2026-09-01";
      const res = crossCheckUploaderDetails(text, "Unknown Student", "24BCS042");
      assert.strictEqual(res.passed, true);
      assert.strictEqual(res.foundRoll, true);
    });

    it("should pass when only name token is present", () => {
      const text = "Submitted by Jayesh Ghagare\nBatch: P1";
      const res = crossCheckUploaderDetails(text, "Jayesh Ghagare", "99999");
      assert.strictEqual(res.passed, true);
      assert.strictEqual(res.foundRoll, false);
      assert.strictEqual(res.foundName, true);
    });

    it("should reject when neither name nor roll number appears in document", () => {
      const text = "Generic Assignment Content without student details\nTask 1: Complete the code.";
      const res = crossCheckUploaderDetails(text, "Jayesh Ghagare", "24BCS042");
      assert.strictEqual(res.passed, false);
      assert.ok(res.error?.includes("couldn't find your name or roll number"));
    });
  });

  describe("4. Rate Limiting & Abuse Protection", () => {
    it("should allow up to 5 uploads within window", () => {
      const hash = hashIp("192.168.1.10");
      for (let i = 1; i <= 5; i++) {
        const res = checkRateLimit(hash, 5);
        assert.strictEqual(res.allowed, true);
        assert.strictEqual(res.remaining, 5 - i);
      }
    });

    it("should block the 6th upload with 0 remaining", () => {
      const hash = hashIp("192.168.1.20");
      for (let i = 1; i <= 5; i++) {
        checkRateLimit(hash, 5);
      }
      const sixth = checkRateLimit(hash, 5);
      assert.strictEqual(sixth.allowed, false);
      assert.strictEqual(sixth.remaining, 0);
    });

    it("should hash IPs consistently without leaking raw IP", () => {
      const h1 = hashIp("10.0.0.1");
      const h2 = hashIp("10.0.0.1");
      const h3 = hashIp("10.0.0.2");

      assert.strictEqual(h1, h2);
      assert.notStrictEqual(h1, h3);
      assert.strictEqual(h1.length, 64); // SHA-256 hex length
    });
  });
});
