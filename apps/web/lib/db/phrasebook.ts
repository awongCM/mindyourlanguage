import type { PhrasebookEntry } from '@mindyourlanguage/shared'
import { query } from '@/lib/db'
import {
  entryToPhrasebookRow,
  phrasebookRowToEntry,
  type PhrasebookRow,
} from '@/lib/db/mappers'

export async function listPhrasebook(userId: string): Promise<PhrasebookEntry[]> {
  const rows = await query<PhrasebookRow>(
    `SELECT id, user_id, translation_id, source_text, source_lang, target_lang,
            translation, traditional, pinyin, character_set, register,
            native_alternative, native_note, dictionary_matches, segments,
            practice_stats, tags, notes, created_at
     FROM phrasebook
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  )
  return rows.map(phrasebookRowToEntry)
}

export async function upsertPhrasebook(
  userId: string,
  items: PhrasebookEntry[],
): Promise<PhrasebookEntry[]> {
  for (const item of items) {
    const row = entryToPhrasebookRow(item)
    await query(
      `INSERT INTO phrasebook (
         id, user_id, translation_id, source_text, source_lang, target_lang,
         translation, traditional, pinyin, character_set, register,
         native_alternative, native_note, dictionary_matches, segments,
         practice_stats, tags, notes, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13, $14::jsonb, $15::jsonb,
         $16::jsonb, $17, $18, $19::timestamptz, now()
       )
       ON CONFLICT (id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         translation_id = EXCLUDED.translation_id,
         source_text = EXCLUDED.source_text,
         source_lang = EXCLUDED.source_lang,
         target_lang = EXCLUDED.target_lang,
         translation = EXCLUDED.translation,
         traditional = EXCLUDED.traditional,
         pinyin = EXCLUDED.pinyin,
         character_set = EXCLUDED.character_set,
         register = EXCLUDED.register,
         native_alternative = EXCLUDED.native_alternative,
         native_note = EXCLUDED.native_note,
         dictionary_matches = EXCLUDED.dictionary_matches,
         segments = EXCLUDED.segments,
         practice_stats = EXCLUDED.practice_stats,
         tags = EXCLUDED.tags,
         notes = EXCLUDED.notes,
         created_at = EXCLUDED.created_at,
         updated_at = now()`,
      [
        row.id,
        userId,
        row.translation_id,
        row.source_text,
        row.source_lang,
        row.target_lang,
        row.translation,
        row.traditional,
        row.pinyin,
        row.character_set,
        row.register,
        row.native_alternative,
        row.native_note,
        JSON.stringify(row.dictionary_matches),
        JSON.stringify(row.segments),
        row.practice_stats ? JSON.stringify(row.practice_stats) : null,
        row.tags,
        row.notes,
        row.created_at ?? item.createdAt,
      ],
    )
  }

  return listPhrasebook(userId)
}
