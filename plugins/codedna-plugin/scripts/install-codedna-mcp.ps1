param(
  [string]$PluginRoot,
  [string]$DataDir,
  [string]$NodePath,
  [string]$CodexPath,
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

$codexFallbacks = @()
if ($env:CODEX_CLI_PATH) {
  $codexFallbacks += $env:CODEX_CLI_PATH
}
$codexBinRoot = Join-Path $env:LOCALAPPDATA "OpenAI\Codex\bin"
if (Test-Path -LiteralPath $codexBinRoot -PathType Container) {
  $codexFallbacks += Get-ChildItem -LiteralPath $codexBinRoot -Recurse -Filter "codex.exe" -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -ExpandProperty FullName
}

$resolvedCodexPath = Resolve-CommandPath `
  -CommandName "codex" `
  -ExplicitPath $CodexPath `
  -Fallbacks $codexFallbacks

$addArgs = @(
  "mcp",
  "add",
  "codedna",
  "--env",
  "CODEDNA_DATA_DIR=$DataDir",
  "--",
  $resolvedNodePath,
  $serverPath
)

Write-Output "CodeDNA MCP global registration"
Write-Output "Plugin root: $resolvedPluginRoot"
Write-Output "Server: $serverPath"
Write-Output "Node: $resolvedNodePath"
Write-Output "Codex CLI: $resolvedCodexPath"
Write-Output "Data dir: $DataDir"

if ($DryRun) {
  Write-Output "Dry run only. Commands that would run:"
  Write-Output "`"$resolvedCodexPath`" mcp remove codedna"
  Write-Output "`"$resolvedCodexPath`" $($addArgs -join ' ')"
  exit 0
}

try {
  & $resolvedCodexPath mcp remove codedna 2>$null | Out-Null
}
catch {
  # It is safe to continue when the server was not registered before.
}

& $resolvedCodexPath @addArgs
if ($LASTEXITCODE -ne 0) {
  throw "Failed to register CodeDNA MCP with Codex CLI."
}

& $resolvedCodexPath mcp get codedna
if ($LASTEXITCODE -ne 0) {
  throw "CodeDNA MCP was added, but Codex CLI could not read it back."
}

Write-Output "CodeDNA MCP registered. Restart Codex App, then open Settings -> MCP Servers."
