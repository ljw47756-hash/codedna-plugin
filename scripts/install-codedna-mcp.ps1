param(
  [string]$PluginRoot,
  [string]$DataDir,
  [string]$NodePath,
  [string]$ServerName = "codedna_local",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Resolve-ExistingFile {
  param(
    [string[]]$Candidates,
    [string]$Label
  )

  foreach ($candidate in $Candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) {
      continue
    }
    $expanded = [Environment]::ExpandEnvironmentVariables($candidate)
    if (Test-Path -LiteralPath $expanded -PathType Leaf) {
      return (Resolve-Path -LiteralPath $expanded).Path
    }
  }

  throw "Could not find $Label. Provide it explicitly with the matching parameter."
}

function Resolve-CommandPath {
  param(
    [string]$CommandName,
    [string]$ExplicitPath,
    [string[]]$Fallbacks
  )

  if (-not [string]::IsNullOrWhiteSpace($ExplicitPath)) {
    if (Test-Path -LiteralPath $ExplicitPath -PathType Leaf) {
      return (Resolve-Path -LiteralPath $ExplicitPath).Path
    }
    throw "$CommandName path does not exist: $ExplicitPath"
  }

  $command = Get-Command $CommandName -ErrorAction SilentlyContinue
  if ($command -and $command.Source -and (Test-Path -LiteralPath $command.Source -PathType Leaf)) {
    return $command.Source
  }

  return Resolve-ExistingFile -Candidates $Fallbacks -Label $CommandName
}

function Resolve-PluginRoot {
  param([string]$ExplicitPluginRoot)

  if (-not [string]::IsNullOrWhiteSpace($ExplicitPluginRoot)) {
    if (Test-Path -LiteralPath $ExplicitPluginRoot -PathType Container) {
      return (Resolve-Path -LiteralPath $ExplicitPluginRoot).Path
    }
    throw "Plugin root does not exist: $ExplicitPluginRoot"
  }

  $root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
  if (Test-Path -LiteralPath (Join-Path $root.Path ".codex-plugin\plugin.json") -PathType Leaf) {
    return $root.Path
  }

  throw "Could not resolve CodeDNA plugin root from script location. Use -PluginRoot."
}

$resolvedPluginRoot = Resolve-PluginRoot -ExplicitPluginRoot $PluginRoot
$serverPath = Join-Path $resolvedPluginRoot "mcp-server\dist\server.js"
if (-not (Test-Path -LiteralPath $serverPath -PathType Leaf)) {
  throw "MCP server entrypoint not found: $serverPath. Reinstall the latest CodeDNA plugin or run npm run build in mcp-server."
}
$serverPath = (Resolve-Path -LiteralPath $serverPath).Path

if ([string]::IsNullOrWhiteSpace($DataDir)) {
  $DataDir = Join-Path $HOME ".codex\codedna-data"
}
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
$DataDir = (Resolve-Path -LiteralPath $DataDir).Path

$resolvedNodePath = Resolve-CommandPath `
  -CommandName "node" `
  -ExplicitPath $NodePath `
  -Fallbacks @(
    "$env:ProgramFiles\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\node-v24.15.0-win-x64\node.exe",
    "$env:LOCALAPPDATA\Programs\node-v22.15.0-win-x64\node.exe"
  )

$configPath = Join-Path $HOME ".codex\config.toml"
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
  throw "Codex config file not found: $configPath"
}

function Convert-ToTomlPath {
  param([string]$PathValue)
  return "'" + $PathValue.Replace("'", "''") + "'"
}

$serverPattern = "^\[mcp_servers\.$([Regex]::Escape($ServerName))\]"
$nodeToml = Convert-ToTomlPath $resolvedNodePath
$serverToml = Convert-ToTomlPath $serverPath
$rootToml = Convert-ToTomlPath $resolvedPluginRoot
$dataToml = Convert-ToTomlPath $DataDir
$configBlock = @"

[mcp_servers.$ServerName]
command = $nodeToml
args = [$serverToml]
cwd = $rootToml
startup_timeout_sec = 120
tool_timeout_sec = 120
enabled = true
default_tools_approval_mode = "prompt"

[mcp_servers.$ServerName.env]
CODEDNA_DATA_DIR = $dataToml
"@

Write-Output "CodeDNA MCP global registration"
Write-Output "Plugin root: $resolvedPluginRoot"
Write-Output "Server: $serverPath"
Write-Output "Node: $resolvedNodePath"
Write-Output "Data dir: $DataDir"
Write-Output "Config: $configPath"
Write-Output "Server name: $ServerName"

if ($DryRun) {
  Write-Output "Dry run only. TOML block that would be appended if missing:"
  Write-Output $configBlock
  exit 0
}

Copy-Item -LiteralPath $configPath -Destination "$configPath.bak-codedna-$(Get-Date -Format yyyyMMdd-HHmmss)" -Force

if (Select-String -Path $configPath -Pattern $serverPattern -Quiet) {
  Write-Output "$ServerName already exists in config.toml; no duplicate block was written."
} else {
  Add-Content -Path $configPath -Value $configBlock -Encoding UTF8
  Write-Output "$ServerName MCP config was written."
}

Write-Output "Restart Codex App, then open Settings -> MCP Servers."
