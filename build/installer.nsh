!macro customInstall
  DetailPrint "Checking Java Runtime Environment (JRE) dependency..."
  
  ; 1. Check registry for Eclipse Temurin JRE
  ClearErrors
  ReadRegStr $0 HKLM "SOFTWARE\Eclipse Adoptium\JDK\8\hotspot\MSI" "Path"
  IfErrors check_oracle_java java_installed

check_oracle_java:
  ; 2. Check registry for standard Oracle JRE
  ClearErrors
  ReadRegStr $0 HKLM "SOFTWARE\JavaSoft\Java Runtime Environment" "CurrentVersion"
  IfErrors java_not_found java_installed

java_not_found:
  DetailPrint "Java JRE not found. Downloading Eclipse Temurin JRE 8..."
  
  ; Download the official installer silently to the Temp folder
  nsExec::ExecToStack 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072; (New-Object Net.WebClient).DownloadFile(\"https://api.adoptium.net/v3/binary/latest/8/ga/windows/x64/jre/hotspot/normal/eclipse\", \"$TEMP\temurin-jre8.msi\")"'
  Pop $0
  
  ; Verify file was downloaded successfully
  IfFileExists "$TEMP\temurin-jre8.msi" install_jre download_failed

install_jre:
  DetailPrint "Installing Java JRE 8 silently... Please wait."
  ; Run the JRE MSI installer silently
  nsExec::ExecToStack 'msiexec.exe /i "$TEMP\temurin-jre8.msi" /quiet /qn ADDLOCAL=FeatureMain,FeatureJarFileRunWith,FeatureJavaHome,FeatureOracleJavaSoft'
  Pop $0
  DetailPrint "Java installation completed successfully!"
  Goto end

download_failed:
  DetailPrint "⚠️ Automated Java download failed. Please install Java manually."
  Goto end

java_installed:
  DetailPrint "Java dependency verified: $0"

end:
!macroend
