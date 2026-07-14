export const tasksAttachmentsController = {
  async list(req, res, next) { res.json({ success: true, data: [] }); },
  async upload(req, res, next) { res.json({ success: true, data: {} }); },
  async remove(req, res, next) { res.json({ success: true, data: {} }); }
};
export const uploadTaskAttachment = {
  single: () => (req, res, next) => next()
};
