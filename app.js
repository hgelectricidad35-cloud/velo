require('dotenv').config(); // <<--- 1. Cargamos las variables de entorno al inicio
const express = require('express');
const { Pool } = require('pg');
const session = require('express-session');
const multer = require('multer'); // <<--- 2. Importamos multer
const { CloudinaryStorage } = require('multer-storage-cloudinary'); // <<--- 2. Importamos storage de cloudinary
const cloudinary = require('cloudinary').v2; // <<--- 2. Importamos cloudinary
const app = express();

// --- Configuración de Cloudinary ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: 'perfiles_velo' }
});

const upload = multer({ storage: storage }); // <<--- Definimos el middleware de subida

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
        </div></body></html>`);
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND password = $2', [email, password]);
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

// --- RUTA DE REGISTRO ACTUALIZADA ---
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
        </div></body></html>`);
});

app.post('/register', upload.single('foto'), async (req, res) => { // <<--- Agregamos el middleware 'upload.single'
    const { nombre, email, password } = req.body;
    const foto_url = req.file.path; // La URL que nos devuelve Cloudinary automáticamente
    try {
        await pool.query('INSERT INTO usuarios (nombre, email, password, membresia) VALUES ($1, $2, $3, $4)', 
                         [nombre, email, password, 'free']);
        await pool.query('INSERT INTO fotos (usuario_email, url_foto, tipo) VALUES ($1, $2, $3)', 
                         [email, foto_url, 'galeria']);
        
        res.send('Usuario registrado con éxito. <a href="/login">Ir al Login</a>');
    } catch (err) {
        res.send('Error al registrar: ' + err.message + '. <a href="/register">Volver</a>');
    }
});

app.get('/feed', requireLogin, async (req, res) => {
    try {
        const result = await pool.query('SELECT u.nombre, u.email, f.url_foto FROM usuarios u LEFT JOIN fotos f ON u.email = f.usuario_email WHERE f.tipo = $1', ['galeria']);
        const cards = result.rows.map(u => `
            <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:15px; text-align:center; width:150px;">
                <img src="${u.url_foto}" style="width:80px; height:80px; border-radius:50%; object-fit:cover; margin-bottom:10px;">
                <p style="margin:0; font-weight:bold;">${u.nombre}</p>
                <a href="/perfil/${u.email}" style="color:#d4af37; text-decoration:none;">Ver perfil</a>
            </div>`).join('');

        res.send(`<html><head><link rel="stylesheet" href="/style.css"></head><body>
            <div class="glass-card" style="width: 90%;">
                <h1>Velo Feed - Bienvenido ${req.session.user.nombre}</h1>
                <div style="display:flex; gap:20px; flex-wrap:wrap; justify-content:center;">${cards}</div>
                <br><a href="/logout" style="color:white;">Cerrar sesión</a>
            </div></body></html>`);
    } catch (err) {
        res.send('Error cargando feed: ' + err.message);
    }
});

app.get('/perfil/:email', requireLogin, async (req, res) => {
    try {
        const { email } = req.params;
        const usuario = (await pool.query('SELECT * FROM usuarios WHERE email = $1', [email])).rows[0];
        const fotos = (await pool.query('SELECT * FROM fotos WHERE usuario_email = $1 AND tipo = $2', [email, 'galeria'])).rows;
        
        let galeriaHTML = fotos.map(f => `<img src="${f.url_foto}" style="width:150px; margin:5px; border-radius:10px;">`).join('');

        res.send(`<html><head><link rel="stylesheet" href="/style.css"></head><body>
            <div class="glass-card">
                <h1>Perfil de ${usuario.nombre}</h1>
                <h3>Galería</h3>${galeriaHTML}
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

app.listen(process.env.PORT || 3000, () => console.log('Velo Producción activo'));