console.log("Step 1: Starting...");
import express from 'express';
console.log("Step 2: Express imported:", typeof express);
import cors from 'cors';
console.log("Step 3: cors imported");
import { config } from './config.js';
console.log("Step 4: config loaded, port:", config.port);

const app = express();
app.use(cors());
app.get('/test', (_req, res) => res.json({ok: true}));
app.listen(3099, () => console.log("Step 5: Server on 3099"));
