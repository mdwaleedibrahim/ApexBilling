Set WshShell = CreateObject("WScript.Shell")
strPath = WshShell.CurrentDirectory
WshShell.Run """" & strPath & "\runtime\node.exe"" --experimental-sqlite """ & strPath & "\app\dist\index.js""", 0, False
WScript.Sleep 1500
On Error Resume Next
WshShell.Run "msedge.exe --app=http://localhost:54321 --name=ApexBill", 1, False
If Err.Number <> 0 Then
    WshShell.Run "http://localhost:54321", 1, False
End If
