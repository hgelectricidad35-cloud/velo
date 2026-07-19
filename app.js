const express = require('express');
const { Pool } = require('pg');
const session = require('express-session');
const app = express();

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: 'postgres', 
    port: 5432,
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuración de la sesión
app.use(session({
    secret: 'velo-secreto-2026',
    resave: false,
    saveUninitialized: false
}));

// MIDDLEWARE para proteger rutas
const requireLogin = (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    next();
};

// --- RUTAS DE AUTENTICACIÓN ---

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
        </div></body></html>`);
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND password = $2', [email, password]);
    
    if (result.rows.length > 0) {
        req.session.user = result.rows[0]; 
        res.redirect('/feed');
    } else {
        res.send('Credenciales incorrectas. <a href="/login">Volver</a>');
    }
});

// --- EL CORAZÓN DE LA APP (Protegido) ---

app.get('/feed', requireLogin, async (req, res) => {
    const result = await pool.query('SELECT nombre, email FROM usuarios');
    const cards = result.rows.map(u => `
        <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:15px; text-align:center; width:150px;">
            <div style="width:80px; height:80px; background:#333; border-radius:50%; margin:0 auto 10px;"></div>
            <p style="margin:0; font-weight:bold;">${u.nombre}</p>
            <a href="/perfil/${u.email}" style="color:#d4af37; text-decoration:none;">Ver perfil</a>
        </div>`).join('');

    res.send(`<html><head><link rel="stylesheet" href="/style.css"></head><body>
        <div class="glass-card" style="width: 90%;">
            <h1>Velo Feed - Bienvenido ${req.session.user.nombre}</h1>
            <div style="display:flex; gap:20px; flex-wrap:wrap; justify-content:center;">${cards}</div>
            <br><a href="/logout" style="color:white;">Cerrar sesión</a>
        </div></body></html>`);
});

app.get('/perfil/:email', requireLogin, async (req, res) => {
    const { email } = req.params;
    const usuario = (await pool.query('SELECT * FROM usuarios WHERE email = $1', [email])).rows[0];
    const fotos = (await pool.query('SELECT * FROM fotos WHERE usuario_email = $1 AND tipo = $2', [email, 'galeria'])).rows;
    const videos = (await pool.query('SELECT * FROM fotos WHERE usuario_email = $1 AND tipo = $2', [email, 'video'])).rows;
    
    const v = req.session.user.membresia;

    let galeriaHTML = v === 'free' ? '<div style="background:rgba(255,255,255,0.1); padding:20px; border-radius:10px;">🔒 Contenido Premium necesario.</div>' : 
                      fotos.map(f => `<img src="${f.url_foto}" style="width:80px; margin:5px; border-radius:10px;">`).join('');

    let videosHTML = v === 'premium_plus' ? (videos.length > 0 ? videos.map(v => `<div style="margin:5px;">📹 Video: ${v.url_foto}</div>`).join('') : '<p>Sin videos.</p>') :
                     '<div style="background:rgba(212,175,55,0.1); padding:20px; border-radius:10px; border:1px solid #d4af37;">✨ Solo para Premium+</div>';

    res.send(`<html><head><link rel="stylesheet" href="/style.css"></head><body>
        <div class="glass-card">
            <h1>Perfil de ${usuario.nombre}</h1>
            <h3>Galería</h3>${galeriaHTML}
            <hr><h3>Videos Exclusivos</h3>${videosHTML}
            <br><a href="/feed" style="color:white;">Volver al Feed</a>
        </div></body></html>`);
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.listen(3000, () => console.log('Velo Producción activo en: http://localhost:3000/login'));