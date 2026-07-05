import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: '2mb' }));

const ROOT_DIR = process.cwd();

const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
const INDEX_PATH = path.join(ROOT_DIR, 'index.html');
const NEWS_DATA_PATH = path.join(ROOT_DIR, 'news-data.json');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || ''
});

function validateEnvOrWarn() {
  const warnings = [];

  // Cloudinary (optional in lenient mode)
  if (!process.env.CLOUDINARY_CLOUD_NAME) warnings.push('CLOUDINARY_CLOUD_NAME is missing (Cloudinary uploads will be disabled).');
  if (!process.env.CLOUDINARY_API_KEY) warnings.push('CLOUDINARY_API_KEY is missing (Cloudinary uploads will be disabled).');
  if (!process.env.CLOUDINARY_API_SECRET) warnings.push('CLOUDINARY_API_SECRET is missing (Cloudinary uploads will be disabled).');

  if (warnings.length) {
    console.warn('[env] Warnings:\n' + warnings.map(w => `- ${w}`).join('\n'));
  }
}

async function verifyCloudinaryConnection() {
  const hasCloudinaryCreds =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;

  if (!hasCloudinaryCreds) {
    console.warn('[verifyCloudinary] Skipped (Cloudinary env vars not set).');
    return { ok: false, reason: 'missing_env' };
  }

  try {
    // Keep this check non-fatal and version-agnostic.
    // We avoid calling cloudinary.api.account() because some SDK versions do not expose it.
    if (typeof cloudinary?.uploader?.upload !== 'function') {
      throw new Error('cloudinary.uploader.upload() is not available in this SDK');
    }

    console.log('[verifyCloudinary] Cloudinary configured (SDK ready, upload method available)');
    return { ok: true, reason: 'sdk_ready' };
  } catch (error) {
    console.warn('[verifyCloudinary] Cloudinary verification failed (non-fatal):', error?.message || error);
    return { ok: false, reason: error?.message || String(error) };
  }
}


validateEnvOrWarn();


// Ensure upload dir exists
await fs.mkdir(IMAGES_DIR, { recursive: true });

// Serve the site root and public assets
app.use(express.static(ROOT_DIR));

// Backward-compatible aliases for older HTML links
// (script.js might have been renamed to script.js.bak at some point)
app.get('/script.js', (req, res, next) => {
  const fileOnDisk = path.join(ROOT_DIR, 'script.js');
  return fs
    .access(fileOnDisk)
    .then(() => next())
    .catch(() => res.sendFile(path.join(ROOT_DIR, 'script.js.bak')));
});

app.use('/images', express.static(IMAGES_DIR));

app.get('/', (req, res) => {
  res.sendFile(INDEX_PATH);
});

app.get('/posts', (req, res) => {
  res.redirect(302, '/posts.html');
});

// Article detail route: /article?id=<article.url or identifier>
app.get('/article', async (req, res) => {
  try {
    const id = req.query?.id;
    const items = await readNewsItems();
    const idStr = id !== undefined && id !== null ? String(id) : '';

    if (!idStr.trim()) {
      return res.status(404).send('<h1>Article not found</h1>');
    }

    const article = items.find((item) => {
      const itemUrl = String(item?.url || '').trim();
      if (!itemUrl) return false;

      // Direct match by stored url
      if (itemUrl === idStr) return true;

      // Also allow id without .html
      const itemNoExt = itemUrl.replace(/\.html$/i, '');
      const idNoExt = idStr.replace(/\.html$/i, '');
      return itemNoExt === idNoExt;
    });

    if (!article) {
      return res.status(404).send('<h1>Article not found</h1>');
    }

    return res.send(buildArticleDetailPage(article));
  } catch (e) {
    return res.status(500).send('<h1>Internal Server Error</h1>');
  }
});

app.get('/:articlePath', async (req, res, next) => {

  const articlePath = req.params.articlePath || '';
  if (!articlePath || articlePath === 'api' || articlePath.startsWith('api/')) {
    return next();
  }

  const cleanedPath = String(articlePath).replace(/^\/+/, '').replace(/^\.\//, '');
  if (cleanedPath) {
    const resolvedPath = path.resolve(ROOT_DIR, cleanedPath);
    const relativePath = path.relative(ROOT_DIR, resolvedPath);
    const isExistingFile = relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);

    if (isExistingFile) {
      try {
        await fs.access(resolvedPath);
        return next();
      } catch (error) {
        // Fall through to dynamic article lookup below.
      }
    }
  }

  const article = await findArticleByUrl(articlePath);
  if (article) {
    return res.send(buildArticleDetailPage(article));
  }

  if (cleanedPath.includes('.')) {
    return res.status(404).send('<h1>Article not found</h1>');
  }

  return res.redirect(302, '/posts.html');
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'nexora-publishing-platform', storage: 'json-file' });
});

// ==============================
// Simple Admin Auth (no DB)
// ==============================
// NOTE: Update these values to your desired admin credentials.
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'change-me';

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function parseBasicAuth(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const trimmed = headerValue.trim();
  const match = trimmed.match(/^Basic\s+(.+)$/i);
  if (!match) return null;
  const token = match[1];
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const idx = decoded.indexOf(':');
    if (idx < 0) return null;
    const username = decoded.slice(0, idx);
    const password = decoded.slice(idx + 1);
    return { username, password };
  } catch {
    return null;
  }
}

function adminAuthMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  const creds = parseBasicAuth(auth);
  if (!creds) return unauthorized(res);

  if (creds.username === ADMIN_USERNAME && creds.password === ADMIN_PASSWORD) {
    return next();
  }

  return unauthorized(res);
}

// List articles (protected)
app.get('/api/articles', adminAuthMiddleware, async (req, res) => {
  try {
    const items = await readNewsItems();
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'List failed' });
  }
});

// Upload image (protected)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_DIR),
  filename: (req, file, cb) => {
    const original = file.originalname || 'image';
    const ext = path.extname(original).toLowerCase();
    const safeExt = ext && ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
    const stamp = Date.now();
    const rand = Math.floor(Math.random() * 1e6);
    cb(null, `news_${stamp}_${rand}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 3 * 1024 * 1024 // 3MB
  },
  fileFilter: (req, file, cb) => {
    const mime = file.mimetype || '';
    if (mime.startsWith('image/')) return cb(null, true);
    return cb(new Error('Invalid file type. Only images are allowed.'));
  }
});

app.post('/api/uploads/image', adminAuthMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Missing file: image' });

    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'nexora-studio',
        resource_type: 'image'
      });
      return res.json({ ok: true, image: result.secure_url });
    }

    const imagePath = `/images/${req.file.filename}`;
    res.json({ ok: true, image: imagePath });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Upload failed' });
  }
});

// Auth placeholder (real implementation comes next phase)
app.post('/api/auth/login', (req, res) => {
  return res.status(501).json({ error: 'Not implemented yet' });
});

function isArticleCandidate(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  return ['title', 'url', 'excerpt', 'content', 'date', 'category', 'image', 'icon'].some((key) => key in item);
}

function normalizeNewsData(parsed) {
  if (Array.isArray(parsed)) {
    return parsed.flatMap((entry) => {
      if (Array.isArray(entry)) {
        return normalizeNewsData(entry);
      }

      if (entry && typeof entry === 'object') {
        if (Array.isArray(entry.items)) {
          return normalizeNewsData(entry.items);
        }

        if (isArticleCandidate(entry)) {
          return [entry];
        }
      }

      return [];
    });
  }

  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.items)) return normalizeNewsData(parsed.items);
    if (Array.isArray(parsed.articles)) return normalizeNewsData(parsed.articles);
    if (Array.isArray(parsed.posts)) return normalizeNewsData(parsed.posts);
  }

  return [];
}

async function readNewsItems() {
  try {
    const txt = await fs.readFile(NEWS_DATA_PATH, 'utf-8');
    const parsed = txt.trim() ? JSON.parse(txt) : [];
    return normalizeNewsData(parsed);
  } catch (e) {
    return [];
  }
}

async function writeNewsItems(items) {
  const normalizedItems = normalizeNewsData(items);
  const cleanedItems = normalizedItems.filter((item) => item && typeof item === 'object');
  const serialized = JSON.stringify(cleanedItems, null, 2);
  await fs.writeFile(NEWS_DATA_PATH, serialized, 'utf-8');
  return cleanedItems;
}

async function ensureNewsDataFileShape() {
  try {
    const txt = await fs.readFile(NEWS_DATA_PATH, 'utf-8');
    const parsed = txt.trim() ? JSON.parse(txt) : [];
    const normalizedItems = normalizeNewsData(parsed);
    const serialized = JSON.stringify(normalizedItems, null, 2);

    if (txt.trim() !== serialized) {
      await fs.writeFile(NEWS_DATA_PATH, serialized, 'utf-8');
    }
  } catch (e) {
    if (e?.code === 'ENOENT') {
      await fs.writeFile(NEWS_DATA_PATH, '[]', 'utf-8');
      return;
    }

    console.warn('[news-data] Could not normalize data file:', e?.message || e);
  }
}

async function findArticleByUrl(requestUrl) {
  const cleanUrl = String(requestUrl || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/^\.\//, '');

  if (!cleanUrl) return null;

  const items = await readNewsItems();
  return items.find((item) => {
    const itemUrl = String(item?.url || '').trim();
    if (!itemUrl) return false;

    const itemClean = String(itemUrl).trim().replace(/^\/+/, '').replace(/^\.\//, '');
    const itemNoExt = itemClean.replace(/\.html$/i, '');

    return (
      itemClean === cleanUrl ||
      itemClean.replace(/^\/+/, '') === cleanUrl ||
      itemNoExt === cleanUrl.replace(/\.html$/i, '')
    );
  }) || null;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildArticleDetailPage(article) {
  const title = escapeHtml(String(article?.title || 'مقالة'));
  const excerpt = escapeHtml(String(article?.excerpt || ''));
  const rawContent = String(article?.content || excerpt || 'لم يتم توفير محتوى لهذا المقال بعد.');
  const content = rawContent.replace(/<\/?\s*script[^>]*>[\s\S]*?<\/?\s*script\s*>/gi, '');
  const image = article?.image ? String(article.image) : '';
  const date = article?.date ? String(article.date) : '';
  const category = article?.category ? String(article.category) : 'News';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} | Nexora Studio</title>
  <meta name="description" content="${excerpt}" />
  <link rel="stylesheet" href="/style.css" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
</head>
<body>
  <main class="container" style="padding: 48px 20px 80px;">
    <a href="/posts.html" class="btn btn--ghost" style="margin-bottom:24px;"><i class="fa-solid fa-arrow-right"></i> العودة إلى المقالات</a>
    <section class="glass p-24 reveal">
      <div style="display:flex; gap:16px; align-items:center; flex-wrap:wrap; margin-bottom:16px;">
        ${image ? `<img src="${image}" alt="${title}" style="width:112px; height:84px; object-fit:cover; border-radius:16px; border:1px solid rgba(255,255,255,.14);" />` : ''}
        <div>
          <p class="muted small" style="margin:0 0 6px;">${category}${date ? ` • ${date}` : ''}</p>
          <h1 class="h1" style="margin:0;">${title}</h1>
          <p class="muted" style="margin-top:10px;">${excerpt}</p>
        </div>
      </div>
      <div class="divider" style="margin: 18px 0;"></div>
      <div style="line-height:1.8; white-space:pre-wrap;">${content}</div>
    </section>
  </main>
</body>
</html>`;
}

function slugify(s) {
  const map = {
    أ: 'a', إ: 'i', آ: 'a', ا: 'a', ب: 'b', ت: 't', ث: 'th', ج: 'j', ح: 'h', خ: 'kh',
    د: 'd', ذ: 'dh', ر: 'r', ز: 'z', س: 's', ش: 'sh', ص: 's', ض: 'd', ط: 't', ظ: 'z',
    ع: '', غ: 'gh', ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', و: 'w',
    ي: 'y', ء: '', ة: 'h', ى: 'y', ئ: 'y',ؤ:'w',ئ:'y'
  };

  const raw = String(s || '')
    .trim()
    .toLowerCase();

  let slug = '';
  for (const char of raw) {
    if (char in map) {
      slug += map[char];
    } else if (/[a-z0-9]/.test(char)) {
      slug += char;
    } else if (char === ' ') {
      slug += '-';
    } else {
      slug += '-';
    }
  }

  slug = slug.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (!slug) {
    slug = `article-${Date.now().toString(36)}`;
  }
  return slug;
}

async function handleSaveArticle(req, res) {
  try {
    const {
      title,
      date,
      category,
      tags,
      excerpt,
      icon,
      url,
      image,
      content
    } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    const items = await readNewsItems();
    const nextItems = [...items];

    const safeDate = date ? String(date) : new Date().toISOString().slice(0, 10);
    const safeCategory = category ? String(category) : 'News';

    const tagsArr = Array.isArray(tags)
      ? tags.map(String).map(t => t.trim()).filter(Boolean)
      : typeof tags === 'string'
        ? tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];

    const safeExcerpt = excerpt ? String(excerpt) : '';
    const safeIcon = icon ? String(icon) : 'fa-solid fa-newspaper';

    const safeUrl = url && String(url).trim() ? String(url).trim() : `article-${slugify(title)}.html`;

    const imagePath = image && String(image).trim() ? String(image).trim() : '';

    const newItem = {
      title: String(title).trim(),
      date: safeDate,
      category: safeCategory,
      tags: tagsArr,
      excerpt: safeExcerpt,
      icon: safeIcon,
      url: safeUrl,
      image: imagePath,
      content: content ? String(content) : ''
    };

    // Replace if same url exists, else push
    const idx = nextItems.findIndex(i => i && i.url === newItem.url);
    if (idx >= 0) nextItems[idx] = newItem;
    else nextItems.push(newItem);

    await writeNewsItems(nextItems);

    res.json({ ok: true, item: newItem, total: nextItems.length });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Publish failed' });
  }
}

app.post('/save-article', adminAuthMiddleware, handleSaveArticle);
app.post('/api/publish', adminAuthMiddleware, handleSaveArticle);


// Update existing article by id or index
app.put('/api/articles/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const items = await readNewsItems();
    const index = Number(id);
    const isNumeric = Number.isInteger(index) && String(id).match(/^\d+$/);
    const targetIndex = isNumeric ? index : items.findIndex((item) => item && String(item.url) === String(id));

    if (targetIndex < 0 || targetIndex >= items.length) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const current = items[targetIndex] || {};
    const payload = req.body || {};
    const updatedItem = {
      ...current,
      title: payload.title ? String(payload.title).trim() : current.title,
      date: payload.date ? String(payload.date) : current.date,
      category: payload.category ? String(payload.category) : current.category,
      tags: Array.isArray(payload.tags)
        ? payload.tags.map(String).map(t => t.trim()).filter(Boolean)
        : (typeof payload.tags === 'string'
          ? payload.tags.split(',').map(t => t.trim()).filter(Boolean)
          : current.tags || []),
      excerpt: payload.excerpt ? String(payload.excerpt) : current.excerpt || '',
      icon: payload.icon ? String(payload.icon) : current.icon || 'fa-solid fa-newspaper',
      url: payload.url && String(payload.url).trim() ? String(payload.url).trim() : current.url || `article-${slugify(payload.title || current.title || 'article')}.html`,
      image: payload.image && String(payload.image).trim() ? String(payload.image).trim() : current.image || '',
      content: payload.content ? String(payload.content) : current.content || ''
    };

    items[targetIndex] = updatedItem;
    await writeNewsItems(items);
    return res.json({ ok: true, item: updatedItem, total: items.length });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Update failed' });
  }
});

// Delete article
// - Prefer deleting by article.url (string id)
// - If :id is a number, delete by array index as fallback
app.delete('/api/articles/:id', adminAuthMiddleware, async (req, res) => {

  try {
    const id = req.params.id;

    const items = await readNewsItems();
    if (!items.length) return res.status(404).json({ error: 'No articles found' });

    let removed = false;
    let nextItems = items;

    const isNumeric = String(id).match(/^\d+$/);
    if (isNumeric) {
      const idx = Number(id);
      if (idx >= 0 && idx < items.length) {
        nextItems = items.slice(0, idx).concat(items.slice(idx + 1));
        removed = true;
      }
    } else {
      const idx = items.findIndex((i) => i && String(i.url) === String(id));
      if (idx >= 0) {
        nextItems = items.slice(0, idx).concat(items.slice(idx + 1));
        removed = true;
      }
    }

    if (!removed) return res.status(404).json({ error: 'Article not found' });

    await writeNewsItems(nextItems);
    return res.json({ ok: true, total: nextItems.length });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Delete failed' });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

async function startServer() {
  await ensureNewsDataFileShape();

  void verifyCloudinaryConnection().catch((e) => {
    console.warn('[verifyCloudinary] Unexpected verification error (ignored):', e?.message || e);
  });

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`API server listening on ${port}`);
  });
}

startServer();




