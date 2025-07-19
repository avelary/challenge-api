import { app } from './app'

const start = async () => {
  try {
    const PORT = Number(process.env.PORT) || 3333

    await app.listen({
      port: PORT,
      host: '0.0.0.0',
    })

    console.log(`🚀 Server is running on port: ${PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
