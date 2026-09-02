import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const threadId = "d7e26851-c09d-4832-a6ea-68e3bf4cffe5"
const bucket = "forum-attachments"

const replacementUrls = [
  "https://cdn.discordapp.com/attachments/1541512426154098748/1542321515264081940/image.png?ex=6a996018&is=6a980e98&hm=6d1c1fc1d7f124680a4372bdb350be9b83694ebd9bd75513aeb74928230f3a52",
  "https://cdn.discordapp.com/attachments/1541512426154098748/1542321618385248397/image.png?ex=6a996030&is=6a980eb0&hm=d2c4c786e530ee56baf1a09f7fbfdef378635a1b30c2d40ae8ba6fd258651982",
  "https://cdn.discordapp.com/attachments/1541512426154098748/1542321704121008249/image.png?ex=6a996045&is=6a980ec5&hm=bc0665c329aa7804ad1e08320c1b57659e224f4e4cb0bca8941ca94038779443",
  "https://cdn.discordapp.com/attachments/1541512426154098748/1542321943330422855/image.png?ex=6a99607e&is=6a980efe&hm=6bab8730902be266fdd1482aae2fc6fb9463d186e2fe5d7a2b7ff640c443f42d",
  "https://cdn.discordapp.com/attachments/1541512426154098748/1542322268586246224/image.png?ex=6a9960cb&is=6a980f4b&hm=71ebd22e96c6dee94fa80e8dc5356ef6479b07c7ea5a7ed7916da6ef0491a279",
  "https://cdn.discordapp.com/attachments/1541512426154098748/1542322354074558485/image.png?ex=6a9960e0&is=6a980f60&hm=0c5fac2cd0bc1e252625790523417b3f886964f44d6ecf5ed27650858fc202ad",
  "https://cdn.discordapp.com/attachments/1541512426154098748/1542322612389154986/image.png?ex=6a99611d&is=6a980f9d&hm=8fab2dadba20962e72b456b566457cf2a48bb45e781422790cddc7df94c82981",
  "https://cdn.discordapp.com/attachments/1541512426154098748/1542322672757641277/image.png?ex=6a99612c&is=6a980fac&hm=46240daf01b16e7a669fc45301c5c7041b6d0b64757ebabeeabd8fba5506e974",
  "https://cdn.discordapp.com/attachments/1541512426154098748/1542322748263501854/image.png?ex=6a99613e&is=6a980fbe&hm=0fcbf46663ec50c233cd0afb111b15b38d47213d41ae02b81a3a449b45e1d489",
]

const previousDiscordAttachmentIds = [
  "1542317639488245800", "1542318010499342437", "1542318273398575105", "1542318775695835136", "1542318865705607188",
  "1542319069867548713", "1542319334368481291", "1542319624467648623", "1542319847482851369", "1542320057571483698",
  "1542320058229858354", "1542320871274709024", "1542320939398598728", "1542321066062389398", "1542321203254132847",
]

if (!url || !serviceRoleKey) throw new Error("Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY antes de ejecutar el script.")

const supabase = createClient(url, serviceRoleKey)
const discordPattern = /https?:\/\/(?:media\.discordapp\.net|cdn\.discordapp\.com)\/[^"'\s<>]+/i
const imageTagPattern = /<img\b[^>]*>/gi

const { data: replies, error: repliesError } = await supabase
  .from("replies")
  .select("id, content, created_at")
  .eq("thread_id", threadId)
  .order("created_at", { ascending: true })

if (repliesError) throw repliesError

let replacementIndex = 0
for (const reply of replies || []) {
  let content = reply.content
  let changed = false

  for (const imageTag of content.match(imageTagPattern) || []) {
    if (replacementIndex >= replacementUrls.length) break
    const sourceMatch = imageTag.match(/\bsrc=(['"])(.*?)\1/i)
    if (!sourceMatch || !discordPattern.test(sourceMatch[2])) continue
    if (previousDiscordAttachmentIds.some((attachmentId) => sourceMatch[2].includes(`/${attachmentId}/`))) continue

    const sourceUrl = replacementUrls[replacementIndex]
    const response = await fetch(sourceUrl)
    if (!response.ok) throw new Error(`No se pudo descargar la imagen ${replacementIndex + 1}: HTTP ${response.status}`)

    const contentType = response.headers.get("content-type")?.split(";")[0] || "image/png"
    const extension = contentType.split("/")[1]?.replace("jpeg", "jpg") || "png"
    const path = `legacy/discord/replies/${reply.id}/${String(replacementIndex + 1).padStart(2, "0")}.${extension}`
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, Buffer.from(await response.arrayBuffer()), { contentType, upsert: true })
    if (uploadError) throw uploadError

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
    content = content.replace(sourceMatch[2], publicUrl)
    replacementIndex += 1
    changed = true
  }

  if (changed) {
    const { error: updateError } = await supabase.from("replies").update({ content }).eq("id", reply.id)
    if (updateError) throw updateError
    console.log(`Actualizada reply ${reply.id}`)
  }
}

console.log(`Migradas ${replacementIndex} de ${replacementUrls.length} imágenes nuevas.`)