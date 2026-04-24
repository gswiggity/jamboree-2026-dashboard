function parseTimestamp(t: string): number | null {
  if (/^\d+$/.test(t)) return parseInt(t, 10)
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  if (!m) return null
  const h = parseInt(m[1] || "0", 10)
  const min = parseInt(m[2] || "0", 10)
  const s = parseInt(m[3] || "0", 10)
  const total = h * 3600 + min * 60 + s
  return total > 0 ? total : null
}

export function toYouTubeEmbed(raw: string): string | null {
  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./i, "").toLowerCase()
    let id: string | null = null
    if (host === "youtu.be") {
      id = u.pathname.replace(/^\//, "").split("/")[0] || null
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      if (u.pathname === "/watch") id = u.searchParams.get("v")
      else if (u.pathname.startsWith("/embed/")) id = u.pathname.slice(7).split("/")[0]
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.slice(8).split("/")[0]
      else if (u.pathname.startsWith("/live/")) id = u.pathname.slice(6).split("/")[0]
    }
    if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) return null
    const tRaw = u.searchParams.get("t") ?? u.searchParams.get("start")
    const start = tRaw ? parseTimestamp(tRaw) : null
    const base = `https://www.youtube-nocookie.com/embed/${id}`
    return start != null ? `${base}?start=${start}` : base
  } catch {
    return null
  }
}

export function toVimeoEmbed(raw: string): string | null {
  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./i, "").toLowerCase()
    if (host === "vimeo.com") {
      const parts = u.pathname.split("/").filter(Boolean)
      const id = parts[0]
      const hash = parts[1]
      if (!id || !/^\d+$/.test(id)) return null
      if (hash && /^[a-f0-9]+$/i.test(hash)) {
        return `https://player.vimeo.com/video/${id}?h=${hash}`
      }
      return `https://player.vimeo.com/video/${id}`
    }
    if (host === "player.vimeo.com") {
      const parts = u.pathname.split("/").filter(Boolean)
      const idx = parts.indexOf("video")
      const id = idx >= 0 ? parts[idx + 1] : null
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`
    }
    return null
  } catch {
    return null
  }
}

export function toInstagramEmbed(raw: string): string | null {
  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./i, "").toLowerCase()
    if (host !== "instagram.com") return null
    const parts = u.pathname.split("/").filter(Boolean)
    // /p/{id}, /reel/{id}, /reels/{id}, /tv/{id}
    const kindIdx = parts.findIndex((p) =>
      p === "p" || p === "reel" || p === "reels" || p === "tv",
    )
    if (kindIdx < 0) return null
    const kind = parts[kindIdx] === "reels" ? "reel" : parts[kindIdx]
    const id = parts[kindIdx + 1]
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null
    return `https://www.instagram.com/${kind}/${id}/embed/`
  } catch {
    return null
  }
}

export function toTikTokEmbed(raw: string): string | null {
  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./i, "").toLowerCase()
    if (host !== "tiktok.com") return null
    // /@{user}/video/{id} or /embed/v2/{id}
    const parts = u.pathname.split("/").filter(Boolean)
    const videoIdx = parts.indexOf("video")
    const id = videoIdx >= 0 ? parts[videoIdx + 1] : null
    if (!id || !/^\d+$/.test(id)) return null
    return `https://www.tiktok.com/embed/v2/${id}`
  } catch {
    return null
  }
}

export function toGoogleDriveEmbed(raw: string): string | null {
  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./i, "").toLowerCase()
    if (host !== "drive.google.com") return null
    const parts = u.pathname.split("/").filter(Boolean)
    // /file/d/{id}/(view|edit|preview)
    if (parts[0] === "file" && parts[1] === "d" && parts[2]) {
      const id = parts[2]
      if (!/^[A-Za-z0-9_-]+$/.test(id)) return null
      return `https://drive.google.com/file/d/${id}/preview`
    }
    // /open?id={id}
    if (parts[0] === "open") {
      const id = u.searchParams.get("id")
      if (id && /^[A-Za-z0-9_-]+$/.test(id)) {
        return `https://drive.google.com/file/d/${id}/preview`
      }
    }
    return null
  } catch {
    return null
  }
}

export function toEmbedUrl(raw: string): string | null {
  return (
    toYouTubeEmbed(raw) ??
    toVimeoEmbed(raw) ??
    toInstagramEmbed(raw) ??
    toTikTokEmbed(raw) ??
    toGoogleDriveEmbed(raw)
  )
}

export function looksLikeUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s)
}
