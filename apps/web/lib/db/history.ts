import type { TranslationRecord } from '@mindyourlanguage/shared'
import { query } from '@/lib/db'
import {
  recordToTranslationRow,
  translationRowToRecord,
  type TranslationRow,
} from '@/lib/db/mappers'
import { HISTORY_MAX } from '@/lib/stores/history'

export async function listHistory(userId: string): Promise<TranslationRecord[]> {
  const rows = await query<TranslationRow>(
    `SELECT id, user_id, source_text, source_lang, target_lang, translation,
            traditional, pinyin, character_set, native_alternative, register,
            native_note, dictionary_matches, segments, created_at
     FROM translations
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, HISTORY_MAX],
  )
  return rows.map(translationRowToRecord)
}

export async function upsertHistory(
  userId: string,
  items: TranslationRecord[],
): Promise<TranslationRecord[]> {
  const capped = items.slice(0, HISTORY_MAX)

  for (const item of capped) {
    const row = recordToTranslationRow(item)
    await query(
      `INSERT INTO translations (
         id, user_id, source_text, source_lang, target_lang, translation,
         traditional, pinyin, character_set, native_alternative, register,
         native_note, dictionary_matches, segments, created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13::jsonb, $14::jsonb, $15::timestamptz
       )
       ON CONFLICT (id) DO UPDATE SET
         source_text = EXCLUDED.source_text,
         source_lang = EXCLUDED.source_lang,
         target_lang = EXCLUDED.target_lang,
         translation = EXCLUDED.translation,
         traditional = EXCLUDED.traditional,
         pinyin = EXCLUDED.pinyin,
         character_set = EXCLUDED.character_set,
         native_alternative = EXCLUDED.native_alternative,
         register = EXCLUDED.register,
         native_note = EXCLUDED.native_note,
         dictionary_matches = EXCLUDED.dictionary_matches,
         segments = EXCLUDED.segments,
         created_at = EXCLUDED.created_at
       WHERE translations.user_id = EXCLUDED.user_id`,
      [
        row.id,
        userId,
        row.source_text,
        row.source_lang,
        row.target_lang,
        row.translation,
        row.traditional,
        row.pinyin,
        row.character_set,
        row.native_alternative,
        row.register,
        row.native_note,
        JSON.stringify(row.dictionary_matches),
        JSON.stringify(row.segments),
        row.created_at ?? item.createdAt,
      ],
    )
  }

  await query(
    `DELETE FROM translations
     WHERE user_id = $1
       AND id NOT IN (
         SELECT id FROM translations
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       )`,
    [userId, HISTORY_MAX],
  )

  return listHistory(userId)
}
