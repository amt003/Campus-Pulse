import { test, expect } from '@playwright/test';

test('Recruiter registers and TPO approves them', async ({ page, context }) => {
  const uniqueId = Date.now();
  const companyName = `Test Corp ${uniqueId}`;
  const officialEmail = `hr${uniqueId}@testcorp.com`;

  // Step 1: Recruiter registers
  await page.goto('/register', { waitUntil: 'domcontentloaded' });
  await page.fill('#reg-company-name', companyName);
  await page.fill('#reg-official-email', officialEmail);
  await page.fill('#reg-website', 'https://testcorp.com');
  await page.fill('#reg-cover-note', 'We are pleased to introduce our organization for campus recruitment drives at your institution.');
  await page.fill('#reg-contact', 'John Doe');
  await page.fill('#reg-phone', '+919876543210');
  await page.fill('#reg-password', 'SecurePass@123');
  await page.fill('#reg-confirm-pwd', 'SecurePass@123');
  await page.locator('label[for="reg-terms"]').click();
  await page.click('#reg-submit-btn');

  await expect(page.locator('.success-state')).toContainText('awaiting TPO approval', { timeout: 10000 });

  // Step 2: TPO logs in on a new tab and approves
  const tpoPage = await context.newPage();
  await tpoPage.goto('/login', { waitUntil: 'domcontentloaded' });
  await tpoPage.click('#role-btn-tpo');
  await tpoPage.fill('#login-email', 'tpo@alphabetcollege.edu.in');
  await tpoPage.fill('#login-password', 'Password123!');
  await tpoPage.click('#login-submit-btn');

  await expect(tpoPage).toHaveURL(/\/tpo\/dashboard/);

  // Step 3: TPO reviews pending recruiters and approves
  await tpoPage.goto('/tpo/approval');
  const recruiterRow = tpoPage.locator(`tr:has-text("${companyName}")`);
  await expect(recruiterRow).toBeVisible();
  await recruiterRow.locator('.btn-approve').click();

  // Confirm in approval modal
  await tpoPage.click('.btn-confirm-approve');

  // Step 4: Verify recruiter appears under Approved tab
  await tpoPage.click('button:has-text("Approved")');
  await expect(tpoPage.locator(`tr:has-text("${companyName}")`)).toBeVisible();
});