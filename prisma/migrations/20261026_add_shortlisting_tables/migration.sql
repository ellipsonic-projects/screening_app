-- Additive migration for Approach B Dynamic Candidate Shortlisting & Ranking

CREATE TABLE IF NOT EXISTS "shortlist_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "template_id" UUID REFERENCES "test_templates"("id") ON DELETE CASCADE,
  "round" INTEGER NOT NULL DEFAULT 1,
  "shortlist_size" INTEGER NOT NULL DEFAULT 10,
  "overall_cutoff_enabled" BOOLEAN NOT NULL DEFAULT false,
  "overall_cutoff_percentage" DECIMAL(5, 2) DEFAULT 60.0,
  "section_cutoffs" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "overall_weight" DECIMAL(5, 2) NOT NULL DEFAULT 50.0,
  "section_weight" DECIMAL(5, 2) NOT NULL DEFAULT 50.0,
  "category_weights" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "tie_break_rules" JSONB,
  "created_by" UUID REFERENCES "users"("id"),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "shortlist_settings_template_round_idx" 
ON "shortlist_settings" ("template_id", "round");

CREATE TABLE IF NOT EXISTS "published_shortlists" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "template_id" UUID REFERENCES "test_templates"("id") ON DELETE SET NULL,
  "round" INTEGER NOT NULL DEFAULT 1,
  "published_by" UUID REFERENCES "users"("id"),
  "shortlist_size" INTEGER NOT NULL,
  "config_snapshot" JSONB NOT NULL,
  "published_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "published_shortlists_template_round_idx" 
ON "published_shortlists" ("template_id", "round");

CREATE TABLE IF NOT EXISTS "shortlist_candidates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "shortlist_id" UUID NOT NULL REFERENCES "published_shortlists"("id") ON DELETE CASCADE,
  "student_id" UUID NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "test_id" UUID NOT NULL REFERENCES "tests"("id") ON DELETE CASCADE,
  "rank" INTEGER,
  "ranking_score" DECIMAL(6, 3),
  "overall_percentage" DECIMAL(5, 2),
  "section_percentages" JSONB,
  "status" VARCHAR(50) NOT NULL,
  "exclusion_reasons" JSONB,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "shortlist_candidates_shortlist_id_idx" 
ON "shortlist_candidates" ("shortlist_id");
CREATE INDEX IF NOT EXISTS "shortlist_candidates_student_id_idx" 
ON "shortlist_candidates" ("student_id");
CREATE INDEX IF NOT EXISTS "shortlist_candidates_test_id_idx" 
ON "shortlist_candidates" ("test_id");
