require('dotenv').config();

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const session = require('express-session');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ======================================================
// CONFIGURACIÓN VELOAPP
// ======================================================

// Mercado Pago:
// En Vercel actualmente usamos MP_ACCESS_TOKEN.
// Se mantiene compatibilidad con el nombre anterior.
const mercadoPagoToken =
    process.env.MP_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN;

const client = new MercadoPagoConfig({
    accessToken: mercadoPagoToken || ''
});

const payment = new Payment(client);

// Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'perfiles_velo'
    }
});

const upload = multer({
    storage: storage
});

// ======================================================
// POSTGRESQL / NEON
// ======================================================

// Nueva base Neon creada para VeloApp.
// Se mantiene DATABASE_URL como respaldo para compatibilidad.
const databaseUrl =
    process.env.VELOAPP_DB_DATABASE_URL ||
    process.env.DATABASE_URL;

if (!databaseUrl) {
    console.warn(
        'VELOAPP: No se encontró VELOAPP_DB_DATABASE_URL ni DATABASE_URL.'
    );
}

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
        rejectUnauthorized: false
    }
});

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(express.urlencoded({
    extended: true
}));

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, 'public')
    )
);

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            'velo-secreto-2026',
        resave: false,
        saveUninitialized: false
    })
);

const requireLogin = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    next();
};

// ======================================================
// SOCKET.IO
// ======================================================

io.on('connection', (socket) => {
    socket.on('chat message', (data) => {
        io.emit('chat message', data);
    });
});

// ======================================================
// HOME
// ======================================================

app.get('/', (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            'public',
            'index.html'
        )
    );
});

// ======================================================
// LOGIN
// ======================================================

app.get('/login', (req, res) => {
    res.send(`
        <html>
        <head>
            <link rel="stylesheet" href="/style.css">
        </head>

        <body>

        <div class="glass-card">

            <h1>Login Velo</h1>

            <form action="/login" method="POST">

                <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    required
                >

                <br>

                <input
                    type="password"
                    name="password"
                    placeholder="Clave"
                    required
                >

                <br>

                <button type="submit">
                    Entrar
                </button>

            </form>

            <br>

            <a href="/register">
                ¿No tenés cuenta? Registrate
            </a>

            <br>

            <a
                href="/recuperar"
                style="font-size:0.8em; color:#d4af37;"
            >
                ¿Olvidaste tu contraseña?
            </a>

            <br><br>

            <a
                href="/legal"
                style="font-size:0.8em; color:gray;"
            >
                Términos y Privacidad
            </a>

        </div>

        </body>
        </html>
    `);
});

app.post('/login', async (req, res) => {
    try {

        const {
            email,
            password
        } = req.body;

        const result = await pool.query(
            `
            SELECT
                nombre,
                email,
                membresia
            FROM usuarios
            WHERE email = $1
            AND password = $2
            `,
            [
                email,
                password
            ]
        );

        if (result.rows.length > 0) {

            req.session.user =
                result.rows[0];

            return res.redirect('/feed');
        }

        res.send(
            'Credenciales incorrectas. <a href="/login">Volver</a>'
        );

    } catch (err) {

        console.error(
            'VELOAPP LOGIN ERROR:',
            err
        );

        res.send(
            'Error en login: ' +
            err.message
        );
    }
});

// ======================================================
// REGISTRO
// ======================================================

app.get('/register', (req, res) => {
    res.send(`
        <html>

        <head>
            <link rel="stylesheet" href="/style.css">
        </head>

        <body>

        <div class="glass-card">

            <h1>Registro Velo</h1>

            <form
                action="/register"
                method="POST"
                enctype="multipart/form-data"
            >

                <input
                    type="text"
                    name="nombre"
                    placeholder="Nombre"
                    required
                >

                <br>

                <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    required
                >

                <br>

                <input
                    type="password"
                    name="password"
                    placeholder="Clave"
                    required
                >

                <br>

                <p style="color:white;">
                    Foto de perfil:
                </p>

                <input
                    type="file"
                    name="foto"
                    accept="image/*"
                    required
                >

                <br>

                <button type="submit">
                    Registrarse
                </button>

            </form>

            <br>

            <a
                href="/legal"
                style="font-size:0.8em; color:gray;"
            >
                Al registrarte, aceptas nuestros términos legales.
            </a>

        </div>

        </body>

        </html>
    `);
});

app.post(
    '/register',
    upload.single('foto'),
    async (req, res) => {

        try {

            if (!req.file) {
                throw new Error(
                    'No se subió ninguna imagen.'
                );
            }

            const {
                nombre,
                email,
                password
            } = req.body;

            const foto_url =
                req.file.path;

            await pool.query(
                `
                INSERT INTO usuarios
                (
                    nombre,
                    email,
                    password,
                    membresia
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4
                )
                `,
                [
                    nombre,
                    email,
                    password,
                    'free'
                ]
            );

            await pool.query(
                `
                INSERT INTO fotos
                (
                    usuario_email,
                    url_foto,
                    tipo
                )
                VALUES
                (
                    $1,
                    $2,
                    $3
                )
                `,
                [
                    email,
                    foto_url,
                    'galeria'
                ]
            );

            res.send(
                'Usuario registrado. <a href="/login">Ir al Login</a>'
            );

        } catch (err) {

            console.error(
                'VELOAPP REGISTER ERROR:',
                err
            );

            res.status(500).send(
                'Error interno: ' +
                err.message
            );
        }
    }
);

// ======================================================
// LEGAL
// ======================================================

app.get('/legal', (req, res) => {

    res.send(`
        <html>

        <head>
            <link
                rel="stylesheet"
                href="/style.css"
            >
        </head>

        <body>

        <div
            class="glass-card"
            style="
                width:80%;
                max-width:700px;
                color:white;
                padding:30px;
            "
        >

            <h1>
                Términos y Privacidad
            </h1>

            <h3>
                1. Términos de Servicio
            </h3>

            <p>
                Al registrarte en veloapp.store,
                declaras bajo juramento ser
                <b>mayor de 18 años</b>.
            </p>

            <h3>
                2. Privacidad y Pagos
            </h3>

            <p>
                La seguridad de tus pagos está
                gestionada exclusivamente por
                <b>Mercado Pago</b>.
                Velo no almacena información bancaria.
            </p>

            <br>

            <a
                href="/login"
                style="color:#d4af37;"
            >
                Volver al Inicio
            </a>

        </div>

        </body>

        </html>
    `);
});

// ======================================================
// CHAT
// ======================================================

app.get(
    '/chat',
    requireLogin,
    (req, res) => {

        const username =
            req.session.user.nombre;

        res.send(`
            <html>

            <head>

                <link
                    rel="stylesheet"
                    href="/style.css"
                >

                <script
                    src="/socket.io/socket.io.js"
                ></script>

            </head>

            <body>

            <div class="chat-container">

                <h1>
                    Velo Chat
                </h1>

                <ul id="messages"></ul>

                <form id="form">

                    <input
                        id="input"
                        autocomplete="off"
                        placeholder="Escribe..."
                        required
                    >

                    <button type="submit">
                        Enviar
                    </button>

                </form>

                <br>

                <a
                    href="/feed"
                    style="color:white;"
                >
                    ⬅ Volver al Feed
                </a>

            </div>

            <script>

                const socket = io();

                const form =
                    document.getElementById('form');

                const input =
                    document.getElementById('input');

                const messages =
                    document.getElementById('messages');

                const username =
                    ${JSON.stringify(username)};

                form.addEventListener(
                    'submit',
                    (e) => {

                        e.preventDefault();

                        if (input.value) {

                            socket.emit(
                                'chat message',
                                {
                                    msg: input.value,
                                    user: username
                                }
                            );

                            input.value = '';
                        }
                    }
                );

                socket.on(
                    'chat message',
                    (data) => {

                        const item =
                            document.createElement('li');

                        item.innerHTML =
                            "<strong>" +
                            data.user +
                            ":</strong> " +
                            data.msg;

                        messages.appendChild(
                            item
                        );

                        messages.scrollTop =
                            messages.scrollHeight;
                    }
                );

            </script>

            </body>

            </html>
        `);
    }
);

// ======================================================
// MERCADO PAGO
// ======================================================

app.post(
    '/pagar',
    requireLogin,
    async (req, res) => {

        try {

            if (!mercadoPagoToken) {

                return res.status(500).send(
                    'Mercado Pago todavía no está configurado.'
                );
            }

            const preference =
                new Preference(client);

            const result =
                await preference.create({
                    body: {
                        items: [
                            {
                                title:
                                    'Membresía Premium Velo (1 mes)',
                                quantity: 1,
                                unit_price: 10
                            }
                        ],

                        external_reference:
                            req.session.user.email,

                        back_urls: {
                            success:
                                'https://veloapp.store/feed',

                            failure:
                                'https://veloapp.store/perfil/' +
                                req.session.user.email,

                            pending:
                                'https://veloapp.store/perfil/' +
                                req.session.user.email
                        }
                    }
                });

            res.redirect(
                result.init_point
            );

        } catch (err) {

            console.error(
                'VELOAPP PAYMENT ERROR:',
                err
            );

            res.send(
                'Error en el pago: ' +
                err.message
            );
        }
    }
);

app.post(
    '/webhook',
    async (req, res) => {

        try {

            const {
                data,
                type
            } = req.body || {};

            if (
                type === 'payment' &&
                data &&
                data.id
            ) {

                const paymentData =
                    await payment.get({
                        id: data.id
                    });

                if (
                    paymentData.status ===
                    'approved'
                ) {

                    const email =
                        paymentData.external_reference;

                    await pool.query(
                        `
                        UPDATE usuarios
                        SET membresia = 'premium'
                        WHERE email = $1
                        `,
                        [
                            email
                        ]
                    );
                }
            }

            res.status(200).send('OK');

        } catch (err) {

            console.error(
                'VELOAPP WEBHOOK ERROR:',
                err
            );

            res.status(500).send(
                'Error'
            );
        }
    }
);

// ======================================================
// FOTOS
// ======================================================

app.post(
    '/agregar-foto',
    requireLogin,
    upload.single('foto'),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.send(
                    'No seleccionaste foto.'
                );
            }

            const email =
                req.session.user.email;

            const membresia =
                req.session.user.membresia;

            const countResult =
                await pool.query(
                    `
                    SELECT COUNT(*)
                    FROM fotos
                    WHERE usuario_email = $1
                    `,
                    [
                        email
                    ]
                );

            const cantidad =
                parseInt(
                    countResult.rows[0].count,
                    10
                );

            if (
                membresia === 'free' &&
                cantidad >= 3
            ) {

                return res.send(
                    'Límite alcanzado (máx 3 fotos). ' +
                    '<a href="/perfil/' +
                    email +
                    '">Volver</a>'
                );
            }

            await pool.query(
                `
                INSERT INTO fotos
                (
                    usuario_email,
                    url_foto,
                    tipo
                )
                VALUES
                (
                    $1,
                    $2,
                    $3
                )
                `,
                [
                    email,
                    req.file.path,
                    'galeria'
                ]
            );

            res.redirect(
                '/perfil/' +
                email
            );

        } catch (err) {

            console.error(
                'VELOAPP PHOTO ERROR:',
                err
            );

            res.status(500).send(
                'Error: ' +
                err.message
            );
        }
    }
);

// ======================================================
// LIKES
// ======================================================

app.post(
    '/like',
    requireLogin,
    async (req, res) => {

        try {

            const email_origen =
                req.session.user.email;

            const {
                email_destino
            } = req.body;

            if (
                email_origen ===
                email_destino
            ) {

                return res.send(
                    'No te puedes dar like a ti mismo. ' +
                    '<a href="/feed">Volver</a>'
                );
            }

            await pool.query(
                `
                INSERT INTO likes
                (
                    email_origen,
                    email_destino
                )
                VALUES
                (
                    $1,
                    $2
                )
                ON CONFLICT
                (
                    email_origen,
                    email_destino
                )
                DO NOTHING
                `,
                [
                    email_origen,
                    email_destino
                ]
            );

            res.redirect('/feed');

        } catch (err) {

            console.error(
                'VELOAPP LIKE ERROR:',
                err
            );

            res.status(500).send(
                'Error al dar like: ' +
                err.message
            );
        }
    }
);

// ======================================================
// ELIMINAR PERFIL
// ======================================================

app.post(
    '/eliminar-perfil',
    requireLogin,
    async (req, res) => {

        const clientDb =
            await pool.connect();

        try {

            const email =
                req.session.user.email;

            await clientDb.query(
                'BEGIN'
            );

            await clientDb.query(
                `
                DELETE FROM likes
                WHERE email_origen = $1
                OR email_destino = $1
                `,
                [
                    email
                ]
            );

            await clientDb.query(
                `
                DELETE FROM fotos
                WHERE usuario_email = $1
                `,
                [
                    email
                ]
            );

            await clientDb.query(
                `
                DELETE FROM usuarios
                WHERE email = $1
                `,
                [
                    email
                ]
            );

            await clientDb.query(
                'COMMIT'
            );

            req.session.destroy();

            res.send(
                'Perfil eliminado correctamente. ' +
                '<a href="/login">Volver al Login</a>'
            );

        } catch (err) {

            await clientDb.query(
                'ROLLBACK'
            );

            console.error(
                'VELOAPP DELETE PROFILE ERROR:',
                err
            );

            res.status(500).send(
                'Error al eliminar perfil: ' +
                err.message
            );

        } finally {

            clientDb.release();
        }
    }
);

// ======================================================
// FEED
// ======================================================

app.get(
    '/feed',
    requireLogin,
    async (req, res) => {

        try {

            const emailActual =
                req.session.user.email;

            const result =
                await pool.query(
                    `
                    SELECT
                        u.nombre,
                        u.email,
                        f.url_foto

                    FROM usuarios u

                    LEFT JOIN fotos f
                    ON u.email =
                    f.usuario_email

                    WHERE
                        f.tipo = 'galeria'
                        AND u.email != $1
                    `,
                    [
                        emailActual
                    ]
                );

            const cards =
                result.rows
                    .map(
                        (u) => `
                            <div
                                style="
                                    background:rgba(255,255,255,0.05);
                                    padding:15px;
                                    border-radius:15px;
                                    text-align:center;
                                    width:150px;
                                    margin:10px;
                                "
                            >

                                <img
                                    src="${u.url_foto}"
                                    style="
                                        width:80px;
                                        height:80px;
                                        border-radius:50%;
                                        object-fit:cover;
                                    "
                                >

                                <p>
                                    ${u.nombre}
                                </p>

                                <a
                                    href="/perfil/${u.email}"
                                    style="color:#d4af37;"
                                >
                                    Ver perfil
                                </a>

                                <form
                                    action="/like"
                                    method="POST"
                                >

                                    <input
                                        type="hidden"
                                        name="email_destino"
                                        value="${u.email}"
                                    >

                                    <button
                                        type="submit"
                                        style="
                                            background:#ff4757;
                                            border:none;
                                            color:white;
                                            padding:5px 10px;
                                            border-radius:5px;
                                        "
                                    >
                                        ❤ Like
                                    </button>

                                </form>

                            </div>
                        `
                    )
                    .join('');

            res.send(`
                <html>

                <head>
                    <link
                        rel="stylesheet"
                        href="/style.css"
                    >
                </head>

                <body>

                <div
                    class="glass-card"
                    style="width:90%;"
                >

                    <h1>
                        Velo - Bienvenido
                        ${req.session.user.nombre}
                    </h1>

                    <div
                        style="
                            display:flex;
                            gap:20px;
                            flex-wrap:wrap;
                            justify-content:center;
                        "
                    >
                        ${cards}
                    </div>

                    <br>

                    <a
                        href="/logout"
                        style="color:white;"
                    >
                        Cerrar sesión
                    </a>

                </div>

                </body>

                </html>
            `);

        } catch (err) {

            console.error(
                'VELOAPP FEED ERROR:',
                err
            );

            res.send(
                'Error cargando feed: ' +
                err.message
            );
        }
    }
);

// ======================================================
// PERFIL
// ======================================================

app.get(
    '/perfil/:email',
    requireLogin,
    async (req, res) => {

        try {

            const {
                email
            } = req.params;

            const usuarioResult =
                await pool.query(
                    `
                    SELECT *
                    FROM usuarios
                    WHERE email = $1
                    `,
                    [
                        email
                    ]
                );

            const fotosResult =
                await pool.query(
                    `
                    SELECT *
                    FROM fotos
                    WHERE usuario_email = $1
                    AND tipo = $2
                    `,
                    [
                        email,
                        'galeria'
                    ]
                );

            if (
                usuarioResult.rows.length ===
                0
            ) {

                return res.send(
                    'Usuario no encontrado'
                );
            }

            const usuario =
                usuarioResult.rows[0];

            const galeriaHTML =
                fotosResult.rows
                    .map(
                        (f) => `
                            <img
                                src="${f.url_foto}"
                                style="
                                    width:150px;
                                    margin:5px;
                                    border-radius:10px;
                                "
                            >
                        `
                    )
                    .join('');

            let formHTML = '';

            if (
                req.session.user.email
                    .toLowerCase()
                    .trim() ===
                email
                    .toLowerCase()
                    .trim()
            ) {

                formHTML = `
                    <div>

                        <h3>
                            Subir nueva foto
                        </h3>

                        <form
                            action="/agregar-foto"
                            method="POST"
                            enctype="multipart/form-data"
                        >

                            <input
                                type="file"
                                name="foto"
                                required
                            >

                            <br>

                            <button
                                type="submit"
                            >
                                Subir
                            </button>

                        </form>

                    </div>
                `;

                if (
                    usuario.membresia ===
                    'free'
                ) {

                    formHTML += `
                        <br>

                        <form
                            action="/pagar"
                            method="POST"
                        >

                            <button
                                type="submit"
                                style="
                                    background:#d4af37;
                                    padding:10px;
                                "
                            >
                                Mejorar a Premium ($10)
                            </button>

                        </form>
                    `;

                } else {

                    formHTML += `
                        <br>

                        <p style="color:gold;">
                            <b>
                                ¡Eres Premium!
                            </b>
                        </p>
                    `;
                }
            }

            res.send(`
                <html>

                <head>
                    <link
                        rel="stylesheet"
                        href="/style.css"
                    >
                </head>

                <body>

                <div class="glass-card">

                    <h1>
                        Perfil de
                        ${usuario.nombre}
                    </h1>

                    <h3>
                        Galería
                    </h3>

                    ${galeriaHTML}

                    <hr>

                    ${formHTML}

                    <br>

                    <a
                        href="/feed"
                        style="color:white;"
                    >
                        Volver al Feed
                    </a>

                </div>

                </body>

                </html>
            `);

        } catch (err) {

            console.error(
                'VELOAPP PROFILE ERROR:',
                err
            );

            res.send(
                'Error cargando perfil: ' +
                err.message
            );
        }
    }
);

// ======================================================
// LOGOUT
// ======================================================

app.get(
    '/logout',
    (req, res) => {

        req.session.destroy(
            () => {
                res.redirect('/login');
            }
        );
    }
);

// ======================================================
// SERVIDOR
// ======================================================

const PORT =
    process.env.PORT ||
    3000;

if (
    process.env.VERCEL !==
    '1'
) {

    server.listen(
        PORT,
        () => {
            console.log(
                'Velo Producción activo'
            );
        }
    );
}

module.exports = app;
