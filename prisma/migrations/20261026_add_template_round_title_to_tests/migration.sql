-- AlterTable: Add template_id, round, and title to tests table safely with defaults
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "template_id" UUID REFERENCES "test_templates"("id") ON DELETE SET NULL;
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "round" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255);

-- CreateIndex: Add indexes for round and template lookups
CREATE INDEX IF NOT EXISTS "tests_template_id_idx" ON "tests"("template_id");
CREATE INDEX IF NOT EXISTS "tests_round_idx" ON "tests"("round");
CREATE INDEX IF NOT EXISTS "tests_student_id_round_idx" ON "tests"("student_id", "round");
