// Add API routes
app.get("/api/rooms", (req, res) => {
  try {
    const rooms: any[] = []

    // Access the matchmaker from the app
    const matchMaker = (app as any).locals?.matchMaker || (global as any).matchMaker

    if (matchMaker && matchMaker.rooms) {
      for (const [roomId, room] of matchMaker.rooms) {
        // Only include rooms that are joinable
        if (!room.locked && room.clients.size < room.maxClients) {
          rooms.push({
            roomId: roomId,
            name: room.roomName,
            type: room.roomName,
            clients: room.clients.size,
            maxClients: room.maxClients,
            locked: room.locked || false,
            private: room.private || false,
            createdAt: room.createdAt || new Date().toISOString(),
            metadata: room.metadata || {},
          })
        }
      }
    }

    console.log(`📊 API: Found ${rooms.length} available rooms`)
    res.json(rooms)
  } catch (error) {
    console.error("❌ API: Error getting rooms:", error)
    res.status(500).json({ error: "Failed to get rooms" })
  }
})

// Store matchmaker reference for API access
app.use((req, res, next) => {
  if (!app.locals.matchMaker && (global as any).matchMaker) {
    app.locals.matchMaker = (global as any).matchMaker
  }
  next()
})
