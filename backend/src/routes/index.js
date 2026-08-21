const express = require('express');
const healthRoute = require('./health.route');
const { requireAuth } = require('../middlewares/authenticate');
const adminNoStore = require('../middlewares/adminNoStore');
const {
  publicDataRateLimit,
  publicSuggestionsRateLimit
} = require('../middlewares/publicRateLimits');

const categoryAdminRoutes = require('../modules/category/category.route');
const productAdminRoutes = require('../modules/product/product.route');
const warrantyBatchAdminRoutes = require('../modules/warrantyBatch/warrantyBatch.route');
const inventoryAdminRoutes = require('../modules/inventory/inventory.route');
const inventoryCheckAdminRoutes = require('../modules/inventoryCheck/inventoryCheck.route');
const stockVoucherAdminRoutes = require('../modules/stockVoucher/stockVoucher.route');
const stockTxAdminRoutes = require('../modules/stockTransaction/stockTransaction.route');
const authAdminRoutes = require('../modules/auth/auth.route');
const customerAdminRoutes = require('../modules/customer/customer.route');
const supplierAdminRoutes = require('../modules/supplier/supplier.route');
const skuCategoryRuleAdminRoutes = require('../modules/skuCategoryRule/skuCategoryRule.route');
const printTemplateSettingAdminRoutes = require('../modules/printTemplateSetting/printTemplateSetting.route');
const quickNoteAdminRoutes = require('../modules/quickNote/quickNote.route');
const productController = require('../modules/product/product.controller');
const categoryController = require('../modules/category/category.controller');
const productValidators = require('../modules/product/product.validation');
const productImageController = require('../modules/productImage/productImage.controller');

const router = express.Router();

router.use('/health', healthRoute);

router.get('/public/catalogue/suggestions', publicSuggestionsRateLimit, productController.listPublicCatalogueSuggestions);
router.get('/public/catalogue/products/:id/images', productValidators.idParamValidator, productImageController.listPublicImagesByProductId);
router.get('/public/catalogue/products/:id/images/:imageId/thumbnail', productValidators.idParamValidator, productImageController.getPublicThumbnailByProductId);
router.get('/public/catalogue/products/:id/images/:imageId/download', productValidators.idParamValidator, productImageController.downloadPublicImageByProductId);
router.get('/public/products', publicDataRateLimit, productController.searchPublicProducts);
router.get('/public/products/:sku/images', productValidators.skuParamValidator, productImageController.listPublicImages);
router.get('/public/products/:sku/images/:imageId/thumbnail', productImageController.getPublicThumbnail);
router.get('/public/products/:sku/images/:imageId/download', productImageController.downloadPublicImage);
router.get('/public/products/:sku/inventory', publicDataRateLimit, productValidators.skuParamValidator, productController.getPublicInventoryBySku);
router.get('/public/categories', categoryController.listCategories);

router.use('/admin', adminNoStore);
router.use('/admin/auth', authAdminRoutes);
router.use('/admin/categories', requireAuth, categoryAdminRoutes);
router.use('/admin/customers', requireAuth, customerAdminRoutes);
router.use('/admin/suppliers', requireAuth, supplierAdminRoutes);
router.use('/admin/sku-category-rules', requireAuth, skuCategoryRuleAdminRoutes);
router.use('/admin/print-template-settings', requireAuth, printTemplateSettingAdminRoutes);
router.use('/admin/quick-notes', requireAuth, quickNoteAdminRoutes);
router.use('/admin/products', requireAuth, productAdminRoutes);
router.use('/admin/inventory-check', requireAuth, inventoryCheckAdminRoutes);
router.use('/admin/stock-vouchers', requireAuth, stockVoucherAdminRoutes);
router.use('/admin', requireAuth, warrantyBatchAdminRoutes);
router.use('/admin/inventory', requireAuth, inventoryAdminRoutes);
router.use('/admin', requireAuth, stockTxAdminRoutes);

module.exports = router;
