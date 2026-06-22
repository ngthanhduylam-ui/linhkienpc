const fs = require('fs/promises');
const path = require('path');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');

const uploadRoot = path.resolve(env.productUploads.root);
const tempDir = path.join(uploadRoot, 'temp');
const originalsDir = path.join(uploadRoot, 'originals');
const thumbnailsDir = path.join(uploadRoot, 'thumbnails');

async function ensureUploadDirectories() {
  await Promise.all([
    fs.mkdir(tempDir, { recursive: true }),
    fs.mkdir(originalsDir, { recursive: true }),
    fs.mkdir(thumbnailsDir, { recursive: true })
  ]);
}

function getRelativePath(kind, fileName) {
  return path.posix.join(kind, fileName);
}

function resolveStoredPath(relativePath) {
  const resolved = path.resolve(uploadRoot, String(relativePath || ''));
  const relative = path.relative(uploadRoot, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new AppError('Stored image path is invalid.', 500, 'IMAGE_STORAGE_PATH_INVALID');
  }
  return resolved;
}

async function removeFile(filePath, attempt = 0) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error.code === 'EBUSY' || error.code === 'EPERM') && attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
      return removeFile(filePath, attempt + 1);
    }
    if (error.code !== 'ENOENT') throw error;
  }
}

async function removeFiles(filePaths) {
  return Promise.allSettled(filePaths.filter(Boolean).map((filePath) => removeFile(filePath)));
}

module.exports = {
  uploadRoot,
  tempDir,
  originalsDir,
  thumbnailsDir,
  ensureUploadDirectories,
  getRelativePath,
  resolveStoredPath,
  removeFile,
  removeFiles
};
