import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { templatize } from "../templatize.ts";
import { fillTemplate, applyCase, formatDate, expandPlaceholder } from "../fill.ts";
import { loadDocx } from "../unzip.ts";
import { extractDocxText } from "../extractText.ts";

// Helper to resolve fixture path from potential locations
function resolveFixture(filename) {
  const local = path.resolve(process.cwd(), "fixtures", filename);
  if (fs.existsSync(local)) return local;
  const parent = path.resolve(process.cwd(), "../assignvault-steps/fixtures", filename);
  if (fs.existsSync(parent)) return parent;
  throw new Error(`Fixture not found: ${filename}`);
}

describe("Step 6: Template Filling & Personalization Engine", () => {
  const downloader = {
    firstName: "Asha",
    middleName: "Ramesh",
    surname: "Patel",
    rollNumber: "57",
    batch: "P2",
    customDate: "2026-10-01",
    folderName: "asha-code",
  };

  describe("1. Unit Utilities (Casing, Date, Placeholders)", () => {
    it("should format date with various format tokens", () => {
      assert.strictEqual(formatDate("2026-10-01", "DD/MM/YYYY"), "01/10/2026");
      assert.strictEqual(formatDate("2026-10-01", "YYYY-MM-DD"), "2026-10-01");
      assert.strictEqual(formatDate("2026-10-01", "D MMMM YYYY"), "1 October 2026");
      assert.strictEqual(formatDate("2026-09-09", "DD.MM.YYYY"), "09.09.2026");
      assert.strictEqual(formatDate("2026-09-09", "D/M/YY"), "9/9/26");
    });

    it("should apply casing correctly", () => {
      assert.strictEqual(applyCase("sharma rahul kumar", "title"), "Sharma Rahul Kumar");
      assert.strictEqual(applyCase("Sharma Rahul Kumar", "upper"), "SHARMA RAHUL KUMAR");
      assert.strictEqual(applyCase("Sharma Rahul Kumar", "lower"), "sharma rahul kumar");
      assert.strictEqual(applyCase("Sharma Rahul Kumar", "asis"), "Sharma Rahul Kumar");
    });

    it("should reverse string after title casing when transform=reverse is specified", () => {
      // Rahul -> luhaR
      const resRahul = expandPlaceholder(
        "NAME",
        "order=F|case=title|transform=reverse",
        { firstName: "Rahul", surname: "Sharma", rollNumber: "101", batch: "P1" }
      );
      assert.strictEqual(resRahul, "luhaR");

      // Asha -> ahsA
      const resAsha = expandPlaceholder(
        "NAME",
        "order=F|case=title|transform=reverse",
        downloader
      );
      assert.strictEqual(resAsha, "ahsA");
    });

    it("should handle missing middle name cleanly without extra spaces", () => {
      const noMiddleDownloader = {
        firstName: "Asha",
        surname: "Patel",
        rollNumber: "57",
        batch: "P2",
      };
      const res = expandPlaceholder("NAME", "order=S-F-M|case=title", noMiddleDownloader);
      assert.strictEqual(res, "Patel Asha");
      assert.strictEqual(res.includes("  "), false);
    });

    it("should pad placeholder value when pad=<n> is present", () => {
      const res = expandPlaceholder(
        "NAME",
        "order=S-F-M|case=title|pad=50",
        downloader
      );
      // "Patel Asha Ramesh" is 17 chars. 50 - 17 = 33 spaces
      assert.strictEqual(res.startsWith("Patel Asha Ramesh"), true);
      assert.strictEqual(res.length, 50);
    });
  });

  describe("2. Python Fixture Personalization (Filled assignment)", () => {
    it("should personalize python_assignment_04 with new student details", async () => {
      const fixturePath = resolveFixture("python_assignment_04_FILLED_anonymized.docx");
      const originalBuffer = fs.readFileSync(fixturePath);

      // Step A: templatize the original uploader (Sharma Rahul Kumar, 101, 2026-09-09)
      const templatizeRes = await templatize(originalBuffer, {
        fullName: "Sharma Rahul Kumar",
        firstName: "Rahul",
        middleName: "Kumar",
        surname: "Sharma",
        rollNumber: "101",
        batch: "P1",
        fileDate: "2026-09-09",
        folderName: "assign",
      });

      // Verify template created with placeholders
      const templateZip = await loadDocx(templatizeRes.templateBuffer);
      const templateText = (await extractDocxText(templateZip)).fullText;
      assert.ok(templateText.includes("{{ROLL}}"));
      assert.ok(templateText.includes("{{NAME|order="));

      // Step B: Personalize for downloader (Asha Ramesh Patel, 57, P2, 2026-10-01)
      const filledBuffer = await fillTemplate(templatizeRes.templateBuffer, downloader);
      const filledZip = await loadDocx(filledBuffer);
      const filledText = (await extractDocxText(filledZip)).fullText;

      // 1. Verify roll number 57 appears across program blocks
      const rollMatches = [...filledText.matchAll(/Roll No:\s*57/g)];
      assert.strictEqual(rollMatches.length, 10);

      // 2. Verify student name Patel Asha Ramesh appears in header blocks
      const nameMatches = [...filledText.matchAll(/Patel Asha Ramesh/g)];
      assert.strictEqual(nameMatches.length, 10);

      // 3. Verify echoed input and reversed output in program 1.2
      assert.ok(filledText.includes("Enter a string:Asha"));
      assert.ok(filledText.includes("Reversed string: ahsA"));

      // 4. Verify submission date
      assert.ok(filledText.includes("01/10/2026"));

      // 5. Verify NO residual trace of previous uploader
      assert.strictEqual(filledText.includes("101"), false);
      assert.strictEqual(filledText.toLowerCase().includes("sharma"), false);
      assert.strictEqual(filledText.toLowerCase().includes("kumar"), false);
      assert.strictEqual(filledText.toLowerCase().includes("luhar"), false);

      // 6. Verify package is well-formed XML
      const parser = new DOMParser({
        onError: (lvl, msg) => {
          throw new Error(`XML error: ${msg}`);
        },
      });
      const xmlFiles = Object.keys(filledZip.files).filter((f) => f.endsWith(".xml"));
      for (const f of xmlFiles) {
        const xml = await filledZip.file(f).async("string");
        assert.doesNotThrow(() => parser.parseFromString(xml, "text/xml"));
      }
    });
  });

  describe("3. React Fixture Personalization (Blank fields assignment)", () => {
    it("should personalize react_assignment_01 and preserve 17 drawings + footer fields", async () => {
      const fixturePath = resolveFixture("react_assignment_01_BLANK_FIELDS.docx");
      const originalBuffer = fs.readFileSync(fixturePath);

      const origZip = await loadDocx(originalBuffer);
      const origDocXml = await origZip.file("word/document.xml").async("string");
      const origDrawingsCount = (origDocXml.match(/<w:drawing/g) || []).length;
      assert.strictEqual(origDrawingsCount, 17);

      // Verify footer has field codes (PAGE)
      const origFooterXml = await origZip.file("word/footer1.xml")?.async("string");
      assert.ok(origFooterXml && (origFooterXml.includes("PAGE") || origFooterXml.includes("fldChar") || origFooterXml.includes("fldSimple")));

      // Create synthetic template with blank slots replaced by placeholders
      // Simulating template for React fixture with {{ROLL}}, {{NAME...pad=98}}, {{DATE...}}
      const templateDocXml = origDocXml
        .replace("Roll No:", "Roll No: {{ROLL}}")
        .replace(
          /Name:\s*Date:/,
          "Name: {{NAME|order=S-F-M|case=title|pad=98}}Date: {{DATE|fmt=DD/MM/YYYY}}"
        );

      origZip.file("word/document.xml", templateDocXml);
      const templateBuffer = await origZip.generateAsync({ type: "nodebuffer" });

      // Personalize with downloader
      const filledBuffer = await fillTemplate(templateBuffer, downloader);
      const filledZip = await loadDocx(filledBuffer);
      const filledDocXml = await filledZip.file("word/document.xml").async("string");
      const filledText = (await extractDocxText(filledZip)).fullText;

      // 1. Verify roll, name, date inserted
      assert.ok(filledText.includes("Roll No: 57"));
      assert.ok(filledText.includes("Name: Patel Asha Ramesh"));
      assert.ok(filledText.includes("Date: 01/10/2026"));

      // 2. Verify all 17 drawings remain untouched
      const filledDrawingsCount = (filledDocXml.match(/<w:drawing/g) || []).length;
      assert.strictEqual(filledDrawingsCount, 17);

      // 3. Verify footer page number field is completely intact
      const filledFooterXml = await filledZip.file("word/footer1.xml").async("string");
      assert.ok(filledFooterXml.includes("PAGE") || filledFooterXml.includes("fldChar") || filledFooterXml.includes("fldSimple"));
    });
  });

  describe("4. Safety & Edge Cases", () => {
    it("should safely escape XML characters in folder name and personal details", async () => {
      const specialDetails = {
        ...downloader,
        firstName: "Asha & Priya",
        folderName: "test<code&proj>",
      };

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
           <w:body>
             <w:p><w:r><w:t>Student: {{NAME|order=F|case=title}}</w:t></w:r></w:p>
             <w:p><w:r><w:t>Path: C:\\{{FOLDER|case=asis}}\\main.py</w:t></w:r></w:p>
           </w:body>
         </w:document>`
      );
      const testBuffer = await zip.generateAsync({ type: "nodebuffer" });

      const filledBuffer = await fillTemplate(testBuffer, specialDetails);
      const filledZip = await loadDocx(filledBuffer);
      const xml = await filledZip.file("word/document.xml").async("string");

      // Verify XML escaping
      assert.ok(xml.includes("&amp;"));
      assert.strictEqual(xml.includes("<code"), false); // '<' should be sanitized or escaped

      const parser = new DOMParser({
        onError: (lvl, msg) => {
          throw new Error(`XML error: ${msg}`);
        },
      });
      assert.doesNotThrow(() => parser.parseFromString(xml, "text/xml"));
    });

    it("should never re-scan or expand literal {{ inside student name (single pass)", async () => {
      const maliciousDetails = {
        ...downloader,
        firstName: "Asha {{ROLL}}",
      };

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
           <w:body>
             <w:p><w:r><w:t>{{NAME|order=F|case=asis}}</w:t></w:r></w:p>
           </w:body>
         </w:document>`
      );
      const testBuffer = await zip.generateAsync({ type: "nodebuffer" });

      const filledBuffer = await fillTemplate(testBuffer, maliciousDetails);
      const filledZip = await loadDocx(filledBuffer);
      const filledText = (await extractDocxText(filledZip)).fullText;

      // "{{ROLL}}" inside student name must stay literal and NOT expand to "57"
      assert.ok(filledText.includes("Asha {{ROLL}}"));
    });

    it("should fail safely and throw an error when an unexpanded placeholder remains", async () => {
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
           <w:body>
             <w:p><w:r><w:t>{{UNKNOWN_PLACEHOLDER}}</w:t></w:r></w:p>
           </w:body>
         </w:document>`
      );
      const testBuffer = await zip.generateAsync({ type: "nodebuffer" });

      await assert.rejects(
        () => fillTemplate(testBuffer, downloader),
        /Template filling failed: unexpanded placeholder/
      );
    });

    it("should fail safely when date placeholder exists but customDate is missing", async () => {
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
           <w:body>
             <w:p><w:r><w:t>Submission: {{DATE|fmt=DD/MM/YYYY}}</w:t></w:r></w:p>
           </w:body>
         </w:document>`
      );
      const testBuffer = await zip.generateAsync({ type: "nodebuffer" });

      const noDateDetails = { ...downloader, customDate: undefined };
      await assert.rejects(
        () => fillTemplate(testBuffer, noDateDetails),
        /Template filling failed: missing date/
      );
    });

    it("should optionally add reference watermark when requested", async () => {
      const zip = new JSZip();
      zip.file(
        "[Content_Types].xml",
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
         <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
           <Default Extension="xml" ContentType="application/xml"/>
           <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
           <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
         </Types>`
      );
      zip.file(
        "word/document.xml",
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
         <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
           <w:body><w:p><w:r><w:t>Page content</w:t></w:r></w:p></w:body>
         </w:document>`
      );
      zip.file(
        "word/footer1.xml",
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
         <w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
           <w:p><w:r><w:t>Page 1 of 1</w:t></w:r></w:p>
         </w:ftr>`
      );
      const testBuffer = await zip.generateAsync({ type: "nodebuffer" });

      const filledBuffer = await fillTemplate(testBuffer, downloader, { watermark: true });
      const filledZip = await loadDocx(filledBuffer);
      const footerXml = await filledZip.file("word/footer1.xml").async("string");

      assert.ok(footerXml.includes("Reference copy generated by AssignVault"));
    });
  });
});
