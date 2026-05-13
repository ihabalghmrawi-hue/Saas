param(
  [Parameter(Mandatory)]
  [string]$Namespace = "finance"
)

$secrets = @{
  supabase_url              = Read-Host -Prompt "Supabase URL" -AsSecureString
  supabase_anon_key         = Read-Host -Prompt "Supabase Anon Key" -AsSecureString
  supabase_service_role_key = Read-Host -Prompt "Supabase Service Role Key" -AsSecureString
  session_secret            = Read-Host -Prompt "Session Secret" -AsSecureString
  redis_url                 = Read-Host -Prompt "Redis URL" -AsSecureString
  redis_sentinel_urls       = Read-Host -Prompt "Redis Sentinel URLs (comma-separated, optional)" -AsSecureString
}

$secretData = [ordered]@{}
foreach ($key in $secrets.Keys) {
  $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secrets[$key])
  $secretData[$key] = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

$manifest = @"
apiVersion: v1
kind: Secret
metadata:
  name: finance-secrets
  namespace: $Namespace
type: Opaque
stringData:
"@

foreach ($entry in $secretData.GetEnumerator()) {
  $manifest += "`n  $($entry.Key): $($entry.Value)"
}

$manifest | Out-File -FilePath "secrets-$Namespace.yaml" -Encoding utf8

Write-Host "Generated secrets-$Namespace.yaml — review before applying:"
Write-Host "  kubectl apply -f secrets-$Namespace.yaml"
Write-Host "  Remove-Item secrets-$Namespace.yaml  # after apply"
