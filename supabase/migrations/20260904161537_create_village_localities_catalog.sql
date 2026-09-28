CREATE TABLE IF NOT EXISTS village_localities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    village_id UUID NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
    locality_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active',
    source TEXT NOT NULL DEFAULT 'Panchayat Cadastral Survey',
    verified_on DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_village_locality UNIQUE (village_id, locality_name)
);

ALTER TABLE village_localities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'village_localities' AND policyname = 'Allow public read access on village_localities'
    ) THEN
        CREATE POLICY "Allow public read access on village_localities"
        ON village_localities FOR SELECT
        TO anon, authenticated
        USING (true);
    END IF;
END $$;

INSERT INTO village_localities (village_id, locality_name, status, source)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'East Weavers Colony', 'Active', 'Gram Panchayat Electoral Roll 2024'),
    ('00000000-0000-0000-0000-000000000001', 'Central Bazaar', 'Active', 'Gram Panchayat Cadastral Map'),
    ('00000000-0000-0000-0000-000000000001', 'North Ward', 'Active', 'Gram Panchayat Revenue Register'),
    ('00000000-0000-0000-0000-000000000001', 'Harijanawada', 'Active', 'Habitation Survey Record'),
    ('00000000-0000-0000-0000-000000000001', 'Main Road', 'Active', 'Public Works Ward Survey')
ON CONFLICT (village_id, locality_name) DO NOTHING;
