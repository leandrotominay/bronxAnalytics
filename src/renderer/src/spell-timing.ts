type ChampionDefinition = {
  id: string
  name: string
}

export type FlashChatMention = {
  messageKey: string
  champion: ChampionDefinition
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
}

export function findFlashChatMentions(
  text: string,
  champions: ChampionDefinition[]
): FlashChatMention[] {
  const mentions: FlashChatMention[] = []
  const messageLines: string[] = []
  for (const line of text.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
    if (/^\d{1,2}[:.]\d{2}\b/.test(line) || messageLines.length === 0) {
      messageLines.push(line)
    } else {
      messageLines[messageLines.length - 1] += ` ${line}`
    }
  }

  for (const line of messageLines) {
    const flashMatch = line.match(/\bflash\b/i)
    if (!flashMatch || flashMatch.index === undefined) continue
    const textBeforeFlash = normalize(line.slice(0, flashMatch.index))
    const champion = champions
      .filter((entry) =>
        textBeforeFlash.endsWith(normalize(entry.name)) ||
        textBeforeFlash.endsWith(normalize(entry.id))
      )
      .sort((left, right) => normalize(right.name).length - normalize(left.name).length)[0]
    if (!champion) continue
    mentions.push({
      messageKey: normalize(line),
      champion
    })
  }
  return mentions
}
