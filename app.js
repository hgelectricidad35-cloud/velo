app.get('/feed', requireLogin, async (req, res) => {
    try {
        const result = await pool.query('SELECT u.nombre, u.email, f.url_foto FROM usuarios u LEFT JOIN fotos f ON u.email = f.usuario_email WHERE f.tipo = $1', ['galeria']);
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
        res.send(`<html><head><link rel="stylesheet" href="/style.css"></head><body>
            <div class="glass-card" style="width: 90%;">
                <h1>Velo Feed - Bienvenido ${req.session.user.nombre}</h1>
                <div style="display:flex; gap:20px; flex-wrap:wrap; justify-content:center;">${cards}</div>
                <br><a href="/chat" style="color:white; display:block; margin:20px;">Ir al Chat</a>
                <br><a href="/logout" style="color:white;">Cerrar sesión</a>
            </div></body></html>`);
    } catch (err) {
        res.send('Error cargando feed: ' + err.message);
    }
});