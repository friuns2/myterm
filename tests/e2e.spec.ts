// Minimal e2e tests for the web terminal app
import { test, expect } from '@playwright/test';

const uniqueName = `proj-${Math.random().toString(36).slice(2, 8)}`;

test.describe('Web Terminal', () => {
  test('loads dashboard and opens terminal session', async ({ page }) => {
    await page.goto('/');

    // Dashboard heading
    await expect(page.locator('text=Shell Dashboard')).toBeVisible();

    // Ensure sessions/projects loaded
    await expect(page.locator('text=All Active Sessions')).toBeVisible();
    await expect(page.locator('text=All Projects & Worktrees')).toBeVisible();

    // Create a project via UI (this also navigates into terminal on success)
    const projectName = uniqueName;
    await page.fill('#project-name', projectName);
    await page.click('button:has-text("Create Project")');

    // Terminal should render and attempt websocket connection (we cannot assert WS easily)
    await expect(page.locator('#terminal')).toBeVisible({ timeout: 15000 });

    // Open file browser and close it
    await page.click('#browse-files');
    await expect(page.locator('#file-browser')).toBeVisible();
    await page.click('#close-browser');
    await expect(page.locator('#file-browser')).toBeHidden();

    // Back to sessions
    await page.click('#back-to-sessions');
    await expect(page.locator('text=Shell Dashboard')).toBeVisible();
  });
});


