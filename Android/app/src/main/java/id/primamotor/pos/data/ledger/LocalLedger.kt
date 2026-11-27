package id.primamotor.pos.data.ledger

import java.math.BigDecimal

/**
 * Cermin aturan `Backend/pb_hooks/lib/atomic_ledger.js`.
 * Hanya untuk tampilan dan pencegahan dini saat offline; server tetap otoritatif.
 * ID akun/user/person sudah diresolusi pemanggil dari `local_record`.
 */
data class CashflowEntry(
    val account1: String,
    val account2: String = "",
    val nominal: BigDecimal,
    val mutasi: String,
    val jenis: String = "",
)

data class StockEntry(
    val itemId: String,
    val qty: BigDecimal,
    val direction: String,
)

data class BonEntry(
    val nominal: BigDecimal,
    val jenis: String,
    val personId: String = "",
    val userId: String = "",
)

internal fun mergeDeltas(a: Map<String, BigDecimal>, b: Map<String, BigDecimal>): Map<String, BigDecimal> {
    val result = a.toMutableMap()
    b.forEach { (key, value) -> result[key] = (result[key] ?: BigDecimal.ZERO).add(value) }
    return result.filterValues { it.signum() != 0 }
}

/** Delta bertanda: positif menambah, negatif mengurangi. */
data class Deltas(val values: Map<String, BigDecimal>) {
    operator fun plus(other: Deltas): Deltas = Deltas(mergeDeltas(values, other.values))
    fun scaled(factor: Int): Deltas = Deltas(values.mapValues { it.value.multiply(BigDecimal(factor)) })

    companion object {
        val EMPTY = Deltas(emptyMap())
    }
}

object LocalLedger {

    fun cashDeltas(entry: CashflowEntry?): Deltas {
        if (entry == null) return Deltas.EMPTY
        val amount = entry.nominal.abs()
        val out = entry.mutasi.lowercase() in setOf("out", "keluar")
        val values = mutableMapOf<String, BigDecimal>()
        if (entry.account1.isNotEmpty()) {
            values[entry.account1] = if (out) amount.negate() else amount
        }
        if (out && entry.account2.isNotEmpty() && entry.jenis.lowercase().contains("transfer")) {
            values[entry.account2] = (values[entry.account2] ?: BigDecimal.ZERO).add(amount)
        }
        return Deltas(values)
    }

    /** old dibalik, current diterapkan. Hapus = current null. Buat = old null. */
    fun cashEffect(old: CashflowEntry?, current: CashflowEntry?): Deltas =
        cashDeltas(old).scaled(-1) + cashDeltas(current)

    fun stockDeltas(entry: StockEntry?): Deltas {
        if (entry == null || entry.itemId.isEmpty()) return Deltas.EMPTY
        val signed = if (entry.direction.lowercase() == "in") entry.qty.abs() else entry.qty.abs().negate()
        return Deltas(mapOf(entry.itemId to signed))
    }

    fun stockEffect(old: StockEntry?, current: StockEntry?): Deltas =
        stockDeltas(old).scaled(-1) + stockDeltas(current)

    fun bonDeltas(entry: BonEntry?): Deltas {
        if (entry == null) return Deltas.EMPTY
        val factor = if (entry.jenis.lowercase() == "out") BigDecimal.ONE else BigDecimal(-1)
        val delta = entry.nominal.abs().multiply(factor)
        val values = mutableMapOf<String, BigDecimal>()
        if (entry.personId.isNotEmpty()) values["person:${entry.personId}"] = delta
        if (entry.userId.isNotEmpty()) values["user:${entry.userId}"] = delta
        return Deltas(values)
    }

    fun bonEffect(old: BonEntry?, current: BonEntry?): Deltas =
        bonDeltas(old).scaled(-1) + bonDeltas(current)

    /** Gabung dua peta delta, menjumlahkan nilai yang sama. */
    fun merge(a: Map<String, BigDecimal>, b: Map<String, BigDecimal>): Map<String, BigDecimal> =
        mergeDeltas(a, b)
}