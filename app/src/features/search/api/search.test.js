import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuery, searchPortal } from './search.js';

test('normalizeQuery trims whitespace and enforces 100 char limit', () => {
    assert.equal(normalizeQuery('   hello world   '), 'hello world');
    assert.equal(normalizeQuery(''), '');
    assert.equal(normalizeQuery(null), '');
    assert.equal(normalizeQuery(undefined), '');

    const longQuery = 'A'.repeat(150);
    const normalized = normalizeQuery(longQuery);
    assert.equal(normalized.length, 100);
    assert.equal(normalized, 'A'.repeat(100));
});

test('searchPortal returns empty array immediately for empty queries without RPC invocation', async () => {
    const resEmpty = await searchPortal('');
    assert.deepEqual(resEmpty, []);

    const resWhitespace = await searchPortal('    ');
    assert.deepEqual(resWhitespace, []);

    const resNull = await searchPortal(null);
    assert.deepEqual(resNull, []);
});

test('searchPortal respects pre-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(
        () => searchPortal('PHC', { signal: controller.signal }),
        (err) => {
            assert.equal(err.name, 'AbortError');
            return true;
        }
    );
});
