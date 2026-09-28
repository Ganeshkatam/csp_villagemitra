import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackService } from './feedback.js';

test('feedbackService rejects messages shorter than 10 characters', async () => {
    await assert.rejects(
        () => feedbackService.submitFeedback({ message: 'too short' }),
        /Please provide at least 10 characters/
    );

    await assert.rejects(
        () => feedbackService.submitFeedback({ message: '         ' }),
        /Please provide at least 10 characters/
    );

    await assert.rejects(
        () => feedbackService.submitFeedback(null),
        /Feedback data is required/
    );
});

test('feedbackService rejects messages longer than 2000 characters', async () => {
    const longMessage = 'A'.repeat(2001);
    await assert.rejects(
        () => feedbackService.submitFeedback({ message: longMessage }),
        /Feedback message cannot exceed 2000 characters/
    );
});

test('feedbackService rejects invalid reference IDs for status check', async () => {
    await assert.rejects(
        () => feedbackService.checkFeedbackStatus(''),
        /Please enter a valid Reference ID/
    );

    await assert.rejects(
        () => feedbackService.checkFeedbackStatus(null),
        /Please enter a valid Reference ID/
    );
});
