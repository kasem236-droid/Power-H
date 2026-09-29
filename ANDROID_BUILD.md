# Power H - Android APK

## GitHub
1. Create a new GitHub repository.
2. Upload all project files to the repository.
3. Push to `main` (or `master`).
4. Open **Actions** -> **Build Android APK**.
5. Wait for the workflow to finish.
6. Open the workflow run -> **Artifacts** -> **Power-H-APK** and download the APK.

## Cloud sync
The Android app works locally/offline by default. To enable cloud sync, set a GitHub repository variable:

`VITE_API_URL=https://YOUR-SERVER-DOMAIN`

The server must expose the existing Power H API routes from `server.ts`.
