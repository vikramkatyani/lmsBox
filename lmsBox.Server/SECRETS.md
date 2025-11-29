# Configuring Secrets for LMS Box

## ⚠️ Important Security Notice

**NEVER commit sensitive credentials to Git!** This includes:
- Database connection strings
- API keys (SendGrid, Azure, etc.)
- JWT secret keys
- Azure Storage connection strings

## Setup Methods

### Option 1: User Secrets (Recommended for Development)

User Secrets are stored outside your project directory and never committed to Git.

```powershell
# Navigate to the Server project
cd lmsBox.Server

# Initialize user secrets
dotnet user-secrets init

# Set your secrets
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost;Database=lmsbox;User Id=your_user;Password=your_password"
dotnet user-secrets set "Jwt:Key" "your-super-secret-jwt-key-min-32-chars"
dotnet user-secrets set "SendGrid:ApiKey" "your-sendgrid-api-key"
dotnet user-secrets set "AzureStorage:ConnectionString" "DefaultEndpointsProtocol=https;AccountName=your_account;AccountKey=your_key;EndpointSuffix=core.windows.net"
dotnet user-secrets set "OpenAI:ApiKey" "your-openai-api-key"

# List all secrets (to verify)
dotnet user-secrets list
```

### Option 2: Environment Variables (Production)

Set environment variables on your hosting platform:

**Windows (PowerShell):**
```powershell
$env:ConnectionStrings__DefaultConnection = "your-connection-string"
$env:Jwt__Key = "your-jwt-key"
$env:SendGrid__ApiKey = "your-sendgrid-key"
$env:AzureStorage__ConnectionString = "your-azure-connection"
```

**Linux/macOS:**
```bash
export ConnectionStrings__DefaultConnection="your-connection-string"
export Jwt__Key="your-jwt-key"
export SendGrid__ApiKey="your-sendgrid-key"
export AzureStorage__ConnectionString="your-azure-connection"
```

**Azure App Service:**
- Go to Configuration → Application Settings
- Add each secret as a new application setting
- Use double underscores `__` for nested config (e.g., `Jwt__Key`)

### Option 3: appsettings.Development.json (Local Only)

If you must use `appsettings.Development.json` for local development:

1. **Ensure it's in .gitignore** (it should already be ignored)
2. Copy `appsettings.Sample.json` to `appsettings.Development.json`
3. Fill in your actual values
4. **NEVER commit this file with real credentials**

## Required Secrets

| Secret | Description | Example Format |
|--------|-------------|----------------|
| `ConnectionStrings:DefaultConnection` | Database connection | SQL Server connection string |
| `Jwt:Key` | JWT signing key | Min 32 characters, random string |
| `SendGrid:ApiKey` | Email service | SG.xxxxxxxxxxxxxxxxx |
| `AzureStorage:ConnectionString` | Azure Blob Storage | DefaultEndpointsProtocol=https;... |
| `OpenAI:ApiKey` | OpenAI API for AI Assistant | sk-proj-... |

## Verifying Configuration

Your app will automatically load secrets from User Secrets in Development mode. To verify:

```powershell
dotnet run
```

Check the startup logs - if you see connection errors, your secrets may not be configured correctly.

## Azure Storage Setup

1. Create an Azure Storage Account
2. Create a container named `lms-content` (or update `AzureStorage:ContainerName`)
3. Get the connection string from Azure Portal:
   - Storage Account → Access Keys → Connection String
4. Set it using User Secrets (see Option 1 above)

## Rotating Secrets

If secrets are accidentally exposed:

1. **Immediately** regenerate them in Azure Portal / SendGrid
2. Update your local User Secrets with new values
3. Update production environment variables
4. Remove exposed secrets from Git history (see below)

## Removing Secrets from Git History

If you accidentally committed secrets:

```powershell
# Use git-filter-repo (recommended) or BFG Repo Cleaner
# This will rewrite Git history - coordinate with your team!

# Install git-filter-repo
pip install git-filter-repo

# Remove the file from all commits
git filter-repo --path lmsBox.Server/appsettings.Development.json --invert-paths

# Force push (CAUTION!)
git push origin --force --all
```

**Important:** Regenerate all exposed secrets immediately!

## Questions?

Contact your team lead or DevOps engineer for assistance with secret management.
