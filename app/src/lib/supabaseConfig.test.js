import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSupabaseConfig, supabase, isSupabaseConfigured } from './supabase.js';

test('validateSupabaseConfig detects missing URL', () => {
    const resNull = validateSupabaseConfig(null, 'some-key');
    assert.strictEqual(resNull.valid, false);
    assert.strictEqual(resNull.reason, 'missing_url');

    const resEmpty = validateSupabaseConfig('', 'some-key');
    assert.strictEqual(resEmpty.valid, false);
    assert.strictEqual(resEmpty.reason, 'missing_url');

    const resWhitespace = validateSupabaseConfig('   ', 'some-key');
    assert.strictEqual(resWhitespace.valid, false);
    assert.strictEqual(resWhitespace.reason, 'missing_url');
});

test('validateSupabaseConfig detects missing anonymous key', () => {
    const resNull = validateSupabaseConfig('https://valid.supabase.co', null);
    assert.strictEqual(resNull.valid, false);
    assert.strictEqual(resNull.reason, 'missing_anon_key');

    const resEmpty = validateSupabaseConfig('https://valid.supabase.co', '');
    assert.strictEqual(resEmpty.valid, false);
    assert.strictEqual(resEmpty.reason, 'missing_anon_key');

    const resWhitespace = validateSupabaseConfig('https://valid.supabase.co', '   ');
    assert.strictEqual(resWhitespace.valid, false);
    assert.strictEqual(resWhitespace.reason, 'missing_anon_key');
});

test('validateSupabaseConfig detects malformed URLs', () => {
    const resInvalid = validateSupabaseConfig('not-a-valid-url', 'some-key');
    assert.strictEqual(resInvalid.valid, false);
    assert.strictEqual(resInvalid.reason, 'malformed_url');

    const resFtp = validateSupabaseConfig('ftp://some-host.com', 'some-key');
    assert.strictEqual(resFtp.valid, false);
    assert.strictEqual(resFtp.reason, 'malformed_url');

    const resJavascript = validateSupabaseConfig('javascript:alert(1)', 'some-key');
    assert.strictEqual(resJavascript.valid, false);
    assert.strictEqual(resJavascript.reason, 'malformed_url');
});

test('validateSupabaseConfig accepts valid https and http configurations', () => {
    const resHttps = validateSupabaseConfig('https://xyzcompany.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.validkey');
    assert.strictEqual(resHttps.valid, true);
    assert.strictEqual(resHttps.reason, null);

    const resHttp = validateSupabaseConfig('http://localhost:54321', 'sb_anon_test_key');
    assert.strictEqual(resHttp.valid, true);
    assert.strictEqual(resHttp.reason, null);
});

test('unconfigured client fails gracefully without issuing network requests', async () => {
    if (!isSupabaseConfigured) {
        const selectResult = await supabase.from('villages').select('*');
        assert.deepEqual(selectResult.data, []);
        assert.ok(selectResult.error);

        const rpcResult = await supabase.rpc('search_portal', { p_query: 'test' });
        assert.strictEqual(rpcResult.data, null);
        assert.ok(rpcResult.error);

        const sessionResult = await supabase.auth.getSession();
        assert.strictEqual(sessionResult.data.session, null);
    }
});
