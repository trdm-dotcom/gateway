function verifyFormat(req, res, next) {
  if (Array.isArray(req.body)) {
    const items = req.body;
    req.body = {};
    req.body.items = items;
  }

  next();
}

module.exports = {
  verifyFormat,
};
