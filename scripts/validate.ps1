param(
    [switch]$Quick,
    [switch]$Backend,
    [switch]$Frontend
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$exitCode = 0

function Invoke-Check {
    param(
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    Write-Host "`n==> $Label" -ForegroundColor Cyan
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Label fallo (codigo de salida $LASTEXITCODE)."
    }
}

Push-Location -LiteralPath $repoRoot
try {
    $selectedModeCount = 0
    foreach ($selectedMode in @($Quick, $Backend, $Frontend)) {
        if ($selectedMode.IsPresent) {
            $selectedModeCount++
        }
    }
    if ($selectedModeCount -gt 1) {
        throw 'Los modos -Quick, -Backend y -Frontend son mutuamente excluyentes.'
    }

    $mode = if ($Quick) { 'QUICK' } elseif ($Backend) { 'BACKEND' } elseif ($Frontend) { 'FRONTEND' } else { 'FULL' }
    $runBackend = $mode -in @('FULL', 'QUICK', 'BACKEND')
    $runFrontend = $mode -in @('FULL', 'QUICK', 'FRONTEND')

    Write-Host "==> Modo: $mode" -ForegroundColor Cyan
    Write-Host '==> Verificando herramientas locales' -ForegroundColor Cyan

    $missing = @()
    if ($runBackend) {
        $pythonCandidates = @(
            (Join-Path $repoRoot 'backend/.venv/Scripts/python.exe'),
            (Join-Path $repoRoot '.venv/Scripts/python.exe')
        )
        $backendPython = $pythonCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        if (-not $backendPython) {
            $pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
            if ($pythonCommand) {
                $backendPython = $pythonCommand.Source
            }
        }

        if (-not $backendPython) {
            $missing += 'Python no esta disponible. Instala Python 3.12 y las dependencias de backend/requirements.txt.'
        }
        else {
            Write-Host "==> Interprete Python: $backendPython"
            try {
                $versionOutput = & $backendPython -c 'import sys; print(sys.version_info.major, sys.version_info.minor, sys.version_info.micro, sep=chr(46))'
                if ($LASTEXITCODE -ne 0) {
                    throw "codigo de salida $LASTEXITCODE"
                }
                $pythonVersion = ($versionOutput | Out-String).Trim()
                Write-Host "==> Version Python: $pythonVersion"
                if ($pythonVersion -notmatch '^3\.12\.\d+$') {
                    $missing += "Version Python incompatible: $backendPython usa $pythonVersion; se requiere Python 3.12."
                }
            }
            catch {
                $missing += "El interprete Python no funciona: $backendPython."
            }
        }
    }
    else {
        Write-Host '==> Interprete Python: no requerido en modo FRONTEND'
    }

    if ($runFrontend) {
        if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
            $missing += 'npm.cmd no esta disponible. Instala una version de Node.js compatible con frontend/package.json.'
        }
        if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'frontend/node_modules/.bin/vitest.cmd'))) {
            $missing += 'Faltan dependencias frontend. Ejecuta npm.cmd ci desde frontend/.'
        }
    }
    if ($missing.Count -gt 0) {
        throw ($missing -join "`n")
    }

    if ($runBackend) {
        Push-Location -LiteralPath (Join-Path $repoRoot 'backend')
        try {
            Invoke-Check 'Backend: unittest' $backendPython @('-B', '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py')
        }
        finally {
            Pop-Location
        }
    }

    if ($runFrontend) {
        Push-Location -LiteralPath (Join-Path $repoRoot 'frontend')
        try {
            Invoke-Check 'Frontend: lint' 'npm.cmd' @('run', 'lint')
            Invoke-Check 'Frontend: typecheck' 'npm.cmd' @('run', 'typecheck')
            Invoke-Check 'Frontend: tests' 'npm.cmd' @('run', 'test:run')
            if ($mode -ne 'QUICK') {
                Invoke-Check 'Frontend: build' 'npm.cmd' @('run', 'build')
            }
        }
        finally {
            Pop-Location
        }
    }

    Write-Host "`nValidacion completa." -ForegroundColor Green
}
catch {
    Write-Host "`nValidacion interrumpida: $($_.Exception.Message)" -ForegroundColor Red
    $exitCode = 1
}
finally {
    Pop-Location
}

exit $exitCode
