package id.primamotor.pos.domain

import java.math.BigDecimal

/** Aturan pelunasan cepat nota tempo, sama seperti `openQuickSettleTransaction` di web. */
object Settlement {

    fun remaining(total: BigDecimal, paid: BigDecimal): BigDecimal {
        val left = total - paid
        return if (left.signum() < 0) BigDecimal.ZERO else left
    }

    fun error(total: BigDecimal, paid: BigDecimal, amount: BigDecimal): String? {
        if (amount.signum() <= 0) return "Nominal pelunasan harus lebih dari 0."
        if (remaining(total, paid).signum() == 0) return "Nota ini sudah lunas."
        if (amount > remaining(total, paid)) return "Nominal melebihi sisa tagihan."
        return null
    }

    fun statusAfter(total: BigDecimal, paid: BigDecimal, amount: BigDecimal): String =
        if (paid + amount >= total) "lunas" else "belum"
}