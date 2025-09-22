# Deployment Guide

## Render.com Deployment

This project includes configuration for easy deployment to render.com.

### Option 1: Automatic Configuration (Recommended)

The `render.yaml` file in the root directory will automatically configure environment variables when you deploy:

```yaml
services:
  - type: web
    name: job-app-tracker-demo
    env: node
    plan: free
    buildCommand: npm install; npm run build
    startCommand: npm start
    envVars:
      - key: NEXT_PUBLIC_DEMO_MODE
        value: true
      - key: DEMO_MODE
        value: true
      # ... other demo settings
```

### Option 2: Manual Environment Variable Setup

If you prefer to set environment variables manually in the render.com dashboard:

**Required Environment Variables for Demo Mode:**
```
NEXT_PUBLIC_DEMO_MODE=true
DEMO_MODE=true
MAX_UPLOAD_FILES=10
MAX_FILE_SIZE_MB=5
ALLOWED_EXTENSIONS=pdf,docx,txt
DEMO_DATA_SEED=42
DEMO_SESSION_TIMEOUT=3600000
```

### Demo Banner Requirements

The demo banner (with privacy warning) will only show when:
- `NEXT_PUBLIC_DEMO_MODE=true` is set
- User hasn't dismissed it (stored in localStorage)

**Important**: Without `NEXT_PUBLIC_DEMO_MODE=true`, the privacy warning about shared demo data will NOT be visible to users.

### Local Development

For local development with demo mode:

1. Copy `.env.example` to `.env.local` 
2. Set `NEXT_PUBLIC_DEMO_MODE=true` in `.env.local`
3. Restart your dev server

The `.env.local` file is already configured in this repository and will enable demo mode locally.

### Verifying Demo Mode

After deployment, check that:

1. **Demo banner appears** on the homepage with privacy warning
2. **Console logs show**: `demoClient: true` in browser dev tools
3. **Upload limits** are enforced (10 files, 5MB each)

### Troubleshooting

**Demo banner not showing?**
- Check that `NEXT_PUBLIC_DEMO_MODE=true` is set in environment variables
- Clear browser localStorage and refresh
- Verify console logs show `demoClient: true`

**Environment variables not working?**
- Ensure variables starting with `NEXT_PUBLIC_` are set (client-side)
- Server-side variables don't need the `NEXT_PUBLIC_` prefix
- Redeploy after changing environment variables