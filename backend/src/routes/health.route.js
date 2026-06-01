const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'linhkienpc-backend',
      status: 'ok'
    },
    meta: {
      server_time: new Date().toISOString()
    }
  });
});

module.exports = router;
