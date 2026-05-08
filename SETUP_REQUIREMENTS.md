# Developer Environment Setup for New PC

Since this is a brand new Windows machine, you need to install the core development engines before you can run this React Native & Express app.

## 1. System Requirements

You can install all of these automatically by opening **PowerShell as Administrator** and running the following commands:

### Node.js (Required)
Required to run the backend and the React Native packager (`npm` and `npx`).
```powershell
winget install --id OpenJS.NodeJS.LTS -e --source winget
```

### Git (Required)
Required for version control and downloading some npm packages.
```powershell
winget install --id Git.Git -e --source winget
```

### MongoDB (Required for Local Backend)
If you aren't using MongoDB Atlas (cloud), you need the local database server to store your app's data.
```powershell
winget install --id MongoDB.Server -e --source winget
```

### Visual Studio Code (Recommended Editor)
```powershell
winget install --id Microsoft.VisualStudioCode -e --source winget
```

---

## 2. Project Dependencies

**CRITICAL:** After installing Node.js, you must **restart your computer** (or completely close and reopen your terminal) so that the `npm` command is recognized.

Once `npm` works, open your terminal in the `Android_App` folder and run these commands to download the code dependencies:

**Install Backend Dependencies:**
```bash
cd backend
npm install
```

**Install Mobile Dependencies:**
```bash
cd ../mobile
npm install
```

**Install Admin Dashboard Dependencies:**
```bash
cd ../admin
npm install
```

---

## 3. Expo Go (Mobile Phone)
Download the **Expo Go** app on your physical Android or iOS device from your app store. You will use this to scan the QR code and test the mobile app.
