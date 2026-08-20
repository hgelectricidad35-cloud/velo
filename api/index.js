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
