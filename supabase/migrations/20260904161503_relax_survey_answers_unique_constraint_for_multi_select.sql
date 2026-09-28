ALTER TABLE survey_answers
DROP CONSTRAINT IF EXISTS uq_response_question;

ALTER TABLE survey_answers
ADD CONSTRAINT uq_response_question_answer UNIQUE (response_id, question_code, answer_value);
