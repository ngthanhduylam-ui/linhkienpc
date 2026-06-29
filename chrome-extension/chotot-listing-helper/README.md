# Phuoc Tai ChoTot Listing Helper

Manifest V3 proof-of-concept extension for transferring a prepared online listing draft from VI TINH PHUOC TAI POS to the current Cho Tot posting form.

## Current Workflow

1. Prepare the listing in POS at `/admin/online-listing`.
2. Click `Gui sang Cho Tot`.
3. The extension opens or focuses the Cho Tot posting form.
4. The extension fills and verifies the description.
5. The seller uploads at least one image manually on Cho Tot.
6. The extension detects the unlocked form and fills the remaining required fields:
   - title
   - price
   - condition
   - component type
   - device
7. The seller reviews the form and clicks `Dang tin` manually.

## Safety

- The extension never clicks `Dang tin`, `Luu nhap`, `Xem truoc`, payment, CAPTCHA, verification, or confirmation buttons.
- The final submit is intentionally disabled in Task 4A.
- Description editor confirmation is the only allowed confirmation-style action if Cho Tot requires it.
- Address and seller type are intentionally left unchanged.
- It uses the seller's already logged-in Chrome session and does not store passwords, cookies, or login credentials.
- It stores only one pending draft temporarily in the extension service worker.
- Duplicate `requestId` values are rejected through `chrome.storage.session`.

## Not Supported Yet

- Automatic image upload is not supported yet. The seller must upload at least one image manually.
- The extension does not auto-submit the listing.
- Optional warranty may not be filled if the current Cho Tot form does not expose a supported field or option.
- Optional fields such as origin are not required for Task 4A completion.

## Load Unpacked

1. Open Chrome and go to `chrome://extensions`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select `chrome-extension/chotot-listing-helper`.
5. Keep DevTools open for the service worker or content scripts when testing.

After reloading the unpacked extension in `chrome://extensions`, reload both:

- the POS tab
- the Cho Tot tab

Chrome leaves old content-script instances in already-open pages, and those stale scripts cannot talk to the newly loaded extension context.

## Host Permissions

- `http://localhost:*/*`
- `http://127.0.0.1:*/*`
- `https://www.chotot.com/*`
- `https://*.chotot.com/*`

## Supported Pages

- POS: `/admin/online-listing` on localhost or 127.0.0.1.
- Cho Tot: posting pages whose path contains `dang`, `post`, `listing`, or `sell`.

## Payload Schema

```js
{
  version: 1,
  source: "vitinh-phuoc-tai-pos",
  requestId: "timestamp-random",
  productId: 123,
  sku: "2nd.cpu.amd.r3.3200g",
  title: "CPU AMD R3 3200G",
  price: 1300000,
  description: "CPU AMD R3 3200G thao may. Het bao hanh.",
  condition: "used_not_repaired",
  componentType: "computer_component",
  deviceType: "cpu",
  origin: "vietnam",
  warrantyPolicy: "",
  images: [
    {
      id: 1,
      originalName: "image.jpg",
      mimeType: "image/jpeg",
      thumbnailUrl: "http://localhost:3000/api/v1/...",
      downloadUrl: "http://localhost:3000/api/v1/..."
    }
  ]
}
```

## Field Mapping

- Main category: `Do dien tu`
- Category: `Linh kien (RAM, Card...)`
- Description: POS description
- Title: POS title
- Price: numeric digits only, minimum `1000`
- Condition:
  - `new` -> `Moi`
  - `used_not_repaired` -> `Da su dung (chua sua chua)`
  - `used_repaired` -> `Da su dung (qua sua chua)`
- Component type: `Linh kien may tinh`
- Device:
  - `mainboard` -> `Bo mach chu - Mainboard`
  - `cpu` -> `Bo vi xu ly - CPU`
  - `vga` -> `Card man hinh - VGA`
  - `psu` -> `Nguon may tinh - PSU`
  - `hdd` -> `O cung HDD`
  - `ssd` -> `O cung SSD`
- Warranty policy: optional best-effort fill only.

## Completion Criteria

The extension reports `READY_FOR_MANUAL_REVIEW` only after verifying:

- description persists
- title equals the draft title
- normalized price digits equal the payload price
- condition is selected
- component type is selected
- device is selected
- at least one image is uploaded

Category can be treated as already correct when the live form shows `Do dien tu / Linh kien (RAM, Card...)`.

## Debugging

- Content scripts and service worker log with `[PhuocTai ChoTot Helper]`.
- Inspect the service worker from `chrome://extensions`.
- Inspect page content script logs from the POS or Cho Tot tab DevTools.

Common error codes:

- `CATEGORY_NOT_FOUND`
- `DESCRIPTION_FIELD_NOT_FOUND`
- `DESCRIPTION_STATE_NOT_PERSISTED`
- `TITLE_FIELD_NOT_FOUND`
- `TITLE_FIELD_SCOPE_MISMATCH`
- `TITLE_STATE_NOT_PERSISTED`
- `PRICE_FIELD_NOT_FOUND`
- `PRICE_FIELD_SCOPE_MISMATCH`
- `PRICE_BELOW_CHOTOT_MINIMUM`
- `PRICE_STATE_NOT_PERSISTED`
- `CONDITION_OPTION_NOT_FOUND`
- `COMPONENT_TYPE_OPTION_NOT_FOUND`
- `DEVICE_OPTION_NOT_FOUND`
- `LOGIN_REQUIRED`
- `UNSUPPORTED_PAGE`
- `EXTENSION_CONTEXT_INVALIDATED`
