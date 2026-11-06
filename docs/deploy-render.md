# Deploy KanalHugget (samma som mx-fantasy)

**Appar ni redan använder:**
1. **GitHub** – sparar koden  
2. **Render** – visar hemsidan på nätet (som mx-fantasy.se)  
3. **Supabase** – inloggning + databas  
4. **Cloudflare** – egen domän senare (som mx-fantasy.se)

Live nu: https://kanalborren.onrender.com (Render-namnet kan bytas senare)

## Efter kodändring
Push till GitHub-repot `Kanalborren` → Render bygger om automatiskt.

**Viktigt:** Vite läser `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY` *vid bygget*.
Om de ändras: **Manual Deploy → Clear build cache & deploy**.

## Supabase URL
Authentication → URL Configuration:
- Site URL = `https://kanalborren.onrender.com`
- Redirect URLs = `https://kanalborren.onrender.com/**`

## Fiskesällskap
Kör `supabase/company.sql` i SQL Editor, aktivera Realtime för
`company_requests` och `chat_messages`.

## Egen domän (senare)
Köp t.ex. `kanalhugget.se` → Cloudflare → Render.
