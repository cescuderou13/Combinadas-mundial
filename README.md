# 🏆 Mundial 2026 — Combinadas & Bola de Nieve

App de probabilidades y apuestas para el Mundial 2026 (React + Vite).
Motor propio: Poisson + Elo dinámico + factores por país (córners/tarjetas/remates).
Datos guardados en el navegador (localStorage) — sin backend.

## Correr local
```bash
npm install
npm run dev
```
Abre http://localhost:5173

## Build
```bash
npm run build      # genera /dist
npm run preview
```

## Subir a Vercel (igual que la polla)
1. Repo nuevo en GitHub y sube esta carpeta:
   ```bash
   git init && git add . && git commit -m "Mundial 2026 combinadas"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/mundial-combinadas.git
   git push -u origin main
   ```
2. vercel.com -> Add New -> Project -> importa el repo.
3. Vercel detecta Vite solo (Build: npm run build, Output: dist).
4. Deploy. Cada git push redeploya solo.

## Secciones
- Partidos: 1/X/2 + detalle con todos los mercados, cuota justa y campos Betano/Epicbet (valor en verde).
- Resultados: marcador + cornes/tarjetas/remates al arco por pais -> reajusta probabilidades.
- Combinadas: tramos x1.5 / x2 / x5 / x10 / x100, multi-mercado, sin repetir pais por combo.
- Bola de nieve: 1 pick/dia (cuota 1.6-1.9), banca inicial 5.000, rueda sola.

Modelo estimativo, no garantia. Las cuotas reales las cargas tu.
