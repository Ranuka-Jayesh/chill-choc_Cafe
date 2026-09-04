# CafeMM Windows Thermal Print Agent (XPrinter / ESC-POS)

A lightweight local print service for Windows cashier computers that enables **instant silent ESC/POS receipt printing** directly from the cloud-hosted React POS system without opening any browser print preview dialogs (`window.print()`).

---

## Quick Setup (1 Minute)

1. Make sure **Node.js** (v16+) is installed on the cashier's Windows computer: [https://nodejs.org](https://nodejs.org).
2. Connect your **XPrinter** via USB and ensure its Windows driver is installed (or set as "Generic / Text Only" / "POS-80" / "XP-80").
3. Double-click `start-agent.bat` in this folder.
4. The agent will start listening at `http://127.0.0.1:23456`.

---

## Connecting with your POS

1. In the Web POS, click the **Printer icon** in the top bar to open **Printer Management**.
2. Go to the **Settings** tab.
3. You will see **Direct Thermal Printing (XPrinter Agent)** with a green **Connected** indicator.
4. Click **Auto-Detect Printers** to list your XPrinter automatically.
5. Select your XPrinter from the dropdown and click **Save**.
6. Tap **Test Print** to verify your printer prints a diagnostic test slip!
