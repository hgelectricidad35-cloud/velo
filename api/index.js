import { Pool } from 'pg';

const databaseUrl =
  process.env.VELOAPP_DB_DATABASE_URL ||
  process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

function getBody(req) {
  if (!req.body) return {};

  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

function sendPaymentPage(res) {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VeloApp - Verificar Pago</title>
<style>
  body{font-family:system-ui;background:#0a0a0a;color:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:20px}
  .card{background:#171717;border:1px solid #2a2a2a;border-radius:16px;padding:28px;max-width:420px;width:100%}
  h1{margin:0 0 8px;font-size:22px}
  p{color:#999;font-size:14px;margin:0 0 20px}
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

  <small>
    El ID está en el mail de MercadoPago después de pagar.
    El sistema verifica que el pago esté APROBADO y con el monto correcto.
  </small>
</div>

<script>
async function verificar(){
  const pid=document.getElementById('payment_id').value.trim();
  const email=document.getElementById('email').value.trim();
  const plan=document.getElementById('plan').value;
  const btn=document.getElementById('btn');
  const ok=document.getElementById('ok');
  const err=document.getElementById('err');

  ok.style.display='none';
  err.style.display='none';

  if(!pid || !email){
    err.innerText='Falta ID o email';
    err.style.display='block';
    return;
  }

  btn.disabled=true;
  btn.innerText='Verificando...';

  try{
    const r=await fetch('/api',{
      method:'POST',
      headers:{
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        payment_id:pid,
        email,
        plan
      })
    });

    const data=await r.json();

    if(data.ok){
      ok.innerHTML=
        '✅ <b>Pago verificado!</b><br>'+
        'Monto: $'+data.monto+'<br>'+
        'Email: '+email+'<br>'+
        'Plan: '+plan.toUpperCase()+
        '<br><br>¡Ya podés entrar a VeloApp!';

      ok.style.display='block';
    }else{
      err.innerText='❌ '+data.error;
      err.style.display='block';
    }

  }catch(e){
    err.innerText='Error: '+e.message;
    err.style.display='block';
  }

  btn.disabled=false;
  btn.innerText='Verificar y activar';
}
</script>

</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  return res.status(200).send(html);
}


async function registerUser(req, res) {

  try {

    if (!databaseUrl) {

      return res.status(500).json({
        ok: false,
        error: 'Base de datos no configurada en Vercel'
      });

    }

    const body = getBody(req);

    const nombre =
      String(body.nombre || '').trim();

    const email =
      String(body.email || '')
        .trim()
        .toLowerCase();

    const ciudad =
      String(body.ciudad || '').trim();

    const pais =
      String(body.pais || '').trim();

    const password =
      String(body.password || '');

    const mayor18 =
      body.mayor18 === true;

    const aceptaTerminos =
      body.acepta_terminos === true;


    if (!nombre || !email || !pais || !ciudad || !password) {

      return res.status(400).json({
        ok: false,
        error:
          'Completá nombre, email, país, ciudad y contraseña.'
      });

    }


    if (!mayor18) {

      return res.status(400).json({
        ok: false,
        error:
          'Debés confirmar que tenés 18 años o más.'
      });

    }


    if (!aceptaTerminos) {

      return res.status(400).json({
        ok: false,
        error:
          'Debés aceptar los Términos y la Política de privacidad.'
      });

    }


    if (password.length < 6) {

      return res.status(400).json({
        ok: false,
        error:
          'La contraseña debe tener al menos 6 caracteres.'
      });

    }


    const existe = await pool.query(
      `
      SELECT id
      FROM usuarios
      WHERE LOWER(email)=LOWER($1)
      LIMIT 1
      `,
      [email]
    );


    if (existe.rows.length > 0) {

      return res.status(409).json({
        ok: false,
        error:
          'Ese email ya está registrado.'
      });

    }


    const result = await pool.query(
      `
      INSERT INTO usuarios
      (
        nombre,
        email,
        password,
        membresia,
        pais,
        ciudad,
        actualizado_en
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        NOW()
      )

      RETURNING

        id,
        nombre,
        email,
        membresia,
        pais,
        ciudad,
        edad,
        genero,
        busca,
        bio,
        foto_url,
        latitud,
        longitud,
        actualizado_en
      `,
      [
        nombre,
        email,
        password,
        'free',
        pais,
        ciudad
      ]
    );


    return res.status(201).json({
      ok: true,
      user: result.rows[0]
    });


  } catch (e) {

    console.error(
      'VELOAPP REGISTER API ERROR:',
      e
    );

    return res.status(500).json({
      ok: false,
      error:
        'No se pudo crear la cuenta: ' +
        e.message
    });

  }

}



async function loginUser(req, res) {

  try {

    if (!databaseUrl) {

      return res.status(500).json({
        ok: false,
        error:
          'Base de datos no configurada en Vercel'
      });

    }


    const body = getBody(req);

    const email =
      String(body.email || '')
        .trim()
        .toLowerCase();

    const password =
      String(body.password || '');


    if (!email || !password) {

      return res.status(400).json({
        ok: false,
        error:
          'Ingresá email y contraseña.'
      });

    }


    const result = await pool.query(
      `
      SELECT

        id,
        nombre,
        email,
        membresia,
        pais,
        ciudad,
        edad,
        genero,
        busca,
        bio,
        foto_url,
        latitud,
        longitud,
        actualizado_en

      FROM usuarios

      WHERE LOWER(email)=LOWER($1)

      AND password=$2

      LIMIT 1
      `,
      [
        email,
        password
      ]
    );


    if (result.rows.length === 0) {

      return res.status(401).json({
        ok: false,
        error:
          'Email o contraseña incorrectos.'
      });

    }


    return res.status(200).json({
      ok: true,
      user: result.rows[0]
    });


  } catch (e) {

    console.error(
      'VELOAPP LOGIN API ERROR:',
      e
    );

    return res.status(500).json({
      ok: false,
      error:
        'No se pudo iniciar sesión: ' +
        e.message
    });

  }

}



async function getProfile(req, res) {

  try {

    if (!databaseUrl) {

      return res.status(500).json({
        ok: false,
        error:
          'Base de datos no configurada en Vercel'
      });

    }


    const email =
      String(req.query?.email || '')
        .trim()
        .toLowerCase();


    if (!email) {

      return res.status(400).json({
        ok: false,
        error:
          'Falta el email del usuario.'
      });

    }


    const result = await pool.query(
      `
      SELECT

        id,
        nombre,
        email,
        membresia,
        pais,
        ciudad,
        edad,
        genero,
        busca,
        bio,
        foto_url,
        latitud,
        longitud,
        actualizado_en

      FROM usuarios

      WHERE LOWER(email)=LOWER($1)

      LIMIT 1
      `,
      [
        email
      ]
    );


    if (result.rows.length === 0) {

      return res.status(404).json({
        ok: false,
        error:
          'Usuario no encontrado.'
      });

    }


    return res.status(200).json({
      ok: true,
      user: result.rows[0]
    });


  } catch (e) {

    console.error(
      'VELOAPP GET PROFILE ERROR:',
      e
    );

    return res.status(500).json({
      ok: false,
      error:
        'No se pudo cargar el perfil: ' +
        e.message
    });

  }

}



async function updateProfile(req, res) {

  try {

    if (!databaseUrl) {

      return res.status(500).json({
        ok: false,
        error:
          'Base de datos no configurada en Vercel'
      });

    }


    const body = getBody(req);

    const email =
      String(body.email || '')
        .trim()
        .toLowerCase();


    if (!email) {

      return res.status(400).json({
        ok: false,
        error:
          'Falta el email del usuario.'
      });

    }


    const nombre =
      String(body.nombre || '').trim();

    const pais =
      String(body.pais || '').trim();

    const ciudad =
      String(body.ciudad || '').trim();

    const genero =
      String(body.genero || '').trim();

    const busca =
      String(body.busca || '').trim();

    const bio =
      String(body.bio || '').trim();

    const foto_url =
      String(body.foto_url || '').trim();


    const edad =

      body.edad === '' ||
      body.edad === null ||
      body.edad === undefined

        ? null

        : Number(body.edad);


    const latitud =

      body.latitud === '' ||
      body.latitud === null ||
      body.latitud === undefined

        ? null

        : Number(body.latitud);


    const longitud =

      body.longitud === '' ||
      body.longitud === null ||
      body.longitud === undefined

        ? null

        : Number(body.longitud);


    if (
      edad !== null &&
      (
        !Number.isFinite(edad) ||
        edad < 18 ||
        edad > 120
      )
    ) {

      return res.status(400).json({
        ok: false,
        error:
          'La edad debe estar entre 18 y 120.'
      });

    }


    if (
      latitud !== null &&
      (
        !Number.isFinite(latitud) ||
        latitud < -90 ||
        latitud > 90
      )
    ) {

      return res.status(400).json({
        ok: false,
        error:
          'Latitud inválida.'
      });

    }


    if (
      longitud !== null &&
      (
        !Number.isFinite(longitud) ||
        longitud < -180 ||
        longitud > 180
      )
    ) {

      return res.status(400).json({
        ok: false,
        error:
          'Longitud inválida.'
      });

    }


    const result = await pool.query(
      `
      UPDATE usuarios

      SET

        nombre =
          COALESCE(
            NULLIF($2, ''),
            nombre
          ),

        pais =
          NULLIF($3, ''),

        ciudad =
          NULLIF($4, ''),

        edad = $5,

        genero =
          NULLIF($6, ''),

        busca =
          NULLIF($7, ''),

        bio =
          NULLIF($8, ''),

        foto_url =
          NULLIF($9, ''),

        latitud = $10,

        longitud = $11,

        actualizado_en =
          NOW()

      WHERE
        LOWER(email)=LOWER($1)

      RETURNING

        id,
        nombre,
        email,
        membresia,
        pais,
        ciudad,
        edad,
        genero,
        busca,
        bio,
        foto_url,
        latitud,
        longitud,
        actualizado_en
      `,
      [
        email,
        nombre,
        pais,
        ciudad,
        edad,
        genero,
        busca,
        bio,
        foto_url,
        latitud,
        longitud
      ]
    );


    if (result.rows.length === 0) {

      return res.status(404).json({
        ok: false,
        error:
          'Usuario no encontrado.'
      });

    }


    return res.status(200).json({
      ok: true,
      user: result.rows[0]
    });


  } catch (e) {

    console.error(
      'VELOAPP UPDATE PROFILE ERROR:',
      e
    );

    return res.status(500).json({
      ok: false,
      error:
        'No se pudo guardar el perfil: ' +
        e.message
    });

  }

}



async function searchPeople(req, res) {

  try {

    if (!databaseUrl) {

      return res.status(500).json({
        ok: false,
        error:
          'Base de datos no configurada en Vercel'
      });

    }


    const q =
      String(req.query?.q || '').trim();

    const country =
      String(req.query?.country || '').trim();

    const city =
      String(req.query?.city || '').trim();

    const excludeEmail =
      String(req.query?.excludeEmail || '')
        .trim()
        .toLowerCase();


    const minAgeRaw =
      Number(req.query?.minAge || 18);

    const maxAgeRaw =
      Number(req.query?.maxAge || 120);


    const minAge =
      Number.isFinite(minAgeRaw)
        ? Math.max(18, minAgeRaw)
        : 18;


    const maxAge =
      Number.isFinite(maxAgeRaw)
        ? Math.min(120, maxAgeRaw)
        : 120;


    const params = [];

    const where = [
      '(edad IS NULL OR (edad >= $1 AND edad <= $2))'
    ];

    params.push(
      minAge,
      maxAge
    );


    if (q) {

      params.push(
        `%${q}%`
      );

      const n =
        params.length;

      where.push(
        `
        (
          COALESCE(nombre,'') ILIKE $${n}
          OR
          COALESCE(pais,'') ILIKE $${n}
          OR
          COALESCE(ciudad,'') ILIKE $${n}
          OR
          COALESCE(bio,'') ILIKE $${n}
        )
        `
      );

    }


    if (country) {

      params.push(country);

      where.push(
        `
        LOWER(
          COALESCE(pais,'')
        )
        =
        LOWER(
          $${params.length}
        )
        `
      );

    }


    if (city) {

      params.push(city);

      where.push(
        `
        LOWER(
          COALESCE(ciudad,'')
        )
        =
        LOWER(
          $${params.length}
        )
        `
      );

    }


    if (excludeEmail) {

      params.push(
        excludeEmail
      );

      where.push(
        `
        LOWER(email)
        <>
        LOWER(
          $${params.length}
        )
        `
      );

    }


    const result = await pool.query(
      `
      SELECT

        id,
        nombre,
        membresia,
        pais,
        ciudad,
        edad,
        genero,
        busca,
        bio,
        foto_url,
        latitud,
        longitud,
        actualizado_en

      FROM usuarios

      WHERE

        ${where.join(' AND ')}

      ORDER BY

        actualizado_en
        DESC NULLS LAST,

        id DESC

      LIMIT 50
      `,
      params
    );


    return res.status(200).json({

      ok: true,

      count:
        result.rows.length,

      people:
        result.rows

    });


  } catch (e) {

    console.error(
      'VELOAPP SEARCH PEOPLE ERROR:',
      e
    );

    return res.status(500).json({

      ok: false,

      error:
        'No se pudo buscar gente: ' +
        e.message

    });

  }

}




// ======================================================
// PAYPAL SUBSCRIPTIONS - VELOAPP LIVE
// ======================================================

const PAYPAL_API_BASE = 'https://api-m.paypal.com';

const VELO_PAYPAL_PLANS = {
  gold_monthly: {
    tier: 'gold',
    period: 'monthly',
    name: 'Velo Gold Mensual',
    price: '9.99',
    intervalUnit: 'MONTH'
  },
  gold_yearly: {
    tier: 'gold',
    period: 'yearly',
    name: 'Velo Gold Anual',
    price: '79.99',
    intervalUnit: 'YEAR'
  },
  platinum_monthly: {
    tier: 'platinum',
    period: 'monthly',
    name: 'Velo Platinum Mensual',
    price: '19.99',
    intervalUnit: 'MONTH'
  },
  platinum_yearly: {
    tier: 'platinum',
    period: 'yearly',
    name: 'Velo Platinum Anual',
    price: '149.99',
    intervalUnit: 'YEAR'
  }
};

function paypalCredentialsReady() {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID &&
    process.env.PAYPAL_CLIENT_SECRET
  );
}

async function getPayPalAccessToken() {
  if (!paypalCredentialsReady()) {
    throw new Error('PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET no configurados en Vercel');
  }

  const basic = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(
      `PayPal OAuth falló: ${data.error_description || data.error || response.status}`
    );
  }

  return data.access_token;
}

async function paypalFetch(path, options = {}) {
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const detail =
      data?.details?.[0]?.description ||
      data?.message ||
      data?.name ||
      `HTTP ${response.status}`;
    throw new Error(`PayPal API: ${detail}`);
  }

  return data;
}

async function ensurePayPalTables() {
  if (!databaseUrl) {
    throw new Error('Base de datos no configurada en Vercel');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS paypal_config (
      clave VARCHAR(80) PRIMARY KEY,
      valor TEXT NOT NULL,
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS suscripciones (
      id BIGSERIAL PRIMARY KEY,
      usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      proveedor VARCHAR(30) NOT NULL DEFAULT 'paypal',
      proveedor_subscription_id VARCHAR(120) UNIQUE NOT NULL,
      plan_code VARCHAR(40) NOT NULL,
      membresia VARCHAR(20) NOT NULL,
      periodicidad VARCHAR(20) NOT NULL,
      estado VARCHAR(40) NOT NULL,
      proximo_cobro TIMESTAMPTZ,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS paypal_eventos (
      event_id VARCHAR(140) PRIMARY KEY,
      event_type VARCHAR(100) NOT NULL,
      recibido_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getPayPalConfig(key) {
  await ensurePayPalTables();
  const result = await pool.query(
    'SELECT valor FROM paypal_config WHERE clave=$1 LIMIT 1',
    [key]
  );
  return result.rows[0]?.valor || null;
}

async function setPayPalConfig(key, value) {
  await ensurePayPalTables();
  await pool.query(
    `INSERT INTO paypal_config (clave, valor, actualizado_en)
     VALUES ($1,$2,NOW())
     ON CONFLICT (clave)
     DO UPDATE SET valor=EXCLUDED.valor, actualizado_en=NOW()`,
    [key, String(value)]
  );
}

async function paypalSetupStatus(req, res) {
  try {
    await ensurePayPalTables();

    const keys = [
      'product_id',
      'plan_gold_monthly',
      'plan_gold_yearly',
      'plan_platinum_monthly',
      'plan_platinum_yearly',
      'webhook_id'
    ];

    const result = await pool.query(
      'SELECT clave, valor FROM paypal_config WHERE clave = ANY($1::text[])',
      [keys]
    );

    const config = Object.fromEntries(
      result.rows.map(row => [row.clave, row.valor])
    );

    return res.status(200).json({
      ok: true,
      credentials: paypalCredentialsReady(),
      configured: keys.every(key => Boolean(config[key])),
      config: {
        product_id: config.product_id || null,
        plans_ready: Boolean(
          config.plan_gold_monthly &&
          config.plan_gold_yearly &&
          config.plan_platinum_monthly &&
          config.plan_platinum_yearly
        ),
        webhook_ready: Boolean(config.webhook_id)
      }
    });
  } catch (e) {
    console.error('VELOAPP PAYPAL STATUS ERROR:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

async function createPayPalPlan(productId, planCode, planDef) {
  const requestId = `velo-${planCode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return paypalFetch('/v1/billing/plans', {
    method: 'POST',
    headers: {
      'PayPal-Request-Id': requestId,
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      product_id: productId,
      name: planDef.name,
      description: `${planDef.name} - VeloApp.store`,
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: {
            interval_unit: planDef.intervalUnit,
            interval_count: 1
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: planDef.price,
              currency_code: 'USD'
            }
          }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          value: '0',
          currency_code: 'USD'
        },
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3
      },
      taxes: {
        percentage: '0',
        inclusive: false
      }
    })
  });
}

async function bootstrapPayPal(req, res) {
  try {
    const body = getBody(req);
    const setupKey = String(body.setup_key || '');
    const expectedSetupKey = String(process.env.PAYPAL_SETUP_KEY || '');

    if (!expectedSetupKey) {
      return res.status(500).json({
        ok: false,
        error: 'PAYPAL_SETUP_KEY no configurado en Vercel'
      });
    }

    if (!setupKey || setupKey !== expectedSetupKey) {
      return res.status(403).json({
        ok: false,
        error: 'Clave de configuración PayPal inválida'
      });
    }

    if (!paypalCredentialsReady()) {
      return res.status(500).json({
        ok: false,
        error: 'Faltan las credenciales LIVE de PayPal en Vercel'
      });
    }

    await ensurePayPalTables();

    // Esta acción solo crea lo que todavía no existe en paypal_config.
    let productId = await getPayPalConfig('product_id');

    if (!productId) {
      const product = await paypalFetch('/v1/catalogs/products', {
        method: 'POST',
        headers: {
          'PayPal-Request-Id': `velo-product-${Date.now()}`,
          Prefer: 'return=representation'
        },
        body: JSON.stringify({
          name: 'VeloApp Membership',
          description: 'Membresías Gold y Platinum de VeloApp.store',
          type: 'SERVICE',
          category: 'SOFTWARE',
          home_url: 'https://veloapp.store'
        })
      });

      productId = product.id;
      await setPayPalConfig('product_id', productId);
    }

    const createdPlans = {};

    for (const [planCode, planDef] of Object.entries(VELO_PAYPAL_PLANS)) {
      const configKey = `plan_${planCode}`;
      let planId = await getPayPalConfig(configKey);

      if (!planId) {
        const plan = await createPayPalPlan(productId, planCode, planDef);
        planId = plan.id;
        await setPayPalConfig(configKey, planId);
      }

      createdPlans[planCode] = planId;
    }

    let webhookId = await getPayPalConfig('webhook_id');

    if (!webhookId) {
      const webhook = await paypalFetch('/v1/notifications/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://veloapp.store/api?action=paypal-webhook',
          event_types: [
            { name: 'BILLING.SUBSCRIPTION.ACTIVATED' },
            { name: 'BILLING.SUBSCRIPTION.CANCELLED' },
            { name: 'BILLING.SUBSCRIPTION.SUSPENDED' },
            { name: 'BILLING.SUBSCRIPTION.EXPIRED' },
            { name: 'BILLING.SUBSCRIPTION.PAYMENT.FAILED' },
            { name: 'PAYMENT.SALE.COMPLETED' },
            { name: 'PAYMENT.SALE.REFUNDED' },
            { name: 'PAYMENT.SALE.REVERSED' }
          ]
        })
      });

      webhookId = webhook.id;
      await setPayPalConfig('webhook_id', webhookId);
    }

    return res.status(200).json({
      ok: true,
      message: 'PayPal VeloApp configurado',
      product_id: productId,
      plans: createdPlans,
      webhook_id: webhookId
    });
  } catch (e) {
    console.error('VELOAPP PAYPAL BOOTSTRAP ERROR:', e);
    return res.status(500).json({
      ok: false,
      error: 'No se pudo configurar PayPal: ' + e.message
    });
  }
}

async function createPayPalSubscription(req, res) {
  try {
    const body = getBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const planCode = String(body.plan_code || '').trim().toLowerCase();

    if (!email || !VELO_PAYPAL_PLANS[planCode]) {
      return res.status(400).json({
        ok: false,
        error: 'Falta email o el plan solicitado no es válido'
      });
    }

    const userResult = await pool.query(
      `SELECT id, nombre, email, membresia
       FROM usuarios
       WHERE LOWER(email)=LOWER($1)
       LIMIT 1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'No existe una cuenta VeloApp con ese email'
      });
    }

    const planId = await getPayPalConfig(`plan_${planCode}`);

    if (!planId) {
      return res.status(503).json({
        ok: false,
        error: 'Los planes PayPal todavía no fueron configurados'
      });
    }

    const user = userResult.rows[0];
    const customId = `velo:${user.id}:${planCode}`;

    const subscription = await paypalFetch('/v1/billing/subscriptions', {
      method: 'POST',
      headers: {
        'PayPal-Request-Id': `velo-sub-${user.id}-${planCode}-${Date.now()}`,
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: customId,
        subscriber: {
          email_address: email
        },
        application_context: {
          brand_name: 'VeloApp',
          locale: 'es-UY',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: 'https://veloapp.store/?paypal=success',
          cancel_url: 'https://veloapp.store/?paypal=cancel'
        }
      })
    });

    const approveUrl = (subscription.links || []).find(
      link => link.rel === 'approve'
    )?.href;

    if (!approveUrl) {
      throw new Error('PayPal no devolvió el enlace de aprobación');
    }

    const def = VELO_PAYPAL_PLANS[planCode];

    await ensurePayPalTables();
    await pool.query(
      `INSERT INTO suscripciones
        (usuario_id, email, proveedor, proveedor_subscription_id, plan_code,
         membresia, periodicidad, estado, proximo_cobro, actualizado_en)
       VALUES ($1,$2,'paypal',$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (proveedor_subscription_id)
       DO UPDATE SET
         estado=EXCLUDED.estado,
         actualizado_en=NOW()`,
      [
        user.id,
        email,
        subscription.id,
        planCode,
        def.tier,
        def.period,
        subscription.status || 'APPROVAL_PENDING',
        subscription.billing_info?.next_billing_time || null
      ]
    );

    return res.status(201).json({
      ok: true,
      subscription_id: subscription.id,
      status: subscription.status,
      plan_code: planCode,
      approve_url: approveUrl
    });
  } catch (e) {
    console.error('VELOAPP PAYPAL CREATE SUBSCRIPTION ERROR:', e);
    return res.status(500).json({
      ok: false,
      error: 'No se pudo iniciar la suscripción: ' + e.message
    });
  }
}

async function getPayPalSubscriptionDetails(subscriptionId) {
  return paypalFetch(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { method: 'GET' }
  );
}

function parseVeloCustomId(customId) {
  const value = String(customId || '');
  const parts = value.split(':');

  if (parts.length !== 3 || parts[0] !== 'velo') return null;

  const userId = Number(parts[1]);
  const planCode = parts[2];

  if (!Number.isInteger(userId) || !VELO_PAYPAL_PLANS[planCode]) return null;

  return { userId, planCode };
}

async function verifyPayPalWebhook(req, webhookEvent) {
  const webhookId = await getPayPalConfig('webhook_id');
  if (!webhookId) return false;

  const payload = {
    auth_algo: req.headers['paypal-auth-algo'],
    cert_url: req.headers['paypal-cert-url'],
    transmission_id: req.headers['paypal-transmission-id'],
    transmission_sig: req.headers['paypal-transmission-sig'],
    transmission_time: req.headers['paypal-transmission-time'],
    webhook_id: webhookId,
    webhook_event: webhookEvent
  };

  const result = await paypalFetch('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return result.verification_status === 'SUCCESS';
}

async function resolveSubscriptionFromWebhook(event) {
  const resource = event?.resource || {};

  let subscriptionId =
    resource.id && String(resource.id).startsWith('I-')
      ? resource.id
      : null;

  if (!subscriptionId) {
    subscriptionId =
      resource.billing_agreement_id ||
      resource.supplementary_data?.related_ids?.subscription_id ||
      null;
  }

  if (!subscriptionId) return null;

  const details = await getPayPalSubscriptionDetails(subscriptionId);
  const parsed = parseVeloCustomId(details.custom_id);

  if (!parsed) return null;

  return {
    subscriptionId,
    details,
    ...parsed
  };
}

async function syncMembershipFromPayPalEvent(event) {
  const resolved = await resolveSubscriptionFromWebhook(event);
  if (!resolved) return { ignored: true, reason: 'Sin referencia VeloApp' };

  const { subscriptionId, details, userId, planCode } = resolved;
  const def = VELO_PAYPAL_PLANS[planCode];
  const eventType = String(event.event_type || '');
  const status = String(details.status || '').toUpperCase();

  const activate =
    eventType === 'BILLING.SUBSCRIPTION.ACTIVATED' ||
    eventType === 'PAYMENT.SALE.COMPLETED' ||
    status === 'ACTIVE';

  const deactivate = [
    'BILLING.SUBSCRIPTION.CANCELLED',
    'BILLING.SUBSCRIPTION.SUSPENDED',
    'BILLING.SUBSCRIPTION.EXPIRED'
  ].includes(eventType) || ['CANCELLED', 'SUSPENDED', 'EXPIRED'].includes(status);

  await ensurePayPalTables();

  const userResult = await pool.query(
    'SELECT id, email FROM usuarios WHERE id=$1 LIMIT 1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return { ignored: true, reason: 'Usuario VeloApp inexistente' };
  }

  const userEmail = userResult.rows[0].email;

  await pool.query(
    `INSERT INTO suscripciones
      (usuario_id, email, proveedor, proveedor_subscription_id, plan_code,
       membresia, periodicidad, estado, proximo_cobro, actualizado_en)
     VALUES ($1,$2,'paypal',$3,$4,$5,$6,$7,$8,NOW())
     ON CONFLICT (proveedor_subscription_id)
     DO UPDATE SET
       plan_code=EXCLUDED.plan_code,
       membresia=EXCLUDED.membresia,
       periodicidad=EXCLUDED.periodicidad,
       estado=EXCLUDED.estado,
       proximo_cobro=EXCLUDED.proximo_cobro,
       actualizado_en=NOW()`,
    [
      userId,
      userEmail,
      subscriptionId,
      planCode,
      def.tier,
      def.period,
      details.status || eventType,
      details.billing_info?.next_billing_time || null
    ]
  );

  if (activate && !deactivate) {
    await pool.query(
      `UPDATE usuarios
       SET membresia=$2, actualizado_en=NOW()
       WHERE id=$1`,
      [userId, def.tier]
    );
  }

  if (deactivate) {
    await pool.query(
      `UPDATE usuarios
       SET membresia='free', actualizado_en=NOW()
       WHERE id=$1`,
      [userId]
    );
  }

  if (eventType === 'PAYMENT.SALE.COMPLETED') {
    const paymentId = String(event.resource?.id || event.id || '');
    const amountValue = Number(event.resource?.amount?.total || 0);
    const currency = String(event.resource?.amount?.currency || 'USD');

    if (paymentId) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS pagos (
          id BIGSERIAL PRIMARY KEY,
          payment_id VARCHAR(120) UNIQUE NOT NULL,
          usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL,
          plan VARCHAR(40) NOT NULL,
          monto NUMERIC(12,2) NOT NULL,
          moneda VARCHAR(10),
          estado VARCHAR(30) NOT NULL,
          proveedor VARCHAR(30) NOT NULL,
          creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(
        `INSERT INTO pagos
          (payment_id, usuario_id, email, plan, monto, moneda, estado, proveedor)
         VALUES ($1,$2,$3,$4,$5,$6,'completed','paypal')
         ON CONFLICT (payment_id) DO NOTHING`,
        [paymentId, userId, userEmail, planCode, amountValue, currency]
      );
    }
  }

  return {
    ignored: false,
    user_id: userId,
    membership: deactivate ? 'free' : def.tier,
    subscription_id: subscriptionId,
    status: details.status
  };
}

async function paypalWebhook(req, res) {
  try {
    const event = getBody(req);

    if (!event?.id || !event?.event_type) {
      return res.status(400).json({ ok: false, error: 'Webhook PayPal inválido' });
    }

    const verified = await verifyPayPalWebhook(req, event);

    if (!verified) {
      console.warn('VELOAPP PAYPAL WEBHOOK FIRMA INVALIDA:', event.id);
      return res.status(400).json({ ok: false, error: 'Firma PayPal inválida' });
    }

    await ensurePayPalTables();

    const duplicate = await pool.query(
      'SELECT event_id FROM paypal_eventos WHERE event_id=$1 LIMIT 1',
      [event.id]
    );

    if (duplicate.rows.length > 0) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    const result = await syncMembershipFromPayPalEvent(event);

    await pool.query(
      `INSERT INTO paypal_eventos (event_id, event_type, recibido_en)
       VALUES ($1,$2,NOW())
       ON CONFLICT (event_id) DO NOTHING`,
      [event.id, event.event_type]
    );

    console.log('VELOAPP PAYPAL WEBHOOK OK:', event.event_type, event.id, result);

    return res.status(200).json({ ok: true, result });
  } catch (e) {
    console.error('VELOAPP PAYPAL WEBHOOK ERROR:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

async function paypalSubscriptionStatus(req, res) {
  try {
    const email = String(req.query?.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ ok: false, error: 'Falta email' });
    }

    await ensurePayPalTables();

    const result = await pool.query(
      `SELECT plan_code, membresia, periodicidad, estado,
              proveedor_subscription_id, proximo_cobro, actualizado_en
       FROM suscripciones
       WHERE LOWER(email)=LOWER($1) AND proveedor='paypal'
       ORDER BY actualizado_en DESC
       LIMIT 1`,
      [email]
    );

    return res.status(200).json({
      ok: true,
      subscription: result.rows[0] || null
    });
  } catch (e) {
    console.error('VELOAPP PAYPAL SUBSCRIPTION STATUS ERROR:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

async function verifyPayment(req, res) {

  if (!databaseUrl) {

    return res.status(500).json({
      ok: false,
      error:
        'Base de datos no configurada en Vercel'
    });

  }


  const MP_ACCESS_TOKEN =
    process.env.MP_ACCESS_TOKEN;


  if (!MP_ACCESS_TOKEN) {

    return res.status(500).json({
      ok: false,
      error:
        'MP_ACCESS_TOKEN no configurado en Vercel'
    });

  }


  const client =
    await pool.connect();


  try {

    const body =
      getBody(req);


    const paymentId =
      String(
        body?.payment_id || ''
      ).trim();


    const email =
      String(
        body?.email || ''
      )
        .trim()
        .toLowerCase();


    const plan =
      String(
        body?.plan || ''
      )
        .trim()
        .toLowerCase();


    if (
      !paymentId ||
      !email
    ) {

      return res.status(400).json({
        ok: false,
        error:
          'Falta payment_id o email'
      });

    }


    if (
      ![
        'gold',
        'platinum'
      ].includes(plan)
    ) {

      return res.status(400).json({
        ok: false,
        error:
          'Plan inválido'
      });

    }


    const usuario =
      await client.query(
        `
        SELECT
          id,
          nombre,
          email,
          membresia

        FROM usuarios

        WHERE
          LOWER(email)=LOWER($1)

        LIMIT 1
        `,
        [
          email
        ]
      );


    if (
      usuario.rows.length === 0
    ) {

      return res.status(404).json({
        ok: false,
        error:
          'No existe una cuenta VeloApp con ese email'
      });

    }


    const mpRes =
      await fetch(
        `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
        {
          headers: {
            Authorization:
              `Bearer ${MP_ACCESS_TOKEN}`
          }
        }
      );


    if (!mpRes.ok) {

      return res.status(400).json({
        ok: false,
        error:
          'ID no encontrado en MercadoPago. Verificá el ID.'
      });

    }


    const pago =
      await mpRes.json();


    if (
      pago.status !== 'approved'
    ) {

      return res.status(400).json({
        ok: false,
        error:
          `Pago no aprobado. Estado: ${pago.status}`
      });

    }


    const monto =
      Number(
        pago.transaction_amount
      );


    const moneda =
      String(
        pago.currency_id || ''
      ).toUpperCase();


    const esperado =
      plan === 'platinum'
        ? 3490
        : 1990;


    if (
      !Number.isFinite(monto)
    ) {

      return res.status(400).json({
        ok: false,
        error:
          'MercadoPago devolvió un monto inválido'
      });

    }


    if (
      moneda &&
      moneda !== 'UYU'
    ) {

      return res.status(400).json({
        ok: false,
        error:
          `Moneda incorrecta. Se recibió ${moneda} y se esperaba UYU`
      });

    }


    if (
      Math.abs(
        monto - esperado
      ) > 1
    ) {

      return res.status(400).json({
        ok: false,
        error:
          `Monto incorrecto. Pagó $${monto}, se esperaba $${esperado}`
      });

    }


    /*
      Creamos el historial de pagos
      si todavía no existe.
    */

    await client.query(
      `
      CREATE TABLE IF NOT EXISTS pagos
      (
        id BIGSERIAL PRIMARY KEY,

        payment_id
          VARCHAR(120)
          UNIQUE
          NOT NULL,

        usuario_id
          BIGINT
          NOT NULL
          REFERENCES usuarios(id)
          ON DELETE CASCADE,

        email
          VARCHAR(255)
          NOT NULL,

        plan
          VARCHAR(20)
          NOT NULL,

        monto
          NUMERIC(12,2)
          NOT NULL,

        moneda
          VARCHAR(10),

        estado
          VARCHAR(30)
          NOT NULL,

        proveedor
          VARCHAR(30)
          NOT NULL
          DEFAULT 'mercadopago',

        creado_en
          TIMESTAMPTZ
          NOT NULL
          DEFAULT NOW()
      )
      `
    );


    await client.query(
      'BEGIN'
    );


    /*
      Impedir que un mismo
      pago se use dos veces.
    */

    const yaUsado =
      await client.query(
        `
        SELECT
          payment_id,
          email,
          plan

        FROM pagos

        WHERE
          payment_id=$1

        LIMIT 1
        `,
        [
          paymentId
        ]
      );


    if (
      yaUsado.rows.length > 0
    ) {

      await client.query(
        'ROLLBACK'
      );

      return res.status(409).json({
        ok: false,
        error:
          'Este pago ya fue utilizado para activar una cuenta'
      });

    }


    /*
      ACTIVACIÓN REAL EN NEON.
    */

    const actualizado =
      await client.query(
        `
        UPDATE usuarios

        SET
          membresia=$2,
          actualizado_en=NOW()

        WHERE
          id=$1

        RETURNING

          id,
          nombre,
          email,
          membresia,
          pais,
          ciudad
        `,
        [
          usuario.rows[0].id,
          plan
        ]
      );


    /*
      Guardamos el pago.
    */

    await client.query(
      `
      INSERT INTO pagos
      (
        payment_id,
        usuario_id,
        email,
        plan,
        monto,
        moneda,
        estado,
        proveedor
      )

      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        'mercadopago'
      )
      `,
      [
        paymentId,
        usuario.rows[0].id,
        email,
        plan,
        monto,
        moneda || 'UYU',
        pago.status
      ]
    );


    await client.query(
      'COMMIT'
    );


    console.log(
      `VELOAPP PAGO OK Y GUARDADO: ${paymentId} ${email} ${plan} ${monto} ${moneda || 'UYU'}`
    );


    return res.status(200).json({

      ok: true,

      monto,

      moneda:
        moneda || 'UYU',

      email,

      plan,

      membresia:
        actualizado.rows[0].membresia,

      user:
        actualizado.rows[0]

    });


  } catch (e) {

    try {

      await client.query(
        'ROLLBACK'
      );

    } catch {}


    console.error(
      'VELOAPP PAYMENT API ERROR:',
      e
    );


    return res.status(500).json({

      ok: false,

      error:
        'Error interno: ' +
        e.message

    });


  } finally {

    client.release();

  }

}



export default async function handler(req, res) {

  const action =
    String(
      req.query?.action || ''
    )
      .trim()
      .toLowerCase();


  /*
    REGISTRO
  */

  if (
    action === 'register'
  ) {

    if (
      req.method !== 'POST'
    ) {

      return res.status(405).json({
        ok: false,
        error:
          'Método no permitido'
      });

    }

    return registerUser(
      req,
      res
    );

  }


  /*
    LOGIN
  */

  if (
    action === 'login'
  ) {

    if (
      req.method !== 'POST'
    ) {

      return res.status(405).json({
        ok: false,
        error:
          'Método no permitido'
      });

    }

    return loginUser(
      req,
      res
    );

  }


  /*
    PERFIL
  */

  if (
    action === 'profile'
  ) {

    if (
      req.method === 'GET'
    ) {

      return getProfile(
        req,
        res
      );

    }


    if (
      req.method === 'POST'
    ) {

      return updateProfile(
        req,
        res
      );

    }


    return res.status(405).json({
      ok: false,
      error:
        'Método no permitido'
    });

  }


  /*
    GENTE CERCA /
    BÚSQUEDA INTERNACIONAL
  */

  if (
    action === 'people'
  ) {

    if (
      req.method !== 'GET'
    ) {

      return res.status(405).json({
        ok: false,
        error:
          'Método no permitido'
      });

    }

    return searchPeople(
      req,
      res
    );

  }



  /*
    PAYPAL - ESTADO DE CONFIGURACIÓN
  */

  if (action === 'paypal-setup-status') {
    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }
    return paypalSetupStatus(req, res);
  }


  /*
    PAYPAL - CREAR PRODUCTO, 4 PLANES Y WEBHOOK (UNA SOLA VEZ)
  */

  if (action === 'paypal-bootstrap') {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }
    return bootstrapPayPal(req, res);
  }


  /*
    PAYPAL - INICIAR SUSCRIPCIÓN DEL USUARIO
  */

  if (action === 'paypal-create-subscription') {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }
    return createPayPalSubscription(req, res);
  }


  /*
    PAYPAL - WEBHOOK AUTOMÁTICO
  */

  if (action === 'paypal-webhook') {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }
    return paypalWebhook(req, res);
  }


  /*
    PAYPAL - CONSULTAR SUSCRIPCIÓN ACTUAL
  */

  if (action === 'paypal-subscription-status') {
    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }
    return paypalSubscriptionStatus(req, res);
  }

  /*
    LOGOUT
  */

  if (
    action === 'logout'
  ) {

    if (
      req.method !== 'POST'
    ) {

      return res.status(405).json({
        ok: false,
        error:
          'Método no permitido'
      });

    }


    return res.status(200).json({
      ok: true
    });

  }


  /*
    SESIÓN
  */

  if (
    action === 'me'
  ) {

    if (
      req.method !== 'GET'
    ) {

      return res.status(405).json({
        ok: false,
        error:
          'Método no permitido'
      });

    }


    return res.status(200).json({
      ok: true,
      user: null
    });

  }


  /*
    /api GET:
    página manual de verificación.
  */

  if (
    req.method === 'GET'
  ) {

    return sendPaymentPage(
      res
    );

  }


  /*
    /api POST:
    verificar pago Mercado Pago.
  */

  if (
    req.method === 'POST'
  ) {

    return verifyPayment(
      req,
      res
    );

  }


  return res.status(405).json({

    ok: false,

    error:
      'Método no permitido'

  });

}
