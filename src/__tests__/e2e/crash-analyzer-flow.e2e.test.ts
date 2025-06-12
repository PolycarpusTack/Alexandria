/**
 * End-to-End tests for Crash Analyzer user flow
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 60000; // 60 seconds for LLM analysis

test.describe('Crash Analyzer E2E Flow', () => {
  test.setTimeout(TEST_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto(BASE_URL);

    // Login if required
    const loginButton = await page.locator('button:has-text("Login")').count();
    if (loginButton > 0) {
      await loginFlow(page);
    }

    // Navigate to crash analyzer
    await page.click('a:has-text("Crash Analyzer")');
    await expect(page).toHaveURL(/.*crash-analyzer/);
  });

  test('should complete full crash analysis workflow', async ({ page }) => {
    // Step 1: Upload crash log
    await test.step('Upload crash log file', async () => {
      await page.click('button:has-text("Upload Crash Log")');

      // Wait for upload dialog
      await expect(page.locator('h2:has-text("Upload Crash Log")')).toBeVisible();

      // Upload test crash log
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'test-crash-log.txt'));

      // Add metadata
      await page.fill('input[placeholder="Application name"]', 'TestApp');
      await page.fill('input[placeholder="Version"]', '1.0.0');

      // Submit upload
      await page.click('button:has-text("Upload")');

      // Wait for upload success
      await expect(page.locator('text=Upload successful')).toBeVisible({ timeout: 10000 });
    });

    // Step 2: View crash log details
    await test.step('View crash log details', async () => {
      // Click on the uploaded crash log
      await page.click('tr:has-text("test-crash-log.txt")');

      // Verify we're on the detail page
      await expect(page.locator('h1:has-text("Crash Log")')).toBeVisible();
      await expect(page.locator('text=test-crash-log.txt')).toBeVisible();

      // Check that stack trace is displayed
      await expect(page.locator('pre:has-text("NullPointerException")')).toBeVisible();
    });

    // Step 3: Analyze crash log
    await test.step('Analyze crash log with AI', async () => {
      // Click analyze button
      await page.click('button:has-text("Analyze")');

      // Wait for analysis to start
      await expect(page.locator('text=Analyzing...')).toBeVisible();

      // Wait for analysis to complete (this may take some time)
      await expect(page.locator('h3:has-text("Analysis Results")')).toBeVisible({
        timeout: 45000
      });

      // Verify analysis results are displayed
      await expect(page.locator('text=Primary Error')).toBeVisible();
      await expect(page.locator('text=Root Causes')).toBeVisible();
      await expect(page.locator('text=Troubleshooting Steps')).toBeVisible();
    });

    // Step 4: Provide feedback
    await test.step('Provide feedback on analysis', async () => {
      // Click feedback button
      await page.click('button:has-text("Provide Feedback")');

      // Wait for feedback dialog
      await expect(page.locator('h2:has-text("Analysis Feedback")')).toBeVisible();

      // Rate the analysis
      await page.click('button[aria-label="4 stars"]');

      // Select accuracy options
      await page.click('text=Root cause was accurate');
      await page.click('text=Suggestions were helpful');

      // Select usefulness options
      await page.click('text=Saved me time');
      await page.click('text=Would use again');

      // Add comment
      await page.fill(
        'textarea[placeholder*="feedback"]',
        'The analysis correctly identified the null pointer issue.'
      );

      // Submit feedback
      await page.click('button:has-text("Submit Feedback")');

      // Verify feedback submitted
      await expect(page.locator('text=Thank you for your feedback')).toBeVisible();
    });
  });

  test('should handle code snippet analysis', async ({ page }) => {
    await test.step('Upload and analyze code snippet', async () => {
      // Click on code snippet tab
      await page.click('button:has-text("Code Snippet")');

      // Enter code snippet
      const codeEditor = await page.locator('textarea[placeholder*="code"]');
      await codeEditor.fill(`
        public class UserService {
          private UserRepository repository;
          
          public User getUser(String id) {
            User user = repository.findById(id);
            return user.getName(); // Potential NPE
          }
        }
      `);

      // Select language
      await page.selectOption('select[name="language"]', 'java');

      // Analyze code
      await page.click('button:has-text("Analyze Code")');

      // Wait for results
      await expect(page.locator('text=Potential Issues')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('text=NullPointerException')).toBeVisible();
    });
  });

  test('should display analytics dashboard', async ({ page }) => {
    await test.step('View feedback analytics', async () => {
      // Navigate to analytics
      await page.click('a:has-text("Analytics")');

      // Verify analytics components
      await expect(page.locator('h2:has-text("Feedback Analytics")')).toBeVisible();
      await expect(page.locator('text=Average Rating')).toBeVisible();
      await expect(page.locator('text=Accuracy Score')).toBeVisible();
      await expect(page.locator('text=Total Feedback')).toBeVisible();

      // Check charts are rendered
      await expect(page.locator('svg.recharts-surface')).toBeVisible();
    });
  });

  test('should search and filter crash logs', async ({ page }) => {
    await test.step('Search crash logs', async () => {
      // Use search bar
      await page.fill('input[placeholder*="Search"]', 'NullPointer');
      await page.press('input[placeholder*="Search"]', 'Enter');

      // Verify filtered results
      await expect(page.locator('table tbody tr')).toHaveCount(1);
      await expect(page.locator('text=NullPointerException')).toBeVisible();

      // Clear search
      await page.click('button[aria-label="Clear search"]');

      // Filter by status
      await page.selectOption('select[name="status"]', 'analyzed');

      // Verify filtered by status
      const rows = await page.locator('table tbody tr').count();
      expect(rows).toBeGreaterThan(0);
    });
  });

  test('should handle errors gracefully', async ({ page }) => {
    await test.step('Upload invalid file', async () => {
      await page.click('button:has-text("Upload Crash Log")');

      // Try to upload non-text file
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, 'fixtures', 'invalid-file.exe'));

      await page.click('button:has-text("Upload")');

      // Should show error
      await expect(page.locator('text=Invalid file type')).toBeVisible();
    });

    await test.step('Handle analysis failure', async () => {
      // Navigate to a crash log
      await page.click('tr:first-child');

      // Disconnect network to simulate failure
      await page.context().setOffline(true);

      // Try to analyze
      await page.click('button:has-text("Analyze")');

      // Should show error message
      await expect(page.locator('text=Failed to analyze')).toBeVisible({ timeout: 10000 });

      // Reconnect
      await page.context().setOffline(false);
    });
  });
});

// Helper function for login flow
async function loginFlow(page: Page) {
  await page.click('button:has-text("Login")');
  await page.fill('input[name="username"]', 'testuser');
  await page.fill('input[name="password"]', 'TestPass123!');
  await page.click('button[type="submit"]');

  // Wait for redirect after login
  await expect(page).toHaveURL(/.*dashboard/, { timeout: 5000 });
}

// Test data fixtures would be in __tests__/e2e/fixtures/
// - test-crash-log.txt: Sample crash log with stack trace
// - invalid-file.exe: Binary file for error testing
