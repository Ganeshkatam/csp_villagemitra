import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import en from '../app/src/i18n/en.js';
import te from '../app/src/i18n/te.js';
import { getLocalized } from '../app/src/i18n/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('i18n: en and te dictionaries have exact matching key sets', () => {
    const enKeys = Object.keys(en).sort();
    const teKeys = Object.keys(te).sort();

    const missingInTe = enKeys.filter(k => !teKeys.includes(k));
    const missingInEn = teKeys.filter(k => !enKeys.includes(k));

    assert.deepStrictEqual(missingInTe, [], `Keys present in en but missing in te: ${missingInTe.join(', ')}`);
    assert.deepStrictEqual(missingInEn, [], `Keys present in te but missing in en: ${missingInEn.join(', ')}`);
    assert.strictEqual(enKeys.length, teKeys.length, 'Total key count must be identical between en and te');
});

test('i18n: all translation values are non-empty strings without stray whitespace', () => {
    for (const [key, value] of Object.entries(en)) {
        assert.strictEqual(typeof value, 'string', `en.${key} must be a string`);
        assert.ok(value.trim().length > 0, `en.${key} must not be empty or whitespace only`);
    }

    for (const [key, value] of Object.entries(te)) {
        assert.strictEqual(typeof value, 'string', `te.${key} must be a string`);
        assert.ok(value.trim().length > 0, `te.${key} must not be empty or whitespace only`);
    }
});

test('i18n: interpolation tokens match identically between en and te entries', () => {
    const tokenRegex = /\{([a-zA-Z0-9_]+)\}/g;

    for (const key of Object.keys(en)) {
        const enTokens = (en[key].match(tokenRegex) || []).sort();
        const teTokens = (te[key].match(tokenRegex) || []).sort();

        assert.deepStrictEqual(
            teTokens,
            enTokens,
            `Interpolation tokens mismatch on key "${key}": en has [${enTokens.join(', ')}], te has [${teTokens.join(', ')}]`
        );
    }
});

test('i18n: strictly zero emojis in translation dictionary entries', () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    for (const [key, val] of Object.entries(en)) {
        assert.ok(!emojiRegex.test(val), `en.${key} contains an emoji: "${val}"`);
    }
    for (const [key, val] of Object.entries(te)) {
        assert.ok(!emojiRegex.test(val), `te.${key} contains an emoji: "${val}"`);
    }
});

test('i18n: all t.<key> and t?.<key> references in app source exist in dictionaries', () => {
    const srcDir = path.join(rootDir, 'app', 'src');

    function collectCodeFiles(dir) {
        let results = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules' && entry.name !== 'legacy') {
                    results = results.concat(collectCodeFiles(fullPath));
                }
            } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
                results.push(fullPath);
            }
        }
        return results;
    }

    const codeFiles = collectCodeFiles(srcDir);
    const keyRefRegex = /\bt(?:\?|\.)\.([a-zA-Z0-9_]+)\b/g;
    const referencedKeys = new Set();

    for (const file of codeFiles) {
        const content = fs.readFileSync(file, 'utf8');
        let match;
        while ((match = keyRefRegex.exec(content)) !== null) {
            referencedKeys.add(match[1]);
        }
    }

    const missingFromEn = [];
    const missingFromTe = [];

    for (const refKey of referencedKeys) {
        if (!(refKey in en)) missingFromEn.push(refKey);
        if (!(refKey in te)) missingFromTe.push(refKey);
    }

    assert.deepStrictEqual(missingFromEn, [], `Code references keys missing from en.js: ${missingFromEn.join(', ')}`);
    assert.deepStrictEqual(missingFromTe, [], `Code references keys missing from te.js: ${missingFromTe.join(', ')}`);
});

test('i18n: getLocalized resolves localized fields with graceful fallback', () => {
    const mockItem = {
        title: 'Primary Health Centre',
        title_te: 'ప్రాథమిక ఆరోగ్య కేంద్రం',
        description: 'Healthcare facility',
        description_te: '   '
    };

    assert.strictEqual(getLocalized(mockItem, 'title', 'en'), 'Primary Health Centre');
    assert.strictEqual(getLocalized(mockItem, 'title', 'te'), 'ప్రాథమిక ఆరోగ్య కేంద్రం');
    assert.strictEqual(getLocalized(mockItem, 'description', 'te'), 'Healthcare facility', 'Should fall back to en if te is empty whitespace');
    assert.strictEqual(getLocalized(null, 'title', 'en'), '', 'Should return empty string for null item');
    assert.strictEqual(getLocalized(undefined, 'title', 'te'), '', 'Should return empty string for undefined item');
});
