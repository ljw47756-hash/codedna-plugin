# CodeDNA Codex Plugin

<p align="center">
  <img src="assets/icon.png" width="96" alt="CodeDNA icon" />
</p>

<p align="center">
  <strong>让 Codex 先理解、再执行、再审查。</strong><br />
  CodeDNA 是一款面向 Codex 的本地工具型插件，用来处理复杂、边界严格、需要验收的代码任务。
</p>

![CodeDNA workflow](assets/docs/codedna-workflow.svg)

## CodeDNA 是什么

CodeDNA 不是桌面软件，也不是普通脚本工具。它是一款 `MCP + Skills` 形态的 Codex Plugin：

- `Skills` 负责引导 Codex 什么时候使用 CodeDNA 工作流。
- `MCP server` 负责在本地生成结构化分析、任务包、审查报告和本地记忆。
- Codex 负责真正的理解、执行、编辑、验证和总结。

CodeDNA 的公开定位很简单：它给 Codex 加一层“任务 DNA”。在动手之前先把用户需求和技术分析配对，执行后再反向检查结果是否偏离原始需求。

## 核心链路

```text
用户需求链
    ↕ 配对审查
反向解析链
    ↓
Codex 任务包
    ↓
代码执行
    ↓
反向审查
    ↓
记忆进化
```

这条链路会帮助 Codex 在复杂任务里保持方向感：先明确目标和边界，再生成任务说明，执行后检查 diff、风险、测试和后续修复。

## 适合哪些任务

CodeDNA 更适合那些“直接让 Codex 改，容易跑偏”的任务：

| 场景 | 适合程度 | 建议用法 |
| --- | --- | --- |
| 多文件功能开发 | 很适合 | 先让 CodeDNA 梳理范围，再执行 |
| Bug 修复 | 适合 | 先确认现象、影响范围和验证方式 |
| 重构 | 很适合 | 先划定边界，避免行为变化 |
| 只允许改指定文件 | 很适合 | 先生成执行边界，再让 Codex 动手 |
| 安装、插件、MCP、配置问题 | 很适合 | 先诊断，再给出可执行步骤 |
| 安全、性能、架构相关变更 | 很适合 | 先评估风险，再执行 |
| Codex 已完成，需要验收 | 适合 | 用 CodeDNA 反向审查输出和 diff |
| 一句话解释、小文案、小翻译 | 不太需要 | 直接让 Codex 做即可 |

简单判断：任务越复杂、边界越重要、越需要验收，越适合使用 CodeDNA。

## 安装方式

使用前请确认本机安装了 Node.js 20 或更高版本：

```powershell
node -v
```

在 Codex App 中添加插件市场：

```text
来源: https://github.com/ljw47756-hash/codedna-plugin.git
Git 引用: main
稀疏路径: 留空
```

安装后建议重启 Codex App，或者至少新开一个对话，让插件能力重新加载。

![CodeDNA install](assets/docs/codedna-install.svg)

## 安装成功后应该看到什么

CodeDNA 是工具型插件，所以它通常会分散显示在两个位置：

- `Skills`：能搜索到 CodeDNA 相关技能。
- `Settings -> MCP Servers`：能看到 `Codedna` 或兜底配置里的 `codedna_local`。

它一般不会像普通 App 插件那样出现在右下角插件菜单里。只要 Skills 能触发，并且 MCP server 可用，就代表安装方向是对的。

![CodeDNA in Codex](assets/docs/codedna-app-visibility.svg)

## 常用触发方式

普通复杂任务：

```text
Use CodeDNA for this task.
```

先分析，不要立刻改文件：

```text
Use CodeDNA. Analyze first and ask me before editing.
```

高风险任务或多文件任务：

```text
Use CodeDNA full workflow before editing.
```

审查 Codex 已经完成的输出：

```text
Use CodeDNA to review this output.
```

中文也可以直接说：

```text
用 CodeDNA 先分析这个任务，不要直接改文件。
```

## 第一次测试

新开一个 Codex 对话，输入：

```text
Use CodeDNA full workflow for this project:
C:\path\to\your\project

Request:
Add a short README quick start section, but do not edit files yet.
```

如果 CodeDNA 正常工作，Codex 会先进行分析和任务准备，而不是直接改文件。

## 生成文件在哪里

CodeDNA 的运行数据默认保存在插件包内的 `data/` 目录中，常见位置包括：

```text
data/tasks/       Codex Task Pack
data/reviews/     Review Report
data/memory/      本地记忆和历史记录
data/strands/     需求链、解析链、配对结果
```

这些是本地运行数据，不建议提交到公开仓库。

## MCP 没有启动怎么办

如果你已经能看到 CodeDNA Skills，但 `Settings -> MCP Servers` 里没有可用的 `codedna`，请先按顺序检查：

1. 重启 Codex App。
2. 确认 `node -v` 是 Node.js 20 或更高版本。
3. 删除旧版 CodeDNA 插件后，重新从 `main` 安装。
4. 确认 MCP 开关已经打开。

如果仍然不能启动，可以使用下面的 PowerShell 兜底方案。它会从 Codex 插件缓存中找到 CodeDNA 的 `mcp-server/dist/server.js`，并写入 `%USERPROFILE%\.codex\config.toml`。正常安装不需要运行这段脚本；它只用于排查或 Codex App 暂时没有自动挂载插件 MCP 的情况。

<details>
<summary>Windows PowerShell 兜底脚本</summary>

```powershell
$ErrorActionPreference = "Stop"

$config = "$env:USERPROFILE\.codex\config.toml"

$server = Get-ChildItem "$env:USERPROFILE\.codex\plugins\cache" -Recurse -File -Filter "server.js" -ErrorAction SilentlyContinue |
    Where-Object {
        $_.FullName -match "codedna|CodeDNA|codedna-local|codedna-plugin" -and
        $_.FullName -match "mcp-server\\dist\\server.js"
    } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $server) {
    throw "没有找到 CodeDNA 的 mcp-server\dist\server.js"
}

$node = (Get-Command node.exe -ErrorAction Stop).Source
$serverPath = $server.FullName

$distDir = Split-Path $serverPath -Parent
$mcpServerDir = Split-Path $distDir -Parent
$pluginRoot = Split-Path $mcpServerDir -Parent
$dataDir = Join-Path $pluginRoot "data"

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

function TomlPath($p) {
    return "'" + $p.Replace("'", "''") + "'"
}

$nodeToml = TomlPath $node
$serverToml = TomlPath $serverPath
$rootToml = TomlPath $pluginRoot
$dataToml = TomlPath $dataDir

Copy-Item $config "$config.bak-codedna-$(Get-Date -Format yyyyMMdd-HHmmss)" -Force

if (Select-String -Path $config -Pattern '^\[mcp_servers\.codedna_local\]' -Quiet) {
    Write-Host "codedna_local 已经存在，未重复写入。" -ForegroundColor Yellow
} else {
    $block = @"

[mcp_servers.codedna_local]
command = $nodeToml
args = [$serverToml]
cwd = $rootToml
startup_timeout_sec = 120
tool_timeout_sec = 120
enabled = true
default_tools_approval_mode = "prompt"

[mcp_servers.codedna_local.env]
CODEDNA_DATA_DIR = $dataToml
"@

    Add-Content -Path $config -Value $block -Encoding UTF8
    Write-Host "已写入 codedna_local MCP 配置。" -ForegroundColor Green
}

Write-Host ""
Write-Host "Node:" $node
Write-Host "Server:" $serverPath
Write-Host "PluginRoot:" $pluginRoot
Write-Host "Config:" $config
```

</details>

运行后重启 Codex App，再进入 `Settings -> MCP Servers` 查看 `codedna_local`。

## 分享给别人

把这个仓库地址发给对方即可：

```text
https://github.com/ljw47756-hash/codedna-plugin.git
```

对方在 Codex App 添加插件市场时填写：

```text
来源: https://github.com/ljw47756-hash/codedna-plugin.git
Git 引用: main
稀疏路径: 留空
```

不要分享你电脑里的插件缓存目录，例如：

```text
C:\Users\<name>\.codex\plugins\cache\...
```

缓存目录只适合当前电脑，不适合作为插件分发来源。

## 隐私和公开边界

CodeDNA 的 MCP server 在本地运行，不依赖外部 AI API。公开仓库只展示安装方式、使用方式和高层能力说明，不展开内部规则细节。这样既方便用户安装，也避免把完整方法论直接暴露成可复制清单。

请不要提交本地运行数据、私有项目内容、密钥、token、个人路径或本地记忆文件。

## 开发者验证

构建 MCP server：

```powershell
cd plugins\codedna-plugin\mcp-server
npm ci
npm run build
```

运行测试：

```powershell
npm test
```

检查插件入口：

```powershell
Test-Path .\dist\server.js
```
