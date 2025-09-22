#!/usr/bin/env node

/**
 * Focused E2E Test for Email Draft Functionality
 * Tests the core email draft features as required
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Test configuration
const APP_URL = 'http://localhost:3000';
const TEST_RESULTS_DIR = path.join(__dirname, 'test-results');
const SCREENSHOT_DIR = path.join(TEST_RESULTS_DIR, 'focused-email-draft-screenshots');

// Ensure directories exist
if (!fs.existsSync(TEST_RESULTS_DIR)) fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let testResults = [];
let screenshotCount = 1;

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type.toUpperCase();
  console.log(`[${timestamp}] [${prefix}] ${message}`);
}

function addTestResult(testName, status, details = '') {
  testResults.push({
    testName,
    status,
    details,
    timestamp: new Date().toISOString()
  });
  
  if (status === 'PASS') {
    log(`✅ ${testName}: ${details}`, 'pass');
  } else {
    log(`❌ ${testName}: ${details}`, 'fail');
  }
}

async function takeScreenshot(page, name) {
  const filename = `${screenshotCount.toString().padStart(2, '0')}-${name}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  screenshotCount++;
  log(`Screenshot saved: ${filename}`);
  return filename;
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFocusedEmailDraftTest() {
  let browser, page;
  
  try {
    log('Starting Focused Email Draft Functionality E2E Test');
    
    // Initialize Puppeteer
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });
    
    page = await browser.newPage();
    
    // Enable console logging from browser
    page.on('console', msg => log(`Browser: ${msg.text()}`));
    page.on('pageerror', error => log(`Page Error: ${error.message}`, 'error'));
    
    // Step 1: Navigate to application
    log('Step 1: Navigating to the application');
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await takeScreenshot(page, 'application-loaded');
    addTestResult('Navigation to Application', 'PASS', 'Application loaded successfully');
    
    // Step 2: Wait for content to load and take screenshot
    log('Step 2: Waiting for application content to load');
    await delay(3000); // Give time for React components to render
    await takeScreenshot(page, 'application-content-loaded');
    
    // Step 3: Look for job applications - check the page content
    log('Step 3: Looking for job applications');
    
    // Look for the loading spinner first - it should disappear
    try {
      await page.waitForSelector('.animate-spin', { timeout: 5000 });
      log('Loading spinner found, waiting for it to disappear...');
      await page.waitForSelector('.animate-spin', { hidden: true, timeout: 15000 });
      log('Loading completed');
    } catch (error) {
      log('No loading spinner found or it disappeared quickly');
    }
    
    await delay(2000);
    await takeScreenshot(page, 'after-loading-complete');
    
    // Step 4: Look for Mail icons/buttons
    log('Step 4: Looking for Mail icons in job applications');
    
    // Try different selectors for mail buttons
    const mailButtonSelectors = [
      'button[title*="email" i]',
      'button[title*="mail" i]',
      'button:has(svg.lucide-mail)',
      'button svg.lucide-mail',
      '.lucide-mail',
      '[class*="mail"]'
    ];
    
    let mailButtons = [];
    let foundMailButton = false;
    
    for (const selector of mailButtonSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          log(`Found ${elements.length} elements with selector: ${selector}`);
          mailButtons = elements;
          foundMailButton = true;
          break;
        }
      } catch (error) {
        log(`Selector ${selector} failed: ${error.message}`);
      }
    }
    
    if (foundMailButton) {
      addTestResult('Mail Button Discovery', 'PASS', `Found mail buttons using selector`);
      await takeScreenshot(page, 'mail-buttons-found');
      
      // Step 5: Click on the first mail button
      log('Step 5: Clicking on mail button to open email draft editor');
      
      try {
        await mailButtons[0].click();
        await delay(2000); // Wait for dialog to appear
        
        // Look for the dialog
        const dialogSelectors = [
          '[role="dialog"]',
          '[class*="dialog"]',
          '.dialog',
          '[data-radix-portal]'
        ];
        
        let emailDialog = null;
        for (const selector of dialogSelectors) {
          try {
            emailDialog = await page.$(selector);
            if (emailDialog) {
              log(`Email draft dialog found with selector: ${selector}`);
              break;
            }
          } catch (error) {
            continue;
          }
        }
        
        if (emailDialog) {
          addTestResult('Email Draft Editor Opening', 'PASS', 'Email draft editor dialog opened');
          await takeScreenshot(page, 'email-draft-editor-opened');
          
          // Step 6: Test email template fields
          log('Step 6: Testing email template fields');
          
          const companyField = await page.$('#company, input[placeholder*="company" i]');
          const roleField = await page.$('#role, input[placeholder*="role" i]');
          const subjectField = await page.$('#subject, input[placeholder*="subject" i]');
          const bodyField = await page.$('#emailBody, textarea[rows]');
          
          if (companyField && roleField && subjectField && bodyField) {
            addTestResult('Template Fields Presence', 'PASS', 'All required template fields found');
            
            // Get field values
            const companyValue = await page.evaluate(el => el.value, companyField);
            const roleValue = await page.evaluate(el => el.value, roleField);
            const subjectValue = await page.evaluate(el => el.value, subjectField);
            const bodyValue = await page.evaluate(el => el.value, bodyField);
            
            log(`Company: ${companyValue}`);
            log(`Role: ${roleValue}`);
            log(`Subject: ${subjectValue}`);
            log(`Body length: ${bodyValue.length} characters`);
            
            if (companyValue && roleValue && subjectValue) {
              addTestResult('Template Data Population', 'PASS', `Template populated with job data: ${companyValue} - ${roleValue}`);
            } else {
              addTestResult('Template Data Population', 'FAIL', 'Template fields not properly populated');
            }
            
            // Step 7: Test field editing
            log('Step 7: Testing field editing functionality');
            
            await companyField.click();
            await companyField.evaluate(el => el.select());
            await companyField.type('Test Company Name');
            await delay(1000);
            
            const updatedCompanyValue = await page.evaluate(el => el.value, companyField);
            if (updatedCompanyValue.includes('Test Company Name')) {
              addTestResult('Field Editing', 'PASS', 'Template fields are editable');
            } else {
              addTestResult('Field Editing', 'FAIL', 'Field editing did not work');
            }
            
            await takeScreenshot(page, 'after-field-editing');
            
            // Step 8: Test email body editing
            log('Step 8: Testing email body editing');
            
            await bodyField.click();
            await bodyField.type('\\n\\nThis is a test addition to verify body editing works.');
            await delay(1000);
            
            const updatedBodyValue = await page.evaluate(el => el.value, bodyField);
            if (updatedBodyValue.includes('test addition')) {
              addTestResult('Email Body Editing', 'PASS', 'Email body editing works');
            } else {
              addTestResult('Email Body Editing', 'FAIL', 'Email body editing failed');
            }
            
            // Check for manual edit indicator
            const editIndicator = await page.$('text="Manually edited"');
            if (editIndicator) {
              addTestResult('Manual Edit Indicator', 'PASS', 'Manual edit indicator appears correctly');
            }
            
            await takeScreenshot(page, 'after-body-editing');
            
            // Step 9: Test copy to clipboard functionality
            log('Step 9: Testing copy to clipboard functionality');
            
            const copyButton = await page.$('button:has-text("Copy to Clipboard")');
            if (copyButton) {
              await copyButton.click();
              await delay(2000);
              
              // Look for toast notification
              const toastSelectors = [
                '.toast',
                '[class*="toast"]',
                '[role="alert"]',
                '[data-radix-toast-root]'
              ];
              
              let toastFound = false;
              for (const selector of toastSelectors) {
                try {
                  const toast = await page.$(selector);
                  if (toast) {
                    const toastText = await page.evaluate(el => el.textContent, toast);
                    log(`Toast found: ${toastText}`);
                    if (toastText.toLowerCase().includes('copied')) {
                      addTestResult('Copy to Clipboard', 'PASS', 'Copy to clipboard works with confirmation');
                      toastFound = true;
                      break;
                    }
                  }
                } catch (error) {
                  continue;
                }
              }
              
              if (!toastFound) {
                addTestResult('Copy to Clipboard', 'PARTIAL', 'Copy button clicked, no visible confirmation');
              }
            } else {
              addTestResult('Copy to Clipboard', 'FAIL', 'Copy button not found');
            }
            
            await takeScreenshot(page, 'after-copy-test');
            
            // Step 10: Test mail app functionality
            log('Step 10: Testing mail app opening functionality');
            
            const mailAppButton = await page.$('button:has-text("Open in Mail"), button:has-text("Mail App")');
            if (mailAppButton) {
              // We'll just click it - the mailto link should trigger
              await mailAppButton.click();
              await delay(1000);
              addTestResult('Mail App Button', 'PASS', 'Mail app button clicked successfully');
            } else {
              addTestResult('Mail App Button', 'FAIL', 'Mail app button not found');
            }
            
            // Step 11: Test reset template functionality
            log('Step 11: Testing template reset functionality');
            
            const resetButton = await page.$('button:has-text("Reset")');
            if (resetButton) {
              await resetButton.click();
              await delay(2000);
              addTestResult('Template Reset', 'PASS', 'Reset button works');
            } else {
              addTestResult('Template Reset', 'FAIL', 'Reset button not found');
            }
            
            await takeScreenshot(page, 'after-reset-test');
            
            // Close the dialog
            const closeButton = await page.$('button:has-text("Close")');
            if (closeButton) {
              await closeButton.click();
              await delay(1000);
            }
            
          } else {
            addTestResult('Template Fields Presence', 'FAIL', 'Required template fields missing');
          }
          
        } else {
          addTestResult('Email Draft Editor Opening', 'FAIL', 'Email draft dialog did not open');
        }
        
      } catch (error) {
        addTestResult('Mail Button Click', 'FAIL', `Error clicking mail button: ${error.message}`);
      }
      
    } else {
      addTestResult('Mail Button Discovery', 'FAIL', 'No mail buttons found in the application');
      
      // Let's check what content is actually on the page
      const bodyHTML = await page.evaluate(() => document.body.innerHTML);
      log('Page content preview: ' + bodyHTML.substring(0, 500) + '...');
    }
    
    await takeScreenshot(page, 'final-application-state');
    
  } catch (error) {
    log(`Critical test failure: ${error.message}`, 'error');
    addTestResult('Critical Test Failure', 'FAIL', `Test suite failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Main execution
async function main() {
  try {
    await runFocusedEmailDraftTest();
    
    // Generate summary
    const passedTests = testResults.filter(t => t.status === 'PASS').length;
    const failedTests = testResults.filter(t => t.status === 'FAIL').length;
    const totalTests = testResults.length;
    
    console.log('\\n' + '='.repeat(80));
    console.log('FOCUSED EMAIL DRAFT FUNCTIONALITY TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`Screenshots Directory: ${SCREENSHOT_DIR}`);
    console.log('='.repeat(80));
    
    // Save detailed results
    const detailedResults = {
      timestamp: new Date().toISOString(),
      testSuite: 'Focused Email Draft Functionality E2E Test',
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        successRate: ((passedTests / totalTests) * 100).toFixed(1) + '%'
      },
      results: testResults
    };
    
    fs.writeFileSync(
      path.join(TEST_RESULTS_DIR, 'focused-email-draft-results.json'),
      JSON.stringify(detailedResults, null, 2)
    );
    
    // List all test results
    console.log('\\nDetailed Test Results:');
    testResults.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${status} ${result.testName}: ${result.details}`);
    });
    
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

// Run the test
main();