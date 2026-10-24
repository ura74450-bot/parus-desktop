Unicode true
SetCompress off
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "nsDialogs.nsh"

Name "Parus"
OutFile "dist\Parus-Setup.exe"
RequestExecutionLevel user
BrandingText "Parus"
ShowInstDetails show
SetAutoClose true

!define MUI_ICON "build\icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Установка Parus"
!define MUI_WELCOMEPAGE_TEXT "Мастер установит мессенджер Parus на ваш компьютер.$\r$\n$\r$\nПрограмма работает в Windows 7, 10 и 11 — и в 32-разрядной, и в 64-разрядной версии. На следующем шаге вы выберете нужную разрядность.$\r$\n$\r$\nНажмите «Далее», чтобы продолжить."

Var Radio64
Var Radio32
Var Choice

!insertmacro MUI_PAGE_WELCOME
Page custom ArchPage ArchLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Russian"

Function ArchPage
  !insertmacro MUI_HEADER_TEXT "Выбор версии" "Выберите разрядность, подходящую вашему компьютеру."
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 36u "Parus работает в Windows 7, 10 и 11 — как в 32-разрядной (x86), так и в 64-разрядной (x64) версии. Выберите версию для вашей системы."
  Pop $0
  ${NSD_CreateRadioButton} 10u 44u 95% 12u "64-разрядная (x64) — для большинства современных компьютеров"
  Pop $Radio64
  ${NSD_CreateRadioButton} 10u 62u 95% 12u "32-разрядная (x86) — для старых компьютеров и 32-битной Windows"
  Pop $Radio32
  ${NSD_CreateLabel} 10u 86u 95% 30u "Не знаете, какая у вас Windows? Оставьте выбор по умолчанию — он подобран автоматически по вашей системе."
  Pop $0

  ${NSD_OnClick} $Radio64 OnPick64
  ${NSD_OnClick} $Radio32 OnPick32

  ${If} ${RunningX64}
    ${NSD_Check} $Radio64
  ${Else}
    ${NSD_Check} $Radio32
    EnableWindow $Radio64 0
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function OnPick64
  ${NSD_Check} $Radio64
  ${NSD_Uncheck} $Radio32
FunctionEnd

Function OnPick32
  ${NSD_Check} $Radio32
  ${NSD_Uncheck} $Radio64
FunctionEnd

Function ArchLeave
  ${NSD_GetState} $Radio32 $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $Choice 32
  ${Else}
    StrCpy $Choice 64
  ${EndIf}
FunctionEnd

Section "Install"
  SetOutPath "$TEMP"
  ${If} $Choice == 32
    DetailPrint "Подготовка 32-разрядной версии…"
    File /oname=ParusSetup-ia32.exe "dist\Parus-Setup-ia32.exe"
    DetailPrint "Запуск установщика…"
    HideWindow
    ExecWait '"$TEMP\ParusSetup-ia32.exe"'
    Delete "$TEMP\ParusSetup-ia32.exe"
  ${Else}
    DetailPrint "Подготовка 64-разрядной версии…"
    File /oname=ParusSetup-x64.exe "dist\Parus-Setup-x64.exe"
    DetailPrint "Запуск установщика…"
    HideWindow
    ExecWait '"$TEMP\ParusSetup-x64.exe"'
    Delete "$TEMP\ParusSetup-x64.exe"
  ${EndIf}
  Quit
SectionEnd
