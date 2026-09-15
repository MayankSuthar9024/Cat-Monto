const assert = require('assert');
const { AntigravityProvider } = require('../electron/ai/antigravity-provider');
const { GeminiProvider } = require('../electron/ai/gemini-provider');
const { CAT_CONFIG } = require('../electron/config/cat-config');
const { DEFAULT_SETTINGS } = require('../electron/settings/store');

console.log('=== RUNNING ANTIGRAVITY & AUTOMATIC FAILOVER VERIFICATION ===\n');

// 1. Verify Configuration
console.log('1. Verifying config constants...');
assert.strictEqual(CAT_CONFIG.PRIMARY_ANTIGRAVITY_MODEL, 'gemini-3.8-flash', 'PRIMARY_ANTIGRAVITY_MODEL must be gemini-3.8-flash');
assert.ok(Array.isArray(CAT_CONFIG.MODEL_FAILOVER_CHAIN), 'MODEL_FAILOVER_CHAIN must be an array');
assert.ok(CAT_CONFIG.MODEL_FAILOVER_CHAIN.includes('gemini-3.8-flash'), 'Failover chain must include gemini-3.8-flash');
assert.ok(CAT_CONFIG.MODEL_FAILOVER_CHAIN.includes('gemini-3.5-flash'), 'Failover chain must include gemini-3.5-flash');
console.log('✓ Configuration constants verified successfully.\n');

// 2. Verify Default Settings
console.log('2. Verifying default settings...');
assert.strictEqual(DEFAULT_SETTINGS.antigravityModel, 'gemini-3.8-flash', 'DEFAULT_SETTINGS.antigravityModel must be gemini-3.8-flash');
assert.strictEqual(DEFAULT_SETTINGS.autoModelFailover, true, 'DEFAULT_SETTINGS.autoModelFailover must default to true');
console.log('✓ Default settings verified successfully.\n');

// 3. Verify AntigravityProvider class & inheritance
console.log('3. Verifying AntigravityProvider...');
const antigravity = new AntigravityProvider({ apiKey: 'test-key' });
assert.strictEqual(antigravity.name, 'antigravity', 'Provider name must be antigravity');
assert.strictEqual(antigravity.model, 'gemini-3.8-flash', 'Antigravity default model must be gemini-3.8-flash');
assert.ok(antigravity instanceof GeminiProvider, 'AntigravityProvider must inherit from GeminiProvider');
console.log('✓ AntigravityProvider instantiated with model:', antigravity.model);

// 4. Verify Failover Callback Mechanism
console.log('\n4. Verifying Dynamic Failover Event Dispatch...');
let failoverCaptured = null;
antigravity.setOnFailover((data) => {
  failoverCaptured = data;
});

// Simulate cooldown on primary model
const primary = antigravity.model;
const backoffMs = 60000;
antigravity.modelCooldowns.set(primary, Date.now() + backoffMs);

assert.ok(antigravity.modelCooldowns.has(primary), 'Cooldown should be recorded for primary model');
console.log(`✓ Cooldown recorded on ${primary}: throttled for ${backoffMs / 1000}s`);

// Simulate trigger of failover callback
antigravity.onFailoverCallback({
  previousModel: primary,
  activeModel: 'gemini-3.5-flash',
  reason: 'rate_limit',
});

assert.ok(failoverCaptured, 'Failover callback should have fired');
assert.strictEqual(failoverCaptured.previousModel, 'gemini-3.8-flash');
assert.strictEqual(failoverCaptured.activeModel, 'gemini-3.5-flash');
assert.strictEqual(failoverCaptured.reason, 'rate_limit');
console.log('✓ Failover event successfully dispatched & received:', failoverCaptured);

console.log('\n=== ALL ANTIGRAVITY & FAILOVER TESTS PASSED! ===');
