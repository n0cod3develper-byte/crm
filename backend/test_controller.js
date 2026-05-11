import 'dotenv/config';
import express from 'express';
import { serviciosController } from './src/modules/servicios/servicios.controller.js';

async function test() {
  const req = {
    params: { id: 'beda58c4-fc9a-47f1-97a2-8b0fa1d4b3ab' },
    body: { estado: 'LIQUIDADA' }
  };
  const res = {
    json: (data) => console.log("SUCCESS:", data),
    status: (code) => { console.log("STATUS:", code); return res; }
  };
  const next = (err) => console.error("NEXT ERROR:", err);

  await serviciosController.update(req, res, next);
  process.exit();
}
test();
