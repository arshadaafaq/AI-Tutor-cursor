import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Modality } from '@google/genai';
import {
  SHOW_VISUALIZATION_TOOL,
  TUTOR_SYSTEM_INSTRUCTION,
} from './tutorPrompt.js';
import {
  buildFallbackSvg,
  generateVisualizationSvg,
  type VisualizationRequest,
} from './visualize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 3001;
const MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY. Copy .env.example to .env and add your key.');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: MODEL });
});

app.get('/api/session-config', (_req, res) => {
  res.json({
    model: MODEL,
    systemInstruction: TUTOR_SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: [SHOW_VISUALIZATION_TOOL] }],
    voiceName: 'Kore',
  });
});

app.post('/api/token', async (_req, res) => {
  try {
    const ai = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1alpha',
    });

    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        // Unlock client config so the browser can set tools + transcriptions.
      },
    });

    if (!token.name) {
      throw new Error('Token response missing name');
    }

    res.json({
      token: token.name,
      model: MODEL,
      expireTime: token.expireTime ?? expireTime,
    });
  } catch (error) {
    console.error('Token error:', error);
    res.status(500).json({
      error: 'Could not create session token',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post('/api/visualize', async (req, res) => {
  try {
    const body = req.body as VisualizationRequest;
    if (!body?.title || !body?.visual_type || !Array.isArray(body.elements)) {
      res.status(400).json({ error: 'Invalid visualization request' });
      return;
    }

    let svg: string;
    try {
      svg = await generateVisualizationSvg(apiKey!, body);
    } catch (err) {
      console.warn('SVG generation failed, using fallback:', err);
      svg = buildFallbackSvg(body);
    }

    res.json({
      title: body.title,
      caption: body.caption,
      analogy: body.analogy,
      svg,
    });
  } catch (error) {
    console.error('Visualize error:', error);
    res.status(500).json({
      error: 'Could not create visualization',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

// Verify Live API reachability without exposing the key (optional warmup).
app.get('/api/warmup', async (_req, res) => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    // Lightweight call to confirm credentials work for text models.
    await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Reply with OK',
      config: { maxOutputTokens: 4 },
    });
    res.json({
      ok: true,
      liveModel: MODEL,
      modalities: [Modality.AUDIO],
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
});

const dist = path.join(root, 'dist');
app.use(express.static(dist));
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`AI Tutor server on http://localhost:${PORT}`);
});
