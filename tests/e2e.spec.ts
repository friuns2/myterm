// Minimal e2e tests for the web terminal app
import { test, expect } from '@playwright/test';

test.describe('Web Terminal', () => {
  test('loads dashboard, creates project, opens terminal, toggles file browser', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Shell Dashboard')).toBeVisible();
    await expect(page.getByText('All Active Sessions')).toBeVisible();
    await expect(page.getByText('All Projects & Worktrees')).toBeVisible();

    const projectName = `proj-${Date.now()}`;
    await page.fill('#project-name', projectName);
    await page.click('button:has-text("Create Project")');

    await expect(page.locator('#terminal')).toBeVisible({ timeout: 20000 });

    await page.click('#browse-files');
    await expect(page.locator('#file-browser')).toBeVisible();
    await page.click('#close-browser');
    await expect(page.locator('#file-browser')).toBeHidden();

    await page.click('#back-to-sessions');
    await expect(page.getByText('Shell Dashboard')).toBeVisible();
  });

  test('manages environment variables via UI', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Environment Variables")');
    await expect(page.getByText('Global Environment Variables')).toBeVisible();

    const textarea = page.locator('#env-editor');
    await textarea.fill('FOO=bar\nHELLO=world');
    await page.click('#save-manually');

    await expect(page.locator('#save-status')).toContainText('Saved');

    // Navigate back, reopen and verify persisted
    await page.click('#back-to-dashboard');
    await page.click('button:has-text("Environment Variables")');
    await expect(textarea).toHaveValue(/FOO=bar/);
  });

  test('manages aliases via UI', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Shell Aliases")');
    await expect(page.getByText('Shell Aliases Manager')).toBeVisible();

    const textarea = page.locator('#aliases-editor');
    await textarea.fill("alias ll='ls -la'\nls=ls -la");
    await page.click('#save-aliases-manually');

    await expect(page.locator('#alias-save-status')).toContainText('Saved');

    await page.click('#back-to-dashboard');
  });

  test('creates a file via browser and edits it', async ({ page }) => {
    await page.goto('/');
    const projectName = `proj-${Math.random().toString(36).slice(2, 8)}`;
    await page.fill('#project-name', projectName);
    await page.click('button:has-text("Create Project")');
    await expect(page.locator('#terminal')).toBeVisible({ timeout: 20000 });

    await page.click('#browse-files');
    await expect(page.locator('#file-browser')).toBeVisible();

    await page.click('#new-file');
    await page.fill('#new-file-name', 'hello.txt');
    await page.click('#create-file-btn');

    // Open file editor should appear
    await expect(page.locator('#file-editor')).toBeVisible();
    await page.fill('#file-content', 'Hello World');
    await page.click('#save-file');

    await expect(page.locator('#save-file')).toContainText('Save');

    await page.click('#close-editor');
  });
});

