CREATE TABLE "coloring_ops" (
	"user_id" uuid NOT NULL,
	"art_id" text NOT NULL,
	"seq" integer NOT NULL,
	"op" jsonb NOT NULL,
	CONSTRAINT "coloring_ops_user_id_art_id_seq_pk" PRIMARY KEY("user_id","art_id","seq")
);
--> statement-breakpoint
ALTER TABLE "coloring_ops" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "coloring_progress" (
	"user_id" uuid NOT NULL,
	"art_id" text NOT NULL,
	"head" integer DEFAULT 0 NOT NULL,
	"cursor" integer DEFAULT 0 NOT NULL,
	"progress" real DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coloring_progress_user_id_art_id_pk" PRIMARY KEY("user_id","art_id")
);
--> statement-breakpoint
ALTER TABLE "coloring_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "coloring_snapshots" (
	"user_id" uuid NOT NULL,
	"art_id" text NOT NULL,
	"seq" integer NOT NULL,
	"image" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coloring_snapshots_user_id_art_id_seq_pk" PRIMARY KEY("user_id","art_id","seq")
);
--> statement-breakpoint
ALTER TABLE "coloring_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coloring_arts" ADD COLUMN "width" integer DEFAULT 1024 NOT NULL;--> statement-breakpoint
ALTER TABLE "coloring_arts" ADD COLUMN "height" integer DEFAULT 1024 NOT NULL;--> statement-breakpoint
ALTER TABLE "coloring_ops" ADD CONSTRAINT "coloring_ops_user_id_art_id_coloring_progress_user_id_art_id_fk" FOREIGN KEY ("user_id","art_id") REFERENCES "public"."coloring_progress"("user_id","art_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coloring_progress" ADD CONSTRAINT "coloring_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coloring_progress" ADD CONSTRAINT "coloring_progress_art_id_coloring_arts_id_fk" FOREIGN KEY ("art_id") REFERENCES "public"."coloring_arts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coloring_snapshots" ADD CONSTRAINT "coloring_snapshots_user_id_art_id_coloring_progress_user_id_art_id_fk" FOREIGN KEY ("user_id","art_id") REFERENCES "public"."coloring_progress"("user_id","art_id") ON DELETE cascade ON UPDATE no action;