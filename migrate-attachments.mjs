import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error("Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY antes de ejecutar el script.")
}

const supabase = createClient(url, serviceRoleKey)
const attachmentBucket = "forum-attachments"
const profileBucket = "profile-media"

async function migrateProfileMedia() {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, banner_url")

  if (error) throw error
  console.log(`profiles: ${profiles.length} perfiles revisados`)

  for (const profile of profiles) {
    const updates = {}
    for (const kind of ["avatar", "banner"]) {
      const column = `${kind}_url`
      const value = profile[column]
      if (!value?.startsWith("data:")) continue

      const match = value.match(/^data:([^;]+);base64,(.+)$/s)
      if (!match) {
        console.warn(`Omitido profiles/${profile.id}/${kind}: Base64 no válido`)
        continue
      }

      const [, contentType, encodedData] = match
      const extension = contentType.split("/")[1]?.replace("jpeg", "jpg") || "bin"
      const path = `profiles/${profile.id}/${kind}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from(profileBucket)
        .upload(path, Buffer.from(encodedData, "base64"), { contentType, upsert: true })

      if (uploadError) throw uploadError
      updates[column] = supabase.storage.from(profileBucket).getPublicUrl(path).data.publicUrl
      console.log(`Migrado: ${profile.username} ${kind}`)
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase.from("profiles").update(updates).eq("id", profile.id)
      if (updateError) throw updateError
    }
  }
}

async function migrateTable(table, parentColumn, folder) {
  const { data: rows, error } = await supabase
    .from(table)
    .select(`id, ${parentColumn}, name, type, data_url, storage_path`)
    .not("data_url", "is", null)
    .is("storage_path", null)

  if (error) throw error
  console.log(`${table}: ${rows.length} archivos pendientes`)

  for (const row of rows) {
    const match = row.data_url.match(/^data:([^;]+);base64,(.+)$/s)
    if (!match) {
      console.warn(`Omitido ${table}/${row.id}: data_url no es Base64 válido`)
      continue
    }

    const [, contentType, encodedData] = match
    const extension = contentType.split("/")[1]?.replace("jpeg", "jpg") || "bin"
    const path = `legacy/${folder}/${row[parentColumn]}/${row.id}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from(attachmentBucket)
      .upload(path, Buffer.from(encodedData, "base64"), { contentType, upsert: false })

    if (uploadError) throw uploadError

    const { error: updateError } = await supabase
      .from(table)
      .update({ storage_path: path, data_url: null })
      .eq("id", row.id)

    if (updateError) throw updateError
    console.log(`Migrado: ${table}/${row.id}`)
  }
}

async function migrateInlineImages(table) {
  const { data: rows, error } = await supabase
    .from(table)
    .select("id, content")
    .or("content.like.%data:image/%,content.like.%media.discordapp.net%,content.like.%cdn.discordapp.com%")

  if (error) throw error
  console.log(`${table}: ${rows.length} contenidos con imágenes Base64`)

  for (const row of rows) {
    let content = row.content
    let migratedCount = 0
    const imageTags = content.match(/<img\b[^>]*>/gi) || []

    for (const imageTag of imageTags) {
      const sourceMatch = imageTag.match(/\bsrc=(['"])((?:data:image\/[^;]+;base64,.*?|https?:\/\/(?:media\.discordapp\.net|cdn\.discordapp\.com)\/[^"']+))\1/i)
      if (!sourceMatch) continue

      const [, quote, source] = sourceMatch
      let contentType
      let imageData
      const dataMatch = source.match(/^data:([^;]+);base64,(.+)$/s)
      if (dataMatch) {
        contentType = dataMatch[1]
        imageData = Buffer.from(dataMatch[2], "base64")
      } else {
        const discordSource = source.replace(/&amp;/g, "&")
        const response = await fetch(discordSource)
        if (!response.ok) {
          console.warn(`Omitida imagen de Discord no disponible: ${response.status} ${discordSource}`)
          continue
        }
        contentType = response.headers.get("content-type")?.split(";")[0] || "image/png"
        imageData = Buffer.from(await response.arrayBuffer())
      }
      const extension = contentType.split("/")[1]?.replace("jpeg", "jpg") || "bin"
      const path = `legacy/inline/${table}/${row.id}/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from(attachmentBucket)
        .upload(path, imageData, { contentType, upsert: false })

      if (uploadError) throw uploadError

      const publicUrl = supabase.storage.from(attachmentBucket).getPublicUrl(path).data.publicUrl
      content = content.replace(source, publicUrl)
      migratedCount += 1
    }

    if (migratedCount > 0) {
      const { error: updateError } = await supabase.from(table).update({ content }).eq("id", row.id)
      if (updateError) throw updateError
      console.log(`Migradas ${migratedCount} imágenes en ${table}/${row.id}`)
    }
  }
}

await migrateProfileMedia()
await migrateInlineImages("threads")
await migrateInlineImages("replies")
console.log("Migración completada")
