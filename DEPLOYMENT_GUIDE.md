# LMS Box - Azure Deployment Guide

## Current Status

✅ **Completed:**
- GitHub workflows configured and pushed
- Static Web App created: https://mango-pond-036dd7103.3.azurestaticapps.net
- App Service created: https://lmsbox.azurewebsites.net
- Workflows updated to use Azure auto-generated files

🔄 **In Progress:**
- Frontend deployment (GitHub Actions running)
- Backend configuration (waiting for your connection strings)

---

## Quick Start: Configure App Service

### 1. Get Required Information

#### Azure SQL Database Connection String
```powershell
# Portal method:
# Azure Portal → SQL Database → Connection strings → ADO.NET (copy the full string)

# CLI method:
az sql db show-connection-string `
  --client ado.net `
  --name lmsbox `
  --server <your-sql-server-name>
# Then replace <username> and <password> with actual credentials
```

#### Azure Storage Connection String
```powershell
# Portal method:
# Azure Portal → Storage Account → Access keys → Connection string (copy)

# CLI method:
az storage account show-connection-string `
  --name <your-storage-account-name> `
  --resource-group <your-resource-group>
```

#### Generate JWT Secret Key
```powershell
# PowerShell method:
Add-Type -AssemblyName System.Web
[System.Web.Security.Membership]::GeneratePassword(64,10)
```

### 2. Run Configuration Script

1. Open `azure-app-service-config.ps1`
2. Replace the placeholder values at the top:
   - `$resourceGroup` = your Azure resource group name
   - `$sqlConnectionString` = from step 1
   - `$storageConnectionString` = from step 1
   - `$jwtKey` = generated from step 1
3. Run the script:
   ```powershell
   .\azure-app-service-config.ps1
   ```

### 3. Verify and Restart

```powershell
# Restart App Service to apply settings
az webapp restart --name lmsbox --resource-group <your-resource-group>

# Check if it's running
az webapp show --name lmsbox --resource-group <your-resource-group> --query state
```

---

## Manual Configuration (Alternative)

If you prefer Azure Portal:

1. **App Service → Configuration → Application settings**
2. Click **+ New application setting** for each:

### Required Settings

| Name | Value |
|------|-------|
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ConnectionStrings__DefaultConnection` | Your SQL connection string |
| `AzureStorage__ConnectionString` | Your storage connection string |
| `AzureStorage__ContainerName` | `lms-content` |
| `Jwt__Key` | Strong random secret (64+ chars) |
| `Jwt__Issuer` | `lmsbox` |
| `Jwt__Audience` | `lmsbox-audience` |
| `Cors__AllowedOrigins__0` | `https://mango-pond-036dd7103.3.azurestaticapps.net` |
| `Cors__AllowCredentials` | `true` |
| `LoginLink__FrontendBaseUrl` | `https://mango-pond-036dd7103.3.azurestaticapps.net` |

3. Click **Save** and restart the App Service

---

## Post-Configuration Checklist

### Database Setup
- [ ] SQL Server firewall allows Azure services
  ```powershell
  az sql server firewall-rule create `
    --resource-group <your-resource-group> `
    --server <your-sql-server> `
    --name AllowAzureServices `
    --start-ip-address 0.0.0.0 `
    --end-ip-address 0.0.0.0
  ```
- [ ] Database exists (migrations will run automatically on first API start)

### Storage Setup
- [ ] Storage container `lms-content` exists
  ```powershell
  az storage container create `
    --name lms-content `
    --account-name <your-storage-account> `
    --public-access off
  ```

### GitHub Actions
- [ ] Check deployment status: https://github.com/vikramkatyani/lmsBox/actions
- [ ] Frontend workflow ("Azure Static Web Apps CI/CD") - should be green
- [ ] Backend workflow ("Build and deploy ASP.Net Core app") - should be green

### Validation
- [ ] Frontend loads: https://mango-pond-036dd7103.3.azurestaticapps.net
- [ ] API responds: https://lmsbox.azurewebsites.net (may show 404 on root - that's ok)
- [ ] No CORS errors in browser console when using the app
- [ ] Login works and creates session

---

## Monitoring Deployments

### Check GitHub Actions Status
```powershell
# Open Actions page in browser
start https://github.com/vikramkatyani/lmsBox/actions

# Or use GitHub CLI
gh run list --limit 5
gh run view <run-id> --log
```

### Check App Service Logs
```powershell
# Stream live logs
az webapp log tail --name lmsbox --resource-group <your-resource-group>

# Download logs
az webapp log download --name lmsbox --resource-group <your-resource-group>
```

### Check Static Web App Status
```powershell
az staticwebapp show `
  --name lmsBox `
  --resource-group <your-resource-group>
```

---

## Troubleshooting

### Frontend not loading
- Check GitHub Actions → "Azure Static Web Apps CI/CD" logs
- Verify `skip_app_build: false` in workflow
- Ensure `VITE_API_BASE` is set correctly in workflow

### API not responding
- Check GitHub Actions → "Build and deploy ASP.Net Core app" logs
- Verify App Service settings are correct
- Check App Service logs: `az webapp log tail --name lmsbox --resource-group <your-rg>`
- Ensure database connection string is valid and firewall allows Azure

### CORS errors
- Verify `Cors__AllowedOrigins__0` matches exact frontend URL (with https://)
- Check `Cors__AllowCredentials` is set to `true`
- Restart App Service after changing CORS settings

### Database migration errors
- App applies migrations automatically on startup
- Check logs: `az webapp log tail --name lmsbox --resource-group <your-rg>`
- Verify SQL connection string and firewall rules

---

## Useful Commands Reference

```powershell
# Login to Azure
az login

# List resource groups
az group list --output table

# List App Services
az webapp list --output table

# Check App Service configuration
az webapp config appsettings list `
  --name lmsbox `
  --resource-group <your-rg> `
  --output table

# Restart App Service
az webapp restart `
  --name lmsbox `
  --resource-group <your-rg>

# Open App Service in browser
az webapp browse `
  --name lmsbox `
  --resource-group <your-rg>
```

---

## Need Help?

1. **Check GitHub Actions logs** for build/deploy errors
2. **Check App Service logs** for runtime errors  
3. **Verify all configuration settings** are correct
4. **Ensure database and storage** are accessible from Azure

**Resource URLs:**
- Frontend: https://mango-pond-036dd7103.3.azurestaticapps.net
- Backend API: https://lmsbox.azurewebsites.net
- GitHub Actions: https://github.com/vikramkatyani/lmsBox/actions
- Azure Portal: https://portal.azure.com
