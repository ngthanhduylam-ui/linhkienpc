export const IMAGE_COPY_UNSUPPORTED_MESSAGE =
  "Trình duyệt này chưa hỗ trợ copy ảnh trực tiếp. Hãy dùng Tải ảnh hoặc nhấn giữ ảnh.";
export const IMAGE_COPY_ERROR_MESSAGE = "Không thể copy ảnh. Hãy dùng Tải ảnh.";

const PNG_MIME_TYPE = "image/png";

function resolveClipboardEnvironment(options = {}) {
  return {
    secureContext: options.secureContext ?? globalThis.isSecureContext === true,
    clipboard: options.clipboard ?? globalThis.navigator?.clipboard,
    ClipboardItemCtor: options.ClipboardItemCtor ?? globalThis.ClipboardItem
  };
}

export function canCopyImageToClipboard(options = {}) {
  const { secureContext, clipboard, ClipboardItemCtor } = resolveClipboardEnvironment(options);
  return Boolean(
    secureContext
      && clipboard
      && typeof clipboard.write === "function"
      && typeof ClipboardItemCtor === "function"
  );
}

export async function fetchImageBlob(imageUrl, { fetchImpl = globalThis.fetch } = {}) {
  if (!imageUrl || typeof fetchImpl !== "function") throw new Error("image_fetch_unavailable");

  const response = await fetchImpl(imageUrl, { cache: "no-store" });
  if (!response?.ok) throw new Error("image_fetch_failed");

  const blob = await response.blob();
  if (!blob?.type?.startsWith("image/") || Number(blob.size || 0) < 1) {
    throw new Error("invalid_image_blob");
  }
  return blob;
}

function decodeImage(objectUrl, ImageCtor) {
  return new Promise((resolve, reject) => {
    const image = new ImageCtor();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_decode_failed"));
    image.src = objectUrl;
  });
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== PNG_MIME_TYPE || Number(blob.size || 0) < 1) {
        reject(new Error("image_conversion_failed"));
        return;
      }
      resolve(blob);
    }, PNG_MIME_TYPE);
  });
}

export async function convertImageBlobToPng(blob, options = {}) {
  if (!blob?.type?.startsWith("image/") || Number(blob.size || 0) < 1) {
    throw new Error("invalid_image_blob");
  }
  if (blob.type === PNG_MIME_TYPE) return blob;

  const ImageCtor = options.ImageCtor ?? globalThis.Image;
  const urlApi = options.urlApi ?? globalThis.URL;
  const canvasFactory = options.canvasFactory
    ?? (() => globalThis.document?.createElement("canvas"));

  if (
    typeof ImageCtor !== "function"
    || typeof urlApi?.createObjectURL !== "function"
    || typeof urlApi?.revokeObjectURL !== "function"
  ) {
    throw new Error("image_conversion_unavailable");
  }

  const objectUrl = urlApi.createObjectURL(blob);
  let canvas = null;
  try {
    const image = await decodeImage(objectUrl, ImageCtor);
    const width = Number(image.naturalWidth || 0);
    const height = Number(image.naturalHeight || 0);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
      throw new Error("invalid_image_dimensions");
    }

    canvas = canvasFactory();
    const context = canvas?.getContext?.("2d");
    if (!canvas || !context || typeof canvas.toBlob !== "function") {
      throw new Error("image_conversion_unavailable");
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);
    return await canvasToPngBlob(canvas);
  } finally {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    urlApi.revokeObjectURL(objectUrl);
  }
}

export async function copyPublicImageToClipboard(imageUrl, options = {}) {
  const environment = resolveClipboardEnvironment(options);
  if (!canCopyImageToClipboard(environment)) return "unsupported";

  const sourceBlob = await fetchImageBlob(imageUrl, { fetchImpl: options.fetchImpl });
  const pngBlob = await convertImageBlobToPng(sourceBlob, options);
  const clipboardItem = new environment.ClipboardItemCtor({ [PNG_MIME_TYPE]: pngBlob });
  await environment.clipboard.write([clipboardItem]);
  return "copied";
}
