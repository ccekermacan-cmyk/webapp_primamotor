package id.primamotor.pos.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RecordIdTest {

    @Test
    fun record_id_is_15_lower_alphanumeric() {
        assertTrue(RecordId.create().matches(Regex("[a-z0-9]{15}")))
    }

    @Test
    fun record_id_respects_custom_length() {
        assertEquals(20, RecordId.create(20).length)
    }

    @Test
    fun record_ids_do_not_repeat_in_a_small_batch() {
        val ids = List(500) { RecordId.create() }
        assertEquals(500, ids.toSet().size)
    }
}