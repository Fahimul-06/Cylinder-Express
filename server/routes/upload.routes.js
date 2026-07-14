export function registerUploadRoutes(ctx) {
  const { app, models, multer } = ctx;
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  });
function safeUploadFileName(value) {
  return String(value || 'upload')
    .replace(/[^a-zA-Z0-9._/-]/g, '-')
    .replaceAll('/', '-')
    .slice(0, 180);
}

app.post('/api/uploads', upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ error: 'No file uploaded.' });
    const requestedName = safeUploadFileName(req.body.path || req.file.originalname);
    const asset = await models.upload_assets.create({
      filename: requestedName,
      original_name: req.file.originalname || requestedName,
      bucket: req.body.bucket || 'uploads',
      content_type: req.file.mimetype || 'application/octet-stream',
      size: req.file.size || req.file.buffer.length,
      data: req.file.buffer,
    });
    res.json({ path: asset.id, url: `/uploads/${asset.id}` });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Upload failed.' });
  }
});

app.get('/uploads/:assetId', async (req, res, next) => {
  try {
    const assetId = String(req.params.assetId || '');
    if (!mongoose.Types.ObjectId.isValid(assetId)) return next();
    const asset = await models.upload_assets.findById(assetId);
    if (!asset) return next();
    res.setHeader('Content-Type', asset.content_type || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(asset.data);
  } catch (error) {
    next(error);
  }
});

}
