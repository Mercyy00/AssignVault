import fs from "fs";
import path from "path";
import JSZip from "jszip";

async function createSampleDocx() {
  const zip = new JSZip();

  // [Content_Types].xml
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`
  );

  // _rels/.rels
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
  );

  // word/_rels/document.xml.rels
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
  <Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/output1.png"/>
</Relationships>`
  );

  // word/media/output1.png (dummy 1x1 PNG)
  const dummyPng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  zip.file("word/media/output1.png", dummyPng);

  // word/header1.xml
  zip.file(
    "word/header1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:r><w:t>Roll Number: 24BCS042 | Batch: P1 | Python Practical</w:t></w:r>
  </w:p>
</w:hdr>`
  );

  // word/footer1.xml
  zip.file(
    "word/footer1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:r><w:t>Submitted on 15/09/2026 by Jayesh Prashant Ghagare</w:t></w:r>
  </w:p>
</w:ftr>`
  );

  // word/document.xml
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>DEPARTMENT OF COMPUTER SCIENCE</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>PRACTICAL ASSIGNMENT NO. 01</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    
    <!-- Table with Student Info -->
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Student Name:</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Jayesh </w:t></w:r><w:r><w:t>Prashant </w:t></w:r><w:r><w:t>Ghagare</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Roll No:</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>24BCS042</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Batch &amp; Date:</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Batch: P1, Date of Submission: 2026-09-15</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    
    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Problem Statement:</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Write a Python program to demonstrate basic data types, lists, and string manipulation.</w:t></w:r>
    </w:p>
    
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Execution &amp; Terminal Path:</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>The script was executed from C:\\Users\\jayesh\\Desktop\\python-assign\\assignment1.py</w:t></w:r>
    </w:p>

    <!-- Textbox note -->
    <w:txbxContent>
      <w:p>
        <w:r><w:t>Verified by Lab Assistant for Batch P1 on 15 September 2026</w:t></w:r>
      </w:p>
    </w:txbxContent>

    <w:p>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Output Screenshot:</w:t></w:r>
    </w:p>
    <w:p>
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
  </w:body>
</w:document>`
  );

  // docProps/core.xml
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>Python Practical Assignment 1</dc:title>
  <dc:creator>Jayesh Prashant Ghagare</dc:creator>
  <cp:lastModifiedBy>Jayesh Prashant Ghagare</cp:lastModifiedBy>
</cp:coreProperties>`
  );

  // docProps/app.xml
  zip.file(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Company>Modern College of Arts, Science and Commerce</Company>
  <Manager>Jayesh Prashant Ghagare</Manager>
</Properties>`
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const targetPath = path.join(process.cwd(), "scripts", "sample_assignment.docx");
  fs.writeFileSync(targetPath, buffer);
  console.log(`Successfully created sample docx at ${targetPath}`);
}

createSampleDocx().catch(console.error);
