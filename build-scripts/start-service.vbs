<!-- build-scripts/start-service.vbs -->
' Silent VBScript launcher for Windows startup
' Starts the ApexBill server in the background without a console window

Dim shell, appData, serverPath
Set shell = CreateObject("WScript.Shell")

appData = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
serverPath = appData & "\ApexBill\server"

' Start node server silently
shell.Run "cmd /c cd /d """ & serverPath & """ && node dist\index.js >> """ & appData & "\ApexBill\server.log"" 2>&1", 0, False

' Wait 2 seconds then open browser
WScript.Sleep 2000
shell.Run "http://localhost:54321", 1, False

Set shell = Nothing
