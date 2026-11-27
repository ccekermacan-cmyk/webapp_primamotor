package id.primamotor.pos.domain

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset

class WibDateTest {

    @Test
    fun wib_day_uses_asia_jakarta_not_device_zone() {
        assertEquals(LocalDate.of(2026, 10, 18), WibDate.dayOf("2026-10-17T20:00:00.000Z"))
    }

    @Test
    fun wib_day_without_zone_is_treated_as_utc() {
        assertEquals(LocalDate.of(2026, 10, 18), WibDate.dayOf("2026-10-17 20:00:00.000"))
    }

    @Test
    fun wib_day_parses_pocketbase_datetime_with_z() {
        assertEquals(LocalDate.of(2026, 11, 27), WibDate.dayOf("2026-11-27 10:00:00.000Z"))
    }

    @Test
    fun day_of_blank_is_null() {
        assertEquals(null, WibDate.dayOf(""))
        assertEquals(null, WibDate.dayOf(null))
    }

    @Test
    fun now_iso_is_utc_with_millis() {
        val parsed = java.time.Instant.parse(WibDate.nowIso())
        assertEquals(ZoneOffset.UTC, parsed.atOffset(ZoneOffset.UTC).offset)
    }

    @Test
    fun start_of_day_iso_is_wib_midnight_in_utc() {
        assertEquals("2026-10-17T17:00:00.000Z", WibDate.startOfDayIso(LocalDate.of(2026, 10, 18)))
    }
}