// Popup script for browser extension
document.addEventListener('DOMContentLoaded', async () => {
    const captureBtn = document.getElementById('captureBtn');
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    const statusDiv = document.getElementById('status');
    const currentUrlDiv = document.getElementById('currentUrl');
    const serverUrlInput = document.getElementById('serverUrl');
    const authTokenInput = document.getElementById('authToken');

    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentUrlDiv.textContent = tab.url;

    // Load saved settings
    const result = await chrome.storage.sync.get(['serverUrl', 'authToken']);
    if (result.serverUrl) {
        serverUrlInput.value = result.serverUrl;
    }
    if (result.authToken) {
        authTokenInput.value = result.authToken;
    }

    // Save settings on change
    serverUrlInput.addEventListener('change', () => {
        chrome.storage.sync.set({ serverUrl: serverUrlInput.value });
    });

    function showStatus(message, type = 'success') {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }

    async function fetchAuthToken() {
        try {
            const serverUrl = serverUrlInput.value || 'http://localhost:3000';
            const response = await fetch(`${serverUrl}/api/auth-token`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            authTokenInput.value = data.token;
            await chrome.storage.sync.set({ authToken: data.token });
            return data.token;
        } catch (error) {
            console.error('Failed to fetch auth token:', error);
            throw error;
        }
    }

    async function testConnection() {
        testConnectionBtn.disabled = true;
        testConnectionBtn.textContent = 'Testing...';
        
        try {
            let token = authTokenInput.value;
            if (!token) {
                showStatus('Fetching auth token...', 'warning');
                token = await fetchAuthToken();
                showStatus('Auth token fetched successfully!', 'success');
            }
            
            const serverUrl = serverUrlInput.value || 'http://localhost:3000';
            const response = await fetch(`${serverUrl}/api/recent-captures`);
            
            if (!response.ok) {
                throw new Error(`Connection failed: HTTP ${response.status}`);
            }
            
            showStatus('✓ Desktop app is running and accessible!', 'success');
        } catch (error) {
            showStatus(`✗ Connection failed: ${error.message}`, 'error');
        } finally {
            testConnectionBtn.disabled = false;
            testConnectionBtn.textContent = 'Test Connection';
        }
    }

    async function captureJobDescription() {
        captureBtn.disabled = true;
        captureBtn.textContent = 'Capturing...';
        
        try {
            // Get auth token
            let token = authTokenInput.value;
            if (!token) {
                showStatus('Fetching auth token...', 'warning');
                token = await fetchAuthToken();
            }

            // Inject content script to extract job description
            const [result] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: extractJobDescription,
            });

            const { text, html } = result.result;
            
            if (!text || text.trim().length < 100) {
                throw new Error('Could not find sufficient job description text on this page');
            }

            // Send to desktop app
            const serverUrl = serverUrlInput.value || 'http://localhost:3000';
            const response = await fetch(`${serverUrl}/api/browser-capture`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    url: tab.url,
                    html: html,
                    auth_token: token,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            showStatus(`✓ Job description captured successfully! (UUID: ${data.uuid.slice(0, 8)}...)`, 'success');
            
        } catch (error) {
            console.error('Capture failed:', error);
            
            // Check if it's a connection error (desktop app not running)
            if (error.message.includes('Failed to fetch') || error.message.includes('fetch') || error.message.includes('NetworkError')) {
                showFallbackOptions();
            } else {
                showStatus(`✗ Capture failed: ${error.message}`, 'error');
            }
        } finally {
            captureBtn.disabled = false;
            captureBtn.textContent = 'Capture Job Description';
        }
    }

    // Event listeners
    testConnectionBtn.addEventListener('click', testConnection);
    captureBtn.addEventListener('click', captureJobDescription);

    function showFallbackOptions() {
        showStatus('✗ Desktop app not running. See options below.', 'error');
        
        const fallbackDiv = document.createElement('div');
        fallbackDiv.style.cssText = 'margin-top: 12px; border-top: 1px solid #e5e7eb; padding-top: 12px;';
        fallbackDiv.innerHTML = `
            <p style="font-size: 12px; margin-bottom: 8px; color: #6b7280;">Choose an option:</p>
            <button id="copyToClipboard" style="
                background: #3b82f6; color: white; border: none; padding: 6px 12px;
                border-radius: 4px; cursor: pointer; width: 100%; font-size: 11px; margin-bottom: 4px;
            ">Copy Job Description to Clipboard</button>
            <button id="showInstructions" style="
                background: #6b7280; color: white; border: none; padding: 6px 12px;
                border-radius: 4px; cursor: pointer; width: 100%; font-size: 11px;
            ">How to Start Desktop App</button>
        `;
        
        document.body.appendChild(fallbackDiv);
        
        document.getElementById('copyToClipboard').onclick = async () => {
            try {
                const [result] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: extractJobDescription,
                });
                
                const { text } = result.result;
                await navigator.clipboard.writeText(text);
                showStatus('✓ Job description copied to clipboard!', 'success');
                
                // Remove fallback options
                fallbackDiv.remove();
            } catch (error) {
                showStatus('✗ Failed to copy to clipboard', 'error');
            }
        };
        
        document.getElementById('showInstructions').onclick = () => {
            alert(`To start the Job App Tracker desktop app:

1. Open a terminal/command prompt
2. Navigate to your Job App Tracker folder
3. Run: npm run dev
4. Wait for "Server running on http://localhost:3000"
5. Return here and try capturing again

Or visit http://localhost:3000 to access the web interface directly.`);
        };
    }

    // Auto-test connection on popup open
    testConnection();
});

// Function to be injected into the page
function extractJobDescription() {
    // Try to find job description text using various selectors
    const selectors = [
        '[data-testid*="job"] [data-testid*="description"]',
        '.job-description',
        '.job-details',
        '.description',
        '[class*="job"][class*="description"]',
        '[class*="description"][class*="content"]',
        'section:has(h1, h2, h3)',
        'main',
        'article',
        '.content',
        '#content'
    ];

    let bestText = '';
    let bestHtml = '';
    let maxLength = 0;

    // Try each selector
    for (const selector of selectors) {
        try {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                const text = element.innerText || element.textContent || '';
                if (text.length > maxLength && text.length > 200) {
                    maxLength = text.length;
                    bestText = text;
                    bestHtml = element.outerHTML;
                }
            }
        } catch (e) {
            // Skip invalid selectors
        }
    }

    // Fallback: get all text from body
    if (!bestText || bestText.length < 200) {
        bestText = document.body.innerText || document.body.textContent || '';
        bestHtml = document.documentElement.outerHTML;
    }

    // Clean up the text
    bestText = bestText.replace(/\s+/g, ' ').trim();

    return {
        text: bestText,
        html: bestHtml
    };
}