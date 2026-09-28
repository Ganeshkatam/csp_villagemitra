ALTER TABLE survey_responses
ADD COLUMN IF NOT EXISTS survey_client_uuid UUID;

CREATE UNIQUE INDEX IF NOT EXISTS survey_responses_client_uuid_uidx
ON survey_responses(survey_client_uuid);
