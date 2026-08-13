const express = require('express');
const controller = require('./quickNote.controller');
const validators = require('./quickNote.validation');

const router = express.Router();

router.get('/', controller.listNotes);
router.post('/', controller.createNote);
router.patch('/:id', validators.idParamValidator, controller.updateNote);
router.delete('/:id', validators.idParamValidator, controller.deleteNote);

module.exports = router;
