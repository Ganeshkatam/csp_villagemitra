-- 1. Create survey_questions table if not exists
CREATE TABLE IF NOT EXISTS survey_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_code TEXT UNIQUE NOT NULL,
    section TEXT NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL,
    options JSONB,
    required BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_questions_order ON survey_questions(display_order);

-- 2. Enhance survey_responses with interview timestamps and locality
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'survey_responses' AND column_name = 'locality_ward') THEN
        ALTER TABLE survey_responses ADD COLUMN locality_ward TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'survey_responses' AND column_name = 'started_at') THEN
        ALTER TABLE survey_responses ADD COLUMN started_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'survey_responses' AND column_name = 'completed_at') THEN
        ALTER TABLE survey_responses ADD COLUMN completed_at TIMESTAMPTZ;
    END IF;
END $$;

-- 3. Add status column to schemes, contacts, institutions, businesses
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schemes' AND column_name = 'status') THEN
        ALTER TABLE schemes ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'verified', 'published'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'status') THEN
        ALTER TABLE contacts ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'verified', 'published'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'institutions' AND column_name = 'status') THEN
        ALTER TABLE institutions ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'verified', 'published'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'status') THEN
        ALTER TABLE businesses ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'verified', 'published'));
    END IF;
END $$;

-- 4. Enable RLS and update policies
ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to schemes" ON schemes;
DROP POLICY IF EXISTS "Public read access to contacts" ON contacts;
DROP POLICY IF EXISTS "Public read access to institutions" ON institutions;
DROP POLICY IF EXISTS "Public read access to businesses" ON businesses;
DROP POLICY IF EXISTS "Public read published schemes" ON schemes;
DROP POLICY IF EXISTS "Public read published contacts" ON contacts;
DROP POLICY IF EXISTS "Public read published institutions" ON institutions;
DROP POLICY IF EXISTS "Public read published businesses" ON businesses;
DROP POLICY IF EXISTS "Public read survey questions" ON survey_questions;
DROP POLICY IF EXISTS "Admin manage survey questions" ON survey_questions;

CREATE POLICY "Public read survey questions"
    ON survey_questions FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Admin manage survey questions"
    ON survey_questions FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Public read published schemes"
    ON schemes FOR SELECT
    TO anon, authenticated
    USING (status = 'published');

CREATE POLICY "Public read published contacts"
    ON contacts FOR SELECT
    TO anon, authenticated
    USING (status = 'published');

CREATE POLICY "Public read published institutions"
    ON institutions FOR SELECT
    TO anon, authenticated
    USING (status = 'published');

CREATE POLICY "Public read published businesses"
    ON businesses FOR SELECT
    TO anon, authenticated
    USING (status = 'published');

-- 5. Drop and recreate View to calculate question-specific percentages
DROP VIEW IF EXISTS view_survey_metric_counts;

CREATE VIEW view_survey_metric_counts AS
SELECT 
    sa.question_code,
    sa.answer_value,
    COUNT(*)::INTEGER AS response_count,
    ROUND((COUNT(*)::NUMERIC / NULLIF((
        SELECT COUNT(*) 
        FROM survey_answers sub 
        WHERE sub.question_code = sa.question_code
    ), 0)) * 100, 1) AS percentage_of_question_answers
FROM survey_answers sa
GROUP BY sa.question_code, sa.answer_value
ORDER BY sa.question_code, response_count DESC;

-- 6. Remove dummy placeholder village record if exists
DELETE FROM villages WHERE name = '[Assigned Village Name]';

-- 7. Seed 21 CSP survey questions
INSERT INTO survey_questions (question_code, section, question_text, question_type, options, required, display_order)
VALUES
    ('D1', 'Demographics', 'Age Group of Respondent', 'single_choice', 
     '[{"value": "18-25", "label": "18 - 25 years"}, {"value": "26-40", "label": "26 - 40 years"}, {"value": "41-60", "label": "41 - 60 years"}, {"value": "Above-60", "label": "Above 60 years"}]'::jsonb, true, 1),
    ('D2', 'Demographics', 'Gender', 'single_choice', 
     '[{"value": "Male", "label": "Male"}, {"value": "Female", "label": "Female"}, {"value": "Other", "label": "Other / Prefer not to say"}]'::jsonb, true, 2),
    ('D3', 'Demographics', 'Primary Occupation of Household Head', 'single_choice', 
     '[{"value": "Agriculture", "label": "Agriculture / Farming"}, {"value": "Agri-Labor", "label": "Agricultural Laborer / Daily Wage"}, {"value": "Artisan-Trades", "label": "Artisan / Tradesperson"}, {"value": "Small-Business", "label": "Small Business / Vendor"}, {"value": "Salaried", "label": "Salaried Employment"}, {"value": "Other", "label": "Other"}]'::jsonb, true, 3),
    ('D4', 'Demographics', 'Highest Education Level in Household', 'single_choice', 
     '[{"value": "Non-Literate", "label": "Non-literate"}, {"value": "Primary", "label": "Primary School (1-5)"}, {"value": "Secondary", "label": "Secondary School (6-10)"}, {"value": "Higher-Secondary", "label": "Higher Secondary (11-12)"}, {"value": "Diploma", "label": "Diploma / Vocational"}, {"value": "Graduate-Plus", "label": "Graduate / Post-Graduate"}]'::jsonb, true, 4),
    ('D5', 'Demographics', 'Total Household Members', 'number', NULL, false, 5),
    ('TECH1', 'Digital Infrastructure', 'Working Smartphone Availability in Household', 'single_choice', 
     '[{"value": "Smartphone-Available", "label": "Yes, at least one working smartphone"}, {"value": "Basic-Phone-Only", "label": "Basic feature phone only"}, {"value": "No-Phone", "label": "No mobile phone"}]'::jsonb, true, 6),
    ('TECH2', 'Digital Infrastructure', 'Primary Internet Access Mode', 'single_choice', 
     '[{"value": "Mobile-Data-4G-5G", "label": "Mobile Data (4G / 5G)"}, {"value": "Mobile-Data-2G-3G", "label": "Mobile Data (2G / 3G low-bandwidth)"}, {"value": "Broadband-Wifi", "label": "Home Broadband / Wi-Fi"}, {"value": "No-Internet", "label": "No internet access"}]'::jsonb, true, 7),
    ('TECH3', 'Digital Infrastructure', 'Independent Digital Browsing & Reading', 'single_choice', 
     '[{"value": "Independent", "label": "Yes, independently"}, {"value": "Needs-Assistance", "label": "Yes, but requires assistance"}, {"value": "Completely-Dependent", "label": "No, relies on third parties / internet cafes"}]'::jsonb, true, 8),
    ('SCH1', 'Welfare Schemes', 'Primary Source for Learning About Welfare Schemes', 'single_choice', 
     '[{"value": "Word-Of-Mouth", "label": "Word of mouth"}, {"value": "Panchayat-Notices", "label": "Panchayat notices / Grama Sabha"}, {"value": "Intermediaries", "label": "Intermediaries / Middlemen"}, {"value": "CSC-Center", "label": "CSC / Internet Cafe"}, {"value": "Official-Websites", "label": "Official Government Portals"}, {"value": "Social-Media", "label": "Social Media (WhatsApp/YouTube)"}]'::jsonb, true, 9),
    ('SCH2', 'Welfare Schemes', 'Biggest Challenge When Applying for Schemes', 'single_choice', 
     '[{"value": "Unknown-Eligibility-Docs", "label": "Not knowing eligibility or required documents"}, {"value": "Repeated-Office-Visits", "label": "Repeated mandal visits due to missing paperwork"}, {"value": "Unsure-Official-Link", "label": "Uncertainty over whether link is genuine"}, {"value": "Intermediary-Fees", "label": "Paying fees to intermediaries"}, {"value": "No-Challenge", "label": "No challenge faced"}]'::jsonb, true, 10),
    ('SCH3', 'Welfare Schemes', 'Confusion Identifying Official Government Domains (.gov.in)', 'single_choice', 
     '[{"value": "Frequently-Confused", "label": "Frequently confused by private sites"}, {"value": "Sometimes-Unsure", "label": "Sometimes unsure"}, {"value": "Easily-Distinguishes", "label": "Can distinguish official portals easily"}, {"value": "Does-Not-Use", "label": "Does not use government websites"}]'::jsonb, true, 11),
    ('CON1_Panchayat', 'Emergency Contacts', 'Has Panchayat Secretary / Sarpanch Number Saved', 'single_choice', 
     '[{"value": "Yes", "label": "Yes"}, {"value": "No", "label": "No"}]'::jsonb, true, 12),
    ('CON1_PHC', 'Emergency Contacts', 'Has Primary Health Centre / Ambulance Number Saved', 'single_choice', 
     '[{"value": "Yes", "label": "Yes"}, {"value": "No", "label": "No"}]'::jsonb, true, 13),
    ('CON1_Police', 'Emergency Contacts', 'Has Police Station / Outpost Number Saved', 'single_choice', 
     '[{"value": "Yes", "label": "Yes"}, {"value": "No", "label": "No"}]'::jsonb, true, 14),
    ('CON1_Lineman', 'Emergency Contacts', 'Has Electricity Lineman / Water Operator Number Saved', 'single_choice', 
     '[{"value": "Yes", "label": "Yes"}, {"value": "No", "label": "No"}]'::jsonb, true, 15),
    ('CON2', 'Emergency Contacts', 'How Emergency Contacts Are Looked Up in Crisis', 'single_choice', 
     '[{"value": "Ask-Neighbors", "label": "Ask neighbors or acquaintances"}, {"value": "Visit-Panchayat", "label": "Visit Panchayat office or wall board"}, {"value": "Saved-In-Phone", "label": "Already saved in mobile phone"}, {"value": "Struggle-To-Find", "label": "Struggle to find the verified number quickly"}]'::jsonb, true, 16),
    ('HLTH1', 'Healthcare & Education', 'How Doctor Availability at PHC is Checked', 'single_choice', 
     '[{"value": "Visit-In-Person", "label": "Visit in person (risk doctor absence)"}, {"value": "Contact-ASHA-ANM", "label": "Contact ASHA worker / ANM"}, {"value": "Official-Board", "label": "Official notice board"}, {"value": "No-Way-To-Check", "label": "No reliable way to check beforehand"}]'::jsonb, true, 17),
    ('EDU1', 'Healthcare & Education', 'Ease of Obtaining School / Anganwadi Details', 'single_choice', 
     '[{"value": "Scattered-Hard", "label": "Scattered and requires in-person visits"}, {"value": "Easily-Accessible", "label": "Easily accessible"}, {"value": "Not-Applicable", "label": "Not applicable"}]'::jsonb, true, 18),
    ('BIZ1', 'Local Economy', 'How Village Tradespeople (Mechanic, Tailor, Electrician) Are Found', 'single_choice', 
     '[{"value": "Personal-Contacts", "label": "Rely on personal contacts / immediate ward"}, {"value": "Ask-At-Market", "label": "Ask around village bazaar"}, {"value": "Struggle-To-Find", "label": "Often struggle to find available skilled persons"}]'::jsonb, true, 19),
    ('BIZ2', 'Local Economy', 'Utility of Verified Village Business & SHG Directory', 'single_choice', 
     '[{"value": "Very-Helpful", "label": "Yes, very helpful"}, {"value": "Somewhat-Helpful", "label": "Somewhat helpful"}, {"value": "Not-Necessary", "label": "Not necessary"}]'::jsonb, true, 20),
    ('PRIO1', 'Citizen Priorities', 'Top Priority Category for Village Information Portal', 'single_choice', 
     '[{"value": "Emergency-Contacts", "label": "Emergency & Official Contacts"}, {"value": "Government-Schemes", "label": "Government Schemes & Document Checklists"}, {"value": "Healthcare-PHC", "label": "PHC Doctor Timings & Healthcare Services"}, {"value": "Education-Schools", "label": "School & Anganwadi Information"}, {"value": "Local-Business-Directory", "label": "Local Business & Artisan Directory"}, {"value": "Panchayat-Announcements", "label": "Panchayat Public Notices"}]'::jsonb, true, 21)
ON CONFLICT (question_code) DO NOTHING;
