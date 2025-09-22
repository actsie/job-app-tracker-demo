// Bookmarklet for Job App Tracker
// To use: Create a bookmark with this code as the URL (prefix with javascript:)

javascript:(function(){
    const DESKTOP_APP_URL = 'http://localhost:3001';
    
    // Create UI overlay
    const overlay = document.createElement('div');
    overlay.id = 'job-tracker-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 2px solid #3b82f6;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        width: 400px;
        max-width: 90vw;
    `;
    
    overlay.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; color: #1f2937;">Job App Tracker</h3>
            <button id="close-btn" style="background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
        </div>
        <div id="status" style="padding: 8px; border-radius: 4px; margin-bottom: 12px; display: none;"></div>
        <div style="margin-bottom: 12px;">
            <strong>URL:</strong><br>
            <div style="font-size: 12px; color: #6b7280; word-break: break-all;">${window.location.href}</div>
        </div>
        <button id="capture-btn" style="
            background: #3b82f6;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            width: 100%;
            font-size: 14px;
            margin-bottom: 8px;
        ">Capture Job Description</button>
        <button id="test-btn" style="
            background: #6b7280;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            width: 100%;
            font-size: 12px;
        ">Test Connection</button>
    `;
    
    document.body.appendChild(overlay);
    
    function showStatus(message, type = 'success') {
        const statusDiv = document.getElementById('status');
        statusDiv.textContent = message;
        statusDiv.style.cssText = `
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 12px;
            display: block;
            background: ${type === 'error' ? '#fef2f2' : type === 'warning' ? '#fefbeb' : '#dcfce7'};
            color: ${type === 'error' ? '#dc2626' : type === 'warning' ? '#d97706' : '#166534'};
            font-size: 12px;
        `;
    }
    
    function extractJobDescription() {
        const selectors = [
            '.job-description', '.job-details', '.description',
            '[class*="job"][class*="description"]',
            '[class*="description"][class*="content"]',
            'main', 'article'
        ];
        
        let bestText = '';
        let bestHtml = '';
        let maxLength = 0;
        
        for (const selector of selectors) {
            try {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const text = element.innerText || element.textContent || '';
                    if (text.length > maxLength && text.length > 100) {
                        maxLength = text.length;
                        bestText = text;
                        bestHtml = element.outerHTML;
                    }
                }
            } catch (e) {}
        }
        
        if (!bestText || bestText.length < 200) {
            bestText = document.body.innerText || document.body.textContent || '';
            bestHtml = document.documentElement.outerHTML;
        }
        
        return {
            text: bestText.replace(/\s+/g, ' ').trim(),
            html: bestHtml
        };
    }
    
    async function fetchAuthToken() {
        const response = await fetch(`${DESKTOP_APP_URL}/api/auth-token`);
        if (!response.ok) {
            throw new Error(`Failed to get auth token: ${response.statusText}`);
        }
        const data = await response.json();
        return data.token;
    }
    
    async function testConnection() {
        const testBtn = document.getElementById('test-btn');
        testBtn.textContent = 'Testing...';
        testBtn.disabled = true;
        
        try {
            const response = await fetch(`${DESKTOP_APP_URL}/api/recent-captures`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            showStatus('✓ Desktop app is running!', 'success');
        } catch (error) {
            showStatus(`✗ Connection failed: ${error.message}`, 'error');
        } finally {
            testBtn.textContent = 'Test Connection';
            testBtn.disabled = false;
        }
    }
    
    async function captureJob() {
        const captureBtn = document.getElementById('capture-btn');
        captureBtn.textContent = 'Capturing...';
        captureBtn.disabled = true;
        
        try {
            showStatus('Extracting job description...', 'warning');
            const { text, html } = extractJobDescription();
            
            if (!text || text.length < 100) {
                throw new Error('Could not find job description text on this page');
            }
            
            try {
                showStatus('Getting auth token...', 'warning');
                const token = await fetchAuthToken();
                
                showStatus('Sending to desktop app...', 'warning');
                const response = await fetch(`${DESKTOP_APP_URL}/api/browser-capture`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: text,
                        url: window.location.href,
                        html: html,
                        auth_token: token
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }
                
                const data = await response.json();
                showStatus(`✓ Job captured! UUID: ${data.uuid.slice(0, 8)}...`, 'success');
                
                setTimeout(() => {
                    overlay.remove();
                }, 2000);
                
            } catch (networkError) {
                // Desktop app is not running - offer fallback options
                showAppNotRunningDialog(text);
            }
            
        } catch (error) {
            showStatus(`✗ Capture failed: ${error.message}`, 'error');
        } finally {
            captureBtn.textContent = 'Capture Job Description';
            captureBtn.disabled = false;
        }
    }
    
    function showAppNotRunningDialog(text) {
        overlay.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0; color: #1f2937;">Desktop App Not Running</h3>
                <button id="close-btn" style="background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
            </div>
            <div style="padding: 8px; border-radius: 4px; margin-bottom: 12px; background: #fefbeb; color: #d97706; font-size: 12px;">
                ⚠️ Could not connect to Job App Tracker desktop app
            </div>
            <div style="margin-bottom: 12px;">
                <p style="font-size: 14px; margin-bottom: 8px;">Choose an option:</p>
            </div>
            <button id="copy-btn" style="
                background: #3b82f6;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                width: 100%;
                font-size: 14px;
                margin-bottom: 8px;
            ">Copy Job Description to Clipboard</button>
            <button id="instructions-btn" style="
                background: #6b7280;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                width: 100%;
                font-size: 12px;
                margin-bottom: 8px;
            ">Show Desktop App Instructions</button>
            <button id="retry-btn" style="
                background: #10b981;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                width: 100%;
                font-size: 12px;
            ">Retry Connection</button>
        `;
        
        document.getElementById('close-btn').onclick = () => overlay.remove();
        
        document.getElementById('copy-btn').onclick = async () => {
            try {
                await navigator.clipboard.writeText(text);
                showStatus('✓ Job description copied to clipboard! You can now paste it manually in the desktop app.', 'success');
                setTimeout(() => overlay.remove(), 3000);
            } catch (e) {
                // Fallback for browsers that don't support clipboard API
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    showStatus('✓ Job description copied to clipboard! You can now paste it manually in the desktop app.', 'success');
                    setTimeout(() => overlay.remove(), 3000);
                } catch (fallbackError) {
                    showStatus('✗ Could not copy to clipboard. Please select the text manually.', 'error');
                }
                document.body.removeChild(textArea);
            }
        };
        
        document.getElementById('instructions-btn').onclick = () => {
            showInstructions();
        };
        
        document.getElementById('retry-btn').onclick = () => {
            overlay.remove();
            setTimeout(() => {
                captureJob();
            }, 100);
        };
    }
    
    function showInstructions() {
        overlay.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0; color: #1f2937;">Start Desktop App</h3>
                <button id="close-btn" style="background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
            </div>
            <div style="font-size: 12px; line-height: 1.5; margin-bottom: 16px;">
                <p><strong>To start the Job App Tracker desktop app:</strong></p>
                <ol style="margin: 8px 0; padding-left: 16px;">
                    <li>Open a terminal/command prompt</li>
                    <li>Navigate to your Job App Tracker folder</li>
                    <li>Run: <code style="background: #f3f4f6; padding: 2px 4px; border-radius: 2px;">npm run dev</code></li>
                    <li>Wait for "Server running on http://localhost:3000"</li>
                    <li>Return to this page and click "Try Again"</li>
                </ol>
                <p style="color: #6b7280; margin-top: 12px;">
                    Or visit <strong>http://localhost:3000</strong> to access the web interface.
                </p>
            </div>
            <button id="back-btn" style="
                background: #3b82f6;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                width: 100%;
                font-size: 12px;
            ">Back to Options</button>
        `;
        
        document.getElementById('close-btn').onclick = () => overlay.remove();
        document.getElementById('back-btn').onclick = () => {
            const { text } = extractJobDescription();
            showAppNotRunningDialog(text);
        };
    }
    
    // Event listeners
    document.getElementById('close-btn').onclick = () => overlay.remove();
    document.getElementById('test-btn').onclick = testConnection;
    document.getElementById('capture-btn').onclick = captureJob;
    
    // Auto-test connection
    testConnection();
    
    // Handle clicks outside overlay
    overlay.onclick = (e) => e.stopPropagation();
    document.onclick = () => overlay.remove();
})();