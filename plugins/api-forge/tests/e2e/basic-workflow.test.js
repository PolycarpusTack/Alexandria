import { test, expect } from '@playwright/test';

test.describe('Apicarus E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for Alexandria to load and click on Apicarus plugin
    await page.waitForSelector('[data-plugin="apicarus"]', { timeout: 10000 });
    await page.click('[data-plugin="apicarus"]');
  });

  test('Create and send a simple GET request', async ({ page }) => {
    // Enter URL
    await page.fill('#apicarus-url', 'https://jsonplaceholder.typicode.com/posts/1');
    
    // Send request
    await page.click('button:has-text("Send")');
    
    // Wait for response
    await page.waitForSelector('.response-json', { timeout: 10000 });
    
    // Verify response
    const responseText = await page.textContent('.response-json');
    expect(responseText).toContain('"userId": 1');
    expect(responseText).toContain('"id": 1');
  });

  test('Create collection and save request', async ({ page }) => {
    // Make a request first
    await page.fill('#apicarus-url', 'https://api.test/users');
    await page.click('button:has-text("Send")');
    
    // Save to collection
    await page.click('button:has-text("Save")');
    await page.fill('input[placeholder="Request name"]', 'Get Users');
    await page.fill('input[placeholder="Collection name"]', 'User API');
    await page.click('button:has-text("Create & Save")');
    
    // Verify collection appears
    await page.waitForSelector('.collection-item:has-text("User API")');
    
    // Click collection
    await page.click('.collection-item:has-text("User API")');
    
    // Verify request is loaded
    const urlValue = await page.inputValue('#apicarus-url');
    expect(urlValue).toBe('https://api.test/users');
  });

  test('Use environment variables', async ({ page }) => {
    // Open environments
    await page.click('button[title="Environments"]');
    
    // Create environment
    await page.click('button:has-text("New Environment")');
    await page.fill('input[name="name"]', 'Production');
    await page.fill('textarea', JSON.stringify({
      baseUrl: 'https://api.prod.com',
      apiKey: 'prod-key-123'
    }));
    await page.click('button:has-text("Save")');
    
    // Use variable in request
    await page.fill('#apicarus-url', '{{baseUrl}}/users');
    
    // Add header with variable
    await page.click('.tab-button:has-text("Headers")');
    await page.click('button:has-text("Add Header")');
    await page.fill('input[name="key"]', 'X-API-Key');
    await page.fill('input[name="value"]', '{{apiKey}}');
    
    // Send and verify substitution
    await page.click('button:has-text("Send")');
    
    // Check that URL was substituted (in history or UI)
    await page.waitForSelector('.history-item:has-text("https://api.prod.com/users")');
  });

  test('Import cURL command', async ({ page }) => {
    // Open import dialog
    await page.keyboard.press('Control+Shift+I');
    
    // Paste cURL command
    const curlCommand = `
      curl -X POST https://api.test/users \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer token123" \\
        -d '{"name": "John Doe", "email": "john@example.com"}'
    `;
    
    await page.fill('#curl-input', curlCommand);
    await page.click('button:has-text("Import")');
    
    // Verify imported values
    const method = await page.inputValue('#apicarus-method');
    expect(method).toBe('POST');
    
    const url = await page.inputValue('#apicarus-url');
    expect(url).toBe('https://api.test/users');
    
    // Check headers tab
    await page.click('.tab-button:has-text("Headers")');
    await page.waitForSelector('input[value="Content-Type"]');
    await page.waitForSelector('input[value="application/json"]');
    
    // Check auth tab
    await page.click('.tab-button:has-text("Authorization")');
    const authType = await page.inputValue('#apicarus-auth-type');
    expect(authType).toBe('bearer');
  });

  test('Generate code from request', async ({ page }) => {
    // Setup request
    await page.fill('#apicarus-url', 'https://api.test/posts');
    await page.selectOption('#apicarus-method', 'POST');
    
    // Add body
    await page.click('.tab-button:has-text("Body")');
    await page.fill('#apicarus-body-content', JSON.stringify({
      title: 'Test Post',
      content: 'Lorem ipsum'
    }));
    
    // Generate code
    await page.keyboard.press('Control+Shift+G');
    
    // Select JavaScript
    await page.click('.language-option:has-text("JavaScript")');
    
    // Verify generated code
    const code = await page.textContent('.generated-code');
    expect(code).toContain('fetch("https://api.test/posts"');
    expect(code).toContain('method: "POST"');
    expect(code).toContain('title: "Test Post"');
    
    // Copy code
    await page.click('button:has-text("Copy")');
    
    // Verify clipboard (if possible in test environment)
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('fetch(');
  });

  test('Handle error responses gracefully', async ({ page }) => {
    // Make request to non-existent endpoint
    await page.fill('#apicarus-url', 'https://httpstat.us/404');
    await page.click('button:has-text("Send")');
    
    // Wait for error response
    await page.waitForSelector('.response-error');
    
    // Verify error is displayed
    const errorText = await page.textContent('.response-error');
    expect(errorText).toContain('404');
  });

  test('Search and filter collections', async ({ page }) => {
    // Create multiple collections first
    const collections = ['API Tests', 'Auth Tests', 'User Management'];
    
    for (const name of collections) {
      await page.click('button:has-text("New Collection")');
      await page.fill('input[name="collection-name"]', name);
      await page.click('button:has-text("Create")');
    }
    
    // Search for specific collection
    await page.fill('#collection-search', 'Auth');
    
    // Verify only matching collection is shown
    await page.waitForSelector('.collection-item:has-text("Auth Tests")');
    expect(await page.isVisible('.collection-item:has-text("API Tests")')).toBe(false);
  });

  test('Performance with large response', async ({ page }) => {
    // Request large dataset
    await page.fill('#apicarus-url', 'https://jsonplaceholder.typicode.com/posts');
    
    const startTime = Date.now();
    await page.click('button:has-text("Send")');
    await page.waitForSelector('.response-json');
    const endTime = Date.now();
    
    // Should complete in reasonable time
    expect(endTime - startTime).toBeLessThan(5000);
    
    // Verify response is displayed
    const responseText = await page.textContent('.response-json');
    expect(responseText).toBeTruthy();
  });

  test('Keyboard shortcuts work correctly', async ({ page }) => {
    // Test new request shortcut
    await page.keyboard.press('Control+Shift+N');
    // Should clear the current request
    
    // Test send request shortcut
    await page.fill('#apicarus-url', 'https://jsonplaceholder.typicode.com/posts/1');
    await page.keyboard.press('Control+Shift+Enter');
    await page.waitForSelector('.response-json');
    
    // Test import shortcut
    await page.keyboard.press('Control+Shift+I');
    await page.waitForSelector('#curl-input');
  });
});