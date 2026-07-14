export const tasksChecklistController = {
  async list(req, res, next) { res.json({ success: true, data: [] }); },
  async add(req, res, next) { res.json({ success: true, data: {} }); },
  async update(req, res, next) { res.json({ success: true, data: {} }); },
  async remove(req, res, next) { res.json({ success: true, data: {} }); }
};
