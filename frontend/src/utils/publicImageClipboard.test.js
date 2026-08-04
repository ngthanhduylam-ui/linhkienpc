import assert from "node:assert/strict";
import test from "node:test";
import {
  canCopyImageToClipboard,
  convertImageBlobToPng,
  copyPublicImageToClipboard,
  fetchImageBlob
} from "./publicImageClipboard.js";

class FakeClipboardItem {
  constructor(data) {
    this.data = data;
  }
}

function supportedEnvironment(overrides = {}) {
  return {
    secureContext: true,
    ClipboardItemCtor: FakeClipboardItem,
    clipboard: { write: async () => {} },
    ...overrides
  };
}

test("clipboard support requires a secure context, write(), and ClipboardItem", () => {
  assert.equal(canCopyImageToClipboard(supportedEnvironment()), true);
  assert.equal(canCopyImageToClipboard(supportedEnvironment({ secureContext: false })), false);
  assert.equal(canCopyImageToClipboard(supportedEnvironment({ clipboard: {} })), false);
  assert.equal(canCopyImageToClipboard(supportedEnvironment({ ClipboardItemCtor: null })), false);
});

test("fetchImageBlob uses the original URL and accepts only non-empty images", async () => {
  const calls = [];
  const source = new Blob(["png"], { type: "image/png" });
  const result = await fetchImageBlob("/original-image", {
    fetchImpl: async (...args) => {
      calls.push(args);
      return { ok: true, blob: async () => source };
    }
  });

  assert.equal(result, source);
  assert.deepEqual(calls, [["/original-image", { cache: "no-store" }]]);
  await assert.rejects(
    fetchImageBlob("/missing", { fetchImpl: async () => ({ ok: false }) }),
    /image_fetch_failed/
  );
  await assert.rejects(
    fetchImageBlob("/not-image", {
      fetchImpl: async () => ({ ok: true, blob: async () => new Blob(["text"], { type: "text/plain" }) })
    }),
    /invalid_image_blob/
  );
});

test("PNG sources are written as image data and never as URL text", async () => {
  const source = new Blob(["png"], { type: "image/png" });
  const writes = [];
  let writeTextCalled = false;
  const clipboard = {
    write: async (items) => writes.push(items),
    writeText: async () => { writeTextCalled = true; }
  };

  const result = await copyPublicImageToClipboard("/api/original.png", {
    ...supportedEnvironment({ clipboard }),
    fetchImpl: async (url) => {
      assert.equal(url, "/api/original.png");
      return { ok: true, blob: async () => source };
    }
  });

  assert.equal(result, "copied");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].length, 1);
  assert.equal(writes[0][0].data["image/png"], source);
  assert.equal(writeTextCalled, false);
});

test("unsupported clipboard returns before fetching", async () => {
  let fetched = false;
  const result = await copyPublicImageToClipboard("/image.jpg", {
    secureContext: false,
    clipboard: null,
    ClipboardItemCtor: null,
    fetchImpl: async () => { fetched = true; }
  });
  assert.equal(result, "unsupported");
  assert.equal(fetched, false);
});

test("JPEG/WebP conversion uses natural dimensions and revokes its object URL", async () => {
  const revoked = [];
  const drawCalls = [];
  const png = new Blob(["converted"], { type: "image/png" });
  class LoadedImage {
    naturalWidth = 1200;
    naturalHeight = 800;
    set src(value) {
      this.source = value;
      queueMicrotask(() => this.onload());
    }
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: (...args) => drawCalls.push(args) }),
    toBlob: (callback, type) => {
      assert.equal(type, "image/png");
      callback(png);
    }
  };

  const result = await convertImageBlobToPng(new Blob(["jpeg"], { type: "image/jpeg" }), {
    ImageCtor: LoadedImage,
    urlApi: {
      createObjectURL: () => "blob:source",
      revokeObjectURL: (url) => revoked.push(url)
    },
    canvasFactory: () => canvas
  });

  assert.equal(result, png);
  assert.equal(drawCalls.length, 1);
  assert.deepEqual(drawCalls[0].slice(1), [0, 0, 1200, 800]);
  assert.deepEqual(revoked, ["blob:source"]);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
});

test("decode and canvas conversion failures revoke temporary URLs", async () => {
  const decodeRevoked = [];
  class BrokenImage {
    set src(value) {
      this.source = value;
      queueMicrotask(() => this.onerror());
    }
  }
  await assert.rejects(
    convertImageBlobToPng(new Blob(["webp"], { type: "image/webp" }), {
      ImageCtor: BrokenImage,
      urlApi: {
        createObjectURL: () => "blob:broken",
        revokeObjectURL: (url) => decodeRevoked.push(url)
      }
    }),
    /image_decode_failed/
  );
  assert.deepEqual(decodeRevoked, ["blob:broken"]);

  const conversionRevoked = [];
  class LoadedImage {
    naturalWidth = 10;
    naturalHeight = 10;
    set src(value) {
      this.source = value;
      queueMicrotask(() => this.onload());
    }
  }
  await assert.rejects(
    convertImageBlobToPng(new Blob(["jpeg"], { type: "image/jpeg" }), {
      ImageCtor: LoadedImage,
      urlApi: {
        createObjectURL: () => "blob:no-png",
        revokeObjectURL: (url) => conversionRevoked.push(url)
      },
      canvasFactory: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: () => {} }),
        toBlob: (callback) => callback(null)
      })
    }),
    /image_conversion_failed/
  );
  assert.deepEqual(conversionRevoked, ["blob:no-png"]);
});

test("clipboard write rejection is reported to the caller", async () => {
  await assert.rejects(
    copyPublicImageToClipboard("/image.png", {
      ...supportedEnvironment({ clipboard: { write: async () => { throw new Error("denied"); } } }),
      fetchImpl: async () => ({
        ok: true,
        blob: async () => new Blob(["png"], { type: "image/png" })
      })
    }),
    /denied/
  );
});
