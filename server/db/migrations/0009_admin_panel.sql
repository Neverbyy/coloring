CREATE TABLE "admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "admins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "coloring_art_countries" (
	"art_id" text NOT NULL,
	"country" text NOT NULL,
	CONSTRAINT "coloring_art_countries_art_id_country_pk" PRIMARY KEY("art_id","country")
);
--> statement-breakpoint
ALTER TABLE "coloring_art_countries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "coloring_art_opens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coloring_art_opens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"art_id" text NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coloring_art_opens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "coloring_art_users" (
	"art_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "coloring_art_users_art_id_user_id_pk" PRIMARY KEY("art_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "coloring_art_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coloring_arts" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coloring_arts" ADD COLUMN "audience" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coloring_art_countries" ADD CONSTRAINT "coloring_art_countries_art_id_coloring_arts_id_fk" FOREIGN KEY ("art_id") REFERENCES "public"."coloring_arts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coloring_art_opens" ADD CONSTRAINT "coloring_art_opens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coloring_art_opens" ADD CONSTRAINT "coloring_art_opens_art_id_coloring_arts_id_fk" FOREIGN KEY ("art_id") REFERENCES "public"."coloring_arts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coloring_art_users" ADD CONSTRAINT "coloring_art_users_art_id_coloring_arts_id_fk" FOREIGN KEY ("art_id") REFERENCES "public"."coloring_arts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coloring_art_users" ADD CONSTRAINT "coloring_art_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_idx" ON "admin_sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "coloring_art_opens_art_idx" ON "coloring_art_opens" USING btree ("art_id","opened_at");--> statement-breakpoint
CREATE INDEX "coloring_art_opens_user_idx" ON "coloring_art_opens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "coloring_art_users_user_idx" ON "coloring_art_users" USING btree ("user_id");--> statement-breakpoint
-- Уже опубликованные общие арты (три базовых) — опубликованы, а не черновики
UPDATE "coloring_arts" SET "published_at" = "created_at" WHERE "published" AND "owner_id" IS NULL;
