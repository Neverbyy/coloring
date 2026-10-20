CREATE TABLE "coloring_arts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"title" text NOT NULL,
	"image_url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coloring_arts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "coloring_arts_gallery_idx" ON "coloring_arts" USING btree ("published","sort_order","created_at");