const crypto = require('crypto');
const multer = require('multer');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const storage = require('./productImage.storage');

const diskStorage = multer.diskStorage({
  destination(req, file, callback) {
    storage.ensureUploadDirectories()
      .then(() => callback(null, storage.tempDir))
      .catch((error) => callback(error));
  },
  filename(req, file, callback) {
    callback(null, `${crypto.randomUUID()}.upload`);
  }
});

const upload = multer({
  storage: diskStorage,
  limits: {
    fileSize: env.productUploads.maxFileBytes + 1,
    files: env.productUploads.maxImages
  }
});

function uploadProductImages(req, res, next) {
  upload.array('images', env.productUploads.maxImages)(req, res, (error) => {
    if (!error) return next();

    const tempPaths = Array.isArray(req.files) ? req.files.map((file) => file.path) : [];
    storage.removeFiles(tempPaths).finally(() => {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError(
            `Each image must not exceed ${Math.floor(env.productUploads.maxFileBytes / 1024 / 1024)} MB.`,
            413,
            'IMAGE_FILE_TOO_LARGE'
          ));
        }
        if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(new AppError(
            `A product can have at most ${env.productUploads.maxImages} images.`,
            400,
            'PRODUCT_IMAGE_LIMIT_EXCEEDED'
          ));
        }
        return next(new AppError(error.message, 400, 'IMAGE_UPLOAD_INVALID'));
      }

      return next(error);
    });
  });
}

module.exports = uploadProductImages;
