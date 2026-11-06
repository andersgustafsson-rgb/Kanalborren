# Deploy KanalBorren (samma som mx-fantasy)

**Appar ni redan använder:**
1. **GitHub** – sparar koden  
2. **Render** – visar hemsidan på nätet (som mx-fantasy.se)  
3. **Supabase** – inloggning + databas (KanalBorren)  
4. **Cloudflare** – egen domän senare (som mx-fantasy.se)

Skippa Vercel.

## Steg för steg

### 1. Lägg koden på GitHub
Skapa ett nytt repo (t.ex. `Kanalborren`) under samma GitHub-konto som mx-fantasy  
(`andersgustafsson-rgb`). Pusha projektet dit.

### 2. Publicera på Render
1. Gå till [dashboard.render.com](https://dashboard.render.com) (samma inloggning som mx-fantasy)
2. **New** → **Static Site**
3. Koppla GitHub-repot `Kanalborren`
4. Inställningar:
   - **Root Directory:** `web`
   - **Build Command:** `npm ci && npm run build`
   - **Publish Directory:** `dist`
5. Under **Environment** lägg till (kopiera från `web/.env.local`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Deploy → kopiera den publika URL:en (`https://kanalborren.onrender.com` el. liknande)

**Viktigt:** Vite läser nycklarna *vid bygget*. Om du lägger till Environment efter första deployn måste du köra **Manual Deploy → Clear build cache & deploy**, annars syns “Lokal demo” / ingen inloggning.

### 3. Supabase (så inloggning funkar)
Authentication → URL Configuration:
- **Site URL** = Render-URL:en
- **Redirect URLs** = `https://DIN-RENDER-URL/**`

### 4. Egen domän (senare)
Köp t.ex. `kanalborren.se` → peka via Cloudflare mot Render, samma sätt som `mx-fantasy.se`.
