package id.primamotor.pos.domain

import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/** Tanggal laporan selalu dihitung di WIB, bukan zona perangkat. */
object WibDate {
    val WIB: ZoneId = ZoneId.of("Asia/Jakarta")

    private val ISO_MILLIS: DateTimeFormatter =
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC)

    fun dayOf(raw: String?): LocalDate? = parseInstant(raw)?.atZone(WIB)?.toLocalDate()

    fun nowIso(): String = ISO_MILLIS.format(Instant.now())

    fun isoOf(instant: Instant): String = ISO_MILLIS.format(instant.truncatedTo(ChronoUnit.MILLIS))

    fun startOfDayIso(date: LocalDate): String = isoOf(date.atStartOfDay(WIB).toInstant())

    fun endOfDayIso(date: LocalDate): String = isoOf(date.plusDays(1).atStartOfDay(WIB).toInstant().minusMillis(1))

    /** Input tanpa zona dianggap UTC, sama seperti `localDate` di ledger web. */
    fun parseInstant(raw: String?): Instant? {
        if (raw.isNullOrBlank()) return null
        val trimmed = raw.trim()
        return runCatching { Instant.parse(trimmed) }.getOrNull()
            ?: runCatching { LocalDateTime.parse(trimmed.replace(' ', 'T')).toInstant(ZoneOffset.UTC) }.getOrNull()
    }
}