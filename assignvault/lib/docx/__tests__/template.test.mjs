import { describe, it } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";
import { templatize } from "../templatize.ts";
import { loadDocx } from "../unzip.ts";
import { extractDocxText } from "../extractText.ts";

/**
 * Helper to construct an in-memory synthetic DOCX package with custom body,
 * headers, footers, and metadata for rigorous template engine testing.
 */
async function createFixtureDocx({
  bodyXml,
  headerXml,
  footerXml,
  author = "Jayesh Prashant Ghagare",
  company = "Modern BCS College",
  mediaImages = [],
}) {
  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
     <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
       <Default Extension="xml" ContentType="application/xml"/>
       <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
       <Default Extension="png" ContentType="image/png"/>
       <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
       ${headerXml ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : ""}
       ${footerXml ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : ""}
       <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
       <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
     </Types>`
  );

  // 2. _rels/.rels
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
     <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
       <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
       <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
       <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
     </Relationships>`
  );

  // 3. word/_rels/document.xml.rels
  let docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
  if (headerXml) {
    docRels += `<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>`;
  }
  if (footerXml) {
    docRels += `<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>`;
  }
  for (const img of mediaImages) {
    docRels += `<Relationship Id="${img.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${img.target}"/>`;
    zip.file(`word/${img.target}`, Buffer.from([0x89, 0x50, 0x4e, 0x47])); // dummy PNG bytes
  }
  docRels += `</Relationships>`;
  zip.file("word/_rels/document.xml.rels", docRels);

  // 4. word/document.xml
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
     <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
                 xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
                 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
       <w:body>${bodyXml}</w:body>
     </w:document>`
  );

  // 5. Headers & Footers if supplied
  if (headerXml) {
    zip.file(
      "word/header1.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
       <w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${headerXml}</w:hdr>`
    );
  }
  if (footerXml) {
    zip.file(
      "word/footer1.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
       <w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${footerXml}</w:ftr>`
    );
  }

  // 6. docProps/core.xml & app.xml
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
     <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                        xmlns:dc="http://purl.org/dc/elements/1.1/">
       <dc:creator>${author}</dc:creator>
       <cp:lastModifiedBy>${author}</cp:lastModifiedBy>
     </cp:coreProperties>`
  );
  zip.file(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
     <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
       <Company>${company}</Company>
       <Manager>${author}</Manager>
     </Properties>`
  );

  return await zip.generateAsync({ type: "nodebuffer" });
}

describe("Step 5: Template Engine (Transform Completed Assignments into Templates)", () => {
  const uploader = {
    fullName: "Jayesh Prashant Ghagare",
    rollNumber: "24BCS042",
    batch: "P1",
    folderName: "jayesh",
    fileDate: "2026-09-15",
  };

  it("1. should detect and replace name split across three consecutive runs", async () => {
    // "Jayesh" + " " + "Prashant Ghagare" across runs
    const body = `
      <w:p>
        <w:r><w:rPr><w:b/></w:rPr><w:t>Student Name: </w:t></w:r>
        <w:r><w:rPr><w:b/><w:color w:val="FF0000"/></w:rPr><w:t>Jayesh</w:t></w:r>
        <w:r><w:t> </w:t></w:r>
        <w:r><w:rPr><w:b/></w:rPr><w:t>Prashant Ghagare</w:t></w:r>
      </w:p>
    `;
    const docx = await createFixtureDocx({ bodyXml: body });
    const result = await templatize(docx, uploader);

    const parsed = await extractDocxText(await loadDocx(result.templateBuffer));
    assert.ok(parsed.fullText.includes("{{NAME|order=F-M-L|case=title}}"));
    assert.strictEqual(parsed.fullText.includes("Jayesh Prashant Ghagare"), false);
    assert.strictEqual(result.report.placeholderCounts.NAME.total, 1);
  });

  it("2. should detect UPPERCASE and lowercase name variants", async () => {
    const body = `
      <w:p><w:r><w:t>SUBMITTED BY: JAYESH PRASHANT GHAGARE</w:t></w:r></w:p>
      <w:p><w:r><w:t>Contact: jayesh prashant ghagare@college.edu</w:t></w:r></w:p>
    `;
    const docx = await createFixtureDocx({ bodyXml: body });
    const result = await templatize(docx, uploader);

    const parsed = await extractDocxText(await loadDocx(result.templateBuffer));
    assert.ok(parsed.fullText.includes("{{NAME|order=F-M-L|case=upper}}"));
    assert.ok(parsed.fullText.includes("{{NAME|order=F-M-L|case=lower}}"));
    assert.strictEqual(result.report.placeholderCounts.NAME.total, 2);
  });

  it("3. should detect surname-first order (L-F-M and L-F)", async () => {
    const body = `
      <w:p><w:r><w:t>Candidate: Ghagare Jayesh Prashant</w:t></w:r></w:p>
      <w:p><w:r><w:t>Short: Ghagare Jayesh</w:t></w:r></w:p>
    `;
    const docx = await createFixtureDocx({ bodyXml: body });
    const result = await templatize(docx, uploader);

    const parsed = await extractDocxText(await loadDocx(result.templateBuffer));
    assert.ok(parsed.fullText.includes("{{NAME|order=L-F-M|case=title}}"));
    assert.ok(parsed.fullText.includes("{{NAME|order=L-F|case=title}}"));
  });

  it("4. should replace roll number in header and footer", async () => {
    const header = `<w:p><w:r><w:t>Roll No: 24BCS042 | Practical 1</w:t></w:r></w:p>`;
    const footer = `<w:p><w:r><w:t>Page 1 of 5 - Student: 24BCS042</w:t></w:r></w:p>`;
    const body = `<w:p><w:r><w:t>Content body</w:t></w:r></w:p>`;

    const docx = await createFixtureDocx({ bodyXml: body, headerXml: header, footerXml: footer });
    const result = await templatize(docx, uploader);

    assert.strictEqual(result.report.placeholderCounts.ROLL.total, 2);
    assert.strictEqual(result.report.placeholderCounts.ROLL.locations.header, 1);
    assert.strictEqual(result.report.placeholderCounts.ROLL.locations.footer, 1);

    const zip = await loadDocx(result.templateBuffer);
    const headerContent = await zip.file("word/header1.xml").async("string");
    const footerContent = await zip.file("word/footer1.xml").async("string");

    assert.ok(headerContent.includes("{{ROLL}}"));
    assert.ok(footerContent.includes("{{ROLL}}"));
  });

  it("5. should replace roll number and details inside a table cell and text box", async () => {
    const body = `
      <w:tbl>
        <w:tr>
          <w:tc>
            <w:p><w:r><w:t>Roll: 24BCS042</w:t></w:r></w:p>
          </w:tc>
        </w:tr>
      </w:tbl>
      <w:txbxContent>
        <w:p><w:r><w:t>Batch: P1</w:t></w:r></w:p>
      </w:txbxContent>
    `;
    const docx = await createFixtureDocx({ bodyXml: body });
    const result = await templatize(docx, uploader);

    assert.strictEqual(result.report.placeholderCounts.ROLL.locations.table, 1);
    assert.strictEqual(result.report.placeholderCounts.BATCH.locations.textbox, 1);
  });

  it("6. should detect dates in multiple formats (DD/MM/YYYY, YYYY-MM-DD, D MMMM YYYY)", async () => {
    const body = `
      <w:p><w:r><w:t>Date 1: 15/09/2026</w:t></w:r></w:p>
      <w:p><w:r><w:t>Date 2: 2026-09-15</w:t></w:r></w:p>
      <w:p><w:r><w:t>Date 3: 15 September 2026</w:t></w:r></w:p>
    `;
    const docx = await createFixtureDocx({ bodyXml: body });
    const result = await templatize(docx, uploader);

    const parsed = await extractDocxText(await loadDocx(result.templateBuffer));
    assert.ok(parsed.fullText.includes("{{DATE|fmt=DD/MM/YYYY}}"));
    assert.ok(parsed.fullText.includes("{{DATE|fmt=YYYY-MM-DD}}"));
    assert.ok(parsed.fullText.includes("{{DATE|fmt=DD MMMM YYYY}}") || parsed.fullText.includes("{{DATE|fmt=D MMMM YYYY}}"));
    assert.strictEqual(result.report.placeholderCounts.DATE.total, 3);
  });

  it("7. should disambiguate folder vs name token in file path context", async () => {
    // Uploader first name is "Jayesh", and folder name is "jayesh"
    const body = `
      <w:p><w:r><w:t>Terminal Path: C:\\Users\\jayesh\\Desktop\\assignment></w:t></w:r></w:p>
      <w:p><w:r><w:t>Programmer: Jayesh</w:t></w:r></w:p>
    `;
    const docx = await createFixtureDocx({ bodyXml: body });
    const result = await templatize(docx, uploader);

    const parsed = await extractDocxText(await loadDocx(result.templateBuffer));
    assert.ok(parsed.fullText.includes("C:\\Users\\{{FOLDER|case=lower}}\\Desktop\\assignment>"));
    assert.ok(parsed.fullText.includes("Programmer: {{NAME|order=F|case=title}}"));
  });

  it("8. should NOT match roll number inside a longer number", async () => {
    const shortRollUploader = {
      ...uploader,
      rollNumber: "12",
    };
    const body = `
      <w:p><w:r><w:t>The year was 2012, and the serial was 12345.</w:t></w:r></w:p>
      <w:p><w:r><w:t>Student Roll: 12</w:t></w:r></w:p>
    `;
    const docx = await createFixtureDocx({ bodyXml: body });
    const result = await templatize(docx, shortRollUploader);

    const parsed = await extractDocxText(await loadDocx(result.templateBuffer));
    // Must NOT replace inside 2012 or 12345
    assert.ok(parsed.fullText.includes("2012"));
    assert.ok(parsed.fullText.includes("12345"));
    assert.ok(parsed.fullText.includes("Student Roll: {{ROLL}}"));
    assert.strictEqual(result.report.placeholderCounts.ROLL.total, 1);
  });

  it("9. should scrub author, modifier, company and manager from metadata", async () => {
    const body = `<w:p><w:r><w:t>Clean document content</w:t></w:r></w:p>`;
    const docx = await createFixtureDocx({ bodyXml: body });
    const result = await templatize(docx, uploader);

    const zip = await loadDocx(result.templateBuffer);
    const coreXml = await zip.file("docProps/core.xml").async("string");
    const appXml = await zip.file("docProps/app.xml").async("string");

    assert.strictEqual(coreXml.includes("Jayesh Prashant Ghagare"), false);
    assert.strictEqual(appXml.includes("Modern BCS College"), false);
    assert.strictEqual(appXml.includes("Jayesh Prashant Ghagare"), false);
  });

  it("10. should inventory images with dimensions and media path", async () => {
    const body = `
      <w:p>
        <w:r><w:t>Program execution screenshot:</w:t></w:r>
        <w:drawing>
          <wp:inline>
            <wp:extent cx="5486400" cy="3086100"/>
            <a:graphic>
              <a:graphicData>
                <a:blip r:embed="rIdImg1"/>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:p>
    `;
    const mediaImages = [{ id: "rIdImg1", target: "media/screenshot1.png" }];
    const docx = await createFixtureDocx({ bodyXml: body, mediaImages });
    const result = await templatize(docx, uploader);

    assert.strictEqual(result.report.outputImages.length, 1);
    const img = result.report.outputImages[0];
    assert.strictEqual(img.relationshipId, "rIdImg1");
    assert.strictEqual(img.mediaPath, "word/media/screenshot1.png");
    assert.strictEqual(img.widthEmu, 5486400);
    assert.strictEqual(img.heightEmu, 3086100);
  });

  it("11. should produce an output package where every XML part is well-formed XML", async () => {
    const body = `
      <w:p><w:r><w:t>Name: Jayesh Prashant Ghagare</w:t></w:r></w:p>
      <w:p><w:r><w:t>Roll: 24BCS042</w:t></w:r></w:p>
    `;
    const docx = await createFixtureDocx({ bodyXml: body });
    const result = await templatize(docx, uploader);

    const zip = await loadDocx(result.templateBuffer);
    const parser = new DOMParser({
      onError: (level, msg) => {
        throw new Error(`XML Parse Error [${level}]: ${msg}`);
      },
    });

    const xmlFiles = Object.keys(zip.files).filter((f) => f.endsWith(".xml"));
    for (const f of xmlFiles) {
      const xmlStr = await zip.file(f).async("string");
      assert.doesNotThrow(() => {
        parser.parseFromString(xmlStr, "text/xml");
      }, `Failed to parse ${f} as well-formed XML`);
    }
  });
});
