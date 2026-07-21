app.get('/perfil/:email', requireLogin, async (req, res) => {
    try {
        const { email } = req.params;
        const usuarioResult = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        const fotosResult = await pool.query('SELECT * FROM fotos WHERE usuario_email = $1 AND tipo = $2', [email, 'galeria']);
        
        if (usuarioResult.rows.length === 0) return res.send('Usuario no encontrado');
        
        const usuario = usuarioResult.rows[0];
        let galeriaHTML = fotosResult.rows.map(f => `<img src="${f.url_foto}" style="width:150px; margin:5px; border-radius:10px;">`).join('');

        // --- SOLUCIÓN: Normalizamos ambos valores antes de comparar ---
        const emailSesion = req.session.user.email.toLowerCase().trim();
        const emailPerfil = email.toLowerCase().trim();

        let formHTML = '';
        if (emailSesion === emailPerfil) {
            formHTML = `<h3>Subir nueva foto</h3>
                <form action="/agregar-foto" method="POST" enctype="multipart/form-data">
                    <input type="file" name="foto" accept="image/*" required><br>
                    <button type="submit">Subir</button>
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