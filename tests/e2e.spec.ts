// Minimal e2e tests for the web terminal app
import { test, expect } from '@playwright/test';

const uniqueName = `proj-${Math.random().toString(36).slice(2, 8)}`;

// Helper: create a project via API to avoid flaky UI typing
async function createProjectViaApi(baseURL: string, name: string) {
  const resp = await fetch(`${baseURL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  // If git is missing, endpoint still creates the directory and will likely 500 on git init.
  // We tolerate non-200 here and fallback to UI flow
  if (!resp.ok) {
    return false;
  }
  return true;
}

test.describe('Web Terminal', () => {
  test('loads dashboard and opens terminal session', async ({ page, baseURL }) => {
    await page.goto('/');

    // Dashboard heading
    await expect(page.locator('text=Shell Dashboard')).toBeVisible();

    // Ensure sessions/projects loaded
    await expect(page.locator('text=All Active Sessions')).toBeVisible();
    await expect(page.locator('text=All Projects & Worktrees')).toBeVisible();

    // Try to create a project
    const projectName = uniqueName;
    const createdViaApi = await createProjectViaApi(baseURL!, projectName).catch(() => false);

    if (!createdViaApi) {
      // Fallback to UI
      await page.fill('#project-name', projectName);
      await page.click('button:has-text("Create Project")');
    }

    // Open the project (either automatically or via button)
    await page.waitForTimeout(500);
    const openBtn = page.locator(`.card:has-text("${projectName}") button:has-text("Open Project")`);
    if (await openBtn.count()) {
      await openBtn.first().click();
    } else {
      // If UI auto-opened, continue
    }

    // Terminal should render and attempt websocket connection (we cannot assert WS easily)
    await expect(page.locator('#terminal')).toBeVisible();

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


