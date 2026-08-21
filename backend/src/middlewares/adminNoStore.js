module.exports = function adminNoStore(req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
};
