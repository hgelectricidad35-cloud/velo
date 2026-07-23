require('dotenv').config();
const express = require('express');
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

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN });
const payment = new Payment(client);

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: 'perfiles_velo' }
});

const upload = multer({ storage: storage });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: 'velo-secreto-2026',
    resave: false,
    saveUninitialized: false
}));

const requireLogin = (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    next();
};

io.on('connection', (socket) => {
    socket.on('chat message', (data) => {
        io.emit('chat message', data);
    });
});

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => {
    res.send(`<html><head><link rel="stylesheet" href="/style.css"></head>
        <body><div class="glass-card">
            <h1>Login Velo</h1>
            <form action="/login" method="POST">
                <input type="email" name="email" placeholder="Email" required><br>
                <input type="password" name="password" placeholder="Clave" required><br>
                <button type="submit">Entrar</button>
            </form>
            <br><a href="/register">¿No tenés cuenta? Registrate</a>
            <br><a href="/recuperar" style="font-size:0.8em; color:#d4af37;">¿Olvidaste tu contraseña?</a>
            <br><br><a href="/legal" style="font-size:0.8em; color:gray;">Términos y Privacidad</a>
        </div></body></html>`);
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query('SELECT nombre, email, membresia FROM usuarios WHERE email = $1 AND password = $2', [email, password]);
        if (result.rows.length > 0) {
            req.session.user = result.rows[0];
            res.redirect('/feed');
        } else {
            res.send('Credenciales incorrectas. <a href="/login">Volver</a>');
        }
    } catch (err) {
        res.send('Error en login: ' + err.message);
    }
});

app.get('/register', (req, res) => {
    res.send(`<html><head><link rel="stylesheet" href="/style.css"></head>
        <body><div class="glass-card">
            <h1>Registro Velo</h1>
            <form action="/register" method="POST" enctype="multipart/form-data"> 
                <input type="text" name="nombre" placeholder="Nombre" required><br>
                <input type="email" name="email" placeholder="Email" required><br>
                <input type="password" name="password" placeholder="Clave" required><br>
                <p style="color:white;">Foto de perfil:</p>
                <input type="file" name="foto" accept="image/*" required><br>
                <button type="submit">Registrarse</button>
            </form>
            <br><a href="/legal" style="font-size:0.8em; color:gray;">Al registrarte, aceptas nuestros términos legales.</a>
        </div></body></html>`);
});

app.post('/register', upload.single('foto'), async (req, res) => {
    try {
        if (!req.file) throw new Error('No se subió ninguna imagen.');
        const { nombre, email, password } = req.body;
        const foto_url = req.file.path;
        await pool.query('INSERT INTO usuarios (nombre, email, password, membresia) VALUES ($1, $2, $3, $4)', [nombre, email, password, 'free']);
        await pool.query('INSERT INTO fotos (usuario_email, url_foto, tipo) VALUES ($1, $2, $3)', [email, foto_url, 'galeria']);
        res.send('Usuario registrado. <a href="/login">Ir al Login</a>');
    } catch (err) {
        res.status(500).send('Error interno: ' + err.message);
    }
});

app.get('/legal', (req, res) => {
    res.send(`<html><head><link rel="stylesheet" href="/style.css"></head><body>
        <div class="glass-card" style="width: 80%; max-width: 700px; color: white; padding: 30px;">
            <h1>Términos y Privacidad</h1>
            <h3>1. Términos de Servicio</h3>
            <p>Al registrarte en veloapp.store, declaras bajo juramento ser <b>mayor de 18 años</b>. El uso de esta plataforma implica la aceptación de estas normas. No se permite contenido ofensivo o ilegal.</p>
            <h3>2. Privacidad y Pagos</h3>
            <p>La seguridad de tus pagos está gestionada exclusivamente por <b>Mercado Pago</b>. Velo no almacena información bancaria. Tus fotos y datos de perfil se usan únicamente para el funcionamiento de la red social.</p>
            <br><a href="/login" style="color:#d4af37;">Volver al Inicio</a>
        </div></body></html>`);
});

app.get('/chat', requireLogin, (req, res) => {
    const username = req.session.user.nombre;
    res.send(`<html><head><link rel="stylesheet" href="/style.css">
        <script src="/socket.io/socket.io.js"></script>
        <style>
            .chat-container { width: 90%; max-width: 600px; height: 70vh; margin: 20px auto; display: flex; flex-direction: column; background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 20px; padding: 20px; color: white; }
            #messages { flex-grow: 1; overflow-y: auto; list-style: none; padding: 0; }
            #messages li { background: rgba(0, 0, 0, 0.3); padding: 10px; margin-bottom: 10px; border-radius: 10px; border-left: 3px solid #d4af37; }
            #form { display: flex; gap: 10px; margin-top: 10px; }
            input { flex-grow: 1; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 10px; padding: 10px; color: white; }
            button { background: #d4af37; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: bold; }
        </style>
        </head><body>
        <div class="chat-container">
            <h1 style="text-align:center;">Velo Chat</h1>
            <ul id="messages"></ul>
            <form id="form">
                <input id="input" autocomplete="off" placeholder="Escribe un mensaje..." required>
                <button type="submit">Enviar</button>
            </form>
            <br><a href="/feed" style="color:white; text-decoration:none; text-align:center;">⬅ Volver al Feed</a>
        </div>
        <script>
            const socket = io();
            const form = document.getElementById('form');
            const input = document.getElementById('input');
            const messages = document.getElementById('messages');
            const username = "${username}";
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                if (input.value) { 
                    socket.emit('chat message', { msg: input.value, user: username }); 
                    input.value = ''; 
                }
            });
            socket.on('chat message', (data) => {
                const item = document.createElement('li');
                item.innerHTML = "<strong>" + data.user + ":</strong> " + data.msg;
                messages.appendChild(item);
                messages.scrollTop = messages.scrollHeight;
            });
        </script>
        </body></html>`);
});

app.post('/pagar', requireLogin, async (req, res) => {
    try {
        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: [{ title: 'Membresía Premium Velo (1 mes)', quantity: 1, unit_price: 10 }],
                external_reference: req.session.user.email,
                back_urls: {
                    success: 'https://veloapp.store/feed',
                    failure: 'https://veloapp.store/perfil/' + req.session.user.email,
                    pending: 'https://veloapp.store/perfil/' + req.session.user.email
                }
            }
        });
        res.redirect(result.init_point);
    } catch (err) {
        res.send('Error en el pago: ' + err.message);
    }
});

app.post('/webhook', express.json(), async (req, res) => {
    try {
        const { data, type } = req.body;
        if (type === 'payment' && data && data.id) {
            const paymentData = await payment.get({ id: data.id });
            if (paymentData.status === 'approved') {
                const email = paymentData.external_reference;
                await pool.query("UPDATE usuarios SET membresia = 'premium' WHERE email = $1", [email]);
            }
        }
        res.status(200).send('OK');
    } catch (err) {
        console.error('Error en webhook:', err);
        res.status(500).send('Error');
    }
});

app.post('/agregar-foto', requireLogin, upload.single('foto'), async (req, res) => {
    try {
        if (!req.file) return res.send('No seleccionaste foto.');
        const email = req.session.user.email;
        const membresia = req.session.user.membresia;
        const countResult = await pool.query('SELECT COUNT(*) FROM fotos WHERE usuario_email = $1', [email]);
        const cantidad = parseInt(countResult.rows[0].count);
        if (membresia === 'free' && cantidad >= 3) {
            return res.send('Límite alcanzado (máx 3 fotos). <a href="/perfil/' + email + '">Volver</a>');
        }
        await pool.query('INSERT INTO fotos (usuario_email, url_foto, tipo) VALUES ($1, $2, $3)', [email, req.file.path, 'galeria']);
        res.redirect('/perfil/' + email);
    } catch (err) {
        res.status(500).send('Error: ' + err.message);
    }
});

app.post('/like', requireLogin, async (req, res) => {
    try {
        const email_origen = req.session.user.email;
        const { email_destino } = req.body;
        if (email_origen === email_destino) return res.send('No te puedes dar like a ti mismo. <a href="/feed">Volver</a>');
        await pool.query('INSERT INTO likes (email_origen, email_destino) VALUES ($1, $2)', [email_origen, email_destino]);
        res.redirect('/feed');
    } catch (err) {
        res.status(500).send('Error al dar like: ' + err.message);
    }
});

app.post('/eliminar-perfil', requireLogin, async (req, res) => {
    try {
        const email = req.session.user.email;
        await pool.query('DELETE FROM likes WHERE email_origen = $1 OR email_destino = $1', [email]);
        await pool.query('DELETE FROM fotos WHERE usuario_email = $1', [email]);
        await pool.query('DELETE FROM usuarios WHERE email = $1', [email]);
        req.session.destroy();
        res.send('Perfil eliminado correctamente. <a href="/login">Volver al Login</a>');
    } catch (err) {
        res.status(500).send('Error al eliminar perfil: ' + err.message);
    }
});

app.get('/feed', requireLogin, async (req, res) => {
    try {
        const emailActual = req.session.user.email;
        
        const result = await pool.query(`
            SELECT u.nombre, u.email, f.url_foto 
            FROM usuarios u 
            LEFT JOIN fotos f ON u.email = f.usuario_email 
            WHERE f.tipo = 'galeria' AND u.email != $1`, [emailActual]);
        
        const cards = result.rows.map(u => `
            <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:15px; text-align:center; width:150px; margin: 10px;">
                <img src="${u.url_foto}" style="width:80px; height:80px; border-radius:50%; object-fit:cover; margin-bottom:10px;">
                <p style="margin:0; font-weight:bold;">${u.nombre}</p>
                <a href="/perfil/${u.email}" style="color:#d4af37; text-decoration:none;">Ver perfil</a>
                <form action="/like" method="POST" style="margin-top:10px;">
                    <input type="hidden" name="email_destino" value="${u.email}">
                    <button type="submit" style="background:#ff4757; border:none; color:white; padding:5px 10px; border-radius:5px; cursor:pointer;">❤️ Like</button>
                </form>
            </div>`).join('');

        const matchQuery = `
            SELECT DISTINCT u.nombre, u.email, f.url_foto 
            FROM likes l1 
            JOIN likes l2 ON l1.email_origen = l2.email_destino AND l1.email_destino = l2.email_origen 
            JOIN usuarios u ON u.email = l1.email_destino
            LEFT JOIN fotos f ON u.email = f.usuario_email AND f.tipo = 'galeria'
            WHERE l1.email_origen = $1 AND l1.email_destino != $1
        `;
        const matchResult = await pool.query(matchQuery, [emailActual]);
        
        const matchesHTML = matchResult.rows.map(m => `
            <div style="background:rgba(212,175,55,0.1); padding:10px; border-radius:10px; text-align:center; width:100px; border: 1px solid #d4af37;">
                <img src="${m.url_foto}" style="width:50px; height:50px; border-radius:50%; object-fit:cover;">
                <p style="margin:5px 0; font-size:0.9em; font-weight:bold;">${m.nombre}</p>
                <a href="/chat" style="color:#d4af37; font-size:0.8em; text-decoration:none;">💬 Chatear</a>
            </div>`).join('');

        res.send(`<html><head><link rel="stylesheet" href="/style.css"></head><body>
            <div class="glass-card" style="width: 90%;">
                <h1>Velo - Bienvenido ${req.session.user.nombre}</h1>
                
                ${matchResult.rows.length > 0 ? `
                    <div style="margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 15px;">
                        <h3>🔥 Tus Matches</h3>
                        <div style="display:flex; gap:15px; flex-wrap:wrap; justify-content:center;">${matchesHTML}</div>
                    </div>
                ` : ''}

                <h3>Descubre gente nueva</h3>
                <div style="display:flex; gap:20px; flex-wrap:wrap; justify-content:center;">${cards}</div>
                
                <br><a href="/chat" style="color:white; display:block; margin:20px;">Ir al Chat General</a>
                <br><a href="/logout" style="color:white;">Cerrar sesión</a>
            </div></body></html>`);
    } catch (err) {
        res.send('Error cargando feed y matches: ' + err.message);
    }
});

app.get('/perfil/:email', requireLogin, async (req, res) => {
    try {
        const { email } = req.params;
        const usuarioResult = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        const fotosResult = await pool.query('SELECT * FROM fotos WHERE usuario_email = $1 AND tipo = $2', [email, 'galeria']);
        if (usuarioResult.rows.length === 0) return res.send('Usuario no encontrado');
        const usuario = usuarioResult.rows[0];
        let galeriaHTML = fotosResult.rows.map(f => `<img src="${f.url_foto}" style="width:150px; margin:5px; border-radius:10px;">`).join('');
        const emailSesion = req.session.user.email ? req.session.user.email.toLowerCase().trim() : 'VACIO';
        const emailPerfil = email.toLowerCase().trim();
        let formHTML = '';
        if (emailSesion === emailPerfil) {
            formHTML = `<div style="border:2px solid green; padding:10px;"><h3>Subir nueva foto</h3>
                <form action="/agregar-foto" method="POST" enctype="multipart/form-data">
                    <input type="file" name="foto" accept="image/*" required><br>
                    <button type="submit">Subir</button>
                </form></div>`;
            if (usuario.membresia === 'free') {
                formHTML += `<br><form action="/pagar" method="POST">
                    <button type="submit" style="background:#d4af37; padding:10px; border:none; border-radius:5px; cursor:pointer;">Mejorar a Premium ($10 USD)</button>
                </form>`;
            } else {
                formHTML += `<br><p style="color:gold;"><b>¡Eres usuario Premium!</b></p>`;
            }
            formHTML += `<br><hr><form action="/eliminar-perfil" method="POST">
                <button type="submit" style="background:#ff4757; color:white; padding:10px; border:none; border-radius:5px; cursor:pointer;">❌ Eliminar mi cuenta</button>
            </form>`;
        }
        res.send(`<html><head><link rel="stylesheet" href="/style.css"></head><body>
            <div class="glass-card">
                <h1>Perfil de ${usuario.nombre}</h1>
                <h3>Galería</h3>${galeriaHTML}
                <hr>${formHTML}
                <br><a href="/feed" style="color:white;">Volver al Feed</a>
            </div></body></html>`);
    } catch (err) {
        res.send('Error cargando perfil: ' + err.message);
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

server.listen(process.env.PORT || 3000, () => console.log('Velo Producción activo con Chat, Legal, Likes, Matches y Borrado Seguro'));