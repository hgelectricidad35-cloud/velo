// VeloApp - INDEX SEGURO DEFINITIVO - Usa MP_ACCESS_TOKEN de Vercel Environment Variables
// Subí este archivo como /api/index.js - Ya no tiene la llave pegada, la lee de Vercel
// Es la versión definitiva y segura

export default async function handler(req, res) {
  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

  if (req.method === "GET") {
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VeloApp - Verificar Pago</title>
<style>
  body{font-family:system-ui;background:#0a0a0a;color:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:20px}
  .card{background:#171717;border:1px solid #2a2a2a;border-radius:16px;padding:28px;max-width:420px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,.5)}
  h1{margin:0 0 8px;font-size:22px} p{color:#999;font-size:14px;margin:0 0 20px}
  input,select{width:100%;padding:12px 14px;border-radius:10px;border:1px solid #333;background:#0f0f0f;color:#fff;margin-bottom:12px;font-size:15px;box-sizing:border-box}
  button{width:100%;padding:14px;background:#fff;color:#000;border:0;border-radius:10px;font-weight:700;font-size:16px;cursor:pointer}
  button:disabled{opacity:.5}
  .ok{background:#0f2a1a;border:1px solid #1a5c2f;color:#4ade80;padding:12px;border-radius:10px;margin-top:16px;display:none}
  .err{background:#2a0f0f;border:1px solid #5c1a1a;color:#f87171;padding:12px;border-radius:10px;margin-top:16px;display:none}
  small{color:#666;font-size:12px;display:block;margin-top:14px;line-height:1.4}
  .badge{display:inline-block;background:#222;border:1px solid #333;border-radius:20px;padding:4px 10px;font-size:11px;color:#888;margin-bottom:12px}
</style>
</head>
<body>
<div class="card">
  <div class="badge">🔒 Verificación segura con MercadoPago</div>
  <h1>VeloApp - Activar Cuenta</h1>
  <p>Pega el ID de pago de MercadoPago y tu email. Verificación automática.</p>
  <input id="payment_id" placeholder="ID de pago ej: 12345678901" />
  <input id="email" type="email" placeholder="Tu email de VeloApp" />
  <select id="plan">
    <option value="gold">GOLD $1990</option>
    <option value="platinum">PLATINUM $3490</option>
  </select>
  <button id="btn" onclick="verificar()">Verificar y activar</button>
  <div id="ok" class="ok"></div>
  <div id="err" class="err"></div>
  <small>El ID está en el mail de MercadoPago después de pagar. El sistema verifica que el pago esté APROBADO y con el monto correcto. Sin truchadas.</small>
</div>
<script>
async function verificar(){
  const pid=document.getElementById('payment_id').value.trim();
  const email=document.getElementById('email').value.trim();
  const plan=document.getElementById('plan').value;
  const btn=document.getElementById('btn');
  const ok=document.getElementById('ok');
  const err=document.getElementById('err');
  ok.style.display='none'; err.style.display='none';
  if(!pid||!email){err.innerText='Falta ID o email'; err.style.display='block'; return;}
  btn.disabled=true; btn.innerText='Verificando...';
  try{
    const r=await fetch('/api/index.js',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payment_id:pid,email,plan})});
    const data=await r.json();
    if(data.ok){
      ok.innerHTML='✅ <b>Pago verificado!</b><br>Monto: $'+data.monto+'<br>Email: '+email+'<br>Plan: '+plan.toUpperCase()+'<br><br>¡Ya podés entrar a VeloApp!';
      ok.style.display='block';
    }else{
      err.innerText='❌ '+data.error; err.style.display='block';
    }
  }catch(e){err.innerText='Error: '+e.message; err.style.display='block';}
  btn.disabled=false; btn.innerText='Verificar y activar';
}
</script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  }

  if (req.method === "POST") {
    try {
      if (!MP_ACCESS_TOKEN) {
        return res.status(500).json({ ok: false, error: 'MP_ACCESS_TOKEN no configurado en Vercel. Agregalo en Environment Variables.' });
      }
      const { payment_id, email, plan } = req.body || {};
      if (!payment_id || !email) return res.status(400).json({ ok: false, error: 'Falta payment_id o email' });

      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` }
      });

      if (!mpRes.ok) {
        return res.status(400).json({ ok: false, error: 'ID no encontrado en MercadoPago. Verifica el ID.' });
      }

      const pago = await mpRes.json();

      if (pago.status !== 'approved') {
        return res.status(400).json({ ok: false, error: `Pago no aprobado. Estado: ${pago.status}` });
      }

      const monto = pago.transaction_amount;
      const minimo = plan === 'platinum' ? 3490 : 1990;

      if (monto < minimo - 50) {
        return res.status(400).json({ ok: false, error: `Monto insuficiente. Pagó $${monto}, se esperaba $${minimo}` });
      }

      console.log(`VELOAPP PAGO OK: ${payment_id} ${email} ${plan} $${monto}`);

      return res.status(200).json({ ok: true, monto, email, plan });

    } catch (e) {
      console.error(e);
      return res.status(500).json({ ok: false, error: 'Error interno: ' + e.message });
    }
  }

  return res.status(405).json({ ok: false, error: 'Método no permitido' });
}
