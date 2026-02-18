require('dotenv').config()
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const { createClient } = require('@supabase/supabase-js')

const app = express()
app.use(cors())
app.use(express.json())

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

// Configuración de Multer para subir archivos en memoria
const upload = multer({ storage: multer.memoryStorage() })

// 🔐 Middleware de protección para rutas de admin (POST, PUT, DELETE)
app.use('/producto', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const token = req.headers.authorization
    if (token !== `Bearer ${process.env.ADMIN_TOKEN}`) {
      return res.status(403).json({ error: "No autorizado" })
    }
  }
  next()
})

app.use('/upload', (req, res, next) => {
  const token = req.headers.authorization
  if (token !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(403).json({ error: "No autorizado" })
  }
  next()
})

// 🌟 Rutas

// LISTAR PRODUCTOS (público)
app.get('/producto', async (req, res) => {
  const { data, error } = await supabase
    .from('producto')
    .select('*')
    .eq('activo', true)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json(error)
  res.json(data)
})

// CREAR PRODUCTO (admin)
app.post('/producto', async (req, res) => {
  const { nombre, descripcion, categoria, estado, precio, imagen_url } = req.body

  const { data, error } = await supabase
    .from('producto')
    .insert([{ nombre, descripcion, categoria, estado, precio, imagen_url }])

  if (error) return res.status(500).json(error)
  res.json(data)
})

// EDITAR PRODUCTO (admin)
app.put('/producto/:id', async (req, res) => {
  const { id } = req.params
  const { nombre, descripcion, categoria, estado, precio, imagen_url } = req.body

  const { error } = await supabase
    .from('producto')
    .update({ nombre, descripcion, categoria, estado, precio, imagen_url })
    .eq('id', id)

  if (error) return res.status(500).json(error)
  res.json({ message: "Actualizado correctamente" })
})

// ELIMINAR PRODUCTO (soft delete) (admin)
app.delete('/producto/:id', async (req, res) => {
  const { id } = req.params

  const { error } = await supabase
    .from('producto')
    .update({ activo: false })
    .eq('id', id)

  if (error) return res.status(500).json(error)
  res.json({ message: "Producto eliminado" })
})

// SUBIR IMAGEN (admin)
app.post('/upload', upload.single('imagen'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se envió imagen" })
  }

  const file = req.file
  const fileName = Date.now() + '-' + file.originalname

  const { error } = await supabase.storage
    .from('productos')
    .upload(fileName, file.buffer, { contentType: file.mimetype })

  if (error) return res.status(500).json(error)

  const { data } = supabase.storage.from('productos').getPublicUrl(fileName)

  res.json({ url: data.publicUrl })
})

// Middleware de errores global
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Ocurrió un error inesperado' })
})

// Iniciar servidor
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`))
