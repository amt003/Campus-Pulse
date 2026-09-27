import { test, expect } from '@playwright/test';

test.beforeEach(async () => {
  try {
    const dotenv = require('d:/Campus-Pulse/backend/node_modules/dotenv');
    dotenv.config({ path: 'd:/Campus-Pulse/backend/.env' });
    const mongoose = require('d:/Campus-Pulse/backend/node_modules/mongoose');
    if (mongoose.connection.readyState === 0 && process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
    const Application = mongoose.models.Application || mongoose.model('Application', new mongoose.Schema({}, { strict: false }));
    await Application.updateOne(
      { _id: '6a83e8a3441f51800b2e915f' },
      { $set: { status: 'Shortlisted', 'aptitude.status': 'Not Applicable' } }
    );
  } catch (e) {
    console.error('beforeEach reset error:', e);
  }
});

test('System blocks double-booking of students', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // Step 1: Login as recruiter (Gigabyte Technologies)
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.click('#role-btn-recruiter');
  await page.fill('#login-email', 'hr@giga.com');
  await page.fill('#login-password', 'Password123!');
  await page.click('#login-submit-btn');

  await expect(page).toHaveURL(/\/recruiter\/dashboard/, { timeout: 15000 });

  // Step 2: Open applications list for active drive
  await page.locator('.btn-action-primary').first().click();
  await expect(page).toHaveURL(/\/recruiter\/applications/, { timeout: 15000 });

  // Step 3: Select student who has a conflicting schedule (Ananya Pillai)
  const candidateRow = page.locator('tr:has-text("Ananya Pillai")');
  await candidateRow.locator('input[type="checkbox"]').click();

  // Step 4: Open schedule modal
  const scheduleBtn = page.locator('button.btn-bulk-schedule:has-text("Schedule Aptitude Test")');
  await expect(scheduleBtn).toBeEnabled({ timeout: 10000 });
  await scheduleBtn.click();

  // Step 5: Fill date and time slot with conflicting schedule
  await page.waitForSelector('#scheduleDate', { state: 'visible', timeout: 10000 });
  await page.fill('#scheduleDate', '2026-10-20');
  await page.fill('#scheduleTime', '10:00 AM - 11:00 AM');
  await page.click('.modal-footer .btn-submit');

  // Step 6: Expect conflict detection error notification
  await expect(page.locator('.alert-danger, .toast-error')).toContainText(/conflict|busy|already booked/i, { timeout: 10000 });
});
