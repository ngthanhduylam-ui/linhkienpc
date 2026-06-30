# Cho Tot Posting Helper

Local-only Playwright helper for the dedicated Windows posting laptop. It uses a persistent Google Chrome profile to prepare Cho Tot listing forms from POS data, then stops before final submit.

## Current Workflow

1. Start the helper on the posting laptop with `start-helper.bat`.
2. The helper opens or reuses a dedicated Chrome profile under `.runtime/chrome-profile`.
3. Log in to Cho Tot once in that Chrome profile.
4. Keep the helper running.
5. In POS, prepare the online listing and click `Gui sang Cho Tot`.
6. The helper opens/focuses dedicated Chrome, enters the electronics posting flow, uploads selected images, fills the listing fields, and verifies the form.
7. The seller reviews everything and manually clicks `Dang tin`.

The helper intentionally never clicks `Dang tin`, `Luu nhap`, `Xem truoc`, payment actions, CAPTCHA, or verification prompts.

## Setup

1. Install Node.js 18 or newer.
2. Start the helper manually:
   ```powershell
   .\start-helper.bat
   ```

`start-helper.bat` changes into the helper directory, checks Node.js/npm, installs dependencies with `npm install` if `node_modules` is missing, checks whether `http://127.0.0.1:17321` is already running, then runs:

```powershell
npm.cmd run start
```

The current `start` script is:

```json
"start": "node src/server.js"
```

3. If you prefer raw commands for development:
   ```powershell
   npm install
   npx playwright install chrome
   npm start
   ```

## Windows Startup

To start the helper automatically when the current Windows user logs in:

1. Double-click `install-startup.bat`.
2. The script creates a shortcut in the current user's Startup folder.
3. The shortcut runs `start-helper-hidden.vbs`, which starts `start-helper.bat` hidden.

No Administrator permission is required.

To remove auto-start:

1. Double-click `remove-startup.bat`.
2. The Startup shortcut is deleted.

The scripts support project paths with spaces.

## Manual Run And Restart

- Manual start: double-click `start-helper.bat`.
- Hidden start: run `start-helper-hidden.vbs`, or use the Startup shortcut.
- Restart when needed: close the helper window or stop the running Node.js helper, then double-click `start-helper.bat` again.
- Do not close the helper while it is preparing a listing.
- If `start-helper.bat` says `Cho Tot helper dang chay`, it detected an existing helper at `http://127.0.0.1:17321` and will not start a duplicate process.

## Endpoints

`GET http://127.0.0.1:17321/health`

`POST http://127.0.0.1:17321/v1/prepare-listing`

Payload:

```json
{
  "version": 1,
  "requestId": "unique-id",
  "posOrigin": "http://localhost:3000",
  "product": {
    "id": 843,
    "sku": "2nd.vga.msi.3050.8g.ventus2x"
  },
  "images": [
    {
      "id": 27,
      "position": 1,
      "isCover": true
    }
  ],
  "title": "Listing title",
  "price": 3500000,
  "description": "Listing description with at least ten words.",
  "condition": "used_not_repaired",
  "componentType": "computer_component",
  "deviceType": "vga",
  "warrantyPolicy": ""
}
```

`POST http://127.0.0.1:17321/v1/test-upload-one-image` remains available for isolated image-upload debugging.

## Image Rules

- POS sends one to five selected product images.
- The cover image must be first in the payload.
- Remaining images keep product image order.
- The helper fetches public originals from POS by SKU and image ID.
- The helper validates JPEG, PNG, or WebP by magic bytes before upload.
- Existing thumbnails on the Cho Tot form stop the request with `CHOTOT_EXISTING_IMAGES`.

## Runtime Files

Runtime data is stored under `.runtime/` and ignored by Git.

- `.runtime/chrome-profile` stores the dedicated Chrome login session.
- `.runtime/temp/<requestId>` stores temporary images during a request.

Temporary request directories are deleted after success, failure, and helper startup cleanup.

To reset the dedicated Chrome profile:

1. Stop the helper.
2. Delete `.runtime/chrome-profile`.
3. Start the helper again.
4. Log in to Cho Tot again.

## Troubleshooting

- If POS cannot connect, confirm the helper is running on `http://127.0.0.1:17321`.
- If the helper was installed in Windows Startup, check Task Manager or visit `http://127.0.0.1:17321/health`.
- If Cho Tot asks for login, CAPTCHA, verification, or payment, handle it manually in dedicated Chrome and retry.
- The first time the helper opens dedicated Chrome, log in to Cho Tot in that Chrome profile.
- If the form already has images, clear/reset the Cho Tot form manually before retrying.
- If the helper opens the wrong form, it navigates back to the posting entry and chooses `Do dien tu` again.
- If the helper seems stuck, close/restart the helper and try again. Do not restart it while a listing is actively being prepared.

## Security

- Binds only to `127.0.0.1:17321`.
- CORS only allows approved POS origins.
- Fetches images only from approved POS origins.
- Builds image URLs internally from SKU and image ID.
- Does not accept arbitrary URLs or filesystem paths.
- Does not run shell commands from payloads.
- Does not submit listings.
