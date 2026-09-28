import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidPhone, isValidEmail, isValidUrl, sanitizeUrl, sanitizeText } from './validation.js';


test('isValidPhone validates emergency and full phone formats', () => {
    assert.strictEqual(isValidPhone('108'), true);
    assert.strictEqual(isValidPhone('1912'), true);
    assert.strictEqual(isValidPhone('9951871501'), true);
    assert.strictEqual(isValidPhone('08922-246100'), true);
    assert.strictEqual(isValidPhone('12'), false);
    assert.strictEqual(isValidPhone(''), false);
    assert.strictEqual(isValidPhone(null), false);
});

test('isValidEmail validates standard email format', () => {
    assert.strictEqual(isValidEmail('citizen@example.com'), true);
    assert.strictEqual(isValidEmail('test.user@ap.gov.in'), true);
    assert.strictEqual(isValidEmail('invalid-email'), false);
    assert.strictEqual(isValidEmail(''), false);
    assert.strictEqual(isValidEmail(null), false);
});

test('isValidUrl validates URLs safely and restricts to web protocols', () => {
    // Valid standard web URLs
    assert.strictEqual(isValidUrl('https://vizianagaram.ap.gov.in'), true);
    assert.strictEqual(isValidUrl('http://localhost:5173'), true);
    assert.strictEqual(isValidUrl('HTTP://VIZIANAGARAM.AP.GOV.IN/PORTAL'), true);
    assert.strictEqual(isValidUrl('  https://ap.gov.in/schemes  '), true);
    assert.strictEqual(isValidUrl('https://sub.domain.org/path?query=1&b=2#section'), true);

    // Rejected dangerous and pseudo-protocols
    assert.strictEqual(isValidUrl('javascript:alert(1)'), false);
    assert.strictEqual(isValidUrl('JAVASCRIPT:alert(document.cookie)'), false);
    assert.strictEqual(isValidUrl('data:text/html,<script>alert(1)</script>'), false);
    assert.strictEqual(isValidUrl('vbscript:msgbox(1)'), false);
    assert.strictEqual(isValidUrl('file:///etc/passwd'), false);
    assert.strictEqual(isValidUrl('ftp://files.example.com'), false);

    // Rejected protocol-relative and malformed inputs
    assert.strictEqual(isValidUrl('//evil.com/payload'), false);
    assert.strictEqual(isValidUrl('not-a-url'), false);
    assert.strictEqual(isValidUrl(''), false);
    assert.strictEqual(isValidUrl('   '), false);
    assert.strictEqual(isValidUrl(null), false);
    assert.strictEqual(isValidUrl(undefined), false);
    assert.strictEqual(isValidUrl(12345), false);
    assert.strictEqual(isValidUrl({}), false);
});

test('sanitizeUrl normalizes and guards web URLs against script protocols', () => {
    assert.strictEqual(sanitizeUrl('https://vizianagaram.ap.gov.in'), 'https://vizianagaram.ap.gov.in');
    assert.strictEqual(sanitizeUrl('vizianagaram.ap.gov.in'), 'https://vizianagaram.ap.gov.in');
    assert.strictEqual(sanitizeUrl('  ap.gov.in  '), 'https://ap.gov.in');
    assert.strictEqual(sanitizeUrl('javascript:alert(1)'), '#');
    assert.strictEqual(sanitizeUrl('data:text/html,attack'), '#');
    assert.strictEqual(sanitizeUrl('//evil.com'), '#');
    assert.strictEqual(sanitizeUrl(''), '#');
    assert.strictEqual(sanitizeUrl(null), '#');
    assert.strictEqual(sanitizeUrl(undefined), '#');
});


test('sanitizeText trims string inputs and handles invalid types', () => {
    assert.strictEqual(sanitizeText('  Modavalasa  '), 'Modavalasa');
    assert.strictEqual(sanitizeText(123), '');
    assert.strictEqual(sanitizeText(null), '');
    assert.strictEqual(sanitizeText(undefined), '');
});
