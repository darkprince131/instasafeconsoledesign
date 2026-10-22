@echo off
REM ---------------------------------------------------------------------------
REM Builds the agent prototype.
REM
REM Uses the C# compiler that ships inside Windows, so there is no SDK to
REM install, no package manager, and nothing to download. On any Windows 10 or
REM 11 machine this works from a clean checkout.
REM ---------------------------------------------------------------------------
setlocal
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC%" set CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe
if not exist "%CSC%" (
  echo Could not find csc.exe. This needs the .NET Framework 4 that ships with Windows.
  exit /b 1
)

"%CSC%" -nologo -target:winexe -out:InstaSafe-Agent-Prototype.exe -optimize+ ^
  -r:System.dll -r:System.Drawing.dll -r:System.Windows.Forms.dll ^
  Agent.cs App.cs

if errorlevel 1 exit /b 1
echo Built InstaSafe-Agent-Prototype.exe
endlocal
