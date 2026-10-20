CREATE TABLE "coloring_drawings" (
	"user_id" uuid NOT NULL,
	"art_id" text NOT NULL,
	"base_seq" integer DEFAULT 0 NOT NULL,
	"base_image" "bytea",
	"ops" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cursor" integer DEFAULT 0 NOT NULL,
	"progress" real DEFAULT 0 NOT NULL,
	"thumbnail" "bytea",
	"thumbnail_updated_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coloring_drawings_user_id_art_id_pk" PRIMARY KEY("user_id","art_id")
);
--> statement-breakpoint
ALTER TABLE "coloring_drawings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coloring_drawings" ADD CONSTRAINT "coloring_drawings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coloring_drawings" ADD CONSTRAINT "coloring_drawings_art_id_coloring_arts_id_fk" FOREIGN KEY ("art_id") REFERENCES "public"."coloring_arts"("id") ON DELETE cascade ON UPDATE no action;