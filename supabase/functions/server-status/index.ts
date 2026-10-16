import { createClient } from "npm:@supabase/supabase-js@2"

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
)

type RconPacket = { id: number; type: number; body: string }

function packet(id: number, type: number, body: string): Uint8Array {
  const bodyBytes = encoder.encode(body)
  const payloadLength = 4 + 4 + bodyBytes.length + 2
  const output = new Uint8Array(4 + payloadLength)
  const view = new DataView(output.buffer)
  view.setInt32(0, payloadLength, true)
  view.setInt32(4, id, true)
  view.setInt32(8, type, true)
  output.set(bodyBytes, 12)
  return output
}

async function readPacket(connection: Deno.Conn): Promise<RconPacket> {
  const header = new Uint8Array(4)
  let offset = 0
  while (offset < header.length) {
    const count = await connection.read(header.subarray(offset))
    if (count === null) throw new Error("RCON cerró la conexión")
    offset += count
  }

  const payloadLength = new DataView(header.buffer).getInt32(0, true)
  if (payloadLength < 10 || payloadLength > 1_048_576) throw new Error("Paquete RCON inválido")
  const payload = new Uint8Array(payloadLength)
  offset = 0
  while (offset < payload.length) {
    const count = await connection.read(payload.subarray(offset))
    if (count === null) throw new Error("RCON cerró la conexión")
    offset += count
  }

  const view = new DataView(payload.buffer)
  const body = decoder.decode(payload.subarray(8, payload.length - 2))
  return { id: view.getInt32(0, true), type: view.getInt32(4, true), body }
}

async function readCommandResponse(connection: Deno.Conn, commandId: number): Promise<string> {
  const bodies: string[] = []
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await readPacket(connection)
    if (response.id !== commandId) continue
    bodies.push(response.body)
    if (response.body.length === 0 || response.body.length < 4096) break
  }
  return bodies.join("")
}

function parsePlayers(response: string): string[] {
  return response
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter((line) => line.length > 0 && !/^players connected/i.test(line) && !/^there are no players/i.test(line))
    .filter((line) => !/^\d+$/.test(line))
}

async function getPlayers(): Promise<string[]> {
  const connection = await Deno.connect({
    hostname: Deno.env.get("PZ_RCON_HOST") || "172.240.18.177",
    port: Number(Deno.env.get("PZ_RCON_PORT") || "27706"),
  })

  try {
    const authId = Math.floor(Math.random() * 2_000_000_000)
    const commandId = authId + 1
    const password = Deno.env.get("PZ_RCON_PASSWORD")
    if (!password) throw new Error("Falta configurar PZ_RCON_PASSWORD")

    await connection.write(packet(authId, 3, password))
    const authResponse = await readPacket(connection)
    if (authResponse.id === -1) throw new Error("Contraseña RCON incorrecta")

    await connection.write(packet(commandId, 2, "players"))
    return parsePlayers(await readCommandResponse(connection, commandId))
  } finally {
    connection.close()
  }
}

async function recordPlayerPlaytime(players: string[], now: string): Promise<void> {
  if (players.length === 0) return

  const { data, error } = await supabase
    .from("player_playtime")
    .select("username, total_seconds, last_seen")
    .in("username", players)
  if (error) throw error

  const previousByUsername = new Map((data || []).map((row) => [row.username, row]))
  const nowMs = new Date(now).getTime()
  const updates = players.map((username) => {
    const previous = previousByUsername.get(username)
    if (!previous) {
      return { username, total_seconds: 0, last_seen: now, updated_at: now }
    }

    const elapsedSeconds = Math.max(0, Math.min(600, Math.floor((nowMs - new Date(previous.last_seen).getTime()) / 1000)))
    return {
      username,
      total_seconds: Number(previous.total_seconds || 0) + elapsedSeconds,
      last_seen: now,
      updated_at: now,
    }
  })

  const { error: upsertError } = await supabase.from("player_playtime").upsert(updates)
  if (upsertError) throw upsertError
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 })

  try {
    const players = await getPlayers()
    const now = new Date().toISOString()
    await recordPlayerPlaytime(players, now)
    const { data: previousPlayers, error: previousPlayersError } = await supabase
      .from("server_players")
      .select("username")
    if (previousPlayersError) throw previousPlayersError

    const { data: previousStatus, error: previousStatusError } = await supabase
      .from("server_status")
      .select("online, peak_player_count, online_since")
      .eq("id", "main")
      .maybeSingle()
    if (previousStatusError) throw previousStatusError

    const peakPlayerCount = Math.max(previousStatus?.peak_player_count || 0, players.length)
    const onlineSince = previousStatus?.online && previousStatus.online_since ? previousStatus.online_since : now
    const { error: statusError } = await supabase.from("server_status").upsert({
      id: "main",
      online: true,
      player_count: players.length,
      peak_player_count: peakPlayerCount,
      online_since: onlineSince,
      checked_at: now,
    })
    if (statusError) throw statusError

    const activityEvents: Array<{ type: string; title: string; message: string; username?: string; metadata: Record<string, unknown> }> = []
    const previousPlayerCount = previousStatus?.player_count ?? 0
    if (!previousStatus?.online) {
      activityEvents.push({
        type: "server",
        title: "Servidor activo",
        message: `El servidor volvió a estar online con ${players.length} jugadores conectados.`,
        metadata: { player_count: players.length },
      })
    }

    const previousPlayerNames = new Set((previousPlayers || []).map((player) => player.username))
    const currentPlayerNames = new Set(players)
    for (const username of players) {
      if (!previousPlayerNames.has(username)) {
        activityEvents.push({
          type: "player_joined",
          title: "Jugador conectado",
          message: `${username} se conectó al servidor.`,
          username,
          metadata: { username },
        })
      }
    }
    for (const username of previousPlayerNames) {
      if (!currentPlayerNames.has(username)) {
        activityEvents.push({
          type: "player_left",
          title: "Jugador desconectado",
          message: `${username} salió del servidor.`,
          username,
          metadata: { username },
        })
      }
    }

    const { error: deleteError } = await supabase.from("server_players").delete().neq("username", "")
    if (deleteError) throw deleteError
    if (players.length > 0) {
      const { error: playersError } = await supabase.from("server_players").insert(
        players.map((username) => ({ username, last_seen: now })),
      )
      if (playersError) throw playersError
    }

    if (activityEvents.length > 0) {
      const { error: activityError } = await supabase.from("server_activity").insert(
        activityEvents.map((event) => ({
          type: event.type,
          title: event.title,
          message: event.message,
          username: event.username ?? null,
          metadata: event.metadata,
          created_at: now,
        })),
      )
      if (activityError) throw activityError
    }

    return Response.json({ online: true, playerCount: players.length })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error)
    console.error("server-status failed:", errorMessage)
    const offlineNow = new Date().toISOString()
    await supabase.from("server_status").upsert({
      id: "main",
      online: false,
      player_count: 0,
      online_since: null,
      checked_at: offlineNow,
    })
    await supabase.from("server_activity").insert({
      type: "server",
      title: "Servidor fuera de línea",
      message: "El chequeo del servidor falló. Se registró una desconexión o error de conexión.",
      metadata: { error: errorMessage },
      created_at: offlineNow,
    })
    return Response.json({ error: errorMessage || "No se pudo consultar RCON" }, { status: 502 })
  }
})
