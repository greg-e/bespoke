import { test, expect } from '@playwright/test';

const APP_URL = process.env.APP_URL || 'https://gather.ehrenberg.us/app/';

// Utility: Wait for main content to load
async function waitForContent(page: any) {
  await page.waitForSelector('#content:not(.hidden)', { timeout: 15000 });
}

test.describe('Gather App – Public (signed-out) state', () => {
  test('main content loads from Supabase', async ({ page }) => {
    await page.goto(APP_URL);
    await waitForContent(page);
    // Accordion has at least one day loaded from Supabase
    const firstDay = page.locator('.accordion-day').first();
    await expect(firstDay).toBeVisible();
  });

  test('System tab is hidden', async ({ page }) => {
    await page.goto(APP_URL);
    await waitForContent(page);
    const systemTab = page.locator('.nav-tab[data-view="system"]');
    await expect(systemTab).toBeHidden();
  });

  test('footer shows key icon sign-in button', async ({ page }) => {
    await page.goto(APP_URL);
    await waitForContent(page);
    const signInButton = page.locator('#footer-status button[data-auth-action="signin"]');
    await expect(signInButton).toBeVisible();
    await expect(signInButton).toHaveAttribute('aria-label', 'Sign in to edit');
  });

  test('all editable fields are read-only', async ({ page }) => {
    await page.goto(APP_URL);
    await waitForContent(page);
    // Expand first accordion day
    await page.locator('.accordion-header').first().click();
    const editables = page.locator('.inline-edit');
    const count = await editables.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(editables.nth(i)).toHaveAttribute('contenteditable', 'false');
    }
  });

  test('empty assignees show TBD when signed out', async ({ page }) => {
    await page.goto(APP_URL);
    await waitForContent(page);
    // Expand all accordion days to reveal assignments
    const headers = page.locator('.accordion-header');
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      await headers.nth(i).click();
    }
    // Only check assignee-specific placeholders (not activity title etc.)
    const assigneePlaceholders = page.locator('.inline-assignee.is-placeholder');
    const count = await assigneePlaceholders.count();
    for (let i = 0; i < count; i++) {
      await expect(assigneePlaceholders.nth(i)).toHaveText('TBD');
    }
  });

  test('WhatsApp link in hangout prompt is clickable', async ({ page }) => {
    await page.goto(APP_URL);
    await waitForContent(page);
    // Expand days to find a hangout prompt
    const headers = page.locator('.accordion-header');
    const headerCount = await headers.count();
    for (let i = 0; i < headerCount; i++) {
      await headers.nth(i).click();
    }
    const hangoutLink = page.locator('.hangout-prompt__link').first();
    if (await hangoutLink.count() > 0) {
      await expect(hangoutLink).toHaveAttribute('href', /chat.whatsapp.com/);
      await expect(hangoutLink).toHaveAttribute('target', '_blank');
    }
  });

  test('nav tabs switch views for available tabs', async ({ page }) => {
    await page.goto(APP_URL);
    await waitForContent(page);
    const activeLabel = page.locator('#nav-active-label');
    const hamburger = page.locator('#nav-hamburger');

    for (const view of ['assignments', 'food', 'schedule']) {
      const tab = page.locator(`.nav-tab[data-view="${view}"]`);
      if (await tab.count() === 0) {
        continue;
      }

      // On narrow layouts, only the active tab is visible until the menu opens.
      if (!(await tab.isVisible()) && await hamburger.isVisible()) {
        await hamburger.click();
      }

      if (!(await tab.isVisible())) {
        continue;
      }

      await tab.click();

      // Verify user-visible state rather than CSS implementation details.
      await expect(activeLabel).toHaveText(new RegExp(`^${view}$`, 'i'));
      await expect(page.locator(`#view-${view}`)).not.toHaveClass(/hidden/);
    }
  });
});

// Note: Sign-in flow tests require a live email inbox to receive the Supabase magic link.
// To automate: integrate a service like Mailosaur or Ethereal to intercept emails and
// extract the magic link programmatically, then navigate to it in Playwright.
