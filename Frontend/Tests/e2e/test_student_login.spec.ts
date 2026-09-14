import { test, expect } from '@playwright/test';

test('Student can login with roll number and view dashboard', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.click('#role-btn-student');
  await page.fill('#login-email', 'rahul.sharma@alphabetcollege.edu.in');
  await page.fill('#login-password', 'Rahul@2003');
  await page.click('#login-submit-btn');

  await expect(page).toHaveURL(/\/student\/dashboard/);
  await expect(page.locator('h1')).toContainText('Rahul Sharma');
});