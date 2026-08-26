import { useState, useEffect, useCallback, useRef } from "react"
import DOMPurify from "dompurify"
import { marked } from "marked"
import { supabase } from "@/lib/supabase"
import logoImg from "@/imports/bg,f8f8f8-flat,750x,075,f-pad,750x1000,f8f8f8.jpg"
import siteLogoImg from "@/imports/final123.png"
import defaultBannerImg from "@/imports/default-banner.jpg"
import eclipseGif from "@/imports/giphy.gif"

const DEFAULT_BANNER_URL = defaultBannerImg

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "user" | "admin" | "moderator"
type Category = "bugs" | "reportes" | "historias" | "facciones" | "normativa"
type ThreadStatus = "abierto" | "cerrado" | "en_revision"
type ThreadSubforum = "formato" | "no_oficial" | "oficial"

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
  bannerUrl?: string
  notifications?: NotificationItem[]
  rolePoints?: number
  redeemedRolePoints?: number
  ownedProductIds?: string[]
  suspended?: boolean
}

interface StoreProduct {
  id: string
  title: string
  price: number
  description: string
  imageUrl?: string
  createdAt: string
  kind?: "personal" | "faccion"
}

interface StoreRedemption {
  id: string
  userId: string
  username: string
  productId: string
  productTitle: string
  price: number
  createdAt: string
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
  editedAt?: string
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
  editedAt?: string
  replies: Reply[]
  pinned?: boolean
  attachments?: Attachment[]
  adminOnly?: boolean
  subforum?: ThreadSubforum
  factionRolePoints?: number
  factionRolePointsClaimed?: boolean
  visitorCount?: number
}

function MarkdownText({ content, inline = false }: { content: string; inline?: boolean }) {
  const normalizedContent = content.replace(/:::\s*(left|center|right)\s*\n([\s\S]*?)\n:::/g, '<div class="markdown-align-$1">\n$2\n</div>')
  const html = DOMPurify.sanitize(marked.parse(normalizedContent, { async: false, breaks: true, gfm: true }) as string)

  if (inline) {
    const inlineHtml = DOMPurify.sanitize(marked.parseInline(content, { async: false, breaks: true, gfm: true }) as string)
    return <span dangerouslySetInnerHTML={{ __html: inlineHtml }} />
  }

  return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: html }} />
}

function AlignmentIcon({ mode }: { mode: "left" | "center" | "right" }) {
  return <span className={`markdown-align-icon markdown-align-icon-${mode}`} aria-hidden="true"><i /><i /><i /><i /></span>
}

function MarkdownToolbar({ editorRef, onInsertImage }: { editorRef: React.RefObject<HTMLDivElement | null>; onInsertImage: (file: File) => void }) {
  const savedSelectionRef = useRef<Range | null>(null)

  function saveSelection() {
    const selection = window.getSelection()
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) {
      savedSelectionRef.current = selection.getRangeAt(0).cloneRange()
    }
  }

  function restoreSelection() {
    const selection = window.getSelection()
    if (!selection || !savedSelectionRef.current) return
    selection.removeAllRanges()
    selection.addRange(savedSelectionRef.current)
  }

  function applyFormat(command: string, value?: string) {
    restoreSelection()
    editorRef.current?.focus()
    if (command === "createLink") {
      const url = window.prompt("URL del enlace", "https://")
      if (!url) return
      document.execCommand(command, false, url)
      return
    }
    document.execCommand(command, false, value)
  }

  const tools = [
    { label: "H1", title: "Encabezado", command: "formatBlock", value: "h1" },
    { label: "B", title: "Negrita", command: "bold" },
    { label: "I", title: "Cursiva", command: "italic" },
    { label: "S", title: "Tachado", command: "strikeThrough" },
    { label: ">", title: "Cita", command: "formatBlock", value: "blockquote" },
    { label: "</>", title: "Código", command: "formatBlock", value: "pre" },
    { label: "•", title: "Lista", command: "insertUnorderedList" },
    { label: "1.", title: "Lista numerada", command: "insertOrderedList" },
    { label: "🔗", title: "Enlace", command: "createLink" },
    { label: <AlignmentIcon mode="left" />, title: "Alinear a la izquierda", command: "justifyLeft" },
    { label: <AlignmentIcon mode="center" />, title: "Centrar", command: "justifyCenter" },
    { label: <AlignmentIcon mode="right" />, title: "Alinear a la derecha", command: "justifyRight" },
  ]

  const colors = ["#000000", "#ffffff", "#ef4444", "#f97316", "#fbbf24", "#22c55e", "#14b8a6", "#38bdf8", "#3b82f6", "#8b5cf6", "#ec4899", "#94a3b8", "#475569", "#7f1d1d", "#854d0e"]
  const fonts = ["Arial", "Arial Black", "Comic Sans MS", "Courier New", "Georgia", "Impact", "Sans-serif", "Serif", "Times New Roman", "Trebuchet MS", "Verdana"]
  const imageInputRef = useRef<HTMLInputElement>(null)

  return <div className="markdown-toolbar" role="toolbar" aria-label="Formato visual">
    {tools.map((tool) => <button key={tool.title} type="button" title={tool.title} aria-label={tool.title} data-tooltip={tool.title} onMouseDown={(event) => { event.preventDefault(); saveSelection() }} onClick={() => applyFormat(tool.command, tool.value)}>{tool.label}</button>)}
    <span className="markdown-toolbar-divider" aria-hidden="true" />
    <select title="Fuente" aria-label="Fuente" onMouseDown={saveSelection} onChange={(event) => applyFormat("fontName", event.target.value)} defaultValue="Arial">
      {fonts.map((font) => <option key={font} value={font}>{font}</option>)}
    </select>
    <select title="Tamaño de fuente" aria-label="Tamaño de fuente" onMouseDown={saveSelection} onChange={(event) => applyFormat("fontSize", event.target.value)} defaultValue="3">
      {[1, 2, 3, 4, 5, 6, 7].map((size) => <option key={size} value={size}>{size}</option>)}
    </select>
    <details className="markdown-color-picker">
      <summary title="Color del texto" aria-label="Color del texto"><span className="markdown-color-current" /></summary>
      <div className="markdown-color-palette">
        {colors.map((color) => <button key={color} type="button" title={`Color ${color}`} aria-label={`Color ${color}`} onMouseDown={(event) => { event.preventDefault(); saveSelection() }} onClick={() => applyFormat("foreColor", color)}><span className="markdown-color-swatch" style={{ background: color }} /></button>)}
      </div>
    </details>
    <button type="button" title="Insertar imagen" aria-label="Insertar imagen" data-tooltip="Insertar imagen" onMouseDown={(event) => event.preventDefault()} onClick={() => imageInputRef.current?.click()}>▧</button>
    <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) onInsertImage(file); event.target.value = "" }} />
    <span>Formato visual</span>
  </div>
}

function VisualEditor({ editorRef, onChange }: { editorRef: React.RefObject<HTMLDivElement | null>; onChange: (html: string, text: string) => void }) {
  return <div ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" onInput={(event) => { const element = event.currentTarget; onChange(element.innerHTML, element.textContent || "") }} className="visual-editor" data-placeholder="Escribe el contenido del hilo..." />
}

type View =
  | "login"
  | "register"
  | "forum"
  | "category"
  | "report_status"
  | "faction_subforum"
  | "thread"
  | "new_thread"
  | "profile"
  | "store"
  | "admin"

type RouteState = {
  view: View
  profileId?: string
  threadId?: string
  category?: Category
  reportStatus?: ThreadStatus
  factionSubforum?: ThreadSubforum
}

type NavigationSnapshot = RouteState & {
  category: Category
  reportStatus: ThreadStatus
  factionSubforum: ThreadSubforum
}

function routeFromLocation(): RouteState {
  const segments = window.location.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment))

  if (segments[0] === "perfil" && segments[1]) return { view: "profile", profileId: segments[1] }
  if (segments[0] === "hilo" && segments[1]) return { view: "thread", threadId: segments[1] }
  if (segments[0] === "foro" && segments[2] === "nuevo" && segments[1]) {
    return { view: "new_thread", category: segments[1] as Category }
  }
  if (segments[0] === "foro" && segments[1] === "reportes" && segments[2]) {
    return { view: "report_status", category: "reportes", reportStatus: segments[2] as ThreadStatus }
  }
  if (segments[0] === "foro" && segments[1] === "facciones" && segments[2]) {
    return { view: "faction_subforum", category: "facciones", factionSubforum: segments[2] as ThreadSubforum }
  }
  if (segments[0] === "foro" && segments[1]) {
    return { view: "category", category: segments[1] as Category }
  }

  return { view: "forum" }
}

function pathFromState(view: View, profileId: string, threadId: string, category: Category, reportStatus: ThreadStatus, factionSubforum: ThreadSubforum) {
  if (view === "profile" && profileId) return `/perfil/${encodeURIComponent(profileId)}`
  if (view === "thread" && threadId) return `/hilo/${encodeURIComponent(threadId)}`
  if (view === "new_thread") return `/foro/${category}/nuevo`
  if (view === "category") return `/foro/${category}`
  if (view === "report_status") return `/foro/reportes/${reportStatus}`
  if (view === "faction_subforum") return `/foro/facciones/${factionSubforum}`
  return "/"
}

type ProfileRow = {
  id: string
  username: string
  role: Role
  avatar: string
  avatar_url?: string | null
  bio?: string | null
  banner_url?: string | null
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
  edited_at?: string | null
  subforum?: ThreadSubforum
  faction_role_points?: number
  faction_role_points_claimed?: boolean
}

type ReplyRow = {
  id: string
  thread_id: string
  author_id: string
  content: string
  is_staff: boolean
  created_at: string
  edited_at?: string | null
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

const ATTACHMENTS_BUCKET = "forum-attachments"

function attachmentUrl(row: AttachmentRow) {
  if (row.storage_path) {
    return supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(row.storage_path).data.publicUrl
  }
  return row.data_url || ""
}

async function uploadAttachment(attachment: Attachment, folder: string) {
  const response = await fetch(attachment.dataUrl)
  const blob = await response.blob()
  const extension = attachment.name.split(".").pop()?.toLowerCase() || (attachment.type === "video" ? "mp4" : "jpg")
  const path = `${folder}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, blob, {
    contentType: blob.type || (attachment.type === "video" ? "video/mp4" : "image/jpeg"),
    upsert: false,
  })
  if (error) throw new Error(`No se pudo subir ${attachment.name}: ${error.message}`)
  return { name: attachment.name, type: attachment.type, storage_path: path }
}

async function uploadInlineImages(content: string, folder: string) {
  if (!content.includes("<img")) return content
  const documentParser = new DOMParser()
  const documentFragment = documentParser.parseFromString(content, "text/html")
  const images = Array.from(documentFragment.querySelectorAll("img"))

  await Promise.all(images.map(async (image) => {
    if (!image.src.startsWith("data:")) return
    const response = await fetch(image.src)
    const blob = await response.blob()
    const extension = blob.type.split("/")[1] || "png"
    const path = `${folder}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, blob, {
      contentType: blob.type || "image/png",
      upsert: false,
    })
    if (error) throw new Error(`No se pudo subir una imagen insertada: ${error.message}`)
    image.src = supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path).data.publicUrl
  }))

  return documentFragment.body.innerHTML
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
    bannerUrl: row.banner_url || undefined,
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
    editedAt: row.edited_at || undefined,
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
    { data: threadViewRows, error: threadViewsError },
  ] = await Promise.all([
    supabase.from("profiles").select("*").order("joined_at", { ascending: true }),
    supabase.from("threads").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("replies").select("*").order("created_at", { ascending: true }),
    supabase.from("thread_attachments").select("*"),
    supabase.from("reply_attachments").select("*"),
    supabase.from("thread_views").select("thread_id, user_id"),
  ])

  if (profilesError) throw profilesError
  if (threadsError) throw threadsError
  if (repliesError) throw repliesError
  if (threadAttachmentsError) throw threadAttachmentsError
  if (replyAttachmentsError) throw replyAttachmentsError
  const threadViews = threadViewsError ? [] : (threadViewRows || []) as { thread_id: string; user_id: string }[]

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
      subforum: thread.subforum || (thread.category === "facciones" ? "no_oficial" : undefined),
      factionRolePoints: thread.faction_role_points || 0,
      factionRolePointsClaimed: thread.faction_role_points_claimed || false,
      visitorCount: threadViews.filter((view) => view.thread_id === thread.id).length,
      createdAt: thread.created_at,
      editedAt: thread.edited_at || undefined,
      attachments: threadAttachments
        .filter((attachment) => attachment.thread_id === thread.id)
        .map((attachment) => ({ name: attachment.name, type: attachment.type, dataUrl: attachmentUrl(attachment) })),
      replies: (replyRows || []).filter((reply) => (reply as ReplyRow).thread_id === thread.id).map((reply) => {
        const mappedReply = mapReply(reply as ReplyRow)
        mappedReply.attachments = replyAttachments
          .filter((attachment) => attachment.reply_id === mappedReply.id)
          .map((attachment) => ({ name: attachment.name, type: attachment.type, dataUrl: attachmentUrl(attachment) }))
        return mappedReply
      }),
    }
  })

  // Ensure rules thread is always present
  const rulesThread: Thread = {
    id: "t-rules-historias",
    title: "Formato para fichas del personaje",
    category: "historias",
    authorId: "u0",
    content: "**FORMATO PARA FICHAS DEL PERSONAJE**\n\n> **Nombre y Apellido:**\n> **Edad:**\n> **Historia Breve Del Personaje:**\n> **Descripción Psicológica Del Personaje**\n> **Foto/ilustración del personaje**\n\n**Todo personaje** debe presentar una biografía breve y básica antes de su participación activa. La biografía define únicamente el punto de partida del personaje y no su desarrollo completo. Debe establecer de forma clara un origen general, rasgos psicológicos principales, motivaciones iniciales y límites concretos, como miedos, debilidades o conflictos internos. No se exige profundidad ni extensión inicial, ya que el desarrollo del personaje ocurre dentro del mismo servidor.\n\nEl desarrollo activo de la biografía durante el juego otorga peso narrativo real. Las decisiones tomadas, los vínculos construidos, los conflictos sostenidos y la evolución psicológica forman parte del canon personal del personaje. Las biografías que se desarrollen de manera coherente y sostenida serán recompensadas ya sea con **PDR** o **FDR** de manera casual.\n\nEn el caso que el usuario no interprete humanamente un personaje, fuerce situaciones conflictivas o innecesarias, será bloqueado por nula interpretación.\n\nLos usuarios que realicen roles relevantes para el futuro deberán guardar capturas de sus roles previos.\n\nAl cierre de cada temporada, el staff podrá reconocer a aquellos personajes que hayan demostrado un desarrollo, coherencia narrativa sostenida. Estas premiaciones más que nada es para incentivar el rolear y mantener un personaje bien construído.\n\nCada personaje creado por un usuario debe ser único e irrepetible. No está permitido reutilizar historias, perfiles psicológicos, rasgos, antecedentes ni recrear vínculos familiares con personajes anteriores.\n\nTodos los personajes deben tener un mínimo de **16 años**, sin excepciones.",
    status: "abierto",
    createdAt: "2026-08-03T11:00:00Z",
    pinned: true,
    replies: [],
    adminOnly: true,
  }

  const reportRulesThread: Thread = {
    id: "t-rules-reportes",
    title: "Normativa de la Sección y plantilla de reporte",
    category: "reportes",
    authorId: "u0",
    content: "**Reglas específicas de la sección de reportes**\n\n- En los reportes solo hablan los acusados, el que reporta y el miembro del Staff que tome el reporte. Aunque hayas estado involucrado (como testigo o con pruebas) no podrás participar.\n\n- El motivo de sanción debe ser claro.\n\n- El título del reporte debe seguir el formato: **Nombre Apellido**.\n\n- Si el usuario que reporta o el usuario reportado están baneados permanentemente o de forma indefinida, el reporte será rechazado.\n\n- El denunciante, luego de 72 horas, puede solicitar al Encargado de Staff que coloque un encargado para responder su reporte. Aun así esto no quiere decir que el reporte sea tomado sí o cuando el usuario lo solicite. El Equipo del Staff y los Administradores se reserva el derecho de tomar el reporte cuando sea conveniente.\n\n- Cualquier reporte hecho con la intención de molestar, hostigar o con pruebas editadas para incriminar a un usuario/staff terminará con tu cuenta baneada de la comunidad.\n\n- El reporte estará en estado de pendiente hasta que el acusado responda o un Staff pida la respuesta del acusado (con un mínimo de 24 horas de espera). Esto quiere decir que si se excede el límite de tiempo y todavía el acusado no ha respondido se podrá tomar como aceptado el reporte sin problema alguno, basándose en los hechos que aclaró el denunciante.\n\n- En caso de que el Staff considere que las pruebas entregadas son suficientes para una resolución, no estará obligado a esperar la respuesta del acusado.\n\n- El caso no se tomará en cuenta si se reporta luego de 2 semanas de lo ocurrido.\n\n- Las pruebas no pueden estar manipuladas de ninguna forma. Si se muestran dichas pruebas, deben de estar en su formato original. Esto incluye el ocultado de información como puede ser tapar el chat o los nombres de los personajes. En caso de que esto se realice, el reporte será cerrado a favor del contrincante (si las pruebas son editadas por el acusado, el reporte es aceptado mientras que si las pruebas son editadas por el denunciante, el reporte es rechazado).\n\n- Además, la manipulación de pruebas puede llevar a una sanción, llegando hasta la expulsión de nuestra comunidad en ciertos casos.\n\n- La explicación de los hechos no puede superar los 1000 caracteres.\n\n**Modus operandi**\n\n**General:**\n\nAl realizar el reporte, el denunciante o creador del mismo deberá de dar toda la información que pueda al respecto del caso. Si es un reporte múltiple (con varios acusados) los motivos de sanción deben de ser idénticos para cada persona. Por ejemplo, en caso de que un acusado haya sido denunciado erróneamente por DM y este lo remarque, el reporte será rechazado para todos. Si quiere reportar a un grupo de personas por distintos motivos, realice distintos reportes.\n\nLas pruebas deben de ser claras y la explicación breve y concisa, no se vaya por las ramas porque solo entorpecerá la resolución de dicha denuncia/reporte. Procure explicar todo lo que pueda teniendo chances limitadas para defender su palabra. Una vez cree el reporte, no podrá contestarlo hasta que un Staff le permita hacerlo. Deberá de esperar a la respuesta del acusado o del Staff que se haga cargo de dicha denuncia.\n\nSi usted fue el acusado, deberá de responder el reporte lo más rápido que pueda. No es necesario que cuente con pruebas a excepción de que comente que las tiene o que hable sobre sucesos los cuales las pruebas del contrincante no los muestran. El comentar tener pruebas y luego no mostrarlas es un indicativo que tomará el Staff para creerle más al denunciante que al acusado. Usted deberá de responder el reporte y esperar a la respuesta del Staff.\n\nSi el acusado vuelve a responder sin que el Staff le dé el permiso, el Staff podrá aceptar el reporte por este mismo motivo aun si las pruebas no son del todo convincentes. A la vez, si el acusado responde al denunciante sin el permiso del Staff, el Staff podrá rechazar el reporte aun si las pruebas son convincentes.\n\nEl denunciante luego de crear el post solo podrá volver a comentar en el mismo si el Staff le da permiso, mientras que el acusado luego de dar una respuesta al post solo podrá volver a comentar si el Staff le otorga el permiso.\n\nEl editar o eliminar el post luego de una respuesta podrá resultar en una sanción por parte del Staff a cargo de dicho reporte.\n\n**Contra usuarios:**\n\nEs obligatorio que dicho reporte cuente con pruebas sobre lo relatado. En caso de no tenerlas, el reporte será rechazado a excepción de que el Staff vea conveniente no hacerlo.\n\n**Plantilla/formato del reporte**\n\n**Nombre del denunciante:** Responder aquí.\n\n**Nombre del acusado:** Responder aquí.\n\n**Fecha de lo ocurrido:** Responder aquí.\n\n**Motivos de sanción:** Responder aquí.\n\n**Breve explicación de los hechos:** Responder aquí.\n\n**Pruebas sobre lo relatado:** Responder aquí.",
    status: "abierto",
    createdAt: "2026-08-03T10:00:00Z",
    pinned: true,
    replies: [],
    adminOnly: true,
  }

  const factionFormatThread: Thread = {
    id: "t-rules-facciones-formato",
    title: "Formato para presentar una facción",
    category: "facciones",
    authorId: "u0",
    content: "**El titulo del hilo debe ser nombre de la facción**\n\n**Introducción y Lore**:\n\n**Ubicación**:\n\n**Miembros**:\n\n**Screenshots (Si requiere)**:",
    status: "abierto",
    createdAt: "2026-08-03T09:00:00Z",
    pinned: true,
    replies: [],
    adminOnly: true,
    subforum: "formato",
  }

  // Filter out duplicate rules thread and add it at the beginning
  const filteredThreads = threads.filter((t) => t.id !== "t-rules-historias" && t.id !== "t-rules-reportes" && t.id !== "t-rules-facciones-formato")
  const allThreads = [rulesThread, reportRulesThread, factionFormatThread, ...filteredThreads]

  return { users, threads: allThreads }
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
    bannerUrl: DEFAULT_BANNER_URL,
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
    title: "Normativa de la Sección y plantilla de reporte",
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

const FACTION_SUBFORUM_LABELS: Record<ThreadSubforum, string> = {
  formato: "FORMATO",
  no_oficial: "NO OFICIAL",
  oficial: "OFICIAL",
}

const ROLE_REDEEM_COST = 100
const SESSION_STORAGE_KEY = "eclipse-order-session"
const LOCAL_USERS_STORAGE_KEY = "eclipse-order-local-users"
const STORE_PRODUCTS_STORAGE_KEY = "eclipse-order-store-products"
const STORE_REDEMPTIONS_STORAGE_KEY = "eclipse-order-store-redemptions"

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

function roleLabel(role: Role) {
  return role === "user" ? "USUARIO" : role.toUpperCase()
}

function RoleMark({ role }: { role: Role }) {
  if (role === "user") return null
  const isAdmin = role === "admin"
  return (
    <span
      title={isAdmin ? "Administrador del foro" : "Moderador del foro"}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 6, padding: "2px 6px", border: `1px solid ${isAdmin ? "rgba(255,107,95,0.55)" : "rgba(77,216,223,0.5)"}`, borderRadius: 999, background: isAdmin ? "rgba(255,107,95,0.14)" : "rgba(77,216,223,0.12)", color: isAdmin ? "#ff9b91" : "#8cecf0", fontFamily: "JetBrains Mono, monospace", fontSize: 8, letterSpacing: "0.08em", lineHeight: 1.2, verticalAlign: "middle", boxShadow: `0 0 12px ${isAdmin ? "rgba(255,107,95,0.2)" : "rgba(77,216,223,0.18)"}` }}
    >
      {isAdmin ? "★ ADMIN" : "◆ MOD"}
    </span>
  )
}

function readLocalUsers(): User[] {
  try {
    const storedUsers = JSON.parse(localStorage.getItem(LOCAL_USERS_STORAGE_KEY) || "[]")
    return Array.isArray(storedUsers) ? storedUsers : []
  } catch {
    return []
  }
}

function readStoreProducts(): StoreProduct[] {
  try {
    const storedProducts = JSON.parse(localStorage.getItem(STORE_PRODUCTS_STORAGE_KEY) || "[]")
    return Array.isArray(storedProducts) ? storedProducts : []
  } catch {
    return []
  }
}

function readStoreRedemptions(): StoreRedemption[] {
  try {
    const storedRedemptions = JSON.parse(localStorage.getItem(STORE_REDEMPTIONS_STORAGE_KEY) || "[]")
    return Array.isArray(storedRedemptions) ? storedRedemptions : []
  } catch {
    return []
  }
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

function PostingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 14,
        background: "rgba(4, 9, 15, 0.82)",
        backdropFilter: "blur(5px)",
      }}
    >
      <div style={{ width: 42, height: 42, border: "3px solid rgba(148, 163, 184, 0.22)", borderTop: "3px solid #f97316", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ color: "var(--text)", fontSize: 13, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.08em" }}>
        PUBLICANDO...
      </div>
      <div style={{ color: "var(--text-dim)", fontSize: 11 }}>Subiendo contenido y archivos</div>
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
      <div className="login-content" style={{ width: "100%", maxWidth: 1040 }}>
        <div className="login-brand" style={{ textAlign: "center", marginBottom: 40 }}>
          <Logo />
          <div className="login-brand-line">
            <span />
            <small>COMUNIDAD DE PROJECT ZOMBOID</small>
            <span />
          </div>
        </div>
        <div className="login-eclipse" aria-hidden="true">
          <img src={eclipseGif} alt="" />
        </div>

        <div className="login-layout">
          <div className="login-brief">
            <span className="login-eyebrow">REFUGIO // ECLIPSE ORDER</span>
            <h1>
              SOBREVIVE.
              <br />
              <span>CONECTA.</span>
            </h1>
            <p>El mundo cambió. Las historias que quedan se escriben aquí.</p>
            <div className="login-brief-line">
              <span />
              <small>COMUNIDAD DE SUPERVIVIENTES</small>
            </div>
          </div>

          <div
            className="login-panel"
            style={{
              background: "linear-gradient(180deg, var(--surface), var(--surface2))",
              border: "1px solid var(--border)",
              borderRadius: 24,
              padding: "32px 28px",
              boxShadow: "0 30px 60px rgba(2, 6, 23, 0.32)",
            }}
          >
            <div className="login-panel-heading">
              <span className="login-eyebrow">ACCESO DE SUPERVIVIENTE</span>
              <h2>INICIAR SESIÓN</h2>
              <p className="login-subtitle">Vuelve a entrar en tu historia.</p>
            </div>

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
                borderTop: "1px solid var(--border)",
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
  const [characterFirstName, setCharacterFirstName] = useState("")
  const [characterLastName, setCharacterLastName] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const firstName = characterFirstName.trim()
    const lastName = characterLastName.trim()
    const username = `${firstName} ${lastName}`.trim()
    if (firstName.length < 1 || lastName.length < 1) {
      setError("Debes indicar el nombre y apellido de tu personaje.")
      return
    }
    if (username.length < 3) {
      setError("El nombre completo del personaje debe tener al menos 3 caracteres.")
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
    <div
      className="login-shell register-shell"
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
      <div className="login-content" style={{ width: "100%", maxWidth: 1040 }}>
        <div className="login-brand" style={{ textAlign: "center", marginBottom: 40 }}>
          <Logo />
          <div className="login-brand-line">
            <span />
            <small>COMUNIDAD DE PROJECT ZOMBOID</small>
            <span />
          </div>
        </div>
        <div className="login-eclipse" aria-hidden="true">
          <img src={eclipseGif} alt="" />
        </div>

        <div className="login-layout">
          <div className="login-brief">
            <span className="login-eyebrow">NUEVO SUPERVIVIENTE</span>
            <h1>
              ENCUENTRA.
              <br />
              <span>RESISTE.</span>
            </h1>
            <p>Tu personaje. Tu historia. Tu lugar en la comunidad.</p>
            <div className="login-brief-line">
              <span />
              <small>CREA TU IDENTIDAD</small>
            </div>
          </div>

          <div
            className="login-panel"
            style={{
              background: "linear-gradient(180deg, var(--surface), var(--surface2))",
              border: "1px solid var(--border)",
              borderRadius: 24,
              padding: "32px 28px",
              boxShadow: "0 30px 60px rgba(2, 6, 23, 0.32)",
            }}
          >
            <div className="login-panel-heading">
              <span className="login-eyebrow">REGISTRO DE SUPERVIVIENTE</span>
              <h2>CREAR CUENTA</h2>
              <p className="login-subtitle">Prepara tu llegada al foro.</p>
            </div>

            {error && (
              <div style={{ background: "#c0392b18", border: "1px solid #c0392b55", borderRadius: 4, padding: "10px 14px", color: "#e74c3c", fontSize: 13, marginBottom: 20 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Nombre de tu personaje</label>
                <input className="login-input" style={inputStyle} value={characterFirstName} onChange={(e) => setCharacterFirstName(e.target.value)} placeholder="Nombre del personaje" autoFocus />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Apellido de tu personaje</label>
                <input className="login-input" style={inputStyle} value={characterLastName} onChange={(e) => setCharacterLastName(e.target.value)} placeholder="Apellido del personaje" />
                <p style={{ margin: "5px 0 0", fontSize: 11, color: "var(--text-dim)" }}>
                  Usa el mismo nombre y apellido de tu personaje en el servidor de Zomboid
                </p>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Contraseña</label>
                <input className="login-input" style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div style={{ marginBottom: 28 }}>
                <label style={labelStyle}>Confirmar contraseña</label>
                <input className="login-input" style={inputStyle} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repite la contraseña" />
              </div>
              <button type="submit" className="login-submit" style={primaryBtn}>CREAR CUENTA</button>
            </form>

            <div className="login-register" style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--border)", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
              ¿Ya tienes cuenta?{" "}
              <button onClick={goLogin} style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer", fontWeight: 600, padding: 0, fontSize: 13 }}>
                Iniciar sesión
              </button>
            </div>
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

function StoreView({
  currentUser,
  threads,
  products,
  onCreateProduct,
  onRedeemProduct,
  onBack,
}: {
  currentUser: User
  threads: Thread[]
  products: StoreProduct[]
  onCreateProduct: (product: StoreProduct) => void
  onRedeemProduct: (product: StoreProduct) => void
  onBack: () => void
}) {
  const [title, setTitle] = useState("")
  const [price, setPrice] = useState("")
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [productKind, setProductKind] = useState<"personal" | "faccion">("personal")
  const [error, setError] = useState("")
  const ownedProductIds = currentUser.ownedProductIds || []
  const balance = Math.max(0, (currentUser.rolePoints || 0) - (currentUser.redeemedRolePoints || 0))
  const factionBalance = threads
    .filter((thread) => thread.category === "facciones" && thread.authorId === currentUser.id && !thread.factionRolePointsClaimed)
    .reduce((total, thread) => total + (thread.factionRolePoints || 0), 0)

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImageUrl(String(reader.result || ""))
    reader.readAsDataURL(file)
    event.target.value = ""
  }

  function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    const numericPrice = Number(price)
    if (!title.trim() || !description.trim() || !Number.isInteger(numericPrice) || numericPrice < 1) {
      setError("Completa título, descripción y un precio entero mayor a 0.")
      return
    }
    onCreateProduct({ id: uid(), title: title.trim(), price: numericPrice, description: description.trim(), imageUrl, kind: productKind, createdAt: new Date().toISOString() })
    setTitle("")
    setPrice("")
    setDescription("")
    setImageUrl("")
    setProductKind("personal")
    setError("")
  }

  return (
    <div className="store-view">
      <div className="store-heading">
        <button onClick={onBack} className="store-back">← VOLVER AL FORO</button>
        <span className="store-kicker">ECLIPSE ORDER // RECOMPENSAS</span>
        <h1>Tienda</h1>
        <p>Canjea tus puntos de rol por recompensas de la comunidad.</p>
        <div className="store-balances">
          <div className={`store-balance ${balance === 0 ? "store-balance-empty" : ""}`}><span>●</span> SALDO PERSONAL <strong>{balance} PDR</strong></div>
          <div className={`store-balance store-balance-faction ${factionBalance === 0 ? "store-balance-empty" : ""}`}><span>◆</span> SALDO FACCIONARIO <strong>{factionBalance} PDR</strong></div>
        </div>
      </div>

      <div className="store-layout">
        <div className="store-catalog-departments">
        <section className="store-catalog store-department store-user-department">
          <div className="store-section-title"><span className="store-catalog-title">Recompensas personales</span><small>{products.filter((product) => (product.kind || "personal") === "personal").length} PRODUCTOS</small></div>
          {products.filter((product) => (product.kind || "personal") === "personal").length === 0 ? (
            <div className="store-empty">Todavía no hay productos personales disponibles.</div>
          ) : (
            <div className="store-products">
              {products.filter((product) => (product.kind || "personal") === "personal").map((product) => {
                const owned = ownedProductIds.includes(product.id)
                const canAfford = balance >= product.price
                return (
                  <article className="store-product" key={product.id}>
                    <div className="store-product-image">
                      {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span>✦</span>}
                    </div>
                    <div className="store-product-body">
                      <div className="store-product-price">{product.price} PDR</div>
                      <h2>{product.title}</h2>
                      <p>{product.description}</p>
                      <button onClick={() => onRedeemProduct(product)} disabled={owned || !canAfford} className="store-redeem">
                        {owned ? "CANJEADO" : canAfford ? "CANJEAR PRODUCTO" : "PUNTOS INSUFICIENTES"}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="store-catalog store-department faction-store-department">
          <div className="store-section-title faction-store-section-title"><span>Recompensas para facciones</span><small>{products.filter((product) => product.kind === "faccion").length} PRODUCTOS</small></div>
          {products.filter((product) => product.kind === "faccion").length === 0 ? (
            <div className="store-empty faction-store-empty">Todavía no hay productos faccionario disponibles.</div>
          ) : (
            <div className="store-products">
              {products.filter((product) => product.kind === "faccion").map((product) => (
                <article className="store-product faction-store-product" key={product.id}>
                  <div className="store-product-image">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span>✦</span>}</div>
                  <div className="store-product-body">
                    <div className="store-product-price">{product.price} PDR FACCIONARIO</div>
                    <h2>{product.title}</h2>
                    <p>{product.description}</p>
                    <button disabled className="store-redeem">CANJE DESDE EL HILO</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        </div>

        {currentUser.role === "admin" && (
          <section className="store-admin-panel">
            <div className="store-section-title"><span>Nuevo producto</span><small>SOLO ADMIN</small></div>
            <form onSubmit={handleCreate}>
              {error && <div className="store-error">{error}</div>}
              <label style={labelStyle}>Título<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nombre de la recompensa" style={inputStyle} /></label>
              <label style={labelStyle}>Precio en puntos de rol<input type="number" min="1" step="1" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="100" style={inputStyle} /></label>
              <label style={labelStyle}>Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe qué recibe el superviviente..." style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} /></label>
              <label style={labelStyle}>Tipo de recompensa<select value={productKind} onChange={(event) => setProductKind(event.target.value as "personal" | "faccion")} style={inputStyle}><option value="personal">PDR personal</option><option value="faccion">PDR faccionario</option></select></label>
              <label className="store-upload">{imageUrl ? <img src={imageUrl} alt="Vista previa" /> : <span>＋ Añadir imagen</span>}<input type="file" accept="image/*" onChange={handleImageChange} /></label>
              <button type="submit" className="store-create">PUBLICAR EN TIENDA</button>
            </form>
          </section>
        )}
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
  onOpenProfile,
  onClearNotifications,
  onOpenAdmin,
}: {
  currentUser: User
  onLogout: () => void
  setView: (v: View) => void
  view: View
  onOpenProfile: (user: User) => void
  onClearNotifications: () => void
  onOpenAdmin: () => void
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

        <nav className="header-nav" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div className="header-primary-links">
            <button
              className={`header-primary-link ${view === "forum" ? "is-active" : ""}`}
              onClick={() => setView("forum")}
              style={{ ...navBtn, color: view === "forum" ? "#f8fafc" : "var(--text-dim)", background: view === "forum" ? "rgba(230, 162, 60, 0.16)" : "transparent", padding: "10px 22px" }}
            >
              FORO
            </button>

            <button
              className={`header-primary-link ${view === "store" ? "is-active" : ""}`}
              onClick={() => setView("store")}
              style={{ ...navBtn, color: view === "store" ? "#f8fafc" : "var(--text-dim)", background: view === "store" ? "rgba(114, 200, 191, 0.14)" : "transparent", padding: "10px 22px" }}
            >
              TIENDA
            </button>
          </div>

          {isStaff && (
            <button onClick={onOpenAdmin} style={{ ...navBtn, color: view === "admin" ? "#f8fafc" : "var(--text-dim)", borderBottom: view === "admin" ? "2px solid #ef4444" : "2px solid transparent", background: view === "admin" ? "rgba(239, 68, 68, 0.08)" : "transparent", padding: "9px 12px" }}>
              ADMIN
            </button>
          )}

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
                {roleLabel(currentUser.role)}
              </div>
            </div>
          </button>

          <button
            onClick={() => setShowLogoutModal(true)}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.34)", borderRadius: 10, color: "#f87171", cursor: "pointer", width: 38, height: 38, padding: 0, fontSize: 22, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", boxShadow: "0 0 14px rgba(239,68,68,0.08)" }}
          >
            ↪
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
        <Avatar letter={author?.avatar || "?"} role={author?.role || "user"} size={30} imageUrl={author?.avatarUrl} />
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
            <MarkdownText content={thread.title} inline />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
            <span style={{ color: "var(--text-muted)" }}>{author?.username}{author && <RoleMark role={author.role} />}</span> · {formatDate(thread.createdAt)} · {thread.visitorCount || 0} visitantes
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
    // Normativa orders oldest first (ascending), others newest first (descending)
    if (category === "normativa") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    }
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
  currentUser,
  setView,
  setSelectedThread,
  onSound,
  onSelectCategory,
  onOpenReportStatus,
  onOpenFactionSubforum,
}: {
  category: Category
  threads: Thread[]
  users: User[]
  currentUser: User
  setView: (v: View) => void
  setSelectedThread: (id: string) => void
  onSound: (type: "click" | "select" | "success" | "notification") => void
  onSelectCategory: (category: Category) => void
  onOpenReportStatus: (status: ThreadStatus) => void
  onOpenFactionSubforum: (subforum: ThreadSubforum) => void
}) {
  const color = CATEGORY_COLORS[category]

  const sortThreads = (list: Thread[], cat: Category) =>
    [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      // Normativa orders oldest first (ascending), others newest first (descending)
      if (cat === "normativa") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  const tabThreads = sortThreads(threads.filter((t) => t.category === category), category)
  const factionSubforums: ThreadSubforum[] = ["no_oficial", "oficial"]
  const factionThreads = tabThreads.filter((t) => t.category === "facciones")
  const factionFormatThread = factionThreads.find((thread) => thread.id === "t-rules-facciones-formato")
  const visibleThreads = tabThreads
  const reportSections = [
    { status: "abierto" as ThreadStatus, label: "Activos", description: "Reportes abiertos pendientes de una resolución.", color: "#f59e0b" },
    { status: "cerrado" as ThreadStatus, label: "Aceptados", description: "Todos los reportes aceptados y resueltos.", color: "#60a5fa" },
    { status: "en_revision" as ThreadStatus, label: "Rechazados", description: "Reportes revisados que no requieren más acciones.", color: "#ef4444" },
  ]
  const reportThreads = tabThreads.filter((thread) => thread.id !== "t-rules-reportes")
  const reportRulesThread = tabThreads.find((thread) => thread.id === "t-rules-reportes")

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "18px 14px 40px" }}>
      {category === "reportes" && (
        <div className="report-guidance" style={{ background: "rgba(15,23,42,0.7)", border: "1px solid rgba(230,126,34,0.35)", borderRadius: 16, padding: "14px 16px", marginBottom: 16, color: "var(--text-muted)", lineHeight: 1.7 }}>
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
        {(category !== "normativa" || currentUser.role === "admin") && category !== "facciones" && (
          <button
            className="forum-action forum-action-secondary"
            onClick={() => {
              onSelectCategory(category)
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
            {CATEGORY_THREAD_ACTIONS[category]}
          </button>
        )}
      </div>

      {category === "facciones" && (
        <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
          {factionFormatThread && (
            <button
              onClick={() => {
                setSelectedThread(factionFormatThread.id)
                setView("thread")
                onSound("select")
              }}
              style={{ display: "grid", gridTemplateColumns: "30px minmax(0, 1fr) 120px", alignItems: "center", gap: 14, width: "100%", padding: "16px 18px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 14, color: "var(--text)", cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ color: "#fbbf24", fontSize: 16 }}>📌</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <strong style={{ fontFamily: "Oswald, sans-serif", fontSize: 18, letterSpacing: "0.06em" }}>{factionFormatThread.title}</strong>
                <small style={{ color: "var(--text-dim)", fontSize: 12 }}>Formato fijo para presentar una facción. Solo lectura.</small>
              </span>
              <span style={{ color: "#fbbf24", fontFamily: "JetBrains Mono, monospace", fontSize: 10, textAlign: "right" }}>FIJADO</span>
            </button>
          )}
          {factionSubforums.map((subforum) => {
            const threadsForSubforum = factionThreads.filter((thread) => (thread.subforum || "no_oficial") === subforum)
            const pinnedThread = threadsForSubforum.find((thread) => thread.pinned)

            return (
              <button
                key={subforum}
                onClick={() => {
                  onOpenFactionSubforum(subforum)
                  onSound("select")
                }}
                style={{ display: "grid", gridTemplateColumns: "30px minmax(0, 1fr) 86px 120px", alignItems: "center", gap: 14, width: "100%", padding: "16px 18px", background: "rgba(15,23,42,0.7)", border: "1px solid var(--border)", borderRadius: 14, color: "var(--text)", cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ color: subforum === "oficial" ? "#60a5fa" : subforum === "no_oficial" ? "#22c55e" : "#fbbf24", fontSize: 18 }}>●</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <strong style={{ fontFamily: "Oswald, sans-serif", fontSize: 19, letterSpacing: "0.08em" }}>{FACTION_SUBFORUM_LABELS[subforum]}</strong>
                  <small style={{ color: "var(--text-dim)", fontSize: 12 }}>
                    {subforum === "formato" && "Formato fijo para presentar la facción. Solo lectura."}
                    {subforum === "no_oficial" && "Facciones sin aprobación oficial. Los usuarios pueden iniciar hilos aquí."}
                    {subforum === "oficial" && "Facciones aprobadas. Solo el staff puede mover hilos desde NO OFICIAL."}
                  </small>
                </span>
                <span style={{ color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", fontSize: 11, textAlign: "center" }}>{threadsForSubforum.length} HILOS</span>
                <span style={{ color: subforum === "no_oficial" ? "#86efac" : "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", fontSize: 10, textAlign: "right" }}>{subforum === "no_oficial" ? "PUBLICAR" : pinnedThread ? "FIJO" : "SOLO LECTURA"}</span>
              </button>
            )
          })}
        </div>
      )}

      {category !== "facciones" && <main style={{ width: "100%", background: "linear-gradient(180deg, rgba(13, 20, 30, 0.96), rgba(11, 17, 25, 0.9))", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden", boxShadow: "0 20px 40px rgba(2, 6, 23, 0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", background: "linear-gradient(90deg, rgba(17,24,39,0.9) 0%, rgba(15,23,32,0.7) 100%)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
            <div style={{ width: 5, height: 18, background: color, borderRadius: 999, boxShadow: `0 0 18px ${color}` }} />
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 18, letterSpacing: "0.08em", color: "var(--text)" }}>
              {category === "bugs" ? "BUGS" : category === "reportes" ? "REPORTES" : category === "historias" ? "HISTORIAS" : category === "facciones" ? "FACCIONES" : "NORMATIVA"}
            </div>
          </div>
        </div>

        {category === "reportes" && (
          <div className="report-directory">
            <div className="report-directory-head">
              <span>Foro</span>
              <span>Temas</span>
              <span>Mensajes</span>
              <span>Visitas</span>
              <span>Último mensaje</span>
            </div>
            {reportRulesThread && (
              <button
                className="report-directory-row report-directory-pinned"
                onClick={() => {
                  setSelectedThread(reportRulesThread.id)
                  setView("thread")
                  onSound("select")
                }}
                style={{ "--report-color": "#fbbf24" } as React.CSSProperties}
              >
                <span className="report-directory-icon">📌</span>
                <span className="report-directory-copy">
                  <strong>{reportRulesThread.title}</strong>
                  <small>Consulta obligatoria antes de publicar un reporte.</small>
                </span>
                <span>FIJO</span>
                <span>{reportRulesThread.replies.length}</span>
                <span>{reportRulesThread.visitorCount || 0}</span>
                <span className="report-directory-last">
                  <strong>Administración</strong>
                  <small>{formatDate(reportRulesThread.createdAt)}</small>
                </span>
              </button>
            )}
            {reportSections.map((section) => {
              const sectionThreads = reportThreads.filter((thread) => thread.status === section.status)
              const latestThread = sectionThreads[0]
              const latestAuthor = latestThread ? users.find((user) => user.id === latestThread.authorId) : undefined
              const messageCount = sectionThreads.reduce((total, thread) => total + thread.replies.length, 0)
              const visitorCount = sectionThreads.reduce((total, thread) => total + (thread.visitorCount || 0), 0)
              return (
                <button
                  key={section.status}
                  className="report-directory-row"
                  onClick={() => {
                    onOpenReportStatus(section.status)
                    onSound("select")
                  }}
                  style={{ "--report-color": section.color } as React.CSSProperties}
                >
                  <span className="report-directory-icon">●</span>
                  <span className="report-directory-copy">
                    <strong>{section.label}</strong>
                    <small>{section.description}</small>
                  </span>
                  <span>{sectionThreads.length}</span>
                  <span>{messageCount}</span>
                  <span>{visitorCount}</span>
                  <span className="report-directory-last">
                    {latestThread ? <><strong>{latestAuthor?.username || "Usuario"}</strong><small>{formatDate(latestThread.createdAt)}</small></> : <small>Sin actividad</small>}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div style={{ display: category === "reportes" ? "none" : "flex", flexDirection: "column" }}>
          {visibleThreads.length > 0 && (
            <div className="category-thread-head">
              <span>Foro</span>
              <span>Respuestas</span>
              <span>Estado</span>
              <span>Visitas</span>
              <span>Último mensaje</span>
            </div>
          )}
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
                    gridTemplateColumns: "minmax(0, 3.5fr) 0.6fr 0.7fr 0.7fr 1.1fr",
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
                        <span style={{ fontFamily: "Oswald, sans-serif", fontSize: 15, color: "var(--text)", letterSpacing: "0.02em" }}><MarkdownText content={thread.title} inline /></span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-dim)" }}>
                        por <span style={{ color: "var(--text-muted)" }}>{author?.username}{author && <RoleMark role={author.role} />}</span> · {formatDate(thread.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 15, color: "var(--text)", textAlign: "center" }}>{thread.replies.length}</div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 15, color: "var(--text)", textAlign: "center" }}>{category === "reportes" ? (thread.status === "cerrado" ? "0" : "1") : thread.status}</div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 15, color: "var(--text)", textAlign: "center" }}>{thread.visitorCount || 0}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                    <Avatar letter={lastAuthor?.avatar || author?.avatar || "?"} role={lastAuthor?.role || author?.role || "user"} size={24} imageUrl={lastAuthor?.avatarUrl || author?.avatarUrl} />
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
      </main>}
    </div>
  )
}

function ReportStatusView({
  status,
  threads,
  users,
  setView,
  setSelectedThread,
  onSound,
}: {
  status: ThreadStatus
  threads: Thread[]
  users: User[]
  setView: (view: View) => void
  setSelectedThread: (id: string) => void
  onSound: (type: "click" | "select" | "success" | "notification") => void
}) {
  const section = {
    cerrado: { label: "Aceptados", description: "Reportes aceptados y resueltos.", color: "#60a5fa" },
    en_revision: { label: "Rechazados", description: "Reportes revisados que no requieren más acciones.", color: "#ef4444" },
    abierto: { label: "Activos", description: "Reportes abiertos pendientes de resolución.", color: "#f59e0b" },
  }[status]
  const statusThreads = threads
    .filter((thread) => thread.category === "reportes" && thread.id !== "t-rules-reportes" && thread.status === status)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px" }}>
      <button
        onClick={() => {
          setView("category")
          onSound("click")
        }}
        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}
      >
        ← Volver a reportes
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 5, height: 26, background: section.color, borderRadius: 999, boxShadow: `0 0 18px ${section.color}` }} />
        <div>
          <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: 24, letterSpacing: "0.08em", color: "var(--text)", margin: 0 }}>{section.label.toUpperCase()}</h2>
          <div style={{ color: "var(--text-dim)", fontSize: 13 }}>{section.description}</div>
        </div>
      </div>
      <div className="report-directory" style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div className="report-directory-head">
          <span>Foro</span>
          <span>Temas</span>
          <span>Mensajes</span>
          <span>Visitas</span>
          <span>Último mensaje</span>
        </div>
        {statusThreads.length === 0 ? (
          <div style={{ padding: "28px 20px", textAlign: "center", color: "var(--text-dim)" }}>No hay reportes en este estado.</div>
        ) : (
          statusThreads.map((thread) => {
            const author = users.find((user) => user.id === thread.authorId)
            const lastReply = thread.replies[thread.replies.length - 1]
            const lastAuthor = lastReply ? users.find((user) => user.id === lastReply.authorId) : author
            return (
              <button
                key={thread.id}
                className="report-directory-row"
                onClick={() => {
                  setSelectedThread(thread.id)
                  setView("thread")
                  onSound("select")
                }}
                style={{ "--report-color": section.color } as React.CSSProperties}
              >
                <span className="report-directory-icon">●</span>
                <span className="report-directory-copy">
                  <strong><MarkdownText content={thread.title} inline /></strong>
                  <small>por {author?.username || "Usuario"} · {formatDate(thread.createdAt)} · {thread.visitorCount || 0} visitantes</small>
                </span>
                <span>{thread.replies.length}</span>
                <span>{STATUS_LABELS[thread.status]}</span>
                <span>{thread.visitorCount || 0}</span>
                <span className="report-directory-last">
                  <strong>{lastAuthor?.username || "Usuario"}</strong>
                  <small>{lastReply ? formatDate(lastReply.createdAt) : formatDate(thread.createdAt)}</small>
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function FactionSubforumView({
  subforum,
  threads,
  users,
  setView,
  setSelectedThread,
  onSound,
}: {
  subforum: ThreadSubforum
  threads: Thread[]
  users: User[]
  setView: (view: View) => void
  setSelectedThread: (id: string) => void
  onSound: (type: "click" | "select" | "success" | "notification") => void
}) {
  const descriptions: Record<ThreadSubforum, string> = {
    formato: "Formato fijo para presentar la facción. Solo lectura.",
    no_oficial: "Facciones sin aprobación oficial. Los usuarios pueden iniciar hilos aquí.",
    oficial: "Facciones aprobadas por el staff. Solo lectura.",
  }
  const subforumThreads = threads
    .filter((thread) => thread.category === "facciones" && (thread.subforum || "no_oficial") === subforum)
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  const isReadOnly = subforum !== "no_oficial"

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px" }}>
      <button
        onClick={() => {
          setView("category")
          onSound("click")
        }}
        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}
      >
        ← Volver a facciones
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 5, height: 26, background: "#22c55e", borderRadius: 999, boxShadow: "0 0 18px #22c55e" }} />
          <div>
            <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: 24, letterSpacing: "0.08em", color: "var(--text)", margin: 0 }}>{FACTION_SUBFORUM_LABELS[subforum]}</h2>
            <div style={{ color: "var(--text-dim)", fontSize: 13 }}>{descriptions[subforum]}</div>
          </div>
        </div>
        <button
          disabled={isReadOnly}
          onClick={() => {
            if (isReadOnly) return
            setView("new_thread")
            onSound("success")
          }}
          style={{ background: isReadOnly ? "rgba(15,23,42,0.25)" : "rgba(34,197,94,0.16)", border: `1px solid ${isReadOnly ? "var(--border)" : "rgba(34,197,94,0.5)"}`, borderRadius: 10, color: isReadOnly ? "var(--text-dim)" : "#86efac", cursor: isReadOnly ? "not-allowed" : "pointer", padding: "9px 13px", fontSize: 11, fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}
        >
          {isReadOnly ? "SOLO LECTURA" : "NUEVO HILO"}
        </button>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {subforumThreads.length > 0 && (
          <div className="faction-thread-head">
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span>Respuestas</span>
            <span>Visitas</span>
          </div>
        )}
        {subforumThreads.length === 0 ? (
          <div style={{ padding: "28px 20px", textAlign: "center", color: "var(--text-dim)" }}>
            {subforum === "oficial" ? "Todavía no hay facciones oficiales aprobadas." : "No hay hilos en este subforo todavía."}
          </div>
        ) : (
          subforumThreads.map((thread) => {
            const author = users.find((user) => user.id === thread.authorId)
            return (
              <button
                key={thread.id}
                onClick={() => {
                  setSelectedThread(thread.id)
                  setView("thread")
                  onSound("select")
                }}
                style={{ display: "grid", gridTemplateColumns: "30px minmax(0, 1fr) 110px 110px", alignItems: "center", gap: 14, width: "100%", padding: "15px 18px", background: thread.pinned ? "rgba(245,158,11,0.05)" : "transparent", border: 0, borderBottom: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ color: thread.pinned ? "#fbbf24" : "#22c55e", fontSize: 16 }}>{thread.pinned ? "📌" : "●"}</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <strong style={{ fontFamily: "Oswald, sans-serif", fontSize: 16, letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><MarkdownText content={thread.title} inline /></strong>
                  <small style={{ color: "var(--text-dim)", fontSize: 12 }}>por {author?.username || "Usuario"} · {formatDate(thread.createdAt)} · {thread.visitorCount || 0} visitantes</small>
                </span>
                <span style={{ color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", fontSize: 11, textAlign: "center" }}>{thread.replies.length} RESP.</span>
                <span style={{ color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", fontSize: 11, textAlign: "center" }}>{thread.visitorCount || 0}</span>
              </button>
            )
          })
        )}
      </div>
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
}: {
  threads: Thread[]
  users: User[]
  currentUser: User
  setView: (v: View) => void
  setSelectedThread: (id: string) => void
  onSound: (type: "click" | "select" | "success" | "notification") => void
  selectedCategory: Category
  onOpenCategory: (category: Category) => void
}) {
  return (
    <div className="forum-shell" style={{ maxWidth: 1360, margin: "0 auto", padding: "18px 14px 40px" }}>
      <div className="forum-hero">
        <div>
          <span className="forum-hero-kicker">ECLIPSE ORDER</span>
          <p>Comparte información, historias y decisiones que mantienen viva la comunidad.</p>
        </div>
      </div>
      <div className="forum-layout" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
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
          <div className="forum-sidebar-heading" style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", fontSize: 10, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            <span>General</span>
          </div>
          <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {CATEGORIES_ORDER.map((cat) => {
              const isActive = cat === selectedCategory
              const c = CATEGORY_COLORS[cat]
              const categoryThreads = threads.filter((t) => t.category === cat)
              const topicCount = categoryThreads.length
              const messageCount = categoryThreads.reduce((total, thread) => total + thread.replies.length, 0)

              return (
                <button
                  key={cat}
                  className="forum-category-button"
                  onClick={() => {
                    onOpenCategory(cat)
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
                  <div className="forum-category-stats">
                    <span><strong>{topicCount}</strong> <small>temas</small></span>
                    <span><strong>{messageCount}</strong> <small>mensajes</small></span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

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
  onBack,
  onSelectUser,
}: {
  currentUser: User
  users: User[]
  selectedUserId: string
  onSaveProfile: (userId: string, updates: Partial<User>) => Promise<void>
  onBack: () => void
  onSelectUser: (userId: string) => void
}) {
  const selectedUser = users.find((u) => u.id === selectedUserId) || currentUser
  const isOwnProfile = currentUser.id === selectedUser.id
  const [search, setSearch] = useState("")
  const [bio, setBio] = useState(selectedUser.bio || "")
  const [bannerUrl, setBannerUrl] = useState(selectedUser.bannerUrl || DEFAULT_BANNER_URL)
  const [pendingBannerUrl, setPendingBannerUrl] = useState<string>("")
  const [avatarUrl, setAvatarUrl] = useState(selectedUser.avatarUrl || "")
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileSaveMessage, setProfileSaveMessage] = useState("")
  const [copyMessage, setCopyMessage] = useState("")

  useEffect(() => {
    setBio(selectedUser.bio || "")
    setBannerUrl(selectedUser.bannerUrl || DEFAULT_BANNER_URL)
    setPendingBannerUrl("")
    setAvatarUrl(selectedUser.avatarUrl || "")
    setProfileSaveMessage("")
  }, [selectedUserId, selectedUser.bio, selectedUser.bannerUrl, selectedUser.avatarUrl])

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(search.toLowerCase())
  )

  const bannerBackground = bannerUrl && bannerUrl !== DEFAULT_BANNER_URL
    ? `url(${bannerUrl}) center/cover no-repeat`
    : `url(${DEFAULT_BANNER_URL}) center/cover no-repeat`

  const profileUser = {
    ...selectedUser,
    avatarUrl,
    bio,
    bannerUrl,
  }
  const rolePoints = selectedUser.rolePoints || 0
  const redeemedRolePoints = selectedUser.redeemedRolePoints || 0
  const canSeeRolePointDetails = isOwnProfile || currentUser.role === "admin"

  async function handleCopyProfileLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopyMessage("Enlace copiado")
    } catch {
      setCopyMessage("Copia la URL del navegador")
    }
    window.setTimeout(() => setCopyMessage(""), 2200)
  }

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
      setPendingBannerUrl(imageData)
      setBannerUrl(imageData)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }


  return (
    <div className="profile-view" style={{ maxWidth: 1100, margin: "0 auto", padding: "30px 20px 40px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
        ← Volver al foro
      </button>

      <div className="profile-page-heading">
        <div>
          <span>ARCHIVO DE SUPERVIVIENTE</span>
          <h1>Perfil</h1>
          <p>Configura la identidad con la que te reconocerá la comunidad.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={handleCopyProfileLink} style={{ ...primaryBtn, width: "auto", padding: "9px 13px", fontSize: 11 }}>
            Copiar enlace
          </button>
          {copyMessage && <span style={{ color: "var(--accent)", fontSize: 11 }}>{copyMessage}</span>}
          <div className="profile-page-mark">EO / {roleLabel(selectedUser.role)}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: 18 }}>
        <aside className="profile-directory" style={{ background: "rgba(15,23,42,0.7)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden" }}>
          <div className="profile-directory-heading" style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", fontSize: 10, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            <span>Directorio</span>
            <small>{users.length} PERFILES</small>
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
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{user.username}<RoleMark role={user.role} /></div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace" }}>{roleLabel(user.role)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="profile-main" style={{ background: "rgba(15,23,42,0.7)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden" }}>
          <div
            style={{
              height: 120,
              background: bannerBackground,
              position: "relative",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div className="profile-identity" style={{ position: "absolute", left: 24, bottom: -28, display: "flex", alignItems: "center", gap: 16 }}>
              <Avatar letter={profileUser.avatar} role={profileUser.role} size={72} imageUrl={profileUser.avatarUrl} />
              <div>
                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 26, letterSpacing: "0.06em", color: "#fff" }}>{profileUser.username}<RoleMark role={profileUser.role} /></div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.08em" }}>{roleLabel(profileUser.role)}</div>
              </div>
            </div>
          </div>

          <div className="profile-main-body" style={{ padding: "42px 22px 22px" }}>
            <div className="profile-points" style={{ marginBottom: 22, padding: "16px", borderRadius: 14, border: "1px solid rgba(245,158,11,0.3)", background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(15,23,42,0.45))" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div className="role-points-title" style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.1em", color: "#fbbf24", textTransform: "uppercase" }}>
                    Puntos de rol
                  </div>
                  <div style={{ marginTop: 4, fontFamily: "Oswald, sans-serif", fontSize: 28, color: "var(--text)" }}>
                    {rolePoints} puntos
                  </div>
                  {canSeeRolePointDetails && redeemedRolePoints > 0 && (
                    <div style={{ marginTop: 2, fontSize: 11, color: "var(--text-dim)" }}>
                      Puntos utilizados: {redeemedRolePoints}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {isOwnProfile ? (
              <>
                <div className="profile-section-heading">
                  <span>Personalización</span>
                  <small>IDENTIDAD VISUAL</small>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
                  <div>
                    <label style={labelStyle}>Logo / avatar</label>
                    <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px dashed var(--border)", borderRadius: 12, padding: "18px 12px", background: "rgba(15,23,42,0.5)", cursor: "pointer", color: "var(--text-muted)" }}>
                      <span>📷</span>
                      <span>Subir imagen</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                    </label>
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
                    onClick={async () => {
                      if (isSavingProfile) return
                      setIsSavingProfile(true)
                      setProfileSaveMessage("")
                      try {
                        const nextBannerUrl = pendingBannerUrl || (bannerUrl && bannerUrl !== DEFAULT_BANNER_URL ? bannerUrl : null)
                        await onSaveProfile(currentUser.id, {
                          avatarUrl,
                          bio,
                          bannerUrl: nextBannerUrl,
                        })
                        setPendingBannerUrl("")
                        setProfileSaveMessage("Perfil guardado correctamente.")
                      } catch (saveError) {
                        setProfileSaveMessage(saveError instanceof Error ? saveError.message : "No se pudo guardar el perfil.")
                      } finally {
                        setIsSavingProfile(false)
                      }
                    }}
                    disabled={isSavingProfile}
                    style={{ ...primaryBtn, width: "auto", padding: "12px 22px", opacity: isSavingProfile ? 0.65 : 1, cursor: isSavingProfile ? "wait" : "pointer" }}
                  >
                    {isSavingProfile ? "GUARDANDO..." : "GUARDAR PERFIL"}
                  </button>
                </div>
                {profileSaveMessage && (
                  <div className={profileSaveMessage === "Perfil guardado correctamente." ? "profile-save-success" : "profile-save-error"}>
                    {profileSaveMessage}
                  </div>
                )}
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
  const [contentText, setContentText] = useState("")
  const isReportMode = initialCategory === "reportes" || category === "reportes"
  const formCopy: Record<Category, { title: string; description: string }> = {
    bugs: {
      title: "Resume el fallo encontrado",
      description: "Explica qué ocurrió, cómo reproducirlo, dónde sucedió y qué esperabas que pasara.",
    },
    reportes: {
      title: "Indica el motivo del reporte",
      description: "Describe la situación con hechos concretos y añade evidencias si las tienes.",
    },
    historias: {
      title: "Título de la historia de tu personaje",
      description: "Cuenta el pasado, las motivaciones o un momento importante de tu personaje.",
    },
    facciones: {
      title: "Nombre de la facción o propuesta",
      description: "Presenta la idea, objetivos, integrantes y forma de participar en la facción.",
    },
    normativa: {
      title: "Título de la norma o consulta",
      description: "Explica la norma, el contexto y cualquier detalle que deba conocer la comunidad.",
    },
  }
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])
  const contentRef = useRef<HTMLDivElement>(null)

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
    if (contentText.trim().length < 20 && attachments.length === 0) { setError("Añade una descripción o adjunta al menos un archivo."); return }
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
      subforum: category === "facciones" ? "no_oficial" : undefined,
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
    <>
    {isSubmitting && <PostingOverlay />}
    <div style={{ maxWidth: 1050, margin: "0 auto", padding: "32px 20px" }}>
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

      <form onSubmit={handleSubmit} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "28px 28px" }}>
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
            placeholder={formCopy[category].title}
          />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Descripción</label>
          <div className="visual-editor-shell">
            <VisualEditor editorRef={contentRef} onChange={(html, text) => { setContent(html); setContentText(text) }} />
            <MarkdownToolbar editorRef={contentRef} onInsertImage={(file) => {
              const reader = new FileReader()
              reader.onload = () => {
                contentRef.current?.focus()
                document.execCommand("insertImage", false, String(reader.result))
                setContent(contentRef.current?.innerHTML || "")
              }
              reader.readAsDataURL(file)
            }} />
          </div>
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
              border: "1px dashed var(--border)",
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
                  style={{ position: "relative", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg)" }}
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
          <button type="button" onClick={goBack} style={{ ...primaryBtn, background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            CANCELAR
          </button>
        </div>
      </form>
    </div>
    </>
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
  onEditReply,
  onAddRolePoints,
  onStatusChange,
  onPinToggle,
  onDeleteThread,
  onDeleteReply,
  onMoveFactionThread,
  onAddFactionRolePoints,
  onClaimFactionRolePoints,
  goBack,
}: {
  threadId: string
  threads: Thread[]
  users: User[]
  currentUser: User
  onReply: (threadId: string, content: string, attachments: Attachment[], mentionedUserIds?: string[]) => Promise<void> | void
  onEditThread: (threadId: string, title: string, content: string) => void
  onEditReply: (threadId: string, replyId: string, content: string) => Promise<void> | void
  onAddRolePoints: (userId: string, amount: number) => void
  onStatusChange: (threadId: string, status: ThreadStatus) => void
  onPinToggle: (threadId: string) => void
  onDeleteThread: (threadId: string) => void
  onDeleteReply: (threadId: string, replyId: string) => void
  onMoveFactionThread: (threadId: string, targetSubforum: ThreadSubforum) => void
  onAddFactionRolePoints: (threadId: string, amount: number) => void
  onClaimFactionRolePoints: (threadId: string) => void
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null)
  const [editReplyContent, setEditReplyContent] = useState("")
  const [isSavingReply, setIsSavingReply] = useState(false)

  useEffect(() => {
    if (!thread) return
    void supabase.from("thread_views").upsert(
      { thread_id: thread.id, user_id: currentUser.id },
      { onConflict: "thread_id,user_id", ignoreDuplicates: true },
    )
  }, [currentUser.id, thread?.id])

  if (!thread) return null

  const author = users.find((u) => u.id === thread.authorId)
  const isStaff = currentUser.role !== "user"
  const canEditThread = thread.category === "historias" && currentUser.id === thread.authorId
  const canDeleteThread = currentUser.id === thread.authorId || currentUser.role === "admin"
  const canAddThreadRolePoints = thread.category === "historias" && currentUser.role === "admin"
  const isFactionReadOnly = thread.category === "facciones" && (thread.subforum === "formato" || thread.subforum === "oficial")
  const canReply = !isFactionReadOnly && thread.category !== "normativa" && !thread.adminOnly && (thread.status === "abierto" || thread.status === "en_revision" || isStaff)
  const canMoveFactionThread = currentUser.role === "admin" && thread.category === "facciones" && thread.subforum !== "oficial"
  const factionRolePoints = thread.factionRolePoints || 0
  const canManageFactionPoints = currentUser.role === "admin" && thread.category === "facciones"
  const canClaimFactionPoints = currentUser.id === thread.authorId && factionRolePoints > 0 && !thread.factionRolePointsClaimed

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

  function handleAddFactionRolePoints() {
    const amount = Number(pointsToAdd)
    if (!Number.isInteger(amount) || amount < 1) return
    onAddFactionRolePoints(thread.id, amount)
    setPointsToAdd("")
  }

  function startEditingReply(reply: Reply) {
    setEditingReplyId(reply.id)
    setEditReplyContent(reply.content)
  }

  async function handleEditReplySubmit(e: React.FormEvent, replyId: string) {
    e.preventDefault()
    if (isSavingReply || editReplyContent.trim().length < 5) return
    setIsSavingReply(true)
    try {
      await onEditReply(thread.id, replyId, editReplyContent.trim())
      setEditingReplyId(null)
      setEditReplyContent("")
    } finally {
      setIsSavingReply(false)
    }
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

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    if (thread.category === "normativa") {
      setError("No se pueden añadir respuestas en la sección de Normativa.")
      return
    }
    if (thread.category === "facciones" && (thread.subforum === "formato" || thread.subforum === "oficial")) {
      setError("Este subforo es de solo lectura. Para publicar una facción usa el subforo NO OFICIAL.")
      return
    }
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
    setIsSubmitting(true)
    try {
      await onReply(thread!.id, finalContent, attachments, mentionedUserIds)
      setReplyContent("")
      setAttachments([])
      setMentionedUserIds([])
      setMentionQuery("")
      setError("")
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo publicar la respuesta.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const statuses: ThreadStatus[] = ["abierto", "en_revision", "cerrado"]
  const mentionList = users.filter((user) =>
    user.id !== currentUser.id &&
    user.username.toLowerCase().includes(mentionQuery.toLowerCase())
  )

  return (
    <>
    {isSubmitting && <PostingOverlay />}
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
      <button onClick={goBack} className="store-back">
        ← VOLVER
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
                <MarkdownText content={thread.title} inline />
              </h1>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Avatar letter={author?.avatar || "?"} role={author?.role || "user"} size={28} imageUrl={author?.avatarUrl} />
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                <strong style={{ color: "var(--text)" }}>{author?.username}{author && <RoleMark role={author.role} />}</strong> · {formatDate(thread.createdAt)}
                {thread.editedAt && <span style={{ color: "var(--text-dim)", fontStyle: "italic" }}> · EDITADO</span>}
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

        {(canEditThread || canAddThreadRolePoints || canDeleteThread || canManageFactionPoints || canClaimFactionPoints) && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {canMoveFactionThread && (
              <button
                onClick={() => onMoveFactionThread(thread.id, "oficial")}
                style={{
                  ...primaryBtn,
                  width: "auto",
                  padding: "8px 12px",
                  fontSize: 11,
                  background: "linear-gradient(135deg, rgba(34,197,94,0.22), rgba(20,83,45,0.22))",
                  border: "1px solid rgba(34,197,94,0.5)",
                  color: "#86efac",
                  boxShadow: "none",
                }}
              >
                MOVER A OFICIAL
              </button>
            )}
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
            {canManageFactionPoints && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "#72c8bf", fontFamily: "JetBrains Mono, monospace" }}>PDR FACCIONARIO</span>
                <input type="number" min="1" value={pointsToAdd} onChange={(e) => setPointsToAdd(e.target.value)} placeholder="Cantidad" style={{ ...inputStyle, width: 100, padding: "8px 9px", fontSize: 11 }} />
                <button onClick={handleAddFactionRolePoints} disabled={!pointsToAdd} style={{ ...primaryBtn, width: "auto", padding: "8px 12px", fontSize: 11, background: "linear-gradient(135deg, #4dd8df, #147d8a)", opacity: pointsToAdd ? 1 : 0.5 }}>ASIGNAR AL HILO</button>
              </div>
            )}
            {canClaimFactionPoints && (
              <button onClick={() => onClaimFactionRolePoints(thread.id)} style={{ ...primaryBtn, width: "auto", padding: "8px 12px", fontSize: 11, background: "linear-gradient(135deg, #e6a23c, #a85d1a)" }}>
                RECLAMAR {factionRolePoints} PDR FACCIONARIO
              </button>
            )}
            {canDeleteThread && currentUser.role !== "admin" && (
              <button onClick={() => onDeleteThread(thread.id)} style={{ ...primaryBtn, width: "auto", padding: "8px 12px", fontSize: 11, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5", boxShadow: "none" }}>
                ELIMINAR PUBLICACIÓN
              </button>
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
          {isEditing ? "Revisa el contenido en el formulario superior antes de guardar." : <MarkdownText content={thread.content} />}
        </div>
        {thread.category === "facciones" && (
          <div style={{ marginTop: 18, padding: "13px 15px", border: "1px solid rgba(77,216,223,0.3)", borderRadius: 10, background: "linear-gradient(135deg, rgba(77,216,223,0.1), rgba(10,22,35,0.7))", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", fontSize: 10, letterSpacing: "0.08em" }}>PUNTOS DE ROL FACCIONARIO · SOLO EN ESTE HILO</span>
            <strong style={{ color: "#8cecf0", fontFamily: "Oswald, sans-serif", fontSize: 18 }}>{factionRolePoints} PDR {thread.factionRolePointsClaimed ? "· RECLAMADOS" : ""}</strong>
          </div>
        )}

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
                      width: "auto",
                      maxWidth: "100%",
                      height: "auto",
                      maxHeight: 520,
                      objectFit: "contain",
                      margin: "0 auto",
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Avatar letter={replyAuthor?.avatar || "?"} role={replyAuthor?.role || "user"} size={26} imageUrl={replyAuthor?.avatarUrl} />
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      <strong style={{ color: reply.isStaff ? "#3498db" : "var(--text)" }}>
                        {replyAuthor?.username}<RoleMark role={replyAuthor?.role || "user"} />
                      </strong>
                      {reply.isStaff && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: "#3498db", fontFamily: "JetBrains Mono, monospace" }}>
                          [STAFF]
                        </span>
                      )}
                      {" "}· {formatDate(reply.createdAt)}
                      {reply.editedAt && <span style={{ color: "var(--text-dim)", fontStyle: "italic" }}> · EDITADO</span>}
                    </div>
                    </div>
                    {reply.authorId === currentUser.id && (
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => startEditingReply(reply)} style={{ ...primaryBtn, width: "auto", background: "transparent", border: "1px solid var(--border2)", color: "var(--text-muted)", boxShadow: "none", padding: "5px 8px", fontSize: 9 }}>
                          EDITAR
                        </button>
                        <button onClick={() => onDeleteReply(thread.id, reply.id)} style={{ background: "transparent", border: "1px solid rgba(239,68,68,0.32)", borderRadius: 6, color: "#fca5a5", cursor: "pointer", padding: "5px 8px", fontSize: 9, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.06em" }}>
                          ELIMINAR
                        </button>
                      </div>
                    )}
                  </div>
                  {editingReplyId === reply.id ? (
                    <form onSubmit={(event) => void handleEditReplySubmit(event, reply.id)} style={{ display: "grid", gap: 8 }}>
                      <textarea value={editReplyContent} onChange={(event) => setEditReplyContent(event.target.value)} style={{ ...inputStyle, minHeight: 100, resize: "vertical" } as React.CSSProperties} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="submit" disabled={isSavingReply || editReplyContent.trim().length < 5} style={{ ...primaryBtn, width: "auto", padding: "8px 12px", fontSize: 10, opacity: isSavingReply ? 0.65 : 1 }}>
                          {isSavingReply ? "GUARDANDO..." : "GUARDAR"}
                        </button>
                        <button type="button" onClick={() => setEditingReplyId(null)} disabled={isSavingReply} style={{ ...primaryBtn, width: "auto", padding: "8px 12px", fontSize: 10, background: "transparent", border: "1px solid var(--border2)", color: "var(--text-muted)", boxShadow: "none" }}>
                          CANCELAR
                        </button>
                      </div>
                    </form>
                  ) : reply.content && (
                    <div style={{ color: "var(--text-muted)", lineHeight: 1.7, fontSize: 14, whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                      <MarkdownText content={reply.content} />
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
                              style={{ display: "block", maxWidth: "100%", width: "auto", height: "auto", maxHeight: 420, objectFit: "contain", margin: "0 auto" }}
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
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "20px 24px" }}>
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
                    style={{ position: "relative", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg)" }}
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
              <button type="submit" disabled={isSubmitting} style={{ ...primaryBtn, width: "auto", display: "inline-block", opacity: isSubmitting ? 0.65 : 1, cursor: isSubmitting ? "wait" : "pointer" }}>
                {isSubmitting ? "PUBLICANDO..." : "RESPONDER"}
              </button>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
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
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 24px", color: "var(--text-dim)", fontSize: 13, textAlign: "center" }}>
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
  redemptions,
  currentUser,
  onStatusChange,
  onPinToggle,
  onDeleteThread,
  onRoleChange,
  onAddRolePoints,
  onContactUser,
  onToggleSuspend,
  onDeleteUser,
  setView,
  setSelectedThread,
}: {
  threads: Thread[]
  users: User[]
  redemptions: StoreRedemption[]
  currentUser: User
  onStatusChange: (threadId: string, status: ThreadStatus) => void
  onPinToggle: (threadId: string) => void
  onDeleteThread: (threadId: string) => void
  onRoleChange: (userId: string, role: Role) => void
  onAddRolePoints: (userId: string, amount: number) => void
  onContactUser: (userId: string, message: string) => void
  onToggleSuspend: (userId: string) => void
  onDeleteUser: (userId: string) => void
  setView: (v: View) => void
  setSelectedThread: (id: string) => void
}) {
  const [tab, setTab] = useState<"threads" | "users" | "redemptions">("threads")
  const [pointsToAdd, setPointsToAdd] = useState<Record<string, string>>({})
  const [contactMessages, setContactMessages] = useState<Record<string, string>>({})
  const [userSearch, setUserSearch] = useState("")
  const filteredUsers = users.filter((user) => user.username.toLowerCase().includes(userSearch.trim().toLowerCase()))

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
        {[{ id: "threads", label: "Gestión de Hilos" }, { id: "users", label: "Gestión de Usuarios" }, { id: "redemptions", label: "Canjes" }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as "threads" | "users" | "redemptions")}
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
                    <MarkdownText content={thread.title} inline />
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
                      border: "1px solid var(--border)",
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
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Buscar usuario por nombre..."
              aria-label="Buscar usuario por nombre"
              style={{ ...inputStyle, flex: 1, padding: "10px 13px", fontSize: 12 }}
            />
            <span style={{ color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", fontSize: 10, whiteSpace: "nowrap" }}>
              {filteredUsers.length}/{users.length}
            </span>
          </div>
          {filteredUsers.length === 0 ? (
            <div style={{ padding: "28px 18px", textAlign: "center", color: "var(--text-dim)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
              No se encontraron usuarios con ese nombre.
            </div>
          ) : filteredUsers.map((user) => (
            <div
              key={user.id}
              className="admin-user-row"
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
                <Avatar letter={user.avatar} role={user.role} size={36} imageUrl={user.avatarUrl} />
                <div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 500, fontSize: 15, color: "var(--text)" }}>
                    {user.username}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace" }}>
                    Registrado: {user.joinedAt} · Puntos de rol: {user.rolePoints || 0} · {user.suspended ? "CUENTA SUSPENDIDA" : "CUENTA ACTIVA"}
                  </div>
                </div>
              </div>
              <div className="admin-user-actions" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 }}>
                <Badge
                  label={roleLabel(user.role)}
                  color={user.role === "admin" ? "#e74c3c" : user.role === "moderator" ? "#3498db" : "var(--text-muted)"}
                />
                {currentUser.role === "admin" && user.id !== currentUser.id && (
                  <>
                    <select
                      value={user.role}
                      onChange={(e) => onRoleChange(user.id, e.target.value as Role)}
                      style={{
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
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
                    <button
                      onClick={() => onToggleSuspend(user.id)}
                      style={{ ...primaryBtn, width: "auto", padding: "6px 9px", fontSize: 10, boxShadow: "none", background: user.suspended ? "rgba(39,174,96,0.16)" : "rgba(245,158,11,0.16)", border: `1px solid ${user.suspended ? "#27ae60" : "#f59e0b"}`, color: user.suspended ? "#86efac" : "#fbbf24" }}
                    >
                      {user.suspended ? "REACTIVAR" : "SUSPENDER"}
                    </button>
                    <button
                      onClick={() => onDeleteUser(user.id)}
                      className="admin-delete-user"
                      style={{ ...primaryBtn, width: "auto", maxWidth: "100%", padding: "6px 9px", fontSize: 10, boxShadow: "none", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5", whiteSpace: "normal" }}
                    >
                      ELIMINAR CUENTA
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "redemptions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {redemptions.length === 0 ? (
            <div style={{ padding: "30px 18px", textAlign: "center", color: "var(--text-dim)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
              Todavía no hay productos canjeados.
            </div>
          ) : [...redemptions].reverse().map((redemption) => (
            <div key={redemption.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", alignItems: "center", gap: 18, padding: "15px 18px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "var(--text)", fontFamily: "Oswald, sans-serif", fontSize: 16, letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{redemption.productTitle}</div>
                <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 3 }}>Canjeado por <strong style={{ color: "var(--highlight)" }}>{redemption.username}</strong></div>
              </div>
              <div style={{ color: "#ffe7a3", fontFamily: "JetBrains Mono, monospace", fontSize: 12, whiteSpace: "nowrap" }}>{redemption.price} PDR</div>
              <div style={{ color: "var(--text-dim)", fontFamily: "JetBrains Mono, monospace", fontSize: 10, textAlign: "right", whiteSpace: "nowrap" }}>{formatDate(redemption.createdAt)}</div>
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
  const initialRouteRef = useRef<RouteState>(routeFromLocation())
  const [users, setUsers] = useState<User[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([])
  const [redemptions, setRedemptions] = useState<StoreRedemption[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [view, setView] = useState<View>(initialRouteRef.current.view === "forum" ? "login" : initialRouteRef.current.view)
  const [selectedThread, setSelectedThread] = useState<string>(initialRouteRef.current.threadId || "")
  const [selectedProfileId, setSelectedProfileId] = useState<string>(initialRouteRef.current.profileId || "")
  const [selectedCategory, setSelectedCategory] = useState<Category>(initialRouteRef.current.category || "reportes")
  const [selectedReportStatus, setSelectedReportStatus] = useState<ThreadStatus>(initialRouteRef.current.reportStatus || "abierto")
  const [selectedFactionSubforum, setSelectedFactionSubforum] = useState<ThreadSubforum>(initialRouteRef.current.factionSubforum || "no_oficial")
  const [authReady, setAuthReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const currentUserRef = useRef<User | null>(null)
  const notificationCountRef = useRef<{ userId: string; count: number } | null>(null)
  const navigationHistoryRef = useRef<NavigationSnapshot[]>([])
  const lastNavigationRef = useRef<NavigationSnapshot | null>(null)
  const restoringNavigationRef = useRef(false)

  useEffect(() => {
    const handlePopState = () => {
      const route = routeFromLocation()
      setView(route.view)
      setSelectedThread(route.threadId || "")
      setSelectedProfileId(route.profileId || "")
      if (route.category) setSelectedCategory(route.category)
      if (route.reportStatus) setSelectedReportStatus(route.reportStatus)
      if (route.factionSubforum) setSelectedFactionSubforum(route.factionSubforum)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  useEffect(() => {
    const nextPath = pathFromState(view, selectedProfileId, selectedThread, selectedCategory, selectedReportStatus, selectedFactionSubforum)
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath)
    }
  }, [view, selectedProfileId, selectedThread, selectedCategory, selectedReportStatus, selectedFactionSubforum])

  useEffect(() => {
    if (!authReady) return

    const currentNavigation: NavigationSnapshot = {
      view,
      profileId: selectedProfileId || undefined,
      threadId: selectedThread || undefined,
      category: selectedCategory,
      reportStatus: selectedReportStatus,
      factionSubforum: selectedFactionSubforum,
    }
    const previousNavigation = lastNavigationRef.current
    if (restoringNavigationRef.current) {
      restoringNavigationRef.current = false
    } else if (previousNavigation && previousNavigation.view !== currentNavigation.view) {
      navigationHistoryRef.current.push(previousNavigation)
    }
    lastNavigationRef.current = currentNavigation
  }, [authReady, view, selectedProfileId, selectedThread, selectedCategory, selectedReportStatus, selectedFactionSubforum])

  const playInteractionSound = useCallback((type: "click" | "select" | "success" | "notification") => {
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return

    const audioCtx = new AudioCtor()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()

    const frequencies = {
      click: 180,
      select: 260,
      success: 420,
      notification: 620,
    }
    const durations = {
      click: 0.14,
      select: 0.18,
      success: 0.2,
      notification: 0.28,
    }
    const duration = durations[type]

    oscillator.type = "sine"
    oscillator.frequency.value = frequencies[type]
    gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime)
    gainNode.gain.linearRampToValueAtTime(type === "notification" ? 0.026 : type === "success" ? 0.022 : 0.014, audioCtx.currentTime + 0.02)

    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)

    oscillator.start()
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration)
    oscillator.stop(audioCtx.currentTime + duration)

    setTimeout(() => audioCtx.close(), duration * 1000 + 30)
  }, [])

  async function hydrateSession(userId: string) {
    setIsLoading(true)
    try {
      let { data: profileRow, error: profileError } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()

      if (profileError && profileError.code !== "PGRST116") {
        throw profileError
      }

      if (!profileRow) {
        const fallbackUsername = `Usuario ${userId.slice(0, 6)}`
        const insertResult = await supabase
          .from("profiles")
          .upsert(
            {
              id: userId,
              username: fallbackUsername,
              avatar: fallbackUsername.charAt(0).toUpperCase(),
              role: "user",
              joined_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          )
          .select("*")
          .single()

        if (insertResult.error) {
          throw insertResult.error
        }

        profileRow = insertResult.data
      }

      const [forum] = await Promise.all([
        loadSupabaseForum(),
      ])

      const profile = mapProfile(profileRow as ProfileRow)
      setUsers(forum.users)
      setThreads(forum.threads)
      setCurrentUser(profile)
      const initialRoute = initialRouteRef.current
      if (!currentUserRef.current && initialRoute.view === "profile" && initialRoute.profileId) {
        setSelectedProfileId(initialRoute.profileId)
        setView("profile")
      } else if (!currentUserRef.current && initialRoute.view === "thread" && initialRoute.threadId) {
        setSelectedThread(initialRoute.threadId)
        setView("thread")
      } else if (!currentUserRef.current && initialRoute.view !== "forum") {
        setView(initialRoute.view)
      } else if (!currentUserRef.current) {
        setSelectedProfileId(profile.id)
        setView("forum")
      }
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
    setStoreProducts(readStoreProducts())
    setRedemptions(readStoreRedemptions())
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

    void restoreSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (!session) {
        setCurrentUser(null)
        setUsers([])
        setThreads([])
        setView("login")
      } else if (!currentUserRef.current || currentUserRef.current.id !== session.user.id) {
        void hydrateSession(session.user.id).catch((sessionError) => {
          console.error("Could not load Supabase profile", sessionError)
        })
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    currentUserRef.current = currentUser
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) {
      notificationCountRef.current = null
      return
    }

    const count = currentUser.notifications?.filter((notification) => !notification.read).length || 0
    const previous = notificationCountRef.current
    notificationCountRef.current = { userId: currentUser.id, count }

    if (previous?.userId === currentUser.id && count > previous.count) {
      playInteractionSound("notification")
    }
  }, [currentUser, playInteractionSound])

  useEffect(() => {
    if (currentUser) {
      setSelectedProfileId((profileId) => profileId || currentUser.id)
    }
  }, [currentUser])

  async function handleLogin(characterName: string, password: string) {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: authEmailForCharacter(characterName),
      password,
    })
    if (error) throw new Error(error.message)

    if (authData.session?.user?.id) {
      setView("forum")
      await hydrateSession(authData.session.user.id)
    }
  }

  async function handleRegister(username: string, password: string) {
    const { data: authData, error } = await supabase.auth.signUp({
      email: authEmailForCharacter(username),
      password,
      options: { data: { username } },
    })
    if (error) throw new Error(error.message)

    if (authData.session?.user?.id) {
      setView("forum")
      await hydrateSession(authData.session.user.id)
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()
    if (error) console.error("Could not sign out from Supabase", error)
  }

  function handleCreateProduct(product: StoreProduct) {
    if (currentUser?.role !== "admin") return
    const nextProducts = [...storeProducts, product]
    setStoreProducts(nextProducts)
    localStorage.setItem(STORE_PRODUCTS_STORAGE_KEY, JSON.stringify(nextProducts))
  }

  function handleRedeemProduct(product: StoreProduct) {
    if (!currentUser) return
    const balance = Math.max(0, (currentUser.rolePoints || 0) - (currentUser.redeemedRolePoints || 0))
    if (balance < product.price || currentUser.ownedProductIds?.includes(product.id)) return
    const updatedUser = {
      ...currentUser,
      redeemedRolePoints: (currentUser.redeemedRolePoints || 0) + product.price,
      ownedProductIds: [...(currentUser.ownedProductIds || []), product.id],
    }
    const nextUsers = users.map((user) => user.id === updatedUser.id ? updatedUser : user)
    localStorage.setItem(LOCAL_USERS_STORAGE_KEY, JSON.stringify(nextUsers))
    setUsers(nextUsers)
    setCurrentUser(updatedUser)

    const redemption: StoreRedemption = {
      id: uid(),
      userId: updatedUser.id,
      username: updatedUser.username,
      productId: product.id,
      productTitle: product.title,
      price: product.price,
      createdAt: new Date().toISOString(),
    }
    const nextRedemptions = [...redemptions, redemption]
    localStorage.setItem(STORE_REDEMPTIONS_STORAGE_KEY, JSON.stringify(nextRedemptions))
    setRedemptions(nextRedemptions)
  }

  function handleToggleSuspend(userId: string) {
    if (currentUser?.role !== "admin" || userId === currentUser.id) return
    const user = readLocalUsers().find((item) => item.id === userId)
    if (!user) return
    const action = user.suspended ? "reactivar" : "suspender"
    if (!window.confirm(`¿Seguro que quieres ${action} la cuenta de ${user.username}?`)) return
    const nextUsers = readLocalUsers().map((item) => item.id === userId ? { ...item, suspended: !item.suspended } : item)
    localStorage.setItem(LOCAL_USERS_STORAGE_KEY, JSON.stringify(nextUsers))
    setUsers(nextUsers)
  }

  function handleDeleteUser(userId: string) {
    if (currentUser?.role !== "admin" || userId === currentUser.id) return
    const user = readLocalUsers().find((item) => item.id === userId)
    if (!user || !window.confirm(`¿Eliminar permanentemente la cuenta de ${user.username}? Esta acción no se puede deshacer.`)) return
    const nextUsers = readLocalUsers().filter((item) => item.id !== userId)
    localStorage.setItem(LOCAL_USERS_STORAGE_KEY, JSON.stringify(nextUsers))
    setUsers(nextUsers)
    setThreads((previousThreads) => previousThreads.filter((thread) => thread.authorId !== userId).map((thread) => ({ ...thread, replies: thread.replies.filter((reply) => reply.authorId !== userId) })))
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
    if (!currentUser) return
    if (thread.category === "normativa" && currentUser.role !== "admin") return
    if (thread.category === "facciones") {
      const subforum = thread.subforum || "no_oficial"
      if (subforum === "formato" || subforum === "oficial") {
        throw new Error("No puedes publicar directamente en FORMATO u OFICIAL. Usa NO OFICIAL y luego un administrador puede moverlo.")
      }
    }
    const contentWithUploadedImages = await uploadInlineImages(thread.content, `inline/${currentUser.id}/${crypto.randomUUID()}`)
    const threadPayload = {
      title: thread.title,
      category: thread.category,
      author_id: currentUser.id,
      content: contentWithUploadedImages,
      status: thread.status,
      pinned: thread.pinned || false,
      admin_only: thread.adminOnly || false,
      ...(thread.category === "facciones" ? { subforum: thread.subforum || "no_oficial" } : {}),
    }
    const { data: createdThread, error } = await supabase.from("threads").insert(threadPayload).select().single()
    if (error || !createdThread) {
      console.error("Could not create thread", error)
      throw new Error(error?.message || "No se pudo crear el hilo.")
    }
    if (thread.attachments && thread.attachments.length > 0) {
      const uploadedAttachments = await Promise.all(
        thread.attachments.map((attachment) => uploadAttachment(attachment, `threads/${createdThread.id}`))
      )
      const { error: attachmentsError } = await supabase.from("thread_attachments").insert(
        uploadedAttachments.map((attachment) => ({
          thread_id: createdThread.id,
          name: attachment.name,
          type: attachment.type,
          storage_path: attachment.storage_path,
        }))
      )
      if (attachmentsError) throw new Error(attachmentsError.message)
    }
    await refreshForumState()
    if (thread.category === "reportes") {
      setSelectedThread(createdThread.id)
      setView("thread")
    } else {
      setView("forum")
    }
  }

  async function handleEditThread(threadId: string, title: string, content: string) {
    if (!currentUser) return
    const { error } = await supabase.from("threads").update({ title, content, edited_at: new Date().toISOString() }).eq("id", threadId).eq("author_id", currentUser.id)
    if (error) console.error("Could not edit thread", error)
    else await refreshForumState()
  }

  async function handleEditReply(threadId: string, replyId: string, content: string) {
    if (!currentUser || content.trim().length < 5) return
    const { error } = await supabase
      .from("replies")
      .update({ content: content.trim(), edited_at: new Date().toISOString() })
      .eq("id", replyId)
      .eq("thread_id", threadId)
      .eq("author_id", currentUser.id)
    if (error) throw new Error(error.message)
    await refreshForumState()
  }

  async function handleReply(threadId: string, content: string, _attachments: Attachment[], _mentionedUserIds: string[] = []) {
    if (!currentUser) return
    const targetThread = threads.find((thread) => thread.id === threadId)
    if (!targetThread || targetThread.adminOnly || targetThread.category === "normativa") return
    if (targetThread.category === "facciones" && (targetThread.subforum === "formato" || targetThread.subforum === "oficial")) return
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
      const uploadedAttachments = await Promise.all(
        _attachments.map((attachment) => uploadAttachment(attachment, `replies/${createdReply.id}`))
      )
      const { error: attachmentsError } = await supabase.from("reply_attachments").insert(
        uploadedAttachments.map((attachment) => ({
          reply_id: createdReply.id,
          name: attachment.name,
          type: attachment.type,
          storage_path: attachment.storage_path,
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

  async function handleMoveFactionThread(threadId: string, targetSubforum: ThreadSubforum) {
    const thread = threads.find((item) => item.id === threadId)
    if (!thread || thread.category !== "facciones") return
    const { error } = await supabase.from("threads").update({ subforum: targetSubforum }).eq("id", threadId)
    if (error) console.error("Could not move faction thread", error)
    else await refreshForumState()
  }

  async function handleAddFactionRolePoints(threadId: string, amount: number) {
    if (currentUser?.role !== "admin" || amount < 1) return
    const thread = threads.find((item) => item.id === threadId)
    if (!thread || thread.category !== "facciones") return
    const { error } = await supabase.from("threads").update({ faction_role_points: (thread.factionRolePoints || 0) + amount }).eq("id", threadId)
    if (error) console.error("Could not add faction role points", error)
    else await refreshForumState()
  }

  async function handleClaimFactionRolePoints(threadId: string) {
    if (!currentUser) return
    const thread = threads.find((item) => item.id === threadId)
    if (!thread || thread.category !== "facciones" || thread.authorId !== currentUser.id || thread.factionRolePointsClaimed || !thread.factionRolePoints) return
    const { error } = await supabase.from("threads").update({ faction_role_points_claimed: true }).eq("id", threadId).eq("author_id", currentUser.id)
    if (error) console.error("Could not claim faction role points", error)
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
    const thread = threads.find((item) => item.id === threadId)
    if (!thread || (currentUser?.role !== "admin" && thread.authorId !== currentUser?.id)) return
    if (thread.id === "t-rules-historias" || thread.id === "t-rules-reportes" || thread.id === "t-rules-facciones-formato") return
    if (!window.confirm("¿Seguro que quieres eliminar este hilo? Esta acción no se puede deshacer.")) return
    const { error } = await supabase.from("threads").delete().eq("id", threadId)
    if (error) {
      console.error("Could not delete thread", error)
      return
    }
    await refreshForumState()
    setView("forum")
  }

  function handleDeleteReply(threadId: string, replyId: string) {
    const thread = threads.find((item) => item.id === threadId)
    const reply = thread?.replies.find((item) => item.id === replyId)
    if (!thread || !reply || reply.authorId !== currentUser?.id) return
    if (!window.confirm("¿Seguro que quieres eliminar esta respuesta? Esta acción no se puede deshacer.")) return
    setThreads((previousThreads) => previousThreads.map((item) => item.id === threadId ? { ...item, replies: item.replies.filter((entry) => entry.id !== replyId) } : item))
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

  function handleOpenReportStatus(status: ThreadStatus) {
    setSelectedReportStatus(status)
    setView("report_status")
  }

  function handleOpenFactionSubforum(subforum: ThreadSubforum) {
    setSelectedFactionSubforum(subforum)
    setSelectedCategory("facciones")
    setView("faction_subforum")
  }

  async function handleSaveProfile(userId: string, updates: Partial<User>) {
    const { error } = await supabase.from("profiles").update({
      avatar_url: updates.avatarUrl,
      bio: updates.bio,
      banner_url: updates.bannerUrl,
    }).eq("id", userId)
    if (error) throw new Error(error.message)
    await hydrateSession(userId)
  }

  async function handleClearNotifications() {
    if (!currentUser) return
    const { error } = await supabase.from("notifications").delete().eq("user_id", currentUser.id)
    if (error) console.error("Could not clear notifications", error)
    else await hydrateSession(currentUser.id)
  }

  function handleGoBack() {
    const previousNavigation = navigationHistoryRef.current.pop()
    if (!previousNavigation) {
      setView("forum")
      return
    }

    restoringNavigationRef.current = true
    setSelectedProfileId(previousNavigation.profileId || "")
    setSelectedThread(previousNavigation.threadId || "")
    setSelectedCategory(previousNavigation.category)
    setSelectedReportStatus(previousNavigation.reportStatus)
    setSelectedFactionSubforum(previousNavigation.factionSubforum)
    setView(previousNavigation.view)
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
        onOpenProfile={handleOpenProfile}
        onClearNotifications={handleClearNotifications}
        onOpenAdmin={() => setView("admin")}
      />

      {view === "store" && (
        <StoreView
          currentUser={currentUser}
          threads={threads}
          products={storeProducts}
          onCreateProduct={handleCreateProduct}
          onRedeemProduct={handleRedeemProduct}
          onBack={handleGoBack}
        />
      )}
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
          currentUser={currentUser}
          setView={setView}
          setSelectedThread={setSelectedThread}
          onSound={playInteractionSound}
          onSelectCategory={handleOpenCategory}
          onOpenReportStatus={handleOpenReportStatus}
          onOpenFactionSubforum={handleOpenFactionSubforum}
        />
      )}
      {view === "report_status" && (
        <ReportStatusView
          status={selectedReportStatus}
          threads={threads}
          users={users}
          setView={setView}
          setSelectedThread={setSelectedThread}
          onSound={playInteractionSound}
        />
      )}
      {view === "faction_subforum" && (
        <FactionSubforumView
          subforum={selectedFactionSubforum}
          threads={threads}
          users={users}
          setView={setView}
          setSelectedThread={setSelectedThread}
          onSound={playInteractionSound}
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
          onEditReply={handleEditReply}
          onAddRolePoints={handleAddRolePoints}
          onStatusChange={handleStatusChange}
          onPinToggle={handlePinToggle}
          onDeleteThread={handleDeleteThread}
          onDeleteReply={handleDeleteReply}
          onMoveFactionThread={handleMoveFactionThread}
          onAddFactionRolePoints={handleAddFactionRolePoints}
          onClaimFactionRolePoints={handleClaimFactionRolePoints}
          goBack={handleGoBack}
        />
      )}
      {view === "new_thread" && (
        <NewThreadView
          currentUser={currentUser}
          users={users}
          onSubmit={handleNewThread}
          goBack={handleGoBack}
          initialCategory={selectedCategory}
        />
      )}
      {view === "profile" && (
        <ProfileView
          currentUser={currentUser}
          users={users}
          selectedUserId={selectedProfileId || currentUser.id}
          onSaveProfile={handleSaveProfile}
          onBack={handleGoBack}
          onSelectUser={(userId) => setSelectedProfileId(userId)}
        />
      )}
      {view === "admin" && currentUser.role !== "user" && (
        <AdminView
          threads={threads}
          users={users}
          redemptions={redemptions}
          currentUser={currentUser}
          onStatusChange={handleStatusChange}
          onPinToggle={handlePinToggle}
          onDeleteThread={handleDeleteThread}
          onRoleChange={handleRoleChange}
          onAddRolePoints={handleAddRolePoints}
          onContactUser={handleContactUser}
          onToggleSuspend={handleToggleSuspend}
          onDeleteUser={handleDeleteUser}
          setView={setView}
          setSelectedThread={setSelectedThread}
        />
      )}
    </div>
  )
}
