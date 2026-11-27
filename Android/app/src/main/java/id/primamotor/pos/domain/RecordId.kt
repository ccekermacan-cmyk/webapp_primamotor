package id.primamotor.pos.domain

import java.security.SecureRandom

/** ID record 15 karakter `[a-z0-9]`, sama dengan `createRecordId` di web. */
object RecordId {
    private const val ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
    private val random = SecureRandom()

    fun create(length: Int = 15): String {
        val chars = CharArray(length) { ALPHABET[random.nextInt(ALPHABET.length)] }
        return String(chars)
    }
}