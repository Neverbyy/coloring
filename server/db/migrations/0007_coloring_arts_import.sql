ALTER TABLE "coloring_arts" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "coloring_arts" ADD COLUMN "svg" text;--> statement-breakpoint
ALTER TABLE "coloring_arts" ADD CONSTRAINT "coloring_arts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coloring_arts_owner_idx" ON "coloring_arts" USING btree ("owner_id","created_at");