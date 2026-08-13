const asyncHandler = require('../../utils/asyncHandler');
const quickNoteService = require('./quickNote.service');

function parseId(value) {
  return Number(value);
}

exports.listNotes = asyncHandler(async (req, res) => {
  const result = await quickNoteService.listNotes(req.query);
  res.json({
    success: true,
    data: result.items,
    meta: {
      status: result.status,
      limit: result.limit,
      pending_count: result.pendingCount,
      server_time: new Date().toISOString()
    }
  });
});

exports.createNote = asyncHandler(async (req, res) => {
  const note = await quickNoteService.createNote(req.body);
  res.status(201).json({
    success: true,
    data: note,
    message: 'Đã lưu ghi chú.',
    meta: { server_time: new Date().toISOString() }
  });
});

exports.updateNote = asyncHandler(async (req, res) => {
  const note = await quickNoteService.updateNote(parseId(req.params.id), req.body);
  res.json({
    success: true,
    data: note,
    message: 'Đã cập nhật ghi chú.',
    meta: { server_time: new Date().toISOString() }
  });
});

exports.deleteNote = asyncHandler(async (req, res) => {
  const note = await quickNoteService.deleteNote(parseId(req.params.id));
  res.json({
    success: true,
    data: note,
    message: 'Đã xóa ghi chú.',
    meta: { server_time: new Date().toISOString() }
  });
});
