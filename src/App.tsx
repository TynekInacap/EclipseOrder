import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import logoImg from "@/imports/bg,f8f8f8-flat,750x,075,f-pad,750x1000,f8f8f8.jpg"
import siteLogoImg from "@/imports/final123.png"
import defaultBannerImg from "@/imports/default-banner.jpg"

const DEFAULT_BANNER_URL = `url(${defaultBannerImg})`

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "user" | "admin" | "moderator"
type Category = "bugs" | "reportes" | "historias" | "facciones" | "normativa"
type ThreadStatus = "abierto" | "cerrado" | "en_revision"

interface NotificationItem {
  id: string
  text: string
  createdAt: string
  read?: boolean
}

interface User {
  id: string
  username: string
  password: string
  role: Role
  joinedAt: string
  avatar: string
  avatarUrl?: string
  bio?: string
  bannerColor?: string
  notifications?: NotificationItem[]
  rolePoints?: number
  redeemedRolePoints?: number
}

interface Attachment {
  name: string
  type: "image" | "video"
  dataUrl: string
}

interface Reply {
  id: string
  authorId: string
  content: string
  createdAt: string
  isStaff?: boolean
  attachments?: Attachment[]
}

interface Thread {
  id: string
  title: string
  category: Category
  authorId: string
  content: string
  status: ThreadStatus
  createdAt: string
  replies: Reply[]
  pinned?: boolean
  attachments?: Attachment[]
  adminOnly?: boolean
}

type View =
  | "login"
  | "register"
  | "forum"
  | "category"
  | "thread"
  | "new_thread"
  | "profile"
  | "admin"

type ProfileRow = {
  id: string
  username: string
  role: Role
  avatar: string
  avatar_url?: string | null
  bio?: string | null
  banner_color?: string | null
  notifications?: NotificationItem[]
  role_points?: number
  redeemed_role_points?: number
  joined_at: string
}

type ThreadRow = {
  id: string
  title: string
  category: Category
  author_id: string
  content: string
  status: ThreadStatus
  pinned: boolean
  admin_only: boolean
  created_at: string
}

type ReplyRow = {
  id: string
  thread_id: string
  author_id: string
  content: string
  is_staff: boolean
  created_at: string
}

type AttachmentRow = {
  id: string
  thread_id?: string
  reply_id?: string
  name: string
  type: "image" | "video"
  data_url?: string | null
  storage_path?: string | null
}

function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    username: row.username,
    password: "",
    role: row.role,
    joinedAt: row.joined_at,
    avatar: row.avatar,
    avatarUrl: row.avatar_url || undefined,
    bio: row.bio || undefined,
    bannerColor: row.banner_color || undefined,
    notifications: row.notifications || [],
    rolePoints: row.role_points || 0,
    redeemedRolePoints: row.redeemed_role_points || 0,
  }
}

function mapReply(row: ReplyRow): Reply {
  return {
    id: row.id,
    authorId: row.author_id,
    content: row.content,
    createdAt: row.created_at,
    isStaff: row.is_staff,
  }
}

async function loadSupabaseForum() {
  const [
    { data: profileRows, error: profilesError },
    { data: threadRows, error: threadsError },
    { data: replyRows, error: repliesError },
    { data: threadAttachmentRows, error: threadAttachmentsError },
    { data: replyAttachmentRows, error: replyAttachmentsError },
  ] = await Promise.all([
    supabase.from("profiles").select("*").order("joined_at", { ascending: true }),
    supabase.from("threads").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("replies").select("*").order("created_at", { ascending: true }),
    supabase.from("thread_attachments").select("*"),
    supabase.from("reply_attachments").select("*"),
  ])

  if (profilesError) throw profilesError
  if (threadsError) throw threadsError
  if (repliesError) throw repliesError
  if (threadAttachmentsError) throw threadAttachmentsError
  if (replyAttachmentsError) throw replyAttachmentsError

  const users = (profileRows || []).map((row) => mapProfile(row as ProfileRow))
  const threadAttachments = (threadAttachmentRows || []) as AttachmentRow[]
  const replyAttachments = (replyAttachmentRows || []) as AttachmentRow[]
  const threads = (threadRows || []).map((row) => {
    const thread = row as ThreadRow
    return {
      id: thread.id,
      title: thread.title,
      category: thread.category,
      authorId: thread.author_id,
      content: thread.content,
      status: thread.status,
      pinned: thread.pinned,
      adminOnly: thread.admin_only,
      createdAt: thread.created_at,
      attachments: threadAttachments
        .filter((attachment) => attachment.thread_id === thread.id)
        .map((attachment) => ({ name: attachment.name, type: attachment.type, dataUrl: attachment.data_url || "" })),
      replies: (replyRows || []).filter((reply) => (reply as ReplyRow).thread_id === thread.id).map((reply) => {
        const mappedReply = mapReply(reply as ReplyRow)
        mappedReply.attachments = replyAttachments
          .filter((attachment) => attachment.reply_id === mappedReply.id)
          .map((attachment) => ({ name: attachment.name, type: attachment.type, dataUrl: attachment.data_url || "" }))
        return mappedReply
      }),
    }
  })

  return { users, threads }
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_USERS: User[] = [
  {
    id: "u0",
    username: "Henry Kissinger",
    password: "cartas",
    role: "admin",
    joinedAt: "2024-01-01",
    avatar: "H",
    avatarUrl: logoImg,
    bio: "Moderador principal del servidor. Mantengo el orden dentro de la comunidad y reviso los reportes de jugadores.",
    bannerColor: DEFAULT_BANNER_URL,
    notifications: [],
  },
]

const SEED_THREADS: Thread[] = [
  {
    id: "t1",
    title: "Bug: Objetos desaparecen al cerrar el servidor",
    category: "bugs",
    authorId: "u2",
    content:
      "Cuando el servidor se reinicia, los objetos que dejé en el suelo del safehouse desaparecen. Esto pasa desde la última actualización. He perdido 3 mochilas llenas de comida enlatada y munición. Reproduzco el bug dejando objetos en coordenadas 11420x8203, reiniciando el servidor y volviendo a la ubicación.",
    status: "en_revision",
    createdAt: "2026-08-05T14:22:00Z",
    pinned: true,
    replies: [
      {
        id: "r1",
        authorId: "u1",
        content:
          "Gracias por el reporte detallado. Hemos reproducido el bug en el entorno de pruebas. Estamos trabajando en un hotfix.",
        createdAt: "2026-08-06T09:10:00Z",
        isStaff: true,
      },
    ],
  },
  {
    id: "t2",
    title: "Facción: Zonas de control del norte del mapa",
    category: "facciones",
    authorId: "u3",
    content:
      "Propongo crear una zona PvP opcional al norte, cerca de Louisville. Así los jugadores que quieren combate PvP tienen su espacio sin afectar a los que prefieren PvE. Se podría marcar con señales en el juego y anunciarlo en el Discord.",
    status: "abierto",
    createdAt: "2026-08-07T18:45:00Z",
    replies: [
      {
        id: "r2",
        authorId: "u2",
        content: "+1 a esta idea. Llevan meses pidiendo esto en el Discord.",
        createdAt: "2026-08-07T19:30:00Z",
      },
    ],
  },
  {
    id: "t3",
    title: "Reporte: Jugador usando speed hack - MrGriefer2024",
    category: "reportes",
    authorId: "u2",
    content:
      "El usuario MrGriefer2024 estaba moviéndose a velocidad anormal cerca de West Point. Tengo capturas de pantalla y un clip de video. También destruyó mis barricadas sin poder ser alcanzado. Hora del incidente: 2026-08-08 ~20:30 server time.",
    status: "cerrado",
    createdAt: "2026-08-08T21:00:00Z",
    replies: [
      {
        id: "r3",
        authorId: "u0",
        content:
          "El jugador ha sido baneado permanentemente tras revisar los logs del servidor. Gracias por el reporte con evidencia.",
        createdAt: "2026-08-09T10:00:00Z",
        isStaff: true,
      },
    ],
  },
  {
    id: "t-rules-reportes",
    title: "Formato y reglas para reportes del servidor",
    category: "reportes",
    authorId: "u0",
    content:
      "Antes de abrir un reporte, revisa esta guía:\n\n1. Menciona al menos a un usuario involucrado.\n2. Describe el incidente con la mayor claridad posible.\n3. Añade fecha, hora y ubicación aproximada.\n4. Sube capturas o vídeos si existen pruebas.\n5. No reportes por disputas personales ni rumores sin evidencia.\n\nEl staff revisará cada caso en orden de prioridad y responderá según la gravedad.",
    status: "abierto",
    createdAt: "2026-08-03T11:00:00Z",
    replies: [],
    pinned: true,
    adminOnly: true,
  },
  {
    id: "t4",
    title: "Facción: Eventos semanales de supervivencia",
    category: "facciones",
    authorId: "u3",
    content:
      "Sería genial tener eventos semanales con reglas especiales: sin vehículos, solo armas blancas, hordes especiales los viernes, etc. Esto daría más vida al servidor entre actualizaciones.",
    status: "cerrado",
    createdAt: "2026-08-03T11:00:00Z",
    replies: [],
  },
  {
    id: "t5",
    title: "La caída de Mika — Diario del día 47",
    category: "historias",
    authorId: "u3",
    content:
      "Día 47 desde el inicio del Eclipse.\n\nEncontré un diario abandonado en una farmacia de Muldraugh. Su dueño anterior se llamaba Carlos. No sé si sobrevivió.\n\nLlevo tres semanas sin ver a otro superviviente vivo. El silencio ya no me asusta, me preocupa más el ruido. Ayer escuché un motor al norte, cerca de la estación de policía, pero cuando llegué no había nadie. Solo sangre fresca y una mochila verde oliva con munición del 9mm.\n\nAlguien más sigue aquí fuera. Y no sé si eso es bueno o malo.",
    status: "abierto",
    createdAt: "2026-08-09T16:00:00Z",
    replies: [
      {
        id: "r4",
        authorId: "u2",
        content: "Bro esa mochila era mía... fui a buscar agua y cuando volví ya no estaba. Sobreviví escondiéndome en el sótano del bar. ¿Dónde estás ahora?",
        createdAt: "2026-08-09T18:30:00Z",
      },
    ],
  },
  {
    id: "t6",
    title: "El Cazador Solitario — Origen de ZombieHunter99",
    category: "historias",
    authorId: "u2",
    content:
      "Antes del Eclipse trabajaba como guardia de seguridad en el almacén de Knox. Turno de noche, solo, con una linterna y una radio que solo captaba estática.\n\nLa primera noche que todo se derrumbó, estaba en mi puesto cuando vi a mi compañero Tomás tambalearse por el pasillo. Pensé que estaba borracho. Error casi fatal.\n\nDesde entonces cargo siempre con dos cosas: la navaja que le quité a Tomás antes de que me alcanzara, y la culpa de haberle fallado.\n\nSoy ZombieHunter, pero la verdad es que no cazar zombies me cuesta trabajo. Lo que me cuesta es olvidar las caras que reconozco entre ellos.",
    status: "abierto",
    createdAt: "2026-08-10T09:15:00Z",
    pinned: true,
    replies: [],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<Category, string> = {
  bugs: "Reporte de Bug",
  reportes: "Reportes del servidor",
  historias: "Historia de Personaje",
  facciones: "Facciones",
  normativa: "Normativa",
}

const CATEGORY_ICONS: Record<Category, string> = {
  bugs: "🐛",
  reportes: "⚠️",
  historias: "📖",
  facciones: "🛡️",
  normativa: "📜",
}

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  bugs: "Reporta errores, glitches y problemas técnicos del servidor.",
  reportes: "Reporta jugadores que violen las reglas del servidor.",
  historias: "Comparte la historia de tu personaje superviviente.",
  facciones: "Discute grupos, clanes y facciones del rol.",
  normativa: "Consulta y debate las normas del servidor.",
}

const CATEGORY_COLORS: Record<Category, string> = {
  bugs: "#e74c3c",
  reportes: "#e67e22",
  historias: "#8e44ad",
  facciones: "#22c55e",
  normativa: "#38bdf8",
}

const CATEGORY_THREAD_ACTIONS: Record<Category, string> = {
  bugs: "NOTIFICAR BUG",
  reportes: "NOTIFICAR REPORTE",
  historias: "COMPARTIR HISTORIA",
  facciones: "PROPONER FACCIÓN",
  normativa: "PROPONER NORMATIVA",
}

const ROLE_REDEEM_COST = 100
const SESSION_STORAGE_KEY = "eclipse-order-session"

const STATUS_LABELS: Record<ThreadStatus, string> = {
  abierto: "Abierto",
  cerrado: "Cerrado",
  en_revision: "En revisión",
}

const STATUS_COLORS: Record<ThreadStatus, string> = {
  abierto: "#27ae60",
  cerrado: "#7f8c8d",
  en_revision: "#f39c12",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function authEmailForCharacter(name: string) {
  const slug = name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return `${slug || "personaje"}@eclipse-order.local`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "24px",
        backgroundImage:
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(192,57,43,0.12) 0%, transparent 60%)",
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          border: "3px solid rgba(148, 163, 184, 0.2)",
          borderTop: "3px solid #f97316",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <div
        style={{
          color: "var(--text-muted)",
          fontSize: 14,
          fontFamily: "JetBrains Mono, monospace",
          letterSpacing: "0.05em",
          animation: "pulse 2s ease-in-out infinite",
        }}
      >
        Cargando foro...
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const imgSize = size === "lg" ? 80 : size === "sm" ? 32 : 44
  const titleSize = size === "lg" ? 28 : size === "sm" ? 15 : 20
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size === "lg" ? 16 : 10 }}>
      <div
        style={{
          width: imgSize,
          height: imgSize,
          borderRadius: 16,
          background: "linear-gradient(135deg, rgba(249,115,22,0.25), rgba(14,165,233,0.22))",
          border: "1px solid rgba(148,163,184,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 14px 28px rgba(15, 23, 42, 0.28)",
          overflow: "hidden",
        }}
      >
        <img
          src={siteLogoImg}
          alt="Eclipse Horder logo"
          style={{ width: imgSize * 0.76, height: imgSize * 0.76, objectFit: "contain", flexShrink: 0 }}
        />
      </div>
      <div>
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: titleSize, letterSpacing: "0.1em", color: "var(--text)", lineHeight: 1.1 }}>
          ECLIPSE ORDER
        </div>
      </div>
    </div>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        background: color + "22",
        color: color,
        border: `1px solid ${color}44`,
        borderRadius: 3,
        padding: "1px 7px",
        fontSize: 11,
        fontFamily: "JetBrains Mono, monospace",
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  )
}

function Avatar({ letter, role, size = 32, imageUrl }: { letter: string; role: Role; size?: number; imageUrl?: string }) {
  const bg =
    role === "admin"
      ? "#7b1c13"
      : role === "moderator"
      ? "#1a3a5c"
      : "var(--border)"

  if (imageUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          border: `2px solid ${role === "admin" ? "#c0392b" : role === "moderator" ? "#2980b9" : "var(--border2)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: bg,
        }}
      >
        <img src={imageUrl} alt={letter} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        border: `2px solid ${role === "admin" ? "#c0392b" : role === "moderator" ? "#2980b9" : "var(--border2)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Oswald, sans-serif",
        fontWeight: 600,
        fontSize: size * 0.4,
        color: "var(--text)",
        flexShrink: 0,
      }}
    >
      {letter}
    </div>
  )
}

// ─── Login View ───────────────────────────────────────────────────────────────

function LoginView({
  onLogin,
  goRegister,
}: {
  onLogin: (characterName: string, password: string) => Promise<void>
  goRegister: () => void
}) {
  const [characterName, setCharacterName] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await onLogin(characterName.trim(), password)
      setError("")
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesión.")
    }
  }

  return (
    <div
      className="login-shell"
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        backgroundImage:
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(192,57,43,0.12) 0%, transparent 60%)",
      }}
    >
      <div className="login-orbit login-orbit-one" />
      <div className="login-orbit login-orbit-two" />
      <div className="login-content" style={{ width: "100%", maxWidth: 420 }}>
        <div className="login-brand" style={{ textAlign: "center", marginBottom: 40 }}>
          <Logo />
          <div className="login-brand-line">
            <span />
            <small>COMUNIDAD DE PROJECT ZOMBOID</small>
            <span />
          </div>
        </div>
        <div className="login-eclipse" aria-hidden="true">
          <div className="login-eclipse-corona" />
          <div className="login-eclipse-disc" />
        </div>

        <div
          className="login-panel"
          style={{
            background: "linear-gradient(180deg, rgba(15,23,42,0.88), rgba(11,16,23,0.9))",
            border: "1px solid var(--border)",
            borderRadius: 24,
            padding: "32px 28px",
            boxShadow: "0 30px 60px rgba(2, 6, 23, 0.32)",
          }}
        >
          <h2
            style={{
              fontFamily: "Oswald, sans-serif",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "var(--text)",
              marginBottom: 6,
            }}
          >
            INICIAR SESIÓN
          </h2>
          <p className="login-subtitle" style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 28 }}>
            Accede al foro del servidor Eclipse Order
          </p>

          {error && (
            <div
              style={{
                background: "#c0392b18",
                border: "1px solid #c0392b55",
                borderRadius: 4,
                padding: "10px 14px",
                color: "#e74c3c",
                fontSize: 13,
                marginBottom: 20,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nombre del personaje</label>
              <input
                className="login-input"
                style={inputStyle}
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="Tu nombre en Project Zomboid"
                autoFocus
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Contraseña</label>
              <input
                className="login-input"
                style={inputStyle}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="login-submit" style={primaryBtn}>
              ENTRAR AL FORO
            </button>
          </form>

          <div
            className="login-register"
            style={{
              marginTop: 24,
              paddingTop: 24,
              borderTop: "1px solid #252830",
              textAlign: "center",
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            ¿No tienes cuenta?{" "}
            <button
              onClick={goRegister}
              style={{
                background: "none",
                border: "none",
                color: "#e74c3c",
                cursor: "pointer",
                fontWeight: 600,
                padding: 0,
                fontSize: 13,
              }}
            >
              Registrarse
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Register View ────────────────────────────────────────────────────────────

function RegisterView({
  onRegister,
  goLogin,
}: {
  onRegister: (username: string, password: string) => Promise<void>
  goLogin: () => void
}) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (username.trim().length < 3) {
      setError("El nombre de usuario debe tener al menos 3 caracteres.")
      return
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.")
      return
    }
    try {
      await onRegister(username.trim(), password)
      setError("")
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "No se pudo crear la cuenta.")
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(192,57,43,0.1) 0%, transparent 60%)" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Logo />
        </div>
        <div style={{ background: "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(11,16,23,0.94))", border: "1px solid var(--border)", borderRadius: 24, padding: "32px 28px", boxShadow: "0 30px 60px rgba(2, 6, 23, 0.3)" }}>
          {error && (
            <div style={{ background: "#c0392b18", border: "1px solid #c0392b55", borderRadius: 4, padding: "10px 14px", color: "#e74c3c", fontSize: 13, marginBottom: 20 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nombre de usuario</label>
              <input style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usa el mismo nombre del servidor" />
              <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--text-dim)" }}>
                Recomendamos usar tu nombre en el servidor de Zomboid
              </p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Contraseña</label>
              <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={labelStyle}>Confirmar contraseña</label>
              <input style={inputStyle} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repite la contraseña" />
            </div>
            <button type="submit" style={primaryBtn}>CREAR CUENTA</button>
          </form>

          <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid #252830", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
            ¿Ya tienes cuenta?{" "}
            <button onClick={goLogin} style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontWeight: 600, padding: 0, fontSize: 13 }}>
              Iniciar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function LogoutModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "32px 36px", maxWidth: 380, width: "90%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
      >
        <img src={siteLogoImg} alt="Eclipse Order" style={{ width: 64, height: 64, objectFit: "contain", marginBottom: 16 }} />
        <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: "0.08em", color: "var(--text)", marginBottom: 10 }}>
          ¿CERRAR SESIÓN?
        </div>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 28, lineHeight: 1.5 }}>
          ¿Estás seguro de que quieres salir del foro de Eclipse Order?
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, background: "transparent", border: "1px solid var(--border2)", borderRadius: 4, color: "var(--text-muted)", cursor: "pointer", padding: "10px", fontSize: 12, fontFamily: "Oswald, sans-serif", fontWeight: 600, letterSpacing: "0.08em" }}>
            CANCELAR
          </button>
          <button onClick={onConfirm} style={{ flex: 1, background: "linear-gradient(135deg, #c0392b 0%, #922b21 100%)", border: "none", borderRadius: 4, color: "#fff", cursor: "pointer", padding: "10px", fontSize: 12, fontFamily: "Oswald, sans-serif", fontWeight: 600, letterSpacing: "0.08em" }}>
            SÍ, SALIR
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({
  currentUser,
  onLogout,
  setView,
  view,
  isDark,
  onToggleTheme,
  onOpenProfile,
  onClearNotifications,
}: {
  currentUser: User
  onLogout: () => void
  setView: (v: View) => void
  view: View
  isDark: boolean
  onToggleTheme: () => void
  onOpenProfile: (user: User) => void
  onClearNotifications: () => void
}) {
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const isStaff = currentUser.role !== "user"
  const notifications = currentUser.notifications || []

  return (
    <>
      {showLogoutModal && (
        <LogoutModal onConfirm={() => { setShowLogoutModal(false); onLogout() }} onCancel={() => setShowLogoutModal(false)} />
      )}
      <header
        style={{
          background: "rgba(8, 12, 18, 0.8)",
          backdropFilter: "blur(18px)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 14px 36px rgba(2, 6, 23, 0.22)",
        }}
      >
        <button onClick={() => setView("forum")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
          <Logo size="sm" />
        </button>

        <nav style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            onClick={() => setView("forum")}
            style={{
              ...navBtn,
              color: view === "forum" ? "#f8fafc" : "var(--text-dim)",
              borderBottom: view === "forum" ? "2px solid #fb923c" : "2px solid transparent",
              background: view === "forum" ? "rgba(251, 146, 60, 0.08)" : "transparent",
              padding: "9px 12px",
            }}
          >
            FORO
          </button>

          <button
            onClick={onToggleTheme}
            title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            style={{
              background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(22, 33, 47, 0.8))",
              border: "1px solid var(--border2)",
              borderRadius: 999,
              cursor: "pointer",
              width: 62,
              height: 32,
              position: "relative",
              flexShrink: 0,
              boxShadow: "inset 0 1px 2px rgba(255,255,255,0.04)",
            }}
          >
            <div style={{
              position: "absolute",
              top: 3,
              left: isDark ? 4 : 31,
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: isDark ? "linear-gradient(135deg, #f97316 0%, #f59e0b 100%)" : "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              transition: "left 0.2s ease",
              boxShadow: "0 10px 18px rgba(245,158,11,0.3)",
            }}>
              {isDark ? "🌙" : "☀️"}
            </div>
          </button>

          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowNotifications((v) => !v)}
              style={{
                background: "linear-gradient(135deg, rgba(15,23,42,0.8), rgba(17,24,39,0.7))",
                border: "1px solid var(--border)",
                borderRadius: 12,
                color: "var(--text)",
                cursor: "pointer",
                padding: "8px 12px",
                fontSize: 12,
                fontFamily: "JetBrains Mono, monospace",
                position: "relative",
              }}
            >
              🔔
              {notifications.length > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                  {notifications.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 10px)", width: 300, background: "rgba(12,17,24,0.98)", border: "1px solid var(--border)", borderRadius: 12, padding: 10, boxShadow: "0 18px 42px rgba(2,6,23,0.22)", zIndex: 200 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.1em", color: "var(--text-dim)", textTransform: "uppercase" }}>
                    Notificaciones
                  </span>
                  {notifications.length > 0 && (
                    <button onClick={onClearNotifications} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}>
                      Limpiar
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div style={{ padding: "14px 10px", borderRadius: 8, background: "rgba(15,23,42,0.7)", border: "1px solid var(--border)", color: "var(--text-dim)", fontSize: 12 }}>
                    No tienes notificaciones.
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div key={item.id} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(15,23,42,0.7)", border: "1px solid var(--border)", marginBottom: 6, color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5 }}>
                      {item.text}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <button onClick={() => onOpenProfile(currentUser)} style={{ display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(135deg, rgba(15,23,42,0.8), rgba(17,24,39,0.7))", border: "1px solid var(--border)", borderRadius: 18, padding: "6px 12px 6px 8px", cursor: "pointer", color: "var(--text)" }}>
            <Avatar letter={currentUser.avatar} role={currentUser.role} size={30} imageUrl={currentUser.avatarUrl} />
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>
                {currentUser.username}
              </div>
              <div style={{ fontSize: 9, color: currentUser.role === "admin" ? "#f87171" : currentUser.role === "moderator" ? "#60a5fa" : "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.08em" }}>
                {currentUser.role.toUpperCase()}
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowLogoutModal(true)}
            style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.8), rgba(31,41,55,0.8))", border: "1px solid var(--border2)", borderRadius: 12, color: "var(--text-muted)", cursor: "pointer", padding: "8px 12px", fontSize: 10, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.08em" }}
          >
            SALIR
          </button>
        </nav>
      </header>
    </>
  )
}

// ─── Forum View ───────────────────────────────────────────────────────────────

const CATEGORIES_ORDER: Category[] = ["normativa", "bugs", "reportes", "historias", "facciones"]

function ThreadRow({
  thread,
  users,
  onClick,
}: {
  thread: Thread
  users: User[]
  onClick: () => void
}) {
  const author = users.find((u) => u.id === thread.authorId)
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? "linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.92) 100%)"
          : "linear-gradient(135deg, rgba(15, 23, 42, 0.65) 0%, rgba(11, 16, 23, 0.88) 100%)",
        border: "1px solid var(--border)",
        borderRadius: 18,
        padding: "16px 18px",
        cursor: "pointer",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 14,
        alignItems: "center",
        transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
        boxShadow: hovered ? "0 12px 28px rgba(2, 6, 23, 0.2)" : "0 0 0 rgba(0,0,0,0)",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Avatar letter={author?.avatar || "?"} role={author?.role || "user"} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            {thread.pinned && (
              <span style={{ fontSize: 10, color: "#fbbf24", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.04em" }}>
                📌
              </span>
            )}
            <Badge label={STATUS_LABELS[thread.status]} color={STATUS_COLORS[thread.status]} />
          </div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 500, fontSize: 15, color: "var(--text)", letterSpacing: "0.02em", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {thread.title}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
            <span style={{ color: "var(--text-muted)" }}>{author?.username}</span> · {formatDate(thread.createdAt)}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, background: "rgba(15, 23, 42, 0.4)", borderRadius: 12, padding: "8px 10px", border: "1px solid var(--border2)" }}>
        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 17, fontWeight: 600, color: "var(--text)" }}>
          {thread.replies.length}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.08em" }}>
          RESP.
        </div>
      </div>
    </div>
  )
}

function CategorySection({
  category,
  threads,
  users,
  setView,
  setSelectedThread,
}: {
  category: Category
  threads: Thread[]
  users: User[]
  setView: (v: View) => void
  setSelectedThread: (id: string) => void
}) {
  const color = CATEGORY_COLORS[category]
  const sorted = [...threads].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <div
      style={{
        border: "1px solid #1e2330",
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 24,
      }}
    >
      {/* Category header */}
      <div
        style={{
          background: `linear-gradient(90deg, ${color}18 0%, #111318 100%)`,
          borderBottom: "1px solid #1e2330",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 3,
              alignSelf: "stretch",
              background: color,
              borderRadius: 2,
              minHeight: 36,
            }}
          />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>{CATEGORY_ICONS[category]}</span>
              <span
                style={{
                  fontFamily: "Oswald, sans-serif",
                  fontWeight: 700,
                  fontSize: 17,
                  letterSpacing: "0.1em",
                  color: "var(--text)",
                }}
              >
                {category === "bugs" ? "REPORTES DE BUGS" :
                  category === "reportes" ? "REPORTES DE JUGADORES" :
                    category === "historias" ? "HISTORIAS DE PERSONAJES" :
                      category === "facciones" ? "FACCIONES" :
                        "NORMATIVA"}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
              {CATEGORY_DESCRIPTIONS[category]}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 12,
              color: color,
              background: color + "18",
              border: `1px solid ${color}33`,
              borderRadius: 4,
              padding: "3px 10px",
            }}
          >
            {threads.length} {threads.length === 1 ? "hilo" : "hilos"}
          </div>
        </div>
      </div>

      {/* Thread rows */}
      {sorted.length === 0 ? (
        <div style={{ background: "var(--bg)", padding: "24px 20px", textAlign: "center", color: "var(--border3)", fontSize: 13 }}>
          Sin hilos aún. ¡Sé el primero en publicar.
        </div>
      ) : (
        <div style={{ background: "var(--bg)" }}>
          {sorted.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              users={users}
              onClick={() => { setSelectedThread(thread.id); setView("thread") }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryView({
  category,
  threads,
  users,
  setView,
  setSelectedThread,
  onSound,
  onSelectCategory,
}: {
  category: Category
  threads: Thread[]
  users: User[]
  setView: (v: View) => void
  setSelectedThread: (id: string) => void
  onSound: (type: "click" | "select" | "success") => void
  onSelectCategory: (category: Category) => void
}) {
  const [reportSubTab, setReportSubTab] = useState<"abierto" | "en_revision" | "cerrado">("abierto")
  const color = CATEGORY_COLORS[category]

  const sortThreads = (list: Thread[]) =>
    [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  const tabThreads = sortThreads(threads.filter((t) => t.category === category))
  const visibleThreads = category === "reportes"
    ? tabThreads.filter((thread) => thread.status === reportSubTab)
    : tabThreads

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "18px 14px 40px" }}>
      {category === "reportes" && (
        <div style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(230,126,34,0.35)", borderRadius: 16, padding: "14px 16px", marginBottom: 16, color: "var(--text-muted)", lineHeight: 1.7 }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6, color: "#f59e0b" }}>
            Guía del staff
          </div>
          <div style={{ fontSize: 13 }}>
            Para abrir un reporte, menciona al menos a un usuario implicado, explica la situación con hechos concretos y añade evidencias si existen.
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setView("forum")
            onSound("click")
          }}
          style={{
            background: "rgba(15, 23, 32, 0.7)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            color: "var(--text)",
            cursor: "pointer",
            padding: "8px 12px",
            fontSize: 11,
            fontFamily: "Oswald, sans-serif",
            letterSpacing: "0.08em",
          }}
        >
          ← VOLVER
        </button>
      </div>

      <main style={{ width: "100%", background: "linear-gradient(180deg, rgba(13, 20, 30, 0.96), rgba(11, 17, 25, 0.9))", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden", boxShadow: "0 20px 40px rgba(2, 6, 23, 0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", background: "linear-gradient(90deg, rgba(17,24,39,0.9) 0%, rgba(15,23,32,0.7) 100%)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
            <div style={{ width: 5, height: 18, background: color, borderRadius: 999, boxShadow: `0 0 18px ${color}` }} />
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 18, letterSpacing: "0.08em", color: "var(--text)" }}>
              {category === "bugs" ? "BUGS" : category === "reportes" ? "REPORTES" : category === "historias" ? "HISTORIAS" : category === "facciones" ? "FACCIONES" : "NORMATIVA"}
            </div>
          </div>
        </div>

        {category === "reportes" && (
          <div style={{ borderBottom: "1px solid var(--border)", background: "rgba(15,23,42,0.6)", display: "flex", gap: 8, padding: "10px 14px" }}>
            {([
              { key: "abierto", label: "Abiertos", color: "#27ae60" },
              { key: "en_revision", label: "En revisión", color: "#f39c12" },
              { key: "cerrado", label: "Cerrados", color: "#7f8c8d" },
            ] as const).map((sub) => (
              <button
                key={sub.key}
                onClick={() => {
                  setReportSubTab(sub.key)
                  onSound("select")
                }}
                style={{
                  background: reportSubTab === sub.key ? sub.color + "22" : "transparent",
                  border: `1px solid ${reportSubTab === sub.key ? sub.color : "var(--border)"}`,
                  borderRadius: 8,
                  color: reportSubTab === sub.key ? sub.color : "var(--text-dim)",
                  cursor: "pointer",
                  padding: "6px 10px",
                  fontSize: 10,
                  fontFamily: "JetBrains Mono, monospace",
                  letterSpacing: "0.08em",
                }}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column" }}>
          {visibleThreads.length === 0 ? (
            <div style={{ padding: "28px 20px", textAlign: "center", color: "var(--text-dim)" }}>
              {category === "reportes"
                ? "No hay reportes en este estado."
                : "No hay hilos en esta categoría todavía."}
            </div>
          ) : (
            visibleThreads.map((thread) => {
              const author = users.find((u) => u.id === thread.authorId)
              const lastReply = thread.replies[thread.replies.length - 1]
              const lastAuthor = lastReply ? users.find((u) => u.id === lastReply.authorId) : author

              return (
                <div
                  key={thread.id}
                  onClick={() => { setSelectedThread(thread.id); setView("thread") }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 3.8fr) 0.6fr 0.7fr 1.1fr",
                    gap: 16,
                    padding: "14px 18px",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    background: thread.pinned ? "rgba(245,158,11,0.04)" : "transparent",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
                    <div style={{ width: 10, height: 10, background: color, borderRadius: 999, marginTop: 6, boxShadow: `0 0 18px ${color}` }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {thread.pinned && <span style={{ color: "#fbbf24", fontSize: 10 }}>📌</span>}
                        <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 15, color: "var(--text)", letterSpacing: "0.02em" }}>{thread.title}</span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-dim)" }}>
                        por <span style={{ color: "var(--text-muted)" }}>{author?.username}</span> · {formatDate(thread.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 15, color: "var(--text)", textAlign: "center" }}>{thread.replies.length}</div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 15, color: "var(--text)", textAlign: "center" }}>{category === "reportes" ? (thread.status === "cerrado" ? "0" : "1") : thread.status}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                    <Avatar letter={lastAuthor?.avatar || author?.avatar || "?"} role={lastAuthor?.role || author?.role || "user"} size={24} />
                    <div style={{ textAlign: "right", minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lastAuthor?.username || author?.username || "Usuario"}</div>
                      <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace" }}>{lastReply ? formatDate(lastReply.createdAt) : formatDate(thread.createdAt)}</div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}

function ForumView({
  threads,
  users,
  currentUser,
  setView,
  setSelectedThread,
  onSound,
  selectedCategory,
  onOpenCategory,
  onSelectCategory,
}: {
  threads: Thread[]
  users: User[]
  currentUser: User
  setView: (v: View) => void
  setSelectedThread: (id: string) => void
  onSound: (type: "click" | "select" | "success") => void
  selectedCategory: Category
  onOpenCategory: (category: Category) => void
  onSelectCategory: (category: Category) => void
}) {
  const color = CATEGORY_COLORS[selectedCategory]

  const sortThreads = (list: Thread[]) =>
    [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  const tabThreads = sortThreads(threads.filter((t) => t.category === selectedCategory))

  return (
    <div className="forum-shell" style={{ maxWidth: 1360, margin: "0 auto", padding: "18px 14px 40px" }}>
      <div className="forum-layout" style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", gap: 18 }}>
        <aside
          className="forum-sidebar"
          style={{
            background: "rgba(15,23,42,0.75)",
            border: "1px solid var(--border)",
            borderRadius: 18,
            overflow: "hidden",
            height: "fit-content",
            position: "sticky",
            top: 86,
          }}
        >
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", fontSize: 10, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Categorías
          </div>
          <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {CATEGORIES_ORDER.map((cat) => {
              const isActive = cat === selectedCategory
              const c = CATEGORY_COLORS[cat]
              const count = threads.filter((t) => t.category === cat).length

              return (
                <button
                  key={cat}
                  className="forum-category-button"
                  onClick={() => {
                    onSelectCategory(cat)
                    onSound("select")
                  }}
                  style={{
                    background: isActive ? `linear-gradient(135deg, ${c}22, rgba(15, 23, 32, 0.9))` : "rgba(15, 23, 32, 0.35)",
                    border: `1px solid ${isActive ? c : "var(--border)"}`,
                    borderRadius: 12,
                    padding: "12px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    cursor: "pointer",
                    color: isActive ? "var(--text)" : "var(--text-muted)",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 16 }}>{CATEGORY_ICONS[cat]}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 13, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                        {cat === "bugs" ? "BUGS" : cat === "reportes" ? "REPORTES" : cat === "historias" ? "HISTORIAS" : cat === "facciones" ? "FACCIONES" : "NORMATIVA"}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      minWidth: 26,
                      padding: "4px 7px",
                      borderRadius: 999,
                      textAlign: "center",
                      fontSize: 10,
                      fontFamily: "JetBrains Mono, monospace",
                      background: isActive ? c + "26" : "rgba(148,163,184,0.08)",
                      color: c,
                    }}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <main className="forum-main" style={{ width: "100%", background: "linear-gradient(180deg, rgba(13, 20, 30, 0.96), rgba(11, 17, 25, 0.9))", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden", boxShadow: "0 20px 40px rgba(2, 6, 23, 0.18)" }}>
          <div className="forum-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px 18px", background: "linear-gradient(90deg, rgba(17,24,39,0.9) 0%, rgba(15,23,32,0.7) 100%)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
              <div style={{ width: 5, height: 18, background: color, borderRadius: 999, boxShadow: `0 0 18px ${color}` }} />
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 18, letterSpacing: "0.08em", color: "var(--text)" }}>
                {selectedCategory === "bugs" ? "BUGS" : selectedCategory === "reportes" ? "REPORTES" : selectedCategory === "historias" ? "HISTORIAS" : selectedCategory === "facciones" ? "FACCIONES" : "NORMATIVA"}
              </div>
            </div>
          </div>

          <div className="forum-intro" style={{ padding: "26px 20px", color: "var(--text-muted)", lineHeight: 1.7 }}>
            <div style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.08em", marginBottom: 10, textTransform: "uppercase" }}>
              {CATEGORY_LABELS[selectedCategory]}
            </div>
            <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: 28, margin: "0 0 10px", color: "var(--text)", letterSpacing: "0.06em" }}>
              {selectedCategory === "bugs" ? "Reporte de fallos" : selectedCategory === "reportes" ? "Reportes del servidor" : selectedCategory === "historias" ? "Historias de supervivientes" : selectedCategory === "facciones" ? "Facciones y clanes" : "Normativa del servidor"}
            </h2>
            <p style={{ margin: 0, maxWidth: 660, color: "var(--text-muted)" }}>
              {CATEGORY_DESCRIPTIONS[selectedCategory]}
            </p>

            <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className="forum-action forum-action-primary"
                onClick={() => {
                  onOpenCategory(selectedCategory)
                  onSound("success")
                }}
                style={{
                  background: "linear-gradient(135deg, rgba(239,68,68,0.18), rgba(153,27,27,0.12))",
                  border: "1px solid rgba(239,68,68,0.35)",
                  borderRadius: 10,
                  color: "#fca5a5",
                  cursor: "pointer",
                  padding: "10px 14px",
                  fontSize: 11,
                  fontFamily: "Oswald, sans-serif",
                  letterSpacing: "0.08em",
                }}
              >
                ABRIR CATEGORÍA
              </button>

              {(selectedCategory !== "normativa" || currentUser.role === "admin") && (
                <button
                  className="forum-action forum-action-secondary"
                  onClick={() => {
                    onSelectCategory(selectedCategory)
                    setView("new_thread")
                    onSound("success")
                  }}
                  style={{
                    background: "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(120,53,15,0.14))",
                    border: "1px solid rgba(249,115,22,0.35)",
                    borderRadius: 10,
                    color: "#fdba74",
                    cursor: "pointer",
                    padding: "10px 14px",
                    fontSize: 11,
                    fontFamily: "Oswald, sans-serif",
                    letterSpacing: "0.08em",
                  }}
                >
                  {CATEGORY_THREAD_ACTIONS[selectedCategory]}
                </button>
              )}
            </div>

            <div style={{ marginTop: 22, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(15,23,42,0.45)", color: "var(--text-dim)", fontSize: 13 }}>
              {selectedCategory === "reportes"
                ? "Puedes señalar al usuario implicado y dejar evidencia del caso."
                : selectedCategory === "bugs"
                ? "Describe el fallo, pasos para reproducirlo y cualquier captura o video útil."
                : selectedCategory === "historias"
                ? "Comparte la historia de tu personaje, su evolución y momentos clave."
                : selectedCategory === "facciones"
                ? "Presenta una idea de facción, clán o estructura de rol para la comunidad."
                : "Consulta y debate las normas del servidor."}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Profile View ─────────────────────────────────────────────────────────────

function ProfileView({
  currentUser,
  users,
  selectedUserId,
  onSaveProfile,
  onRedeemRolePoints,
  onBack,
  onSelectUser,
}: {
  currentUser: User
  users: User[]
  selectedUserId: string
  onSaveProfile: (userId: string, updates: Partial<User>) => void
  onRedeemRolePoints: (userId: string) => void
  onBack: () => void
  onSelectUser: (userId: string) => void
}) {
  const selectedUser = users.find((u) => u.id === selectedUserId) || currentUser
  const isOwnProfile = currentUser.id === selectedUser.id
  const [search, setSearch] = useState("")
  const [bio, setBio] = useState(selectedUser.bio || "")
  const [bannerColor, setBannerColor] = useState(selectedUser.bannerColor || "#ef4444")
  const [bannerUrl, setBannerUrl] = useState<string>("")
  const [avatarUrl, setAvatarUrl] = useState(selectedUser.avatarUrl || "")

  useEffect(() => {
    setBio(selectedUser.bio || "")
    setBannerColor(selectedUser.bannerColor || DEFAULT_BANNER_URL)
    setBannerUrl("")
    setAvatarUrl(selectedUser.avatarUrl || "")
  }, [selectedUserId, selectedUser.bio, selectedUser.bannerColor, selectedUser.avatarUrl])

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(search.toLowerCase())
  )

  const profileUser = {
    ...selectedUser,
    avatarUrl,
    bio,
    bannerColor,
  }
  const rolePoints = selectedUser.rolePoints || 0
  const redeemedRolePoints = selectedUser.redeemedRolePoints || 0
  const availableRolePoints = Math.max(0, rolePoints - redeemedRolePoints)
  const canSeeRolePointDetails = isOwnProfile || currentUser.role === "admin"

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const imageData = String(ev.target?.result || "")
      setAvatarUrl(imageData)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const imageData = String(ev.target?.result || "")
      setBannerUrl(imageData)
      setBannerColor("#111827")
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }


  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "30px 20px 40px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
        ← Volver al foro
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: 18 }}>
        <aside style={{ background: "rgba(15,23,42,0.7)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", fontSize: 10, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Usuarios
          </div>
          <div style={{ padding: 12 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar usuario..."
              style={{ ...inputStyle, borderRadius: 10, marginBottom: 10 }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    onSelectUser(user.id)
                  }}
                  style={{
                    background: selectedUser.id === user.id ? "rgba(239,68,68,0.08)" : "rgba(15,23,42,0.35)",
                    border: `1px solid ${selectedUser.id === user.id ? "#ef4444" : "var(--border)"}`,
                    borderRadius: 12,
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    color: "var(--text)",
                    textAlign: "left",
                  }}
                >
                  <Avatar letter={user.avatar} role={user.role} size={28} imageUrl={user.avatarUrl} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{user.username}</div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace" }}>{user.role.toUpperCase()}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section style={{ background: "rgba(15,23,42,0.7)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden" }}>
          <div
            style={{
              height: 120,
              background: bannerUrl
                ? `url(${bannerUrl}) center/cover no-repeat`
                : bannerColor.startsWith("url(")
                  ? `${bannerColor} center/cover no-repeat`
                  : bannerColor || "linear-gradient(135deg, #ef4444, #0ea5e9)",
              position: "relative",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ position: "absolute", left: 24, bottom: -28, display: "flex", alignItems: "center", gap: 16 }}>
              <Avatar letter={profileUser.avatar} role={profileUser.role} size={72} imageUrl={profileUser.avatarUrl} />
              <div>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 26, letterSpacing: "0.06em", color: "#fff" }}>{profileUser.username}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.08em" }}>{profileUser.role.toUpperCase()}</div>
              </div>
            </div>
          </div>

          <div style={{ padding: "42px 22px 22px" }}>
            <div style={{ marginBottom: 22, padding: "16px", borderRadius: 14, border: "1px solid rgba(245,158,11,0.3)", background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(15,23,42,0.45))" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.1em", color: "#fbbf24", textTransform: "uppercase" }}>
                    Puntos de rol
                  </div>
                  <div style={{ marginTop: 4, fontFamily: "Oswald, sans-serif", fontSize: 28, color: "var(--text)" }}>
                    {rolePoints} puntos
                  </div>
                  {canSeeRolePointDetails && (
                    <div style={{ marginTop: 2, fontSize: 11, color: "var(--text-dim)" }}>
                      Disponibles para canjear: {availableRolePoints}
                    </div>
                  )}
                </div>
                {isOwnProfile && (
                  <button
                    onClick={() => onRedeemRolePoints(selectedUser.id)}
                    disabled={availableRolePoints < ROLE_REDEEM_COST}
                    style={{ ...primaryBtn, width: "auto", background: availableRolePoints >= ROLE_REDEEM_COST ? "linear-gradient(135deg, #f59e0b, #b45309)" : "var(--surface2)", color: availableRolePoints >= ROLE_REDEEM_COST ? "#fff" : "var(--text-dim)", boxShadow: "none", cursor: availableRolePoints >= ROLE_REDEEM_COST ? "pointer" : "not-allowed", opacity: availableRolePoints >= ROLE_REDEEM_COST ? 1 : 0.7 }}
                  >
                    CANJEAR PUNTOS DE ROL ({ROLE_REDEEM_COST})
                  </button>
                )}
              </div>
              {canSeeRolePointDetails && redeemedRolePoints > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(245,158,11,0.2)", fontSize: 11, color: "var(--text-dim)" }}>
                  Puntos canjeados: {redeemedRolePoints}
                </div>
              )}
            </div>
            {isOwnProfile ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                  <div>
                    <label style={labelStyle}>Logo / avatar</label>
                    <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px dashed var(--border)", borderRadius: 12, padding: "18px 12px", background: "rgba(15,23,42,0.5)", cursor: "pointer", color: "var(--text-muted)" }}>
                      <span>📷</span>
                      <span>Subir imagen</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                    </label>
                  </div>

                  <div>
                    <label style={labelStyle}>Color de banner</label>
                    <input
                      type="color"
                      value={bannerColor}
                      onChange={(e) => {
                        setBannerColor(e.target.value)
                      }}
                      style={{ width: "100%", height: 48, borderRadius: 10, border: "1px solid var(--border)", background: "transparent", cursor: "pointer" }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 18 }}>
                  <label style={labelStyle}>Banner personalizado</label>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px dashed var(--border)", borderRadius: 12, padding: "18px 12px", background: "rgba(15,23,42,0.5)", cursor: "pointer", color: "var(--text-muted)" }}>
                    <span>🖼️</span>
                    <span>Subir imagen de banner</span>
                    <input type="file" accept="image/*" onChange={handleBannerUpload} style={{ display: "none" }} />
                  </label>
                </div>

                <div style={{ marginTop: 18 }}>
                  <label style={labelStyle}>Banner global</label>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    Todos los perfiles nuevos empiezan con el banner predeterminado del servidor.
                  </div>
                </div>

                <div style={{ marginTop: 18 }}>
                  <label style={labelStyle}>Descripción</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Cuéntanos quién eres dentro del servidor..."
                    style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
                  />
                </div>

                <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() =>
                      onSaveProfile(currentUser.id, {
                        avatarUrl,
                        bio,
                        bannerColor: bannerUrl || bannerColor,
                      })
                    }
                    style={{ ...primaryBtn, width: "auto", padding: "12px 22px" }}
                  >
                    GUARDAR PERFIL
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.08em", marginBottom: 10, textTransform: "uppercase" }}>
                  Bio
                </div>
                <div style={{ color: "var(--text-muted)", lineHeight: 1.8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {selectedUser.bio || "Este superviviente aún no ha escrito una descripción."}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

// ─── New Thread View ──────────────────────────────────────────────────────────

function NewThreadView({
  currentUser,
  users,
  onSubmit,
  goBack,
  initialCategory,
}: {
  currentUser: User
  users: User[]
  onSubmit: (t: Thread, mentionedUserIds?: string[]) => Promise<void> | void
  goBack: () => void
  initialCategory?: Category
}) {
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState<Category>(initialCategory || "reportes")
  const [content, setContent] = useState("")
  const isReportMode = initialCategory === "reportes" || category === "reportes"
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])

  const mentionList = users.filter((user) =>
    user.id !== currentUser.id &&
    user.username.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  function toggleMention(userId: string) {
    setMentionedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => {
      const type = file.type.startsWith("video/") ? "video" : "image"
      const reader = new FileReader()
      reader.onload = (ev) => {
        setAttachments((prev) => [
          ...prev,
          { name: file.name, type, dataUrl: ev.target?.result as string },
        ])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ""
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    if (title.trim().length < 5) { setError("El título debe tener al menos 5 caracteres."); return }
    if (content.trim().length < 20 && attachments.length === 0) { setError("Añade una descripción o adjunta al menos un archivo."); return }
    if (category === "reportes" && mentionedUserIds.length === 0) {
      setError("Debes mencionar al menos a un usuario para crear este reporte.")
      return
    }

    const mentionText = mentionedUserIds
      .map((id) => {
        const user = users.find((u) => u.id === id)
        return user ? `@${user.username}` : ""
      })
      .filter(Boolean)
      .join(" ")

    const finalContent = [content.trim(), mentionText].filter(Boolean).join("\n\n")

    const t: Thread = {
      id: uid(),
      title: title.trim(),
      category,
      authorId: currentUser.id,
      content: finalContent,
      status: "abierto",
      createdAt: new Date().toISOString(),
      replies: [],
      attachments,
    }
    setIsSubmitting(true)
    setError("")
    try {
      await onSubmit(t, mentionedUserIds)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo publicar el hilo.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}>
      <button onClick={goBack} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, marginBottom: 24, display: "flex", alignItems: "center", gap: 6 }}>
        ← Volver al foro
      </button>

      <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: 24, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text)", marginBottom: 24 }}>
        {initialCategory ? CATEGORY_THREAD_ACTIONS[initialCategory] : "NUEVO REPORTE"}
      </h2>

      {error && (
        <div style={{ background: "#c0392b18", border: "1px solid #c0392b55", borderRadius: 4, padding: "10px 14px", color: "#e74c3c", fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: "var(--surface)", border: "1px solid #252830", borderRadius: 8, padding: "28px 28px" }}>
        {!initialCategory && !isReportMode && (
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Categoría</label>
            <div style={{ display: "flex", gap: 8 }}>
              {CATEGORIES_ORDER.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  style={{
                    flex: 1,
                    background: category === cat ? CATEGORY_COLORS[cat] + "22" : "transparent",
                    border: `1px solid ${category === cat ? CATEGORY_COLORS[cat] : "var(--border2)"}`,
                    borderRadius: 4,
                    color: category === cat ? CATEGORY_COLORS[cat] : "var(--text-muted)",
                    cursor: "pointer",
                    padding: "8px 4px",
                    fontSize: 11,
                    fontFamily: "JetBrains Mono, monospace",
                    letterSpacing: "0.04em",
                    transition: "all 0.15s",
                  }}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Título</label>
          <input
            style={inputStyle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Describe brevemente el problema o sugerencia"
          />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Descripción</label>
          <textarea
            style={{ ...inputStyle, height: 160, resize: "vertical" } as React.CSSProperties}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Explica con el mayor detalle posible. Para bugs: pasos para reproducirlo, coordenadas, hora del incidente. Para reportes: evidencia, nombre exacto del jugador."
          />
        </div>

        {category === "reportes" && (
          <div style={{ marginBottom: 18, padding: "14px 14px 12px", background: "rgba(15,23,42,0.48)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Mencionar usuarios</label>
              <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.08em" }}>
                {mentionedUserIds.length}/1 mínimo
              </span>
            </div>

            <input
              value={mentionQuery}
              onChange={(e) => setMentionQuery(e.target.value)}
              placeholder="Buscar personaje o usuario..."
              style={{ ...inputStyle, marginBottom: 10 }}
            />

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minHeight: 38 }}>
              {mentionList.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>No hay coincidencias.</span>
              ) : (
                mentionList.slice(0, 8).map((user) => {
                  const selected = mentionedUserIds.includes(user.id)
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleMention(user.id)}
                      style={{
                        background: selected ? "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(14,165,233,0.08))" : "rgba(15,23,42,0.45)",
                        border: `1px solid ${selected ? "#38bdf8" : "var(--border)"}`,
                        borderRadius: 999,
                        color: selected ? "#e0f2fe" : "var(--text-muted)",
                        padding: "7px 12px",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        boxShadow: selected ? "0 0 0 1px rgba(56,189,248,0.2)" : "none",
                      }}
                    >
                      @{user.username}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Attachments */}
        <div style={{ marginBottom: 28 }}>
          <label style={labelStyle}>Archivos adjuntos</label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              border: "1px dashed #252830",
              borderRadius: 6,
              padding: "18px 20px",
              cursor: "pointer",
              color: "var(--text-dim)",
              fontSize: 13,
              background: "var(--surface2)",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border3)"; e.currentTarget.style.color = "var(--text-muted)" }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text-dim)" }}
          >
            <span style={{ fontSize: 22 }}>📎</span>
            <span>Haz clic para adjuntar imágenes o videos — múltiples archivos permitidos</span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </label>

          {attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  style={{ position: "relative", borderRadius: 4, overflow: "hidden", border: "1px solid #252830", background: "var(--bg)" }}
                >
                  {att.type === "image" ? (
                    <img src={att.dataUrl} alt={att.name} style={{ display: "block", width: 90, height: 70, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 110, height: 70, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <span style={{ fontSize: 22 }}>🎬</span>
                      <span style={{ fontSize: 9, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 4px" }}>{att.name}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    style={{ position: "absolute", top: 3, right: 3, background: "#c0392b", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" disabled={isSubmitting} style={{ ...primaryBtn, opacity: isSubmitting ? 0.65 : 1, cursor: isSubmitting ? "wait" : "pointer" }}>
            {isSubmitting ? "PUBLICANDO..." : isReportMode ? "PUBLICAR REPORTE" : "PUBLICAR HILO"}
          </button>
          <button type="button" onClick={goBack} style={{ ...primaryBtn, background: "transparent", border: "1px solid #252830", color: "var(--text-muted)" }}>
            CANCELAR
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Thread View ──────────────────────────────────────────────────────────────

function ThreadView({
  threadId,
  threads,
  users,
  currentUser,
  onReply,
  onEditThread,
  onAddRolePoints,
  onStatusChange,
  onPinToggle,
  onDeleteThread,
  goBack,
}: {
  threadId: string
  threads: Thread[]
  users: User[]
  currentUser: User
  onReply: (threadId: string, content: string, attachments: Attachment[], mentionedUserIds?: string[]) => void
  onEditThread: (threadId: string, title: string, content: string) => void
  onAddRolePoints: (userId: string, amount: number) => void
  onStatusChange: (threadId: string, status: ThreadStatus) => void
  onPinToggle: (threadId: string) => void
  onDeleteThread: (threadId: string) => void
  goBack: () => void
}) {
  const thread = threads.find((t) => t.id === threadId)
  const [replyContent, setReplyContent] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [error, setError] = useState("")
  const [lightbox, setLightbox] = useState<Attachment | null>(null)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editError, setEditError] = useState("")
  const [pointsToAdd, setPointsToAdd] = useState("")

  if (!thread) return null

  const author = users.find((u) => u.id === thread.authorId)
  const isStaff = currentUser.role !== "user"
  const canEditThread = thread.category === "historias" && currentUser.id === thread.authorId
  const canAddThreadRolePoints = thread.category === "historias" && currentUser.role === "admin"
  const canReply = !thread.adminOnly && (thread.status === "abierto" || thread.status === "en_revision" || isStaff)

  function startEditing() {
    setEditTitle(thread.title)
    setEditContent(thread.content)
    setEditError("")
    setIsEditing(true)
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editTitle.trim().length < 5) {
      setEditError("El título debe tener al menos 5 caracteres.")
      return
    }
    if (editContent.trim().length < 20 && (!thread.attachments || thread.attachments.length === 0)) {
      setEditError("La publicación debe tener al menos 20 caracteres o un archivo adjunto.")
      return
    }

    onEditThread(thread.id, editTitle.trim(), editContent.trim())
    setIsEditing(false)
    setEditError("")
  }

  function handleAddThreadRolePoints() {
    const amount = Number(pointsToAdd)
    if (!Number.isInteger(amount) || amount < 1 || !author) return
    onAddRolePoints(author.id, amount)
    setPointsToAdd("")
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => {
      const type = file.type.startsWith("video/") ? "video" : "image"
      const reader = new FileReader()
      reader.onload = (ev) => {
        setAttachments((prev) => [
          ...prev,
          { name: file.name, type, dataUrl: ev.target?.result as string },
        ])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ""
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
  }

  function toggleMention(userId: string) {
    setMentionedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (replyContent.trim().length < 5 && attachments.length === 0) {
      setError("Escribe al menos un mensaje o adjunta un archivo.")
      return
    }
    if (thread.category === "reportes" && mentionedUserIds.length === 0) {
      setError("Debes mencionar al menos a un usuario antes de responder este reporte.")
      return
    }

    const mentionText = mentionedUserIds
      .map((id) => {
        const user = users.find((u) => u.id === id)
        return user ? `@${user.username}` : ""
      })
      .filter(Boolean)
      .join(" ")

    const finalContent = [replyContent.trim(), mentionText].filter(Boolean).join("\n\n")
    onReply(thread!.id, finalContent, attachments, mentionedUserIds)
    setReplyContent("")
    setAttachments([])
    setMentionedUserIds([])
    setMentionQuery("")
    setError("")
  }

  const statuses: ThreadStatus[] = ["abierto", "en_revision", "cerrado"]
  const mentionList = users.filter((user) =>
    user.id !== currentUser.id &&
    user.username.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  return (
    <>
    {lightbox && (
      <div
        onClick={() => setLightbox(null)}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}
      >
        <img src={lightbox.dataUrl} alt={lightbox.name} style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 6, boxShadow: "0 0 60px rgba(0,0,0,0.8)" }} />
        <button
          onClick={() => setLightbox(null)}
          style={{ position: "fixed", top: 20, right: 24, background: "#c0392b", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          ✕
        </button>
      </div>
    )}
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 20px" }}>
      <button onClick={goBack} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
        ← Volver al foro
      </button>

      {/* Thread header */}
      <div style={{ background: "var(--surface)", border: "1px solid #1e2330", borderLeft: `4px solid ${CATEGORY_COLORS[thread.category]}`, borderRadius: 8, padding: "24px 24px 20px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <Badge label={CATEGORY_LABELS[thread.category]} color={CATEGORY_COLORS[thread.category]} />
              <Badge label={STATUS_LABELS[thread.status]} color={STATUS_COLORS[thread.status]} />
            </div>
            {isEditing ? (
              <form onSubmit={handleEditSubmit} style={{ marginBottom: 12 }}>
                {editError && (
                  <div style={{ background: "#c0392b18", border: "1px solid #c0392b55", borderRadius: 4, padding: "8px 12px", color: "#e74c3c", fontSize: 13, marginBottom: 10 }}>
                    {editError}
                  </div>
                )}
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 10, fontFamily: "Oswald, sans-serif", fontSize: 20 }}
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  style={{ ...inputStyle, minHeight: 180, resize: "vertical" } as React.CSSProperties}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button type="submit" style={{ ...primaryBtn, width: "auto", padding: "8px 12px", fontSize: 11 }}>
                    GUARDAR CAMBIOS
                  </button>
                  <button type="button" onClick={() => setIsEditing(false)} style={{ ...primaryBtn, width: "auto", padding: "8px 12px", fontSize: 11, background: "transparent", border: "1px solid var(--border2)", color: "var(--text-muted)", boxShadow: "none" }}>
                    CANCELAR
                  </button>
                </div>
              </form>
            ) : (
              <h1 style={{ fontFamily: "Oswald, sans-serif", fontSize: 22, fontWeight: 600, letterSpacing: "0.04em", color: "var(--text)", margin: "0 0 12px" }}>
                {thread.title}
              </h1>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar letter={author?.avatar || "?"} role={author?.role || "user"} size={28} />
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                <strong style={{ color: "var(--text)" }}>{author?.username}</strong> · {formatDate(thread.createdAt)}
              </div>
            </div>
          </div>

          {isStaff && (
            <div style={{ minWidth: 180, background: "rgba(15,23,42,0.7)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 12px 10px" }}>
              <div style={{ fontSize: 9, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.12em", marginBottom: 8, textTransform: "uppercase" }}>
                Moderación
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {statuses.map((s) => (
                  <button
                    key={s}
                    onClick={() => onStatusChange(thread.id, s)}
                    style={{
                      background: thread.status === s ? STATUS_COLORS[s] + "22" : "transparent",
                      border: `1px solid ${thread.status === s ? STATUS_COLORS[s] : "var(--border2)"}`,
                      borderRadius: 8,
                      color: thread.status === s ? STATUS_COLORS[s] : "var(--text-dim)",
                      cursor: "pointer",
                      padding: "6px 10px",
                      fontSize: 10,
                      fontFamily: "JetBrains Mono, monospace",
                      letterSpacing: "0.05em",
                      textAlign: "left",
                    }}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
                <button
                  onClick={() => onPinToggle(thread.id)}
                  style={{
                    background: thread.pinned ? "rgba(245,158,11,0.12)" : "transparent",
                    border: `1px solid ${thread.pinned ? "#f59e0b" : "var(--border2)"}`,
                    borderRadius: 8,
                    color: thread.pinned ? "#fbbf24" : "var(--text-dim)",
                    cursor: "pointer",
                    padding: "6px 10px",
                    fontSize: 10,
                    fontFamily: "JetBrains Mono, monospace",
                    letterSpacing: "0.05em",
                    textAlign: "left",
                  }}
                >
                  {thread.pinned ? "DESTACAR: SÍ" : "DESTACAR: NO"}
                </button>
                {currentUser.role === "admin" && (
                  <button
                    onClick={() => onDeleteThread(thread.id)}
                    style={{
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.4)",
                      borderRadius: 8,
                      color: "#fca5a5",
                      cursor: "pointer",
                      padding: "6px 10px",
                      fontSize: 10,
                      fontFamily: "JetBrains Mono, monospace",
                      letterSpacing: "0.05em",
                      textAlign: "left",
                    }}
                  >
                    ELIMINAR HILO
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {(canEditThread || canAddThreadRolePoints) && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {canEditThread && !isEditing && (
              <button onClick={startEditing} style={{ ...primaryBtn, width: "auto", padding: "8px 12px", fontSize: 11 }}>
                EDITAR PUBLICACIÓN
              </button>
            )}
            {canAddThreadRolePoints && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "#fbbf24", fontFamily: "JetBrains Mono, monospace" }}>PUNTOS PARA {author?.username}</span>
                <input
                  type="number"
                  min="1"
                  value={pointsToAdd}
                  onChange={(e) => setPointsToAdd(e.target.value)}
                  placeholder="Cantidad"
                  style={{ ...inputStyle, width: 100, padding: "8px 9px", fontSize: 11 }}
                />
                <button onClick={handleAddThreadRolePoints} disabled={!pointsToAdd} style={{ ...primaryBtn, width: "auto", padding: "8px 12px", fontSize: 11, background: "linear-gradient(135deg, #f59e0b, #b45309)", opacity: pointsToAdd ? 1 : 0.5, cursor: pointsToAdd ? "pointer" : "not-allowed" }}>
                  AÑADIR PUNTOS
                </button>
              </div>
            )}
          </div>
        )}

        <div
          style={{
            marginTop: 20,
            paddingTop: 20,
            borderTop: "1px solid #1e2330",
            color: "var(--text-muted)",
            lineHeight: 1.7,
            fontSize: 14,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {isEditing ? "Revisa el contenido en el formulario superior antes de guardar." : thread.content}
        </div>

        {thread.attachments && thread.attachments.length > 0 && (
          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            {thread.attachments.map((att, idx) =>
              att.type === "image" ? (
                <div
                  key={idx}
                  onClick={() => setLightbox(att)}
                  style={{
                    cursor: "zoom-in",
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    background: "rgba(15,23,42,0.45)",
                    boxShadow: "0 16px 32px rgba(2, 6, 23, 0.18)",
                  }}
                >
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    style={{
                      display: "block",
                      width: "100%",
                      maxHeight: 420,
                      objectFit: "cover",
                    }}
                  />
                </div>
              ) : (
                <div
                  key={idx}
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    background: "rgba(15,23,42,0.45)",
                  }}
                >
                  <video src={att.dataUrl} controls style={{ display: "block", width: "100%", maxHeight: 360 }} />
                  <div style={{ padding: "7px 10px", fontSize: 10, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", background: "rgba(15,23,42,0.6)" }}>
                    {att.name}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Replies */}
      {thread.replies.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.08em", marginBottom: 10 }}>
            {thread.replies.length} RESPUESTA{thread.replies.length !== 1 ? "S" : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {thread.replies.map((reply) => {
              const replyAuthor = users.find((u) => u.id === reply.authorId)
              return (
                <div
                  key={reply.id}
                  style={{
                    background: reply.isStaff ? "var(--surface2)" : "var(--row-bg)",
                    border: `1px solid ${reply.isStaff ? "#1a3a5c" : "var(--border)"}`,
                    borderLeft: `3px solid ${reply.isStaff ? "#2980b9" : "var(--border2)"}`,
                    borderRadius: 6,
                    padding: "16px 18px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <Avatar letter={replyAuthor?.avatar || "?"} role={replyAuthor?.role || "user"} size={26} />
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      <strong style={{ color: reply.isStaff ? "#3498db" : "var(--text)" }}>
                        {replyAuthor?.username}
                      </strong>
                      {reply.isStaff && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: "#3498db", fontFamily: "JetBrains Mono, monospace" }}>
                          [STAFF]
                        </span>
                      )}
                      {" "}· {formatDate(reply.createdAt)}
                    </div>
                  </div>
                  {reply.content && (
                    <div style={{ color: "var(--text-muted)", lineHeight: 1.7, fontSize: 14, whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                      {reply.content}
                    </div>
                  )}
                  {reply.attachments && reply.attachments.length > 0 && (
                    <div style={{ marginTop: reply.content ? 12 : 0, display: "grid", gap: 8 }}>
                      {reply.attachments.map((att, idx) =>
                        att.type === "image" ? (
                          <div
                            key={idx}
                            onClick={() => setLightbox(att)}
                            style={{ cursor: "zoom-in", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: "rgba(15,23,42,0.45)" }}
                          >
                            <img
                              src={att.dataUrl}
                              alt={att.name}
                              style={{ display: "block", width: "100%", maxHeight: 280, objectFit: "cover" }}
                            />
                          </div>
                        ) : (
                          <div key={idx} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: "rgba(15,23,42,0.45)" }}>
                            <video
                              src={att.dataUrl}
                              controls
                              style={{ display: "block", width: "100%", maxHeight: 280 }}
                            />
                            <div style={{ padding: "4px 8px", fontSize: 10, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", background: "rgba(15,23,42,0.6)" }}>
                              {att.name}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Reply form */}
      {canReply ? (
        <div style={{ background: "var(--surface)", border: "1px solid #252830", borderRadius: 8, padding: "20px 24px" }}>
          <div style={{ fontSize: 12, fontFamily: "Oswald, sans-serif", fontWeight: 500, letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 14 }}>
            AÑADIR RESPUESTA
          </div>
          {error && (
            <div style={{ background: "#c0392b18", border: "1px solid #c0392b55", borderRadius: 4, padding: "8px 12px", color: "#e74c3c", fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}
          <form onSubmit={handleReply}>
            <textarea
              style={{ ...inputStyle, height: 100, resize: "vertical" } as React.CSSProperties}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Escribe tu respuesta..."
            />

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    style={{ position: "relative", borderRadius: 4, overflow: "hidden", border: "1px solid #252830", background: "var(--bg)" }}
                  >
                    {att.type === "image" ? (
                      <img src={att.dataUrl} alt={att.name} style={{ display: "block", width: 80, height: 60, objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: 100, height: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        <span style={{ fontSize: 20 }}>🎬</span>
                        <span style={{ fontSize: 9, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 4px" }}>{att.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      style={{ position: "absolute", top: 2, right: 2, background: "#c0392b", border: "none", borderRadius: "50%", width: 16, height: 16, cursor: "pointer", color: "#fff", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {thread.category === "reportes" && (
              <div style={{ marginTop: 12, padding: "14px 14px 12px", background: "rgba(15,23,42,0.48)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Mencionar usuarios</label>
                  <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.08em" }}>
                    {mentionedUserIds.length}/1 mínimo
                  </span>
                </div>

                <input
                  value={mentionQuery}
                  onChange={(e) => setMentionQuery(e.target.value)}
                  placeholder="Buscar usuario..."
                  style={{ ...inputStyle, marginBottom: 10 }}
                />

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {mentionList.length === 0 ? (
                    <span style={{ fontSize: 12, color: "var(--text-dim)" }}>No hay coincidencias.</span>
                  ) : (
                    mentionList.slice(0, 8).map((user) => {
                      const selected = mentionedUserIds.includes(user.id)
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => toggleMention(user.id)}
                          style={{
                            background: selected ? "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(14,165,233,0.08))" : "rgba(15,23,42,0.45)",
                            border: `1px solid ${selected ? "#38bdf8" : "var(--border)"}`,
                            borderRadius: 999,
                            color: selected ? "#e0f2fe" : "var(--text-muted)",
                            padding: "7px 12px",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            boxShadow: selected ? "0 0 0 1px rgba(56,189,248,0.2)" : "none",
                          }}
                        >
                          @{user.username}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button type="submit" style={{ ...primaryBtn, width: "auto", display: "inline-block" }}>
                RESPONDER
              </button>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--surface2)",
                  border: "1px solid #252830",
                  borderRadius: 4,
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: "8px 14px",
                  fontSize: 11,
                  fontFamily: "JetBrains Mono, monospace",
                  letterSpacing: "0.05em",
                  transition: "border-color 0.15s",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border3)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border2)")}
              >
                <span style={{ fontSize: 14 }}>📎</span> ADJUNTAR
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </label>
              {attachments.length > 0 && (
                <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace" }}>
                  {attachments.length} archivo{attachments.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </form>
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid #252830", borderRadius: 8, padding: "16px 24px", color: "var(--text-dim)", fontSize: 13, textAlign: "center" }}>
          {thread.adminOnly ? "Este hilo es informativo y no acepta respuestas." : "Este hilo está cerrado. No se aceptan más respuestas."}
        </div>
      )}
    </div>
    </>
  )
}

// ─── Admin View ───────────────────────────────────────────────────────────────

function AdminView({
  threads,
  users,
  currentUser,
  onStatusChange,
  onPinToggle,
  onDeleteThread,
  onRoleChange,
  onAddRolePoints,
  onContactUser,
  setView,
  setSelectedThread,
}: {
  threads: Thread[]
  users: User[]
  currentUser: User
  onStatusChange: (threadId: string, status: ThreadStatus) => void
  onPinToggle: (threadId: string) => void
  onDeleteThread: (threadId: string) => void
  onRoleChange: (userId: string, role: Role) => void
  onAddRolePoints: (userId: string, amount: number) => void
  onContactUser: (userId: string, message: string) => void
  setView: (v: View) => void
  setSelectedThread: (id: string) => void
}) {
  const [tab, setTab] = useState<"threads" | "users">("threads")
  const [pointsToAdd, setPointsToAdd] = useState<Record<string, string>>({})
  const [contactMessages, setContactMessages] = useState<Record<string, string>>({})

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <div
          style={{
            width: 4,
            height: 28,
            background: "linear-gradient(180deg, #c0392b, #7b1c13)",
            borderRadius: 2,
          }}
        />
        <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: 24, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text)", margin: 0 }}>
          PANEL DE ADMINISTRACIÓN
        </h2>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #1e2330", paddingBottom: 0 }}>
        {[{ id: "threads", label: "Gestión de Hilos" }, { id: "users", label: "Gestión de Usuarios" }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as "threads" | "users")}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === t.id ? "2px solid #c0392b" : "2px solid transparent",
              color: tab === t.id ? "var(--text)" : "var(--text-dim)",
              cursor: "pointer",
              padding: "10px 16px",
              fontSize: 13,
              fontFamily: "Oswald, sans-serif",
              fontWeight: 600,
              letterSpacing: "0.06em",
              marginBottom: -1,
            }}
          >
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "threads" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {threads.map((thread) => {
            const author = users.find((u) => u.id === thread.authorId)
            return (
              <div
                key={thread.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid #1e2330",
                  borderRadius: 6,
                  padding: "14px 18px",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 16,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                    <Badge label={CATEGORY_LABELS[thread.category]} color={CATEGORY_COLORS[thread.category]} />
                    <Badge label={STATUS_LABELS[thread.status]} color={STATUS_COLORS[thread.status]} />
                    {thread.pinned && <Badge label="📌 FIJADO" color="#d4860a" />}
                  </div>
                  <div
                    onClick={() => { setSelectedThread(thread.id); setView("thread") }}
                    style={{ fontFamily: "Oswald, sans-serif", fontWeight: 500, fontSize: 15, color: "var(--text)", cursor: "pointer", marginBottom: 4 }}
                  >
                    {thread.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    {author?.username} · {formatDate(thread.createdAt)} · {thread.replies.length} respuestas
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <select
                    value={thread.status}
                    onChange={(e) => onStatusChange(thread.id, e.target.value as ThreadStatus)}
                    style={{
                      background: "var(--bg)",
                      border: "1px solid #252830",
                      borderRadius: 3,
                      color: "var(--text)",
                      padding: "4px 8px",
                      fontSize: 11,
                      fontFamily: "JetBrains Mono, monospace",
                      cursor: "pointer",
                    }}
                  >
                    {(["abierto", "en_revision", "cerrado"] as ThreadStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => onPinToggle(thread.id)}
                    style={{ background: thread.pinned ? "#d4860a22" : "var(--surface)", border: `1px solid ${thread.pinned ? "#d4860a" : "var(--border2)"}`, borderRadius: 3, color: thread.pinned ? "#d4860a" : "var(--text-dim)", cursor: "pointer", padding: "4px 10px", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                  >
                    {thread.pinned ? "DESFIJAR" : "FIJAR"}
                  </button>
                  {currentUser.role === "admin" && (
                    <button
                      onClick={() => onDeleteThread(thread.id)}
                      style={{ background: "#c0392b18", border: "1px solid #c0392b44", borderRadius: 3, color: "#e74c3c", cursor: "pointer", padding: "4px 10px", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                    >
                      ELIMINAR
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === "users" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map((user) => (
            <div
              key={user.id}
              style={{
                background: "var(--surface)",
                border: "1px solid #1e2330",
                borderRadius: 6,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar letter={user.avatar} role={user.role} size={36} />
                <div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 500, fontSize: 15, color: "var(--text)" }}>
                    {user.username}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace" }}>
                    Registrado: {user.joinedAt} · Puntos de rol: {user.rolePoints || 0}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Badge
                  label={user.role.toUpperCase()}
                  color={user.role === "admin" ? "#e74c3c" : user.role === "moderator" ? "#3498db" : "var(--text-muted)"}
                />
                {currentUser.role === "admin" && user.id !== currentUser.id && (
                  <>
                    <select
                      value={user.role}
                      onChange={(e) => onRoleChange(user.id, e.target.value as Role)}
                      style={{
                        background: "var(--bg)",
                        border: "1px solid #252830",
                        borderRadius: 3,
                        color: "var(--text)",
                        padding: "4px 8px",
                        fontSize: 11,
                        fontFamily: "JetBrains Mono, monospace",
                        cursor: "pointer",
                      }}
                    >
                      <option value="user">Usuario</option>
                      <option value="moderator">Moderador</option>
                      <option value="admin">Admin</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      placeholder="Puntos"
                      value={pointsToAdd[user.id] || ""}
                      onChange={(e) => setPointsToAdd((prev) => ({ ...prev, [user.id]: e.target.value }))}
                      style={{ ...inputStyle, width: 86, padding: "5px 7px", fontSize: 11 }}
                    />
                    <button
                      onClick={() => {
                        const amount = Number(pointsToAdd[user.id])
                        if (!Number.isInteger(amount) || amount < 1) return
                        onAddRolePoints(user.id, amount)
                        setPointsToAdd((prev) => ({ ...prev, [user.id]: "" }))
                      }}
                      style={{ ...primaryBtn, width: "auto", padding: "6px 9px", fontSize: 10, boxShadow: "none" }}
                    >
                      AÑADIR
                    </button>
                    <input
                      type="text"
                      placeholder="Mensaje para el usuario"
                      value={contactMessages[user.id] || ""}
                      onChange={(e) => setContactMessages((prev) => ({ ...prev, [user.id]: e.target.value }))}
                      style={{ ...inputStyle, width: 180, padding: "5px 7px", fontSize: 11 }}
                    />
                    <button
                      onClick={() => {
                        const message = contactMessages[user.id]?.trim()
                        if (!message) return
                        onContactUser(user.id, message)
                        setContactMessages((prev) => ({ ...prev, [user.id]: "" }))
                      }}
                      disabled={!contactMessages[user.id]?.trim()}
                      style={{ ...primaryBtn, width: "auto", padding: "6px 9px", fontSize: 10, boxShadow: "none", background: "linear-gradient(135deg, #0ea5e9, #0369a1)", opacity: contactMessages[user.id]?.trim() ? 1 : 0.45, cursor: contactMessages[user.id]?.trim() ? "pointer" : "not-allowed" }}
                    >
                      CONTACTAR
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontFamily: "JetBrains Mono, monospace",
  letterSpacing: "0.08em",
  color: "var(--text-muted)",
  marginBottom: 7,
  textTransform: "uppercase",
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--input-bg)",
  border: "1px solid var(--border2)",
  borderRadius: 12,
  color: "var(--text)",
  padding: "12px 14px",
  fontSize: 14,
  fontFamily: "Source Sans 3, sans-serif",
  outline: "none",
  boxSizing: "border-box",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
  boxShadow: "inset 0 1px 2px rgba(2,6,23,0.18)",
}

const primaryBtn: React.CSSProperties = {
  width: "100%",
  background: "linear-gradient(135deg, #ef4444 0%, #991b1b 100%)",
  border: "none",
  borderRadius: 12,
  color: "#fff",
  cursor: "pointer",
  padding: "12px 20px",
  fontSize: 13,
  fontFamily: "Oswald, sans-serif",
  fontWeight: 600,
  letterSpacing: "0.12em",
  transition: "transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s",
  boxShadow: "0 14px 30px rgba(239, 68, 68, 0.26)",
}

const navBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  borderBottom: "2px solid transparent",
  cursor: "pointer",
  padding: "7px 10px",
  fontSize: 11,
  fontFamily: "Oswald, sans-serif",
  fontWeight: 600,
  letterSpacing: "0.08em",
  transition: "color 0.15s ease, background 0.15s ease",
  borderRadius: 10,
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [users, setUsers] = useState<User[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [view, setView] = useState<View>("login")
  const [selectedThread, setSelectedThread] = useState<string>("")
  const [selectedProfileId, setSelectedProfileId] = useState<string>("")
  const [selectedCategory, setSelectedCategory] = useState<Category>("reportes")
  const [isDark, setIsDark] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const playInteractionSound = useCallback((type: "click" | "select" | "success") => {
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return

    const audioCtx = new AudioCtor()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()

    const frequencies = {
      click: 180,
      select: 260,
      success: 420,
    }
    const durations = {
      click: 0.14,
      select: 0.18,
      success: 0.2,
    }
    const duration = durations[type]

    oscillator.type = "sine"
    oscillator.frequency.value = frequencies[type]
    gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime)
    gainNode.gain.linearRampToValueAtTime(type === "success" ? 0.022 : 0.014, audioCtx.currentTime + 0.02)

    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)

    oscillator.start()
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration)
    oscillator.stop(audioCtx.currentTime + duration)

    setTimeout(() => audioCtx.close(), duration * 1000 + 30)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("light", !isDark)
  }, [isDark])

  async function hydrateSession(userId: string) {
    setIsLoading(true)
    try {
      const [{ data: profileRow, error: profileError }, forum] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        loadSupabaseForum(),
      ])

      if (profileError) throw profileError
      const profile = mapProfile(profileRow as ProfileRow)
      setUsers(forum.users)
      setThreads(forum.threads)
      setCurrentUser(profile)
      setSelectedProfileId(profile.id)
      setView("forum")
    } finally {
      setIsLoading(false)
    }
  }

  async function refreshForumState() {
    const forum = await loadSupabaseForum()
    setUsers(forum.users)
    setThreads(forum.threads)
  }

  useEffect(() => {
    let mounted = true
    const restoreSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session && mounted) await hydrateSession(session.user.id)
      } catch (sessionError) {
        console.error("Could not restore Supabase session", sessionError)
      } finally {
        if (mounted) setAuthReady(true)
      }
    }

    restoreSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (session) {
        void hydrateSession(session.user.id).catch((sessionError) => {
          console.error("Could not load Supabase profile", sessionError)
        })
      } else {
        setCurrentUser(null)
        setUsers([])
        setThreads([])
        setView("login")
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (currentUser) {
      setSelectedProfileId((profileId) => profileId || currentUser.id)
    }
  }, [currentUser])

  async function handleLogin(characterName: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmailForCharacter(characterName),
      password,
    })
    if (error) throw new Error(error.message)
  }

  async function handleRegister(username: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email: authEmailForCharacter(username),
      password,
      options: { data: { username } },
    })
    if (error) throw new Error(error.message)
    if (!data.session) throw new Error("El administrador debe desactivar la confirmación de email en Supabase para usar nombres de personaje.")
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()
    if (error) console.error("Could not sign out from Supabase", error)
  }

  function notifyUser(userId: string, text: string) {
    setUsers((prevUsers) =>
      prevUsers.map((u) => {
        if (u.id !== userId) return u
        const nextUser = {
          ...u,
          notifications: [
            ...(u.notifications || []),
            {
              id: uid(),
              text,
              createdAt: new Date().toISOString(),
              read: false,
            },
          ],
        }

        if (currentUser && currentUser.id === userId) {
          setCurrentUser(nextUser)
        }

        return nextUser
      })
    )
  }

  async function handleNewThread(thread: Thread, _mentionedUserIds: string[] = []) {
    if (!currentUser || (thread.category === "normativa" && currentUser.role !== "admin")) return
    const { data: createdThread, error } = await supabase.from("threads").insert({
      title: thread.title,
      category: thread.category,
      author_id: currentUser.id,
      content: thread.content,
      status: thread.status,
      pinned: thread.pinned || false,
      admin_only: thread.adminOnly || false,
    }).select().single()
    if (error || !createdThread) {
      console.error("Could not create thread", error)
      throw new Error(error?.message || "No se pudo crear el hilo.")
    }
    if (thread.attachments && thread.attachments.length > 0) {
      const { error: attachmentsError } = await supabase.from("thread_attachments").insert(
        thread.attachments.map((attachment) => ({
          thread_id: createdThread.id,
          name: attachment.name,
          type: attachment.type,
          data_url: attachment.dataUrl,
        }))
      )
      if (attachmentsError) throw new Error(attachmentsError.message)
    }
    await refreshForumState()
    setView("forum")
  }

  async function handleEditThread(threadId: string, title: string, content: string) {
    if (!currentUser) return
    const { error } = await supabase.from("threads").update({ title, content }).eq("id", threadId).eq("author_id", currentUser.id)
    if (error) console.error("Could not edit thread", error)
    else await refreshForumState()
  }

  async function handleReply(threadId: string, content: string, _attachments: Attachment[], _mentionedUserIds: string[] = []) {
    if (!currentUser) return
    const targetThread = threads.find((thread) => thread.id === threadId)
    if (!targetThread || targetThread.adminOnly) return
    const { data: createdReply, error } = await supabase.from("replies").insert({
      thread_id: threadId,
      author_id: currentUser.id,
      content,
      is_staff: currentUser.role !== "user",
    }).select().single()
    if (error || !createdReply) {
      console.error("Could not create reply", error)
      return
    }
    if (_attachments.length > 0) {
      const { error: attachmentsError } = await supabase.from("reply_attachments").insert(
        _attachments.map((attachment) => ({
          reply_id: createdReply.id,
          name: attachment.name,
          type: attachment.type,
          data_url: attachment.dataUrl,
        }))
      )
      if (attachmentsError) console.error("Could not save reply attachments", attachmentsError)
    }
    await refreshForumState()
  }

  async function handleStatusChange(threadId: string, status: ThreadStatus) {
    const { error } = await supabase.from("threads").update({ status }).eq("id", threadId)
    if (error) console.error("Could not update thread status", error)
    else await refreshForumState()
  }

  async function handlePinToggle(threadId: string) {
    const thread = threads.find((item) => item.id === threadId)
    if (!thread) return
    const { error } = await supabase.from("threads").update({ pinned: !thread.pinned }).eq("id", threadId)
    if (error) console.error("Could not pin thread", error)
    else await refreshForumState()
  }

  async function handleDeleteThread(threadId: string) {
    const { error } = await supabase.from("threads").delete().eq("id", threadId)
    if (error) console.error("Could not delete thread", error)
    else {
      await refreshForumState()
      setView("forum")
    }
  }

  async function handleRoleChange(userId: string, role: Role) {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", userId)
    if (error) console.error("Could not update role", error)
    else await refreshForumState()
  }

  async function handleAddRolePoints(userId: string, amount: number) {
    if (currentUser?.role !== "admin" || amount < 1) return
    const user = users.find((item) => item.id === userId)
    if (!user) return
    const { error } = await supabase.from("profiles").update({ role_points: (user.rolePoints || 0) + amount }).eq("id", userId)
    if (error) console.error("Could not add role points", error)
    else await refreshForumState()
  }

  function handleContactUser(userId: string, message: string) {
    if (currentUser?.role !== "admin" || !message.trim()) return
    notifyUser(userId, `Mensaje de ${currentUser.username}: ${message.trim()}`)
  }

  async function handleRedeemRolePoints(userId: string) {
    if (!currentUser || currentUser.id !== userId) return
    const availableRolePoints = (currentUser.rolePoints || 0) - (currentUser.redeemedRolePoints || 0)
    if (availableRolePoints < ROLE_REDEEM_COST) return

    const { error } = await supabase.from("profiles").update({ redeemed_role_points: (currentUser.redeemedRolePoints || 0) + ROLE_REDEEM_COST }).eq("id", userId)
    if (error) console.error("Could not redeem role points", error)
    else await refreshForumState()
  }

  function handleOpenProfile(user: User) {
    setSelectedProfileId(user.id)
    setView("profile")
  }

  function handleOpenCategory(category: Category) {
    setSelectedCategory(category)
    setView("category")
  }

  async function handleSaveProfile(userId: string, updates: Partial<User>) {
    const { error } = await supabase.from("profiles").update({
      avatar_url: updates.avatarUrl,
      bio: updates.bio,
      banner_color: updates.bannerColor,
    }).eq("id", userId)
    if (error) console.error("Could not save profile", error)
    else await hydrateSession(userId)
  }

  async function handleClearNotifications() {
    if (!currentUser) return
    const { error } = await supabase.from("notifications").delete().eq("user_id", currentUser.id)
    if (error) console.error("Could not clear notifications", error)
    else await hydrateSession(currentUser.id)
  }

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!authReady) return null

  if (!currentUser) {
    if (view === "register") {
      return <RegisterView onRegister={handleRegister} goLogin={() => setView("login")} />
    }
    return <LoginView onLogin={handleLogin} goRegister={() => setView("register")} />
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Header
        currentUser={currentUser}
        onLogout={handleLogout}
        setView={setView}
        view={view}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        onOpenProfile={handleOpenProfile}
        onClearNotifications={handleClearNotifications}
      />

      {view === "forum" && (
        <ForumView
          threads={threads}
          users={users}
          currentUser={currentUser}
          setView={setView}
          setSelectedThread={setSelectedThread}
          onSound={playInteractionSound}
          selectedCategory={selectedCategory}
          onOpenCategory={handleOpenCategory}
          onSelectCategory={(category) => setSelectedCategory(category)}
        />
      )}
      {view === "category" && (
        <CategoryView
          category={selectedCategory}
          threads={threads}
          users={users}
          setView={setView}
          setSelectedThread={setSelectedThread}
          onSound={playInteractionSound}
          onSelectCategory={handleOpenCategory}
        />
      )}
      {view === "thread" && (
        <ThreadView
          threadId={selectedThread}
          threads={threads}
          users={users}
          currentUser={currentUser}
          onReply={handleReply}
          onEditThread={handleEditThread}
          onAddRolePoints={handleAddRolePoints}
          onStatusChange={handleStatusChange}
          onPinToggle={handlePinToggle}
          onDeleteThread={handleDeleteThread}
          goBack={() => setView("forum")}
        />
      )}
      {view === "new_thread" && (
        <NewThreadView
          currentUser={currentUser}
          users={users}
          onSubmit={handleNewThread}
          goBack={() => setView("forum")}
          initialCategory={selectedCategory}
        />
      )}
      {view === "profile" && (
        <ProfileView
          currentUser={currentUser}
          users={users}
          selectedUserId={selectedProfileId || currentUser.id}
          onSaveProfile={handleSaveProfile}
          onRedeemRolePoints={handleRedeemRolePoints}
          onBack={() => setView("forum")}
          onSelectUser={(userId) => setSelectedProfileId(userId)}
        />
      )}
      {view === "admin" && currentUser.role !== "user" && (
        <AdminView
          threads={threads}
          users={users}
          currentUser={currentUser}
          onStatusChange={handleStatusChange}
          onPinToggle={handlePinToggle}
          onDeleteThread={handleDeleteThread}
          onRoleChange={handleRoleChange}
          onAddRolePoints={handleAddRolePoints}
          onContactUser={handleContactUser}
          setView={setView}
          setSelectedThread={setSelectedThread}
        />
      )}
    </div>
  )
}
