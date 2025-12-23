# Restore AWS Credentials - Action Required

**Status**: CRITICAL - Bedrock integration broken due to missing AWS credentials
**Date**: 2025-12-19T03:08:12Z
**Affected**: Staging (rom-agent-ia-onrender-com) and Production (rom-agent-ia)

## Problem Summary

AWS credentials are missing from the staging environment, causing all `/api/chat` requests to fail with HTTP 500.

**Evidence**:
```json
"bedrock": {
  "status": "connected",
  "region": "us-east-1",
  "credentials": {
    "hasAccessKeyId": false,
    "hasSecretAccessKey": false,
    "hasRegion": false
  }
}
```

**Impact**:
- 100% failure rate on chat requests (15/15 failed in burst test)
- Circuit breaker triggered 39 failures
- Error: "All models in fallback chain failed (1 attempts)"

## Step-by-Step Resolution

### Step 1: Access Render Dashboard (STAGING)

1. Go to: https://dashboard.render.com/
2. Navigate to: **rom-agent-ia-onrender-com** service
3. Click on **"Environment"** tab (left sidebar)

### Step 2: Add AWS Credentials

Add these **three environment variables**:

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

**Important**:
- Use the SAME credentials that were working before
- Ensure `AWS_REGION=us-east-1` (not us-west-2)
- Double-check for typos in the access key and secret

### Step 3: Deploy

1. Click **"Manual Deploy"** button (top right)
2. Wait for deployment to complete (~2-3 minutes)
3. Service will restart and load the new environment variables

### Step 4: Verify (Run Locally)

```bash
cd ~/ROM-Agent
BASE_URL="https://rom-agent-ia-onrender-com.onrender.com" bash scripts/validate-all.sh
```

**Expected result**:
```
"credentials": {
  "hasAccessKeyId": true,
  "hasSecretAccessKey": true,
  "hasRegion": true
}
```

### Step 5: Repeat for PRODUCTION

1. Go to: **rom-agent-ia** service (production)
2. Add the SAME three environment variables
3. Click **"Manual Deploy"**
4. Validate production:
```bash
cd ~/ROM-Agent
export BASE_URL="https://iarom.com.br"
export X_ADMIN_TOKEN=63a2de1784b57db90b3139277e1ed75b0daca799073c638442f57a46e79bc4ff
REQS=60 PAR=12 bash scripts/validate-go-live.sh
```

## Alternative: Use Environment Mirroring Script

**After staging is fixed**, you can mirror credentials to production using:

```bash
export RENDER_API_KEY="your-render-api-key"
export STAGING_SERVICE_ID="srv-..."  # rom-agent-ia-onrender-com
export PROD_SERVICE_ID="srv-..."     # rom-agent-ia

bash scripts/mirror-env-staging-to-prod.sh
```

This will copy ALL environment variables matching the pattern:
- `AWS_*`
- `BEDROCK_*`
- `ENABLE_*`
- `MAX_CONCURRENT`
- `MAX_QUEUE`

## Validation Checklist

After restoring credentials, verify:

- [ ] `/api/info` shows `hasAccessKeyId: true`
- [ ] `/api/info` shows `hasSecretAccessKey: true`
- [ ] `/api/info` shows `hasRegion: true`
- [ ] POST `/api/chat` returns HTTP 200 (not 500)
- [ ] Burst test shows successful responses (not all 500s)
- [ ] Circuit breaker failures stop increasing

## Diagnostic Tool (Optional)

If you want to test credentials locally before adding to Render:

```bash
cd ~/ROM-Agent
bash scripts/diagnose-aws-bedrock.sh
```

This script will:
1. Verify AWS credentials with STS GetCallerIdentity
2. List available Bedrock models in your region
3. Perform a real invocation of Claude model
4. Provide detailed error diagnostics if anything fails

## IAM Permissions Required

Your AWS IAM user/role must have these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:ListFoundationModels"
      ],
      "Resource": "*"
    }
  ]
}
```

## Next Steps After Resolution

1. **Re-validate both environments** to confirm Bedrock working
2. **Update RC tag** if validation passes
3. **Proceed with go-live** on iarom.com.br
4. **Document root cause** to prevent future credential loss

## Support

If credentials are lost or you don't have access:
1. Check AWS IAM console for user/access keys
2. Create new IAM user with Bedrock permissions if needed
3. Generate new access key pair
4. Update both staging and production environments
