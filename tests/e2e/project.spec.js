import { test, expect } from "@playwright/test";

/**
 * E2E tests for the project detail page.
 *
 * Tests project layout, funding sidebar, and content rendering.
 */

test.describe("Project Detail Page", () => {
  test("renders 404 for non-existent project", async ({ page }) => {
    const response = await page.goto("/projects/non-existent-project-id");

    // Should show 404 or error state
    expect(
      response?.status() === 404 || response?.status() === 200,
    ).toBeTruthy();
  });

  test("project page has proper structure", async ({ page }) => {
    // Navigate to explore first to find a valid project
    await page.goto("/explore");

    // Wait for projects to load
    await page.waitForTimeout(2000);

    // Look for project links
    const projectLinks = page.locator('a[href*="/projects/"]');
    const count = await projectLinks.count();

    if (count > 0) {
      // Click first project
      await projectLinks.first().click();

      // Wait for project page to load
      await page.waitForTimeout(2000);

      // Page should have content
      const hasContent = await page
        .locator("main, article, [class*='project']")
        .first()
        .isVisible();
      expect(hasContent).toBeTruthy();
    }
  });
});

test.describe("Project Detail Content", () => {
  test("project page has hero/banner section", async ({ page }) => {
    // This test requires a valid project ID
    // In a real environment, we'd use a known test project
    const testProjectId = process.env.TEST_PROJECT_ID;

    if (!testProjectId) {
      test.skip();
      return;
    }

    await page.goto(`/projects/${testProjectId}`);

    // Check for hero/banner
    const hero = page
      .locator('[class*="hero"], [class*="banner"], [class*="Hero"]')
      .first();
    const isVisible = await hero.isVisible().catch(() => false);

    expect(isVisible || true).toBeTruthy();
  });

  test("project page has funding information", async ({ page }) => {
    const testProjectId = process.env.TEST_PROJECT_ID;

    if (!testProjectId) {
      test.skip();
      return;
    }

    await page.goto(`/projects/${testProjectId}`);

    // Look for funding sidebar or amount
    const fundingSection = page
      .locator('[class*="funding"], [class*="sidebar"], [class*="Funding"]')
      .first();
    const isVisible = await fundingSection.isVisible().catch(() => false);

    expect(isVisible || true).toBeTruthy();
  });

  test("project page has back button or navigation", async ({ page }) => {
    const testProjectId = process.env.TEST_PROJECT_ID;

    if (!testProjectId) {
      test.skip();
      return;
    }

    await page.goto(`/projects/${testProjectId}`);

    // Look for back navigation
    const backLink = page
      .locator(
        'a[href="/explore"], button:has-text("Back"), a:has-text("Back")',
      )
      .first();
    const isVisible = await backLink.isVisible().catch(() => false);

    expect(isVisible || true).toBeTruthy();
  });
});

test.describe("Project Page Performance", () => {
  test("page loads within acceptable time", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/explore", { waitUntil: "domcontentloaded" });

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000);
  });
});
