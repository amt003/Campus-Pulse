import { test, expect } from '@playwright/test';

test('Student can login and apply to an eligible job drive', async ({ page }) => {
  // 1. Student login
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.click('#role-btn-student');
  await page.fill('#login-email', 'ananya.pillai@alphabetcollege.edu.in');
  await page.fill('#login-password', 'Ananya@2003');
  await page.click('#login-submit-btn');

  await expect(page).toHaveURL(/\/student\/dashboard/);
  await expect(page.locator('h1')).toContainText('Ananya Pillai', { timeout: 10000 });

  // 2. Verify drives are visible on student dashboard
  const driveCards = page.locator('.drive-card-screenshot');
  await expect(driveCards.first()).toBeVisible();

  // 3. If an unapplied drive exists, click Apply Now and verify
  const applyBtn = page.locator('.btn-apply-action').first();
  if (await applyBtn.isVisible()) {
    await applyBtn.click();
    await expect(page.locator('.toast-success, .btn-applied-status').first()).toBeVisible();
  } else {
    // Already applied to all drives, verify status button is visible
    await expect(page.locator('.btn-applied-status').first()).toBeVisible();
  }

  // 4. Navigate to Applications page and verify application history
  await page.goto('/student/applications');
  await expect(page).toHaveURL(/\/student\/applications/);
  await expect(page.locator('.applications-container, .table-container, main').first()).toBeVisible();
});
