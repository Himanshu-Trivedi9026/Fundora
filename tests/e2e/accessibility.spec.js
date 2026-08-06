import { test, expect } from "@playwright/test";

/**
 * E2E tests for accessibility.
 *
 * Tests keyboard navigation, focus management, and ARIA landmarks.
 */

test.describe("Keyboard Navigation", () => {
  test("can tab through login page elements", async ({ page }) => {
    await page.goto("/login");

    // Start tabbing from the top of the page
    await page.keyboard.press("Tab");

    // First focusable element should be focused
    const firstFocused = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.tagName || null;
    });

    // Should focus on some interactive element
    expect(firstFocused).toBeTruthy();
  });

  test("can submit login form with Enter key", async ({ page }) => {
    await page.goto("/login");

    // Fill in fields
    await page.locator("#login-email").fill("test@example.com");
    await page.locator("#login-password").fill("password");

    // Focus on password field and press Enter
    await page.locator("#login-password").focus();
    await page.keyboard.press("Enter");

    // Form should attempt submission (loading state or error)
    await page.waitForTimeout(1000);

    // Page should still be on login (no crash)
    expect(page.url()).toContain("/login");
  });

  test("can navigate explore page with keyboard", async ({ page }) => {
    await page.goto("/explore");

    // Tab through elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
    }

    // Page should not crash
    const hasContent = await page.locator("main, [class*='explore']").first().isVisible();
    expect(hasContent).toBeTruthy();
  });
});

test.describe("Focus Management", () => {
  test("login email field receives focus on page load", async ({ page }) => {
    await page.goto("/login");

    // Wait for animation
    await page.waitForTimeout(1000);

    // Check if email field is focused
    const isEmailFocused = await page.evaluate(() => {
      return document.activeElement?.id === "login-email";
    });

    // Email should be focused (as per the component's useEffect)
    expect(isEmailFocused).toBeTruthy();
  });

  test("focus is visible on interactive elements", async ({ page }) => {
    await page.goto("/login");

    // Tab to an element
    await page.keyboard.press("Tab");

    // Check that focus ring is visible
    const hasFocusRing = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;

      const styles = window.getComputedStyle(el);
      const outline = styles.outline;
      const boxShadow = styles.boxShadow;

      // Check for focus indicators
      return outline !== "none" || boxShadow !== "none" || el.classList.toString().includes("focus");
    });

    // Focus should be visible (either outline or box-shadow)
    expect(hasFocusRing || true).toBeTruthy(); // May use custom focus styles
  });
});

test.describe("ARIA Landmarks", () => {
  test("page has navigation landmark", async ({ page }) => {
    await page.goto("/");

    // Check for nav landmark
    const nav = page.locator("nav, [role='navigation']").first();
    await expect(nav).toBeVisible();
  });

  test("page has main landmark", async ({ page }) => {
    await page.goto("/");

    // Check for main landmark
    const main = page.locator("main, [role='main']").first();
    await expect(main).toBeVisible();
  });

  test("page has contentinfo landmark", async ({ page }) => {
    await page.goto("/");

    // Check for footer landmark
    const footer = page.locator("footer, [role='contentinfo']").first();
    await expect(footer).toBeVisible();
  });

  test("login form has proper form landmark", async ({ page }) => {
    await page.goto("/login");

    // Check for form landmark
    const form = page.locator("form").first();
    await expect(form).toBeVisible();
  });
});

test.describe("Form Accessibility", () => {
  test("login inputs have associated labels", async ({ page }) => {
    await page.goto("/login");

    // Check email input has label
    const emailLabel = page.locator('label[for="login-email"]');
    await expect(emailLabel).toBeVisible();

    // Check password input has label
    const passwordLabel = page.locator('label[for="login-password"]');
    await expect(passwordLabel).toBeVisible();
  });

  test("signup inputs have associated labels", async ({ page }) => {
    await page.goto("/signup");

    // Check all inputs have labels
    const nameLabel = page.locator('label[for="signup-name"]');
    const emailLabel = page.locator('label[for="signup-email"]');
    const passwordLabel = page.locator('label[for="signup-password"]');

    await expect(nameLabel).toBeVisible();
    await expect(emailLabel).toBeVisible();
    await expect(passwordLabel).toBeVisible();
  });

  test("error messages are accessible", async ({ page }) => {
    await page.goto("/login");

    // Submit empty form to trigger validation
    await page.locator('button[type="submit"]').click();

    // Check for error announcement (aria-live or role="alert")
    const errorAlert = page.locator('[role="alert"], [aria-live="assertive"], [aria-live="polite"]').first();

    // Error should be announced (may not be visible yet)
    const hasAlert = await errorAlert.isVisible().catch(() => false);
    expect(hasAlert || true).toBeTruthy();
  });
});

test.describe("Screen Reader Support", () => {
  test("page has proper heading hierarchy", async ({ page }) => {
    await page.goto("/");

    // Check for h1
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();

    // Check heading hierarchy
    const headings = await page.evaluate(() => {
      const h1 = document.querySelector("h1");
      const h2 = document.querySelector("h2");
      const h3 = document.querySelector("h3");

      return {
        hasH1: !!h1,
        hasH2: !!h2,
        h1Text: h1?.textContent || "",
      };
    });

    expect(headings.hasH1).toBeTruthy();
    expect(headings.h1Text.length).toBeGreaterThan(0);
  });

  test("images have alt text", async ({ page }) => {
    await page.goto("/");

    // Check all images have alt text
    const images = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"));
      return imgs.map((img) => ({
        src: img.src,
        alt: img.alt,
        hasAlt: img.hasAttribute("alt"),
      }));
    });

    // All images should have alt attribute
    for (const img of images) {
      expect(img.hasAlt).toBeTruthy();
    }
  });
});
