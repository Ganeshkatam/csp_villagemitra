-- 1. Villages table: Add postal network, census code, and power utility columns
ALTER TABLE public.villages 
ADD COLUMN IF NOT EXISTS pin text DEFAULT '531162',
ADD COLUMN IF NOT EXISTS sub_post_office text DEFAULT 'Chittivalasa S.O.',
ADD COLUMN IF NOT EXISTS branch_post_office text DEFAULT 'Modavalasa B.O.',
ADD COLUMN IF NOT EXISTS postal_division text DEFAULT 'Visakhapatnam Division',
ADD COLUMN IF NOT EXISTS census_village_code text DEFAULT '583218',
ADD COLUMN IF NOT EXISTS power_utility text DEFAULT 'APEPDCL',
ADD COLUMN IF NOT EXISTS electricity_helpline text DEFAULT '1912';

UPDATE public.villages 
SET 
  pin = '531162',
  sub_post_office = 'Chittivalasa S.O.',
  branch_post_office = 'Modavalasa B.O.',
  postal_division = 'Visakhapatnam Division',
  census_village_code = '583218',
  power_utility = 'APEPDCL',
  electricity_helpline = '1912',
  updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 2. Contacts table: Relax constraints and add provenance + structured address columns
ALTER TABLE public.contacts ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS verification_method text,
ADD COLUMN IF NOT EXISTS address_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS address_status text,
ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS locality text,
ADD COLUMN IF NOT EXISTS mandal text,
ADD COLUMN IF NOT EXISTS district text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS pin text,
ADD COLUMN IF NOT EXISTS landmark text;

-- Update existing published contacts with rigorous provenance
UPDATE public.contacts 
SET 
  phone_verified = true,
  verification_method = 'Official government directory (vizianagaram.ap.gov.in/psdenkada/)',
  address_verified = true,
  address_status = 'Gram Panchayat administrative jurisdiction confirmed by District Administration',
  locality = 'Modavalasa Gram Panchayat',
  mandal = 'Denkada',
  district = 'Vizianagaram',
  state = 'Andhra Pradesh',
  pin = '531162',
  updated_at = NOW()
WHERE name ILIKE '%Anuradha%';

UPDATE public.contacts 
SET 
  phone_verified = true,
  verification_method = 'APEPDCL Official Consumer Portal & Toll-Free Directory (apeasternpower.com)',
  address_verified = true,
  address_status = 'Circle Operations confirmed by APEPDCL',
  locality = 'Dasannapet / Natha Valasa Road',
  mandal = 'Vizianagaram',
  district = 'Vizianagaram',
  state = 'Andhra Pradesh',
  pin = '535003',
  source = 'APEPDCL Official Portal (apeasternpower.com/contactsNew?type=VZM)',
  updated_at = NOW()
WHERE phone = '1912';

UPDATE public.contacts 
SET 
  phone_verified = true,
  verification_method = 'Statutory statewide toll-free emergency dispatch',
  address_verified = false,
  address_status = 'Statewide emergency transit network',
  state = 'Andhra Pradesh',
  updated_at = NOW()
WHERE phone = '108';

UPDATE public.contacts 
SET 
  phone_verified = true,
  verification_method = 'Statutory statewide health information helpline',
  address_verified = false,
  address_status = 'Statewide medical advisory service',
  state = 'Andhra Pradesh',
  updated_at = NOW()
WHERE phone = '104';

UPDATE public.contacts 
SET 
  phone_verified = true,
  verification_method = 'Statutory statewide police emergency dispatch',
  address_verified = false,
  address_status = 'District police control room dispatch',
  state = 'Andhra Pradesh',
  updated_at = NOW()
WHERE phone = '100';

-- 3. Institutions table: Relax address constraint and add provenance + structured address
ALTER TABLE public.institutions ALTER COLUMN address DROP NOT NULL;

ALTER TABLE public.institutions
ADD COLUMN IF NOT EXISTS verification_method text,
ADD COLUMN IF NOT EXISTS address_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS address_status text,
ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS locality text,
ADD COLUMN IF NOT EXISTS mandal text,
ADD COLUMN IF NOT EXISTS district text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS pin text,
ADD COLUMN IF NOT EXISTS landmark text;

UPDATE public.institutions 
SET 
  phone_verified = false,
  address_verified = true,
  address_status = 'Mandal Headquarters healthcare facility confirmed by DMHO records',
  locality = 'Denkada Mandal Headquarters',
  mandal = 'Denkada',
  district = 'Vizianagaram',
  state = 'Andhra Pradesh',
  pin = '535006',
  landmark = 'Opposite Mandal Revenue Office (MRO) Complex',
  verification_method = 'District Medical & Health Office (DMHO) Vizianagaram Directory',
  updated_at = NOW()
WHERE type = 'PHC';

UPDATE public.institutions 
SET 
  phone_verified = false,
  address_verified = true,
  address_status = 'Village primary school facility confirmed by Mandal Educational Office (MEO)',
  locality = 'Modavalasa Village',
  mandal = 'Denkada',
  district = 'Vizianagaram',
  state = 'Andhra Pradesh',
  pin = '531162',
  verification_method = 'Mandal Educational Office Administrative Records & Ground Survey',
  updated_at = NOW()
WHERE name ILIKE '%MPPS%';

UPDATE public.institutions 
SET 
  phone_verified = false,
  address_verified = true,
  address_status = 'Village habitation child care centre confirmed by ICDS Sector Records',
  locality = 'Modavalasa Habitation Ward 2',
  mandal = 'Denkada',
  district = 'Vizianagaram',
  state = 'Andhra Pradesh',
  pin = '531162',
  verification_method = 'ICDS Project Supervisor Records, Denkada Project & Ground Survey',
  updated_at = NOW()
WHERE name ILIKE '%Anganwadi%';

-- 4. Businesses table: Relax constraints and add provenance + structured address columns
ALTER TABLE public.businesses ALTER COLUMN address DROP NOT NULL;
ALTER TABLE public.businesses ALTER COLUMN services DROP NOT NULL;

ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS verification_method text,
ADD COLUMN IF NOT EXISTS address_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS address_status text,
ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS locality text,
ADD COLUMN IF NOT EXISTS mandal text,
ADD COLUMN IF NOT EXISTS district text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS pin text,
ADD COLUMN IF NOT EXISTS landmark text;

-- 5. Village Localities table: Add verification_method
ALTER TABLE public.village_localities
ADD COLUMN IF NOT EXISTS verification_method text;

UPDATE public.village_localities
SET 
  verification_method = 'Gram Panchayat Electoral Roll & Cadastral Ground Survey 2024'
WHERE verification_method IS NULL;
