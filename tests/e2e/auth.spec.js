import { test, expect } from "@playwright/test";

/**
 * E2E tests for authentication flows.
 *
 * These tests run against a real Next.js dev server with local Supabase.
 * Only third-party providers (OTP/SMS, Razorpay) are mocked.
 */

test.describe("Login Page", () => {
  test("renders login form with email and password fields", async ({ page }) => {
    await page.goto("/login");

    // Check page title
    await expect(page).toHaveTitle(/Login/);

    // Check form fields exist
    const emailInput = page.locator("#login-email");
    const passwordInput = page.locator("#login-password");

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Check submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toContainText("Login");
  });

  test("shows validation error for empty form submission", async ({ page }) => {
    await page.goto("/login");

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // HTML5 validation should prevent submission
    // Check that email field is still focused or has validation
    const emailInput = page.locator("#login-email");
    await expect(emailInput).toBeFocused();
  });

  test("allows typing in email and password fields", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.locator("#login-email");
    const passwordInput = page.locator("#login-password");

    // Type in fields
    await emailInput.fill("test@example.com");
    await passwordInput.fill("password123");

    // Verify values
    await expect(emailInput).toHaveValue("test@example.com");
    await expect(passwordInput).toHaveValue("password123");
  });

  test("shows sign up link", async ({ page }) => {
    await page.goto("/login");

    // Check for sign up link
    const signUpLink = page.locator('a[href="/signup"]');
    await expect(signUpLink).toBeVisible();
    await expect(signUpLink).toContainText("Sign up");
  });

  test("shows error message for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill in invalid credentials
    await page.locator("#login-email").fill("invalid@example.com");
    await page.locator("#login-password").fill("wrongpassword");

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Wait for error message (Supabase will return an error)
    // The error should appear within a few seconds
    const errorMessage = page.locator('[class*="danger"]').first();
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test("redirects to home after successful login", async ({ page }) => {
    // This test requires valid test credentials in the environment
    // Skip if not available
    const testEmail = process.env.TEST_USER_EMAIL;
    const testPassword = process.env.TEST_USER_PASSWORD;

    if (!testEmail || !testPassword) {
      test.skip();
      return;
    }

    await page.goto("/login");

    // Fill in valid credentials
    await page.locator("#login-email").fill(testEmail);
    await page.locator("#login-password").fill(testPassword);

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Should redirect to home page
    await page.waitForURL("/", { timeout: 10000 });
    expect(page.url()).toBe("http://localhost:3000/");
  });
});

test.describe("Signup Page", () => {
  test("renders signup form with name, email, and password fields", async ({
    page,
  }) => {
    await page.goto("/signup");

    // Check page title
    await expect(page).toHaveTitle(/Signup/);

    // Check form fields exist
    const nameInput = page.locator("#signup-name");
    const emailInput = page.locator("#signup-email");
    const passwordInput = page.locator("#signup-password");

    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Check submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toContainText("Sign Up");
  });

  test("shows validation error for empty form submission", async ({ page }) => {
    await page.goto("/signup");

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // HTML5 validation should prevent submission
    const nameInput = page.locator("#signup-name");
    await expect(nameInput).toBeFocused();
  });

  test("allows typing in all fields", async ({ page }) => {
    await page.goto("/signup");

    const nameInput = page.locator("#signup-name");
    const emailInput = page.locator("#signup-email");
    const passwordInput = page.locator("#signup-password");

    // Type in fields
    await nameInput.fill("Test User");
    await emailInput.fill("test@example.com");
    await passwordInput.fill("password123");

    // Verify values
    await expect(nameInput).toHaveValue("Test User");
    await expect(emailInput).toHaveValue("test@example.com");
    await expect(passwordInput).toHaveValue("password123");
  });

  test("shows login link", async ({ page }) => {
    await page.goto("/signup");

    // Check for login link
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toContainText("Login");
  });

  test("shows success message after signup", async ({ page }) => {
    // Use a unique email to avoid conflicts
    const uniqueEmail = `test-${Date.now()}@example.com`;

    await page.goto("/signup");

    // Fill in form
    await page.locator("#signup-name").fill("Test User");
    await page.locator("#signup-email").fill(uniqueEmail);
    await page.locator("#signup-password").fill("TestPassword123!");

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Should show success/verification message
    const successMessage = page.locator('[class*="success"], [class*="primary"]').first();
    await expect(successMessage).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Navigation between Auth Pages", () => {
  test("can navigate from login to signup", async ({ page }) => {
    await page.goto("/login");

    // Click sign up link
    await page.locator('a[href="/signup"]').click();

    // Should be on signup page
    await page.waitForURL("/signup");
    await expect(page).toHaveTitle(/Signup/);
  });

  test("can navigate from signup to login", async ({ page }) => {
    await page.goto("/signup");

    // Click login link
    await page.locator('a[href="/login"]').click();

    // Should be on login page
    await page.waitForURL("/login");
    await expect(page).toHaveTitle(/Login/);
  });
});
