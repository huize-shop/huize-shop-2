import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs
} from 'firebase/firestore';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { INITIAL_PRODUCTS } from './src/data/initialData.ts';
import type { Product } from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? Number(process.env.PORT) || 3000 : 3000;

function initServerFirestore() {
  try {
    const configPath = path.join(__dirname, 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return null;
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(cfg);
    return getFirestore(app, cfg.firestoreDatabaseId);
  } catch (err) {
    console.warn('[Server] Could not initialize Firestore lookup:', err);
    return null;
  }
}

const serverDb = initServerFirestore();

async function findProductByIdOrRef(idOrRef: string): Promise<Product | null> {
  if (!idOrRef) return null;

  if (serverDb) {
    try {
      const snap = await getDoc(doc(serverDb, 'products', idOrRef));
      if (snap.exists()) {
        return snap.data() as Product;
      }
      const refSnap = await getDocs(
        query(collection(serverDb, 'products'), where('ref', '==', idOrRef), limit(1))
      );
      if (!refSnap.empty) {
        return refSnap.docs[0].data() as Product;
      }
    } catch (err) {
      console.warn('[Server] Firestore product lookup fallback:', err);
    }
  }

  return (
    INITIAL_PRODUCTS.find(
      (p) => p.id === idOrRef || p.ref.toLowerCase() === idOrRef.toLowerCase()
    ) || null
  );
}

function getRequestOrigin(req: express.Request): string {
  const protoHeader = req.headers['x-forwarded-proto'];
  const hostHeader = req.headers['x-forwarded-host'];
  const proto =
    (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader)?.split(',')[0].trim() ||
    req.protocol ||
    'https';
  const host =
    (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader)?.split(',')[0].trim() ||
    req.get('host') ||
    `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectProductOgMeta(html: string, product: Product, origin: string): string {
  const formattedPrice = `${Number(product.price || 0).toLocaleString('fr-FR')} F CFA`;
  const title = `${product.name} — ${formattedPrice} | HUIZE SHOP`;
  const description =
    product.description ||
    `Commandez ${product.name} (${formattedPrice}) sur HUIZE SHOP avec livraison rapide au Burkina Faso.`;
  const productUrl = `${origin}/?produit=${encodeURIComponent(product.id)}`;
  const imageUrl = `${origin}/api/products/${encodeURIComponent(product.id)}/image.jpg`;

  const safeTitle = escapeHtmlAttr(title);
  const safeDesc = escapeHtmlAttr(description);
  const safeUrl = escapeHtmlAttr(productUrl);
  const safeImg = escapeHtmlAttr(imageUrl);
  const safeAlt = escapeHtmlAttr(product.name);

  let updated = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${safeDesc}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${safeTitle}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${safeDesc}" />`
    );

  const extraTags = `
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:image" content="${safeImg}" />
    <meta property="og:image:secure_url" content="${safeImg}" />
    <meta property="og:image:alt" content="${safeAlt}" />
    <meta property="og:image:width" content="750" />
    <meta property="og:image:height" content="750" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${safeImg}" />
  `;

  return updated.replace('</head>', `${extraTags}\n  </head>`);
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '25mb' }));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      port: PORT,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      keyPrefix: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.slice(0, 7) + '...' : 'none',
      app: 'HUIZE SHOP Burkina Faso'
    });
  });

  // AI Product Vision Analysis Endpoint
  app.post('/api/ai/analyze-product', async (req, res) => {
    try {
      const { image, hint } = req.body;

      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'Image requise pour analyse visuelle.' });
      }

      // Check for Gemini API key
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('GEMINI_API_KEY is not defined in environment.');
        return res.status(503).json({
          error: 'Clé API Gemini non configurée. Veuillez renseigner votre clé dans le panneau Settings > Secrets.',
          needsKey: true
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          },
          timeout: 45000
        }
      });

      // Prepare image Part for Gemini multimodal input
      let imagePart: { inlineData: { mimeType: string; data: string } } | null = null;

      if (image.startsWith('data:')) {
        const commaIdx = image.indexOf(',');
        if (commaIdx !== -1) {
          const meta = image.slice(0, commaIdx);
          const rawBase64 = image.slice(commaIdx + 1).replace(/\s/g, '');
          const mimeMatch = meta.match(/data:([^;]+)/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          imagePart = {
            inlineData: {
              mimeType,
              data: rawBase64
            }
          };
        }
      } else if (image.startsWith('http://') || image.startsWith('https://')) {
        try {
          const fetchRes = await fetch(image);
          const arrayBuffer = await fetchRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const contentType = fetchRes.headers.get('content-type') || 'image/jpeg';
          imagePart = {
            inlineData: {
              mimeType: contentType.split(';')[0].trim(),
              data: buffer.toString('base64')
            }
          };
        } catch (fetchErr) {
          console.error('Error fetching remote image URL:', fetchErr);
        }
      } else {
        // Local asset path
        try {
          const cleanPath = image.startsWith('/') ? image.slice(1) : image;
          const localFilePath = path.join(__dirname, cleanPath);
          if (fs.existsSync(localFilePath)) {
            const buffer = fs.readFileSync(localFilePath);
            const ext = path.extname(localFilePath).toLowerCase();
            const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            imagePart = {
              inlineData: {
                mimeType,
                data: buffer.toString('base64')
              }
            };
          }
        } catch (fileErr) {
          console.error('Error reading local file:', fileErr);
        }
      }

      if (!imagePart) {
        return res.status(400).json({ error: "Impossible de lire le format de l'image fournie." });
      }

      console.log(`[AI Vision] Image prepared (MIME: ${imagePart.inlineData.mimeType}, size: ${Math.round(imagePart.inlineData.data.length / 1024)} KB). Calling Gemini...`);
      const startTime = Date.now();

      const promptText = `Tu es un expert reconnu du commerce de détail, de la mode streetwear et du prêt-à-porter au Burkina Faso (marché de Ouagadougou, Sankariaré, Rood-Woko) pour la boutique HUIZE SHOP (+226 53 74 27 48).
Analyse minutieusement cette photo du produit réel et extrais ou déduis-en les informations exactes et vendeuses sur le marché local :

1. Nom commercial (name) : Nom exact et vendeur du modèle et ses couleurs principales (ex: 'Sneaker Dunk Low Noir & Blanc', 'Sandale Sahel Cuir Véritable Tressé', 'T-shirt Oversize Streetwear Coton'). Identifie précisément ce qui est visible sur l'image.
2. Catégorie (category) : STRICTEMENT l'une de ces 3 valeurs :
   - 'chaussures' (pour baskets, sneakers, tennis, bottines, derbies)
   - 'sandales' (pour sandales en cuir, mules, claquettes, babouches)
   - 'vetements' (pour t-shirts, chemises, polos, ensembles, bermudas, pantalons)
3. Libellé de catégorie (categoryLabel) : 'Baskets', 'Sandales', ou 'Vêtements'.
4. Prix de vente en Francs CFA (price) : Estime un prix de vente compétitif et réaliste en F CFA au Burkina Faso pour cet article (ex: entre 18000 et 28000 F CFA pour une paire de baskets, 12000 à 18000 F CFA pour des sandales en cuir, 10000 à 16000 F CFA pour un vêtement). Nombre entier arrondi.
5. Prix barré promotionnel (oldPrice) : Prix barré supérieur d'environ 15% à 25% au prix de vente pour valoriser la promotion.
6. Badge marketing (badge) : Choisis parmi 'Nouveau', 'Top Vente', 'Promo', 'Stock limité', 'Artisanal'.
7. Tailles ou pointures (sizes) : 
   - Pour les chaussures : '40, 41, 42, 43, 44'
   - Pour les sandales : '39, 40, 41, 42, 43, 44'
   - Pour les vêtements : 'M, L, XL, XXL'
8. Description commerciale (description) : Rédige une description vendeuse et soignée en français (2-3 phrases) mentionnant la qualité, le confort et le style sous le climat chaud du Burkina Faso, invitant à commander directement sur WhatsApp (+226 53 74 27 48) avec livraison rapide à Ouagadougou.
${hint ? `Indication spécifique : ${hint}` : ''}`;

      let parsedData: any = null;

      const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
      let lastModelError: any = null;

      const productSchema = {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Nom commercial complet et vendeur du produit"
          },
          category: {
            type: Type.STRING,
            description: "Catégorie ('chaussures', 'sandales', 'vetements')"
          },
          categoryLabel: {
            type: Type.STRING,
            description: "Libellé affiché ('Baskets', 'Sandales', 'Vêtements')"
          },
          price: {
            type: Type.INTEGER,
            description: "Prix de vente réaliste en F CFA au Burkina Faso"
          },
          oldPrice: {
            type: Type.INTEGER,
            description: "Prix barré promotionnel en F CFA"
          },
          badge: {
            type: Type.STRING,
            description: "Badge marketing ('Nouveau', 'Top Vente', 'Promo', 'Stock limité', 'Artisanal')"
          },
          sizes: {
            type: Type.STRING,
            description: "Liste des tailles ou pointures séparées par des virgules"
          },
          description: {
            type: Type.STRING,
            description: "Description commerciale détaillée et attrayante en français"
          }
        },
        required: ['name', 'category', 'categoryLabel', 'price', 'description']
      };

      for (const model of modelsToTry) {
        try {
          console.log(`[AI Vision] Trying model ${model}...`);
          const aiResponse = await ai.models.generateContent({
            model,
            contents: [imagePart, { text: promptText }],
            config: {
              responseMimeType: 'application/json',
              responseSchema: productSchema
            }
          });

          const text = aiResponse.text;
          console.log(`[AI Vision] Model ${model} succeeded in ${Date.now() - startTime}ms.`);
          if (text) {
            parsedData = JSON.parse(text);
            if (parsedData && parsedData.name) {
              break;
            }
          }
        } catch (modelErr: any) {
          console.warn(`[AI Vision] Model ${model} failed:`, modelErr.message || String(modelErr));
          lastModelError = modelErr;
          // Continue to next model in list
        }
      }

      if (!parsedData || !parsedData.name) {
        const rawErr = lastModelError?.message || String(lastModelError || '');
        const isBusy = rawErr.includes('503') || rawErr.includes('high demand') || rawErr.includes('UNAVAILABLE');
        const isQuota = rawErr.includes('429') || rawErr.includes('RESOURCE_EXHAUSTED');
        
        let userMessage = "L'analyse IA de l'image n'a pas pu aboutir.";
        if (isBusy) {
          userMessage = "Les serveurs d'analyse Gemini sont temporairement très sollicités (forte affluence). Veuillez patienter 10 secondes et relancer l'analyse.";
        } else if (isQuota) {
          userMessage = "La limite de requêtes de votre clé Gemini est atteinte. Réessayez dans un instant.";
        } else if (rawErr) {
          userMessage = `Erreur IA : ${rawErr}`;
        }

        return res.status(502).json({
          success: false,
          error: userMessage
        });
      }

      if (!parsedData || !parsedData.name) {
        return res.status(502).json({
          success: false,
          error: "L'IA n'a pas pu analyser précisément cette photo. Veuillez essayer avec une autre image plus nette."
        });
      }

      return res.json({
        success: true,
        data: parsedData
      });
    } catch (err: any) {
      console.error('Error analyzing product with Gemini:', err);
      return res.status(500).json({
        error: err.message || "Erreur lors de l'analyse de l'image par l'IA.",
        details: String(err)
      });
    }
  });

  // Public Product Image Endpoint (serves base64 Firestore images, local assets, or remote URLs as real image bytes)
  app.get(['/api/products/:id/image.jpg', '/api/products/:id/image'], async (req, res) => {
    try {
      const product = await findProductByIdOrRef(req.params.id);
      const imageSrc = product?.images?.[0];

      if (imageSrc) {
        if (imageSrc.startsWith('data:')) {
          const commaIdx = imageSrc.indexOf(',');
          if (commaIdx !== -1) {
            const meta = imageSrc.slice(0, commaIdx);
            const rawBase64 = imageSrc.slice(commaIdx + 1);
            const mimeMatch = meta.match(/data:([^;]+)/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const buffer = Buffer.from(rawBase64, 'base64');
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.send(buffer);
          }
        } else if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) {
          try {
            const remoteRes = await fetch(imageSrc);
            if (remoteRes.ok) {
              const contentType = remoteRes.headers.get('content-type') || 'image/jpeg';
              const buf = Buffer.from(await remoteRes.arrayBuffer());
              res.setHeader('Content-Type', contentType);
              res.setHeader('Cache-Control', 'public, max-age=3600');
              return res.send(buf);
            }
          } catch {
            return res.redirect(imageSrc);
          }
        } else {
          const cleanPath = imageSrc.startsWith('/') ? imageSrc.slice(1) : imageSrc;
          const candidates = [
            path.resolve(__dirname, 'public', cleanPath),
            path.resolve(__dirname, cleanPath)
          ];
          for (const filePath of candidates) {
            if (
              (filePath.startsWith(path.resolve(__dirname, 'public')) ||
                filePath.startsWith(path.resolve(__dirname, 'src'))) &&
              fs.existsSync(filePath)
            ) {
              const ext = path.extname(filePath).toLowerCase();
              const mimeType =
                ext === '.png'
                  ? 'image/png'
                  : ext === '.webp'
                  ? 'image/webp'
                  : ext === '.svg'
                  ? 'image/svg+xml'
                  : 'image/jpeg';
              res.setHeader('Content-Type', mimeType);
              res.setHeader('Cache-Control', 'public, max-age=86400');
              return res.sendFile(filePath);
            }
          }
        }
      }

      const fallbackIcon = path.resolve(__dirname, 'public', 'pwa-512x512.png');
      if (fs.existsSync(fallbackIcon)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.sendFile(fallbackIcon);
      }

      return res.status(404).send('Image not found');
    } catch (err) {
      console.error('Error serving product image:', err);
      return res.status(500).send('Image server error');
    }
  });

  // Mount Vite middleware in development (initialized asynchronously so port binds immediately) or serve static in production
  if (!isProd) {
    const vitePromise = createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa'
    });
    vitePromise.catch((err) => {
      console.error('Failed to initialize Vite dev server:', err);
    });

    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        const targetProductId =
          typeof req.query.produit === 'string'
            ? req.query.produit
            : typeof req.query.product === 'string'
            ? req.query.product
            : null;

        if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html') && targetProductId) {
          const product = await findProductByIdOrRef(targetProductId);
          if (product) {
            const template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
            const withOg = injectProductOgMeta(template, product, getRequestOrigin(req));
            const transformed = await vite.transformIndexHtml(req.originalUrl, withOg);
            res.status(200).set({ 'Content-Type': 'text/html' }).end(transformed);
            return;
          }
        }

        return vite.middlewares(req, res, next);
      } catch (err) {
        return next(err);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');

    app.get('/', async (req, res, next) => {
      try {
        const targetProductId =
          typeof req.query.produit === 'string'
            ? req.query.produit
            : typeof req.query.product === 'string'
            ? req.query.product
            : null;
        if (!targetProductId) return next();

        const product = await findProductByIdOrRef(targetProductId);
        if (!product) return next();

        const html = fs.readFileSync(path.resolve(distPath, 'index.html'), 'utf-8');
        const withOg = injectProductOgMeta(html, product, getRequestOrigin(req));
        return res.status(200).set({ 'Content-Type': 'text/html' }).send(withOg);
      } catch (err) {
        return next(err);
      }
    });

    app.use(express.static(distPath));
    app.get('*', async (req, res) => {
      const indexHtmlPath = path.resolve(distPath, 'index.html');
      const targetProductId =
        typeof req.query.produit === 'string'
          ? req.query.produit
          : typeof req.query.product === 'string'
          ? req.query.product
          : null;

      if (targetProductId) {
        const product = await findProductByIdOrRef(targetProductId);
        if (product) {
          const html = fs.readFileSync(indexHtmlPath, 'utf-8');
          return res
            .status(200)
            .set({ 'Content-Type': 'text/html' })
            .send(injectProductOgMeta(html, product, getRequestOrigin(req)));
        }
      }

      res.sendFile(indexHtmlPath);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HUIZE SHOP server running on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
