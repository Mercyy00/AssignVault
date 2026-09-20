import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { templatize } from "../templatize.ts";
import { fillTemplate } from "../fill.ts";
import { loadDocx } from "../unzip.ts";
import { extractDocxText } from "../extractText.ts";

/**
 * Helper to build a minimal synthetic docx with custom body paragraphs
 */
async function createSyntheticDocx(paragraphs) {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
     <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
       <Default Extension="xml" ContentType="application/xml"/>
       <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
       <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
       <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
     </Types>`
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
     <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
       <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
       <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
     </Relationships>`
  );

  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
     <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
  );

  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
     <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
       <dc:creator>Author</dc:creator>
     </cp:coreProperties>`
  );

  const pXml = paragraphs
    .map(
      (text) =>
        `<w:p><w:r><w:t xml:space="preserve">${text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</w:t></w:r></w:p>`
    )
    .join("\n");

  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
     <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
       <w:body>
         ${pXml}
       </w:body>
     </w:document>`
  );

  return await zip.generateAsync({ type: "nodebuffer" });
}

describe("Step 7: Output Personalization", () => {
  const pythonFixturePath = path.resolve(
    process.cwd(),
    "../assignvault-steps/fixtures/python_assignment_04_FILLED_anonymized.docx"
  );

  it("1. Python fixture: echo detection and reverse transform personalized for Asha", async () => {
    assert.ok(fs.existsSync(pythonFixturePath), "python fixture docx must exist");
    const docxBuf = fs.readFileSync(pythonFixturePath);

    // Templatize with uploader details
    const templatizeRes = await templatize(docxBuf, {
      fullName: "Sharma Rahul Kumar",
      firstName: "Rahul",
      middleName: "Kumar",
      surname: "Sharma",
      rollNumber: "101",
      batch: "P1",
      folderName: "",
      fileDate: "2026-09-09",
    });

    const templateZip = await loadDocx(templatizeRes.templateBuffer);
    const templateText = (await extractDocxText(templateZip)).fullText;

    // Check placeholder in output section
    assert.ok(
      templateText.includes("Enter a string:{{NAME|order=F|case=asis}}") ||
        templateText.includes("Enter a string:{{NAME|order=F|case=title}}") ||
        templateText.includes("Enter a string:{{NAME|order=F"),
      "Echo input should contain NAME placeholder for order=F"
    );

    assert.ok(
      templateText.includes("{{NAME|order=F|case=asis|transform=reverse}}") ||
        templateText.includes("transform=reverse"),
      "Reversed string should contain reverse transform placeholder"
    );

    // Personalize for a new student "Asha"
    const filledDocx = await fillTemplate(templatizeRes.templateBuffer, {
      firstName: "Asha",
      middleName: "Vikas",
      surname: "Patil",
      rollNumber: "505",
      batch: "P2",
      customDate: "2026-09-15",
      folderName: "myfolder",
    });

    const filledZip = await loadDocx(filledDocx);
    const filledText = (await extractDocxText(filledZip)).fullText;

    // Assert echo and reversed output in personalized document
    assert.ok(
      filledText.includes("Enter a string:Asha"),
      `Filled document must contain 'Enter a string:Asha', got excerpt around output: ${filledText.slice(filledText.indexOf("Enter a string"), filledText.indexOf("Enter a string") + 50)}`
    );

    assert.ok(
      filledText.includes("Reversed string: ahsA") || filledText.includes("ahsA"),
      `Filled document must contain reversed string 'ahsA', got excerpt around output: ${filledText.slice(filledText.indexOf("Reversed string"), filledText.indexOf("Reversed string") + 50)}`
    );
  });

  it("2. Synthetic folder path in code prompt (case=asis and case=lower)", async () => {
    // Document with terminal output prompt showing folder path
    const docxBuf = await createSyntheticDocx([
      "Roll No: 101",
      "Student Name: Jayesh Prashant Ghagare",
      "Source Code:",
      "print('Hello world')",
      "Output:-",
      "C:\\Users\\jayesh\\Desktop>python app.py",
      "Hello world",
      "Roll No: 101",
    ]);

    const res = await templatize(docxBuf, {
      fullName: "Jayesh Prashant Ghagare",
      firstName: "Jayesh",
      middleName: "Prashant",
      surname: "Ghagare",
      rollNumber: "101",
      batch: "P1",
      folderName: "jayesh",
      fileDate: "2026-09-09",
    });

    assert.strictEqual(res.requiresFolder, true, "Template must flag requiresFolder = true");

    const templateZip = await loadDocx(res.templateBuffer);
    const templateText = (await extractDocxText(templateZip)).fullText;

    assert.ok(
      templateText.includes("C:\\Users\\{{FOLDER|case=asis}}\\Desktop>python app.py") ||
        templateText.includes("{{FOLDER"),
      `Folder placeholder must replace path segment in prompt, got: ${templateText}`
    );

    // Personalize with downloader folder "superdev"
    const filledDocx = await fillTemplate(res.templateBuffer, {
      firstName: "Amit",
      middleName: "Sunil",
      surname: "Jadhav",
      rollNumber: "202",
      batch: "P1",
      customDate: "2026-09-12",
      folderName: "superdev",
    });

    const filledZip = await loadDocx(filledDocx);
    const filledText = (await extractDocxText(filledZip)).fullText;

    assert.ok(
      filledText.includes("C:\\Users\\superdev\\Desktop>python app.py"),
      `Personalized prompt must show new folder 'superdev', got: ${filledText}`
    );
  });

  it("3. Synthetic unknown derived output produces derived_output warning and needs_review", async () => {
    // Document where output computes length of name
    const docxBuf = await createSyntheticDocx([
      "Roll No: 101",
      "Student Name: Sharma Rahul Kumar",
      "Source Code:",
      "name = input('Enter name:')",
      "print('Length of name is:', len(name))",
      "Output:-",
      "Enter name: Rahul",
      "Length of name is: 5",
      "Roll No: 101",
    ]);

    const res = await templatize(docxBuf, {
      fullName: "Sharma Rahul Kumar",
      firstName: "Rahul",
      middleName: "Kumar",
      surname: "Sharma",
      rollNumber: "101",
      batch: "P1",
      folderName: "assign",
      fileDate: "2026-09-09",
    });

    // Verify warning is emitted with type: "derived_output"
    const derivedWarn = res.report.warnings.find(
      (w) => typeof w === "object" && w?.type === "derived_output"
    );

    assert.ok(derivedWarn, "Must emit a warning with type 'derived_output'");
    assert.strictEqual(
      derivedWarn.message,
      "Output depends on the entered name: please review"
    );
    assert.ok(
      derivedWarn.excerpt.includes("Length of name is"),
      `Excerpt must contain the offending line, got: ${derivedWarn.excerpt}`
    );

    assert.strictEqual(res.needsReview, true, "needsReview must be true for unknown derived output");

    // Line itself must not be replaced
    const templateZip = await loadDocx(res.templateBuffer);
    const templateText = (await extractDocxText(templateZip)).fullText;
    assert.ok(
      templateText.includes("Length of name is: 5"),
      "Non-transformable line must remain untouched without erroneous placeholder replacements"
    );
  });

  it("4. Names never replaced inside source code lines outside output regions", async () => {
    const docxBuf = await createSyntheticDocx([
      "Roll No: 101",
      "Student Name: Sharma Rahul Kumar",
      "Source Code:",
      "def rahul_algorithm():",
      "    uploader_name = 'Rahul'",
      "    return uploader_name",
      "Output:-",
      "Result of execution: Success",
      "Roll No: 101",
    ]);

    const res = await templatize(docxBuf, {
      fullName: "Sharma Rahul Kumar",
      firstName: "Rahul",
      middleName: "Kumar",
      surname: "Sharma",
      rollNumber: "101",
      batch: "P1",
      folderName: "assign",
      fileDate: "2026-09-09",
    });

    const templateZip = await loadDocx(res.templateBuffer);
    const templateText = (await extractDocxText(templateZip)).fullText;

    // Source code lines must remain verbatim
    assert.ok(
      templateText.includes("def rahul_algorithm():"),
      "Function name in source code must not be replaced with placeholder"
    );
    assert.ok(
      templateText.includes("uploader_name = 'Rahul'"),
      "Variable value in source code must not be replaced with placeholder"
    );

    // Student info header WAS replaced
    assert.ok(
      templateText.includes("Student Name: {{NAME"),
      "Student Name in header must still be replaced with placeholder"
    );
  });
});
