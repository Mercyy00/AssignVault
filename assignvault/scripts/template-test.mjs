import fs from "fs";
import path from "path";
import { templatize } from "../lib/docx/templatize.ts";

function parseArgs() {
  const args = process.argv.slice(2);
  let filePath = "";
  let name = "";
  let first = "";
  let middle = "";
  let surname = "";
  let roll = "";
  let batch = "";
  let folder = "";
  let date = "";
  let outPath = "out.docx";
  let isConvertedFromPdf = false;
  let isBlank = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--name" && i + 1 < args.length) {
      name = args[++i];
    } else if (arg === "--first" && i + 1 < args.length) {
      first = args[++i];
    } else if (arg === "--middle" && i + 1 < args.length) {
      middle = args[++i];
    } else if (arg === "--surname" && i + 1 < args.length) {
      surname = args[++i];
    } else if (arg === "--roll" && i + 1 < args.length) {
      roll = args[++i];
    } else if (arg === "--batch" && i + 1 < args.length) {
      batch = args[++i];
    } else if (arg === "--folder" && i + 1 < args.length) {
      folder = args[++i];
    } else if (arg === "--date" && i + 1 < args.length) {
      date = args[++i];
    } else if (arg === "--out" && i + 1 < args.length) {
      outPath = args[++i];
    } else if (arg === "--pdf" || arg === "--converted") {
      isConvertedFromPdf = true;
    } else if (arg === "--blank") {
      isBlank = true;
    } else if (!arg.startsWith("--") && !filePath) {
      filePath = arg;
    }
  }

  // Combine first/middle/surname if passed
  if (!name && (first || surname)) {
    name = [surname, first, middle].filter(Boolean).join(" ");
  }

  return { filePath, name, roll, batch, folder, date, outPath, isConvertedFromPdf, isBlank };
}

async function main() {
  const { filePath, name, roll, batch, folder, date, outPath, isConvertedFromPdf, isBlank } = parseArgs();

  if (!filePath || (!isBlank && (!name || !roll))) {
    console.log("AssignVault Template Engine Test CLI\n");
    console.log("Usage:");
    console.log("  Filled assignment:");
    console.log("    npm run template:test -- <file.docx> --first <First> --middle <Middle> --surname <Surname> --roll <Roll> [--batch <Batch>] [--date <Date>] [--pdf]\n");
    console.log("  Blank assignment:");
    console.log("    npm run template:test -- <file.docx> --blank [--out <out.docx>]\n");
    console.log("Example:");
    console.log("  npm run template:test -- fixtures/python_assignment_04_FILLED_anonymized.docx --first Rahul --middle Kumar --surname Sharma --roll 101 --batch P1 --date 2026-09-09");
    process.exit(1);
  }

  // Resolve file path across standard search locations
  let resolvedInputPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedInputPath)) {
    const alternate1 = path.resolve("fixtures", path.basename(filePath));
    const alternate2 = path.resolve("../assignvault-steps/fixtures", path.basename(filePath));
    if (fs.existsSync(alternate1)) {
      resolvedInputPath = alternate1;
    } else if (fs.existsSync(alternate2)) {
      resolvedInputPath = alternate2;
    } else {
      console.error(`Error: File not found at ${resolvedInputPath}`);
      process.exit(1);
    }
  }

  console.log(`Reading input document: ${resolvedInputPath}...`);
  const inputBuffer = fs.readFileSync(resolvedInputPath);

  console.log("Templatizing document...");
  const startTime = Date.now();

  const result = await templatize(
    inputBuffer,
    {
      fullName: name || "Student Name",
      rollNumber: roll || "101",
      batch: batch || "P1",
      folderName: folder || "assign",
      fileDate: date || new Date().toISOString().split("T")[0],
    },
    {
      isConvertedFromPdf,
    }
  );

  const duration = Date.now() - startTime;
  const resolvedOutPath = path.resolve(outPath);
  fs.writeFileSync(resolvedOutPath, result.templateBuffer);

  console.log(`\n======================================================`);
  console.log(`  ASSIGNVAULT TEMPLATE ENGINE REPORT`);
  console.log(`======================================================`);
  console.log(`Processing Time: ${duration} ms`);
  console.log(`Output Written:  ${resolvedOutPath}`);
  console.log(`Needs Review:    ${result.needsReview ? "YES (Flagged)" : "NO (Approved)"}`);

  console.log(`\n--- Placeholder Counts ---`);
  console.table(
    Object.entries(result.report.placeholderCounts).reduce((acc, [key, data]) => {
      acc[key] = {
        Total: data.total,
        Body: data.locations.body,
        Header: data.locations.header,
        Footer: data.locations.footer,
        Table: data.locations.table,
        TextBox: data.locations.textbox,
      };
      return acc;
    }, {})
  );

  if (result.report.warnings.length > 0) {
    console.log(`\n--- Warnings (${result.report.warnings.length}) ---`);
    for (const w of result.report.warnings) {
      console.log(` [!] ${w}`);
    }
  } else {
    console.log(`\n--- Warnings: None (Clean Templating) ---`);
  }

  if (result.report.outputImages.length > 0) {
    console.log(`\n--- Image Inventory (${result.report.outputImages.length}) ---`);
    for (const img of result.report.outputImages) {
      console.log(` - Rel: ${img.relationshipId} | Media: ${img.mediaPath} | Dimensions: ${img.widthEmu}x${img.heightEmu} EMU | Paragraph: #${img.paragraphIndex}`);
    }
  }

  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error("Templatize CLI Failed:", err);
  process.exit(1);
});
