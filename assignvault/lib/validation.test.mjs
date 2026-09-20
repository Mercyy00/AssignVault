import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fullNameSchema,
  rollNumberSchema,
  folderNameSchema,
  downloadFormSchema,
  ROLL_NUMBER_REGEX,
} from "./validation.ts";

describe("Validation Rules", () => {
  describe("Full Name", () => {
    it("should accept valid 2-word and 3-word names", () => {
      assert.ok(fullNameSchema.safeParse("Jayesh Ghagare").success);
      assert.ok(fullNameSchema.safeParse("Jayesh Prashant Ghagare").success);
      assert.ok(fullNameSchema.safeParse("A. P. J. Abdul Kalam").success);
      assert.ok(fullNameSchema.safeParse("Mary-Jane Watson").success);
    });

    it("should reject single-word names", () => {
      const result = fullNameSchema.safeParse("Jayesh");
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.issues[0].message.includes("at least 2 words"));
      }
    });

    it("should reject names shorter than 3 characters or with illegal characters", () => {
      assert.strictEqual(fullNameSchema.safeParse("J").success, false);
      assert.strictEqual(fullNameSchema.safeParse("Jayesh @123").success, false);
      assert.strictEqual(fullNameSchema.safeParse("Jayesh #$").success, false);
    });
  });

  describe("Roll Number", () => {
    it("should accept valid alphanumeric roll numbers", () => {
      assert.ok(rollNumberSchema.safeParse("1").success);
      assert.ok(rollNumberSchema.safeParse("42").success);
      assert.ok(rollNumberSchema.safeParse("24BCS042").success);
      assert.ok(rollNumberSchema.safeParse("P123").success);
    });

    it("should reject roll numbers with symbols or exceeding 12 characters", () => {
      assert.strictEqual(rollNumberSchema.safeParse("").success, false);
      assert.strictEqual(rollNumberSchema.safeParse("24-BCS-042").success, false);
      assert.strictEqual(rollNumberSchema.safeParse("24BCS000000042").success, false);
    });

    it("should match constant ROLL_NUMBER_REGEX", () => {
      assert.ok(ROLL_NUMBER_REGEX.test("24BCS042"));
      assert.strictEqual(ROLL_NUMBER_REGEX.test("invalid roll!"), false);
    });
  });

  describe("Folder Name", () => {
    it("should accept valid folder names", () => {
      assert.ok(folderNameSchema.safeParse("jayesh").success);
      assert.ok(folderNameSchema.safeParse("24BCS042").success);
      assert.ok(folderNameSchema.safeParse("Assignment_1").success);
      assert.ok(folderNameSchema.safeParse("my-code-repo").success);
    });

    it("should reject illegal characters like slashes, colons, asterisks", () => {
      assert.strictEqual(folderNameSchema.safeParse("jayesh/project").success, false);
      assert.strictEqual(folderNameSchema.safeParse("jayesh\\project").success, false);
      assert.strictEqual(folderNameSchema.safeParse("C:").success, false);
      assert.strictEqual(folderNameSchema.safeParse("test*dir").success, false);
      assert.strictEqual(folderNameSchema.safeParse("dir?").success, false);
      assert.strictEqual(folderNameSchema.safeParse("").success, false);
      assert.strictEqual(folderNameSchema.safeParse("   ").success, false);
    });
  });

  describe("Download Form Schema", () => {
    it("should validate a complete and correct form", () => {
      const data = {
        subject: "csharp",
        assignmentNumber: "1",
        batch: "P1",
        fullName: "Jayesh Ghagare",
        rollNumber: "24BCS042",
        folderName: "jayesh",
        customDate: "2026-09-20",
      };
      assert.ok(downloadFormSchema.safeParse(data).success);
    });

    it("should reject when required fields are missing", () => {
      const data = {
        subject: "",
        assignmentNumber: "",
        batch: "",
        fullName: "Jayesh",
        rollNumber: "",
        folderName: "C:/wrong",
      };
      const res = downloadFormSchema.safeParse(data);
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error.issues.length >= 4);
      }
    });
  });
});
