ALTER TABLE "coloring_arts" ADD COLUMN "svg_hash" text;--> statement-breakpoint
-- Отпечатки уже загруженных SVG (так же, как считает сервер: SHA-256 от UTF-8, hex).
-- Из повторов отпечаток получает только самый старый; остальные остаются (в них могут быть рисунки),
-- игрок удалит их сам — уникальный индекс пропускает NULL
UPDATE "coloring_arts" AS art SET "svg_hash" = hashed.hash
FROM (
	SELECT "id", encode(sha256(convert_to("svg", 'UTF8')), 'hex') AS hash,
		row_number() OVER (PARTITION BY "owner_id", encode(sha256(convert_to("svg", 'UTF8')), 'hex') ORDER BY "created_at", "id") AS rank
	FROM "coloring_arts"
	WHERE "svg" IS NOT NULL
) AS hashed
WHERE art."id" = hashed."id" AND hashed.rank = 1;--> statement-breakpoint
CREATE UNIQUE INDEX "coloring_arts_owner_svg_idx" ON "coloring_arts" USING btree ("owner_id","svg_hash");
