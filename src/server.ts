import { app } from './app'

const start = async () => {
  try {
    const PORT = Number(process.env.PORT) || 10000
    const HOST = process.env.HOST || '0.0.0.0'

    console.log(`🚀 Starting server on ${HOST}:${PORT}`)
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)

    await app.listen({
      port: PORT,
      host: HOST,
    })

    console.log(`✅ Server is running on port: ${PORT}`)
    console.log(`🔗 Health check available at: http://${HOST}:${PORT}/health`)
  } catch (err) {
    console.error('❌ Failed to start server:', err)
    app.log.error(err)
    process.exit(1)
  }
}

start()
