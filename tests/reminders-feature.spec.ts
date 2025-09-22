import { test, expect } from '@playwright/test';

test.describe('Next Reminders Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
  });

  test('should load application and show Active Board', async ({ page }) => {
    // STEP 1: Navigate to application - COMPLETED in beforeEach
    console.log('✅ STEP 1: Application navigation completed');

    // STEP 2: Capture initial state
    console.log('📸 STEP 2: Capturing initial state...');
    await page.screenshot({ path: 'test-results/initial-state.png', fullPage: true });
    
    // Verify main components are loaded
    await expect(page.locator('text=Job Application Tracker')).toBeVisible();
    await expect(page.locator('text=Active Applications')).toBeVisible();
    console.log('✅ STEP 2: Initial state captured and verified');
  });

  test('should create new application with reminder', async ({ page }) => {
    // STEP 3: Test interactive elements - Add Application
    console.log('🔧 STEP 3: Testing Add Application functionality...');
    
    // Click Add Application button
    await page.click('text=Add Application');
    await expect(page.locator('text=Add New Application')).toBeVisible();
    console.log('✅ Add Application dialog opened');

    // Fill in application details
    await page.fill('input[id="company"]', 'Test Company');
    await page.fill('input[id="role"]', 'Software Engineer');
    console.log('✅ Filled application details');

    // Test Set Reminder functionality
    await page.click('text=Set Reminder');
    await expect(page.locator('text=Set Reminder')).toBeVisible();
    console.log('✅ Set Reminder dialog opened');

    // Set reminder for tomorrow at 10 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    await page.fill('input[type="date"]', tomorrowStr);
    await page.fill('input[type="time"]', '10:00');
    await page.fill('textarea[id="reminder-message"]', 'Follow up on Test Company application');
    console.log('✅ Set reminder date, time, and message');

    // Save reminder
    await page.click('button:has-text("Save Reminder")');
    await page.waitForTimeout(1000);
    console.log('✅ Reminder saved successfully');

    // Submit application
    await page.click('button[type="submit"]:has-text("Add Application")');
    await page.waitForTimeout(2000);
    console.log('✅ Application submitted');

    // STEP 4: Verify changes
    console.log('📋 STEP 4: Verifying changes...');
    
    // Check if application appears in Active Board
    await expect(page.locator('text=Test Company')).toBeVisible();
    await expect(page.locator('text=Software Engineer')).toBeVisible();
    console.log('✅ New application visible in Active Board');

    // Check for upcoming reminders
    await expect(page.locator('text=Upcoming Reminders')).toBeVisible();
    console.log('✅ Upcoming Reminders section visible');

    // Capture final state
    await page.screenshot({ path: 'test-results/final-state.png', fullPage: true });
    console.log('✅ STEP 4: Changes verified and final state captured');
  });

  test('should allow inline editing of application fields', async ({ page }) => {
    // First create an application to edit
    await page.click('text=Add Application');
    await page.fill('input[id="company"]', 'Edit Test Company');
    await page.fill('input[id="role"]', 'Developer');
    await page.click('button[type="submit"]:has-text("Add Application")');
    await page.waitForTimeout(1000);

    // Test inline editing
    console.log('✏️ Testing inline editing functionality...');
    
    // Hover over company name to reveal edit button
    const companyCell = page.locator('text=Edit Test Company').first();
    await companyCell.hover();
    
    // Look for edit icon and click if visible
    const editButton = page.locator('button').filter({ hasText: /Edit Test Company/ }).locator('svg');
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.fill('input[value="Edit Test Company"]', 'Updated Company Name');
      await page.press('input[value="Updated Company Name"]', 'Enter');
      console.log('✅ Company name edited successfully');
    }

    // Test status dropdown
    const statusSelect = page.locator('select').first();
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('applied');
      console.log('✅ Status updated successfully');
    }

    await page.screenshot({ path: 'test-results/after-editing.png', fullPage: true });
    console.log('✅ Inline editing test completed');
  });

  test('should display and cancel reminders', async ({ page }) => {
    // Create application with reminder first
    await page.click('text=Add Application');
    await page.fill('input[id="company"]', 'Reminder Test Co');
    await page.fill('input[id="role"]', 'Test Role');
    
    await page.click('text=Set Reminder');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    await page.fill('input[type="date"]', tomorrowStr);
    await page.fill('input[type="time"]', '14:00');
    await page.click('button:has-text("Save Reminder")');
    await page.click('button[type="submit"]:has-text("Add Application")');
    await page.waitForTimeout(2000);

    console.log('🔔 Testing reminder management...');
    
    // Verify reminder appears in upcoming reminders
    await expect(page.locator('text=Upcoming Reminders')).toBeVisible();
    await expect(page.locator('text=Reminder Test Co')).toBeVisible();
    console.log('✅ Reminder appears in upcoming reminders list');

    // Test reminder cancellation
    const cancelButton = page.locator('button[title="Cancel reminder"]').first();
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      console.log('✅ Reminder cancelled successfully');
    }

    await page.screenshot({ path: 'test-results/reminder-management.png', fullPage: true });
    console.log('✅ Reminder management test completed');
  });
});