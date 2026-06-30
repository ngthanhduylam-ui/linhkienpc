Option Explicit

Dim shell, fso, helperDir, batPath
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

helperDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = helperDir & "\start-helper.bat"

If Not fso.FileExists(batPath) Then
  WScript.Quit 1
End If

shell.Run """" & batPath & """", 0, False
