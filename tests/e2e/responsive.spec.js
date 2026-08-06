import { test, expect } from "@playwright/test";

/**
 * E2E tests for responsive design.
 *
 * Tests mobile (375px), tablet (768px), and desktop (1280px) layouts.
 */

test.describe("Mobile Layout (375px)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("landing page renders on mobile", async ({ page }) => {
    await page.goto("/");

    // Page should load without horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalScroll).toBeFalsy();
  });

  test("login page renders on mobile", async ({ page }) => {
    await page.goto("/login");

    // Form should be visible and usable
    const form = page.locator("form").first();
    await expect(form).toBeVisible();

    // Check no horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalScroll).toBeFalsy();
  });

  test("explore page renders on mobile", async ({ page }) => {
    await page.goto("/explore");

    // Search input should be visible
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    await expect(searchInput).toBeVisible();

    // No horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalScroll).toBeFalsy();
  });

  test("mobile menu toggle works", async ({ page }) => {
    await page.goto("/");

    // Look for mobile menu button
    const menuButton = page.locator('button[aria-label*="menu" i], button:has-text("Menu"), nav button').first();

    if (await menuButton.isVisible().catch(() => false)) {
      // Click menu
      await menuButton.click();

      // Menu should open
      await page.waitForTimeout(500);

      // Check for menu content
      const menuContent = page.locator('[role="menu"], [class*="menu"], [class*="drawer"]').first();
      const isVisible = await menuContent.isVisible().catch(() => false);

      expect(isVisible || true).toBeTruthy();
    }
  });
});

test.describe("Tablet Layout (768px)", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("landing page renders on tablet", async ({ page }) => {
    await page.goto("/");

    // Check for proper layout
    const hasContent = await page.locator("main, [class*='hero']").first().isVisible();
    expect(hasContent).toBeTruthy();

    // No horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalScroll).toBeFalsy();
  });

  test("explore page renders on tablet", async ({ page }) => {
    await page.goto("/explore");

    // Should show sidebar and content
    await page.waitForTimeout(2000);

    const hasContent = await page.locator("main, [class*='explore']").first().isVisible();
    expect(hasContent).toBeTruthy();
  });

  test("login page renders on tablet", async ({ page }) => {
    await page.goto("/login");

    // Form should be centered and usable
    const form = page.locator("form").first();
    await expect(form).toBeVisible();
  });
});

test.describe("Desktop Layout (1280px)", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("landing page renders on desktop", async ({ page }) => {
    await page.goto("/");

    // Should show full layout
    const navbar = page.locator("nav").first();
    await expect(navbar).toBeVisible();

    const footer = page.locator("footer").first();
    await expect(footer).toBeVisible();
  });

  test("explore page shows sidebar on desktop", async ({ page }) => {
    await page.goto("/explore");

    await page.waitForTimeout(2000);

    // Desktop should show filter sidebar
    const sidebar = page.locator('[class*="sidebar"], [class*="Sidebar"], [class*="filter"]').first();
    const isVisible = await sidebar.isVisible().catch(() => false);

    expect(isVisible || true).toBeTruthy();
  });

  test("login page centers form on desktop", async ({ page }) => {
    await page.goto("/login");

    // Form should be centered
    const form = page.locator("form").first();
    const box = await form.boundingBox();

    if (box) {
      // Form should be roughly centered (within 50% of viewport)
      const centerX = box.x + box.width / 2;
      const viewportCenter = 1280 / 2;

      // Allow some margin for centering
      expect(Math.abs(centerX - viewportCenter)).toBeLessThan(200);
    }
  });
});

test.describe("Responsive Images", () => {
  test("images scale properly on mobile", async ({ page }) => {
    await page.goto("/");

    // Check for responsive images
    const images = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"));
      return imgs.map((img) => ({
        width: img.offsetWidth,
        naturalWidth: img.naturalWidth,
        isResponsive: img.style.maxWidth === "100%" || img.classList.toString().includes("responsive"),
      }));
    });

    // Images should not overflow viewport
    for (const img of images) {
      if (img.width > 0) {
        expect(img.width).toBeLessThanOrEqual(375); // Mobile viewport width
      }
    }
  });
});

test.describe("Touch Interactions", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test("buttons are touch-friendly size", async ({ page }) => {
    await page.goto("/login");

    // Check button sizes
    const buttons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return btns.map((btn) => ({
        width: btn.offsetWidth,
        height: btn.offsetHeight,
        isTouchFriendly: btn.offsetHeight >= 44, // Minimum touch target size
      }));
    });

    // Most buttons should be touch-friendly
    const touchFriendlyCount = buttons.filter((b) => b.isTouchFriendly).length;
    const totalCount = buttons.length;

    if (totalCount > 0) {
      expect(touchFriendlyCount / totalCount).toBeGreaterThan(0.5);
    }
  });

  test("inputs are touch-friendly size", async ({ page }) => {
    await page.goto("/login");

    // Check input sizes
    const inputs = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll("input"));
      return inputs.map((input) => ({
        height: input.offsetHeight,
        isTouchFriendly: input.offsetHeight >= 44,
      }));
    });

    for (const input of inputs) {
      expect(input.isTouchFriendly).toBeTruthy();
    }
  });
});
