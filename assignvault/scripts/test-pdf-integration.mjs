import fs from "fs";
import path from "path";

async function testPdfIntegration() {
  console.log("=== 1. Testing Scanned/Blank PDF Rejection ===");
  const blankPdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n" +
    "xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n" +
    "trailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF"
  );

  const scanFormData = new FormData();
  scanFormData.append("subject", "basic-python");
  scanFormData.append("assignmentNumber", "1");
  scanFormData.append("batch", "P1");
  scanFormData.append("fullName", "Jayesh Ghagare");
  scanFormData.append("rollNumber", "24BCS042");
  scanFormData.append("folderName", "Assignment_1");
  scanFormData.append("fileDate", "2026-09-15");
  scanFormData.append("file", new Blob([blankPdf], { type: "application/pdf" }), "scanned.pdf");

  const scanRes = await fetch("http://localhost:3005/api/upload", {
    method: "POST",
    body: scanFormData,
  });

  const scanJson = await scanRes.json();
  console.log("Scanned PDF HTTP Status:", scanRes.status);
  console.log("Scanned PDF Response:", scanJson);

  console.log("\n=== 2. Testing Genuine Text-Based PDF Conversion ===");
  const pdfFilePath = path.join(process.cwd(), "scripts", "sample_assignment.pdf");
  const pdfBytes = fs.readFileSync(pdfFilePath);

  const validFormData = new FormData();
  validFormData.append("subject", "basic-python");
  validFormData.append("assignmentNumber", "1");
  validFormData.append("batch", "P1");
  validFormData.append("fullName", "Jayesh Prashant Ghagare");
  validFormData.append("rollNumber", "24BCS042");
  validFormData.append("folderName", "python-assign");
  validFormData.append("fileDate", "2026-09-15");
  validFormData.append("terminalOutput", "Squares dictionary: {1: 1, 2: 4, 3: 9, 4: 16, 5: 25}");
  validFormData.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "Python_Assignment_1.pdf");

  const validRes = await fetch("http://localhost:3005/api/upload", {
    method: "POST",
    body: validFormData,
  });

  const validJson = await validRes.json();
  console.log("Valid PDF HTTP Status:", validRes.status);
  console.log("Valid PDF Response:", validJson);
}

testPdfIntegration().catch(console.error);
