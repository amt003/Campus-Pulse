# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test_recruiter_approval.spec.ts >> Recruiter registers and TPO approves them
- Location: tests\e2e\test_recruiter_approval.spec.ts:3:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#reg-submit-btn')
    - locator resolved to <button disabled type="submit" class="btn-submit" id="reg-submit-btn" _ngcontent-ng-c1449818019="">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
      - waiting 100ms
    59 × waiting for element to be visible, enabled and stable
       - element is not enabled
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - complementary [ref=e5]:
    - generic [ref=e6]:
      - link "CampusPulse" [ref=e7] [cursor=pointer]:
        - /url: /
      - generic [ref=e12]:
        - generic [ref=e13]: corporate_fare
        - generic [ref=e18]: school
        - generic [ref=e20]: analytics
        - generic [ref=e22]: verified
        - generic [ref=e24]: bolt
      - generic [ref=e26]:
        - heading "Find Top Talent From India's Best" [level=2] [ref=e27]: Find Top TalentFrom India's Best
        - paragraph [ref=e28]: Join 1,200+ recruiters already hiring from 300+ premium institutions through CampusPulse's AI-driven placement platform.
      - generic [ref=e29]:
        - generic [ref=e30]:
          - generic [ref=e31]: check_circle
          - generic [ref=e32]: AI-ranked candidate shortlists
        - generic [ref=e33]:
          - generic [ref=e34]: check_circle
          - generic [ref=e35]: One-click interview scheduling
        - generic [ref=e36]:
          - generic [ref=e37]: check_circle
          - generic [ref=e38]: Access to verified student profiles
        - generic [ref=e39]:
          - generic [ref=e40]: check_circle
          - generic [ref=e41]: Real-time placement analytics
  - main [ref=e42]:
    - generic [ref=e43]:
      - generic [ref=e44]:
        - link "arrow_back Back to Home" [ref=e45] [cursor=pointer]:
          - /url: /
          - generic [ref=e46]: arrow_back
          - generic [ref=e47]: Back to Home
        - generic [ref=e48]: ·
      - generic [ref=e49]:
        - generic [ref=e50]:
          - generic [ref=e51]: corporate_fare
          - generic [ref=e52]: Recruiter Registration
        - heading "Register Your Company" [level=1] [ref=e53]
        - paragraph [ref=e54]: Access the next generation of industry professionals
      - generic [ref=e55]:
        - generic [ref=e56]:
          - generic [ref=e57]:
            - text: Company Name
            - generic [ref=e58]: "*"
          - generic [ref=e59]:
            - generic: business
            - textbox "Company Name *" [ref=e60]:
              - /placeholder: e.g., Google India
              - text: Test Corp 1789231227216
        - generic [ref=e61]:
          - generic [ref=e62]:
            - text: Official Email
            - generic [ref=e63]: "*"
          - generic [ref=e64]:
            - generic: mail
            - textbox "Official Email *" [ref=e65]:
              - /placeholder: hr@company.com
              - text: hr1789231227216@testcorp.com
        - generic [ref=e66]:
          - generic [ref=e67]:
            - text: Company Website URL
            - generic [ref=e68]: "*"
          - generic [ref=e69]:
            - generic: language
            - textbox "Company Website URL *" [ref=e70]:
              - /placeholder: https://company.com
              - text: https://testcorp.com
        - generic [ref=e71]:
          - generic [ref=e72]:
            - text: Cover Note / Introduction Letter to TPO
            - generic [ref=e73]: "*"
          - generic [ref=e74]:
            - generic: description
            - textbox "Cover Note / Introduction Letter to TPO *" [ref=e75]:
              - /placeholder: "Subject: Request for Campus Recruitment Partner Approval\n\nDear Training & Placement Officer,\n\nWe are pleased to introduce [Company Name] for campus recruitment drives at your institution. Our hiring team is looking to recruit final-year candidates for engineering and analytical roles..."
              - text: We are pleased to introduce our organization for campus recruitment drives at your institution.
          - paragraph [ref=e76]:
            - generic [ref=e77]: check_circle
            - text: Cover note ready for TPO verification review
        - generic [ref=e78]:
          - generic [ref=e79]:
            - generic [ref=e80]:
              - text: Contact Person Name
              - generic [ref=e81]: "*"
            - generic [ref=e82]:
              - generic: person
              - textbox "Contact Person Name *" [ref=e83]:
                - /placeholder: John Doe
                - text: John Doe
          - generic [ref=e84]:
            - generic [ref=e85]:
              - text: Phone Number
              - generic [ref=e86]: "*"
            - generic [ref=e87]:
              - generic: phone
              - textbox "Phone Number *" [ref=e88]:
                - /placeholder: +91 98765 43210
                - text: "+919876543210"
        - generic [ref=e89]:
          - generic [ref=e90]:
            - generic [ref=e91]:
              - text: Password
              - generic [ref=e92]: "*"
            - generic [ref=e93]:
              - generic: lock
              - textbox "Password *" [ref=e94]:
                - /placeholder: Min. 8 characters
                - text: SecurePass@123
              - button "Show" [ref=e95] [cursor=pointer]:
                - generic [ref=e96]: visibility
            - generic [ref=e97]:
              - generic [ref=e98]: 8+ chars
              - generic [ref=e99]: Uppercase
              - generic [ref=e100]: Number
              - generic [ref=e101]: Special
          - generic [ref=e102]:
            - generic [ref=e103]:
              - text: Confirm Password
              - generic [ref=e104]: "*"
            - generic [ref=e105]:
              - generic: lock_reset
              - textbox "Confirm Password *" [ref=e106]:
                - /placeholder: Re-enter password
                - text: SecurePass@123
              - button "Show" [ref=e107] [cursor=pointer]:
                - generic [ref=e108]: visibility
        - generic [ref=e109]:
          - generic [ref=e110]: Strong
          - list [ref=e117]:
            - listitem [ref=e118]: ✓ At least 8 characters
            - listitem [ref=e119]: ✓ One uppercase letter
            - listitem [ref=e120]: ✓ One number
            - listitem [ref=e121]: ✓ One special character
        - generic [ref=e125] [cursor=pointer]:
          - text: I agree to CampusPulse's
          - link "Terms & Conditions" [active] [ref=e126]:
            - /url: /terms
        - button "how_to_reg Register Company" [disabled] [ref=e127]:
          - generic [ref=e128]: how_to_reg
          - generic [ref=e129]: Register Company
        - paragraph [ref=e130]:
          - text: Already registered?
          - link "Sign in to your account" [ref=e131] [cursor=pointer]:
            - /url: /login
        - link "Terms & Conditions" [ref=e133] [cursor=pointer]:
          - /url: /terms
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('Recruiter registers and TPO approves them', async ({ page, context }) => {
  4  |   const uniqueId = Date.now();
  5  |   const companyName = `Test Corp ${uniqueId}`;
  6  |   const officialEmail = `hr${uniqueId}@testcorp.com`;
  7  | 
  8  |   // Step 1: Recruiter registers
  9  |   await page.goto('/register', { waitUntil: 'domcontentloaded' });
  10 |   await page.fill('#reg-company-name', companyName);
  11 |   await page.fill('#reg-official-email', officialEmail);
  12 |   await page.fill('#reg-website', 'https://testcorp.com');
  13 |   await page.fill('#reg-cover-note', 'We are pleased to introduce our organization for campus recruitment drives at your institution.');
  14 |   await page.fill('#reg-contact', 'John Doe');
  15 |   await page.fill('#reg-phone', '+919876543210');
  16 |   await page.fill('#reg-password', 'SecurePass@123');
  17 |   await page.fill('#reg-confirm-pwd', 'SecurePass@123');
  18 |   await page.locator('label[for="reg-terms"]').click();
> 19 |   await page.click('#reg-submit-btn');
     |              ^ Error: page.click: Test timeout of 30000ms exceeded.
  20 | 
  21 |   await expect(page.locator('.success-state')).toContainText('awaiting TPO approval', { timeout: 10000 });
  22 | 
  23 |   // Step 2: TPO logs in on a new tab and approves
  24 |   const tpoPage = await context.newPage();
  25 |   await tpoPage.goto('/login', { waitUntil: 'domcontentloaded' });
  26 |   await tpoPage.click('#role-btn-tpo');
  27 |   await tpoPage.fill('#login-email', 'tpo@alphabetcollege.edu.in');
  28 |   await tpoPage.fill('#login-password', 'Password123!');
  29 |   await tpoPage.click('#login-submit-btn');
  30 | 
  31 |   await expect(tpoPage).toHaveURL(/\/tpo\/dashboard/);
  32 | 
  33 |   // Step 3: TPO reviews pending recruiters and approves
  34 |   await tpoPage.goto('/tpo/approval');
  35 |   const recruiterRow = tpoPage.locator(`tr:has-text("${companyName}")`);
  36 |   await expect(recruiterRow).toBeVisible();
  37 |   await recruiterRow.locator('.btn-approve').click();
  38 | 
  39 |   // Confirm in approval modal
  40 |   await tpoPage.click('.btn-confirm-approve');
  41 | 
  42 |   // Step 4: Verify recruiter appears under Approved tab
  43 |   await tpoPage.click('button:has-text("Approved")');
  44 |   await expect(tpoPage.locator(`tr:has-text("${companyName}")`)).toBeVisible();
  45 | });
```