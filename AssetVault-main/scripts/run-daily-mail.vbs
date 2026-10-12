Set WshShell = CreateObject("WScript.Shell")
strCommand = "cmd.exe /c cd /d ""d:\OneDrive - PG Electroplast Ltd\Desktop\AEMS V!\AEMS-main\AssetVault-main"" && node node_modules\tsx\dist\cli.mjs scripts\sendDailyOverdueMail.ts >> data\daily-mail.log 2>&1"
WshShell.Run strCommand, 0, True
