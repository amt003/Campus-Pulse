import { test, expect } from '@playwright/test';

test('System blocks double-booking of students', async ({ page }) => {
  // Step 1: Login as recruiter (Gigabyte Technologies)
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.click('#role-btn-recruiter');
  await page.fill('#login-email', 'hr@giga.com');
  await page.fill('#login-password', 'Password123!');
  await page.click('#login-submit-btn');

  await expect(page).toHaveURL(/\/recruiter\/dashboard/);

  // Step 2: Open applications list for active drive
  await page.locator('.btn-action-primary').first().click();
  await expect(page).toHaveURL(/\/recruiter\/applications/);

  // Step 3: Select student who has a conflicting schedule (Ananya Pillai)
  const candidateRow = page.locator('tr:has-text("Ananya Pillai")');
  await candidateRow.locator('input[type="checkbox"]').click();

  // Step 4: Open schedule modal
  await page.locator('button.btn-bulk-schedule:has-text("Schedule Aptitude Test")').click();

  // Step 5: Fill date and time slot with conflicting schedule
  await page.fill('#scheduleDate', '2026-09-20');
  await page.fill('#scheduleTime', '10:00 AM - 11:00 AM');
  await page.click('.modal-footer .btn-submit');

  // Step 6: Expect conflict detection error notification
  await expect(page.locator('.alert-danger, .toast-error')).toContainText(/conflict|busy|already booked/i);
});
