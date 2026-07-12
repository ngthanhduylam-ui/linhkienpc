import { resolveApiAssetUrl } from "../api/apiClient";

export const IMAGE_SHARE_UNSUPPORTED_MESSAGE =
  "Thiết bị này chưa hỗ trợ chia sẻ ảnh trực tiếp. Bạn có thể tải ảnh xuống để gửi.";
export const IMAGE_SHARE_ERROR_MESSAGE =
  "Không thể chuẩn bị ảnh để chia sẻ. Bạn có thể tải ảnh xuống để gửi.";

function getImageShareFileName(product, image, index) {
  const sourceName = String(image?.original_name || "").trim();
  if (sourceName) return sourceName;

  const safeSku = String(product?.sku || "san-pham")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeSku || "san-pham"}-${index + 1}.jpg`;
}

async function imageToShareFile(product, image, index) {
  const response = await fetch(resolveApiAssetUrl(image.download_url), { cache: "no-store" });
  if (!response.ok) throw new Error("image_fetch_failed");

  const blob = await response.blob();
  if (!blob.type || !blob.type.startsWith("image/")) {
    throw new Error("unsupported_image_type");
  }

  return new File([blob], getImageShareFileName(product, image, index), { type: blob.type });
}

function isUserShareCancellation(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || "").toLowerCase();
  return name === "AbortError" || message.includes("cancel") || message.includes("dismiss");
}

function getImageSharePayload(shareNavigator, files, title, text) {
  const allFilesPayload = { files, title, text };
  if (shareNavigator.canShare(allFilesPayload)) return allFilesPayload;

  const firstFilePayload = { files: files.slice(0, 1), title, text };
  if (shareNavigator.canShare(firstFilePayload)) return firstFilePayload;

  return null;
}

export function supportsPublicImageFileSharing(shareNavigator = navigator) {
  return Boolean(shareNavigator?.share && shareNavigator?.canShare && typeof File !== "undefined");
}

export async function sharePublicProductImages(product, images, shareNavigator = navigator) {
  if (!supportsPublicImageFileSharing(shareNavigator) || !images.length) return "unsupported";

  try {
    const files = await Promise.all(images.map((image, index) => imageToShareFile(product, image, index)));
    const title = product.name || "Ảnh sản phẩm";
    const payload = getImageSharePayload(shareNavigator, files, title, product.name || "");
    if (!payload) return "unsupported";

    await shareNavigator.share(payload);
    return "shared";
  } catch (error) {
    if (isUserShareCancellation(error)) return "cancelled";
    throw error;
  }
}
