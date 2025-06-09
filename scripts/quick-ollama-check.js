/**
 * Quick Ollama API Reference
 * 
 * Minimal test to verify Ollama endpoints
 */

const axios = require('axios');

async function quickOllamaCheck() {
  const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
  console.log(`Checking Ollama at: ${host}\n`);

  // Test 1: Basic connectivity
  try {
    await axios.get(host);
    console.log('✅ Ollama server is running');
  } catch (e) {
    console.log('❌ Ollama server not accessible');
    console.log('   Run: ollama serve');
    return;
  }

  // Test 2: List models
  try {
    const res = await axios.get(`${host}/api/tags`);
    const models = res.data.models || [];
    console.log(`✅ Found ${models.length} models:`);
    models.forEach(m => console.log(`   - ${m.name} (${(m.size/1e9).toFixed(1)}GB)`));
  } catch (e) {
    console.log('❌ Failed to list models');
  }

  // Test 3: Check version (if available)
  try {
    const res = await axios.get(`${host}/api/version`);
    console.log(`✅ Ollama version: ${res.data.version}`);
  } catch (e) {
    // Version endpoint might not exist in all versions
    console.log('ℹ️  Version endpoint not available');
  }

  console.log('\nQuick check complete!');
}

quickOllamaCheck();
