-- Базовые арты галереи. Картинки лежат в public/arts
INSERT INTO "coloring_arts" ("id", "title", "image_url", "sort_order") VALUES
	('octopus', 'Осьминог', '/arts/octopus.png', 1),
	('cat', 'Кошка', '/arts/cat.png', 2),
	('house', 'Дом', '/arts/house.png', 3)
ON CONFLICT ("id") DO NOTHING;
