CREATE TABLE IF NOT EXISTS "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "categories_name_key" UNIQUE ("name"),
    CONSTRAINT "categories_slug_key" UNIQUE ("slug")
);

-- Seed existing tags as categories
INSERT INTO "categories" ("id", "name", "slug", "sortOrder")
SELECT gen_random_uuid()::text, 'VPN', 'vpn', 1
WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'vpn');

INSERT INTO "categories" ("id", "name", "slug", "sortOrder")
SELECT gen_random_uuid()::text, 'TMA', 'tma', 2
WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'tma');

INSERT INTO "categories" ("id", "name", "slug", "sortOrder")
SELECT gen_random_uuid()::text, 'CS2', 'cs2', 3
WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'cs2');

INSERT INTO "categories" ("id", "name", "slug", "sortOrder")
SELECT gen_random_uuid()::text, 'Clario', 'clario', 4
WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'clario');

INSERT INTO "categories" ("id", "name", "slug", "sortOrder")
SELECT gen_random_uuid()::text, 'Общее', 'general', 5
WHERE NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'general');
