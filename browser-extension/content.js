// Content script for additional functionality
// This script runs on all pages and can provide additional features like keyboard shortcuts

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractJobDescription') {
        const result = extractJobDescriptionContent();
        sendResponse(result);
    }
});

function extractJobDescriptionContent() {
    // Similar extraction logic as in popup.js but more sophisticated
    const selectors = [
        // LinkedIn
        '.jobs-description__content',
        '.jobs-description-content__text',
        
        // Indeed
        '.jobsearch-jobDescriptionText',
        '.jobsearch-JobComponent-description',
        
        // Glassdoor
        '.jobDescriptionContent',
        '.desc',
        
        // General selectors
        '[data-testid*="job"] [data-testid*="description"]',
        '.job-description',
        '.job-details',
        '.description',
        '[class*="job"][class*="description"]',
        '[class*="description"][class*="content"]',
        'section:has(h1, h2, h3)',
        'main',
        'article'
    ];

    let bestText = '';
    let bestHtml = '';
    let maxLength = 0;

    // Try specific job site selectors first
    for (const selector of selectors) {
        try {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                const text = element.innerText || element.textContent || '';
                // Look for substantial text content that looks like a job description
                if (text.length > maxLength && text.length > 100 && 
                    (text.toLowerCase().includes('responsibilities') ||
                     text.toLowerCase().includes('requirements') ||
                     text.toLowerCase().includes('qualifications') ||
                     text.toLowerCase().includes('experience'))) {
                    maxLength = text.length;
                    bestText = text;
                    bestHtml = element.outerHTML;
                }
            }
        } catch (e) {
            console.warn('Error with selector:', selector, e);
        }
    }

    // Fallback to getting the main content
    if (!bestText || bestText.length < 200) {
        const main = document.querySelector('main') || document.querySelector('article') || document.body;
        bestText = main.innerText || main.textContent || '';
        bestHtml = main.outerHTML || document.documentElement.outerHTML;
    }

    // Clean up the text
    bestText = bestText.replace(/\s+/g, ' ').trim();

    // Extract plain text excerpt (first 2KB)
    const plainTextExcerpt = bestText.length > 2000 
        ? bestText.substring(0, 1997) + '...'
        : bestText;

    return {
        text: bestText,
        html: bestHtml,
        raw_html: bestHtml,  // For server-side formatting
        plain_text_excerpt: plainTextExcerpt,
        url: window.location.href,
        title: document.title
    };
}

// Optional: Add keyboard shortcut listener
document.addEventListener('keydown', (event) => {
    // Ctrl+Shift+J or Cmd+Shift+J to capture job description
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'J') {
        event.preventDefault();
        
        // Send message to background script to trigger capture
        chrome.runtime.sendMessage({
            action: 'captureFromKeyboard',
            data: extractJobDescriptionContent()
        });
    }
});