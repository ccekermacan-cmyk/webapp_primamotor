package id.primamotor.pos.domain

import java.math.BigDecimal
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale

/** Format uang id-ID. Server menyimpan angka; format hanya untuk tampilan. */
object Money {
    private val symbols = DecimalFormatSymbols(Locale("id", "ID"))

    private fun formatter(integral: Boolean): DecimalFormat =
        DecimalFormat(if (integral) "#,##0" else "#,##0.00", symbols)

    fun formatRupiah(value: BigDecimal?): String {
        if (value == null) return ""
        val abs = value.abs()
        val integral = abs.stripTrailingZeros().scale() <= 0
        val body = formatter(integral).format(abs)
        return if (value.signum() < 0) "-Rp $body" else "Rp $body"
    }

    /** Angka bergrup tanpa prefix, tanda minus di depan. Dipakai kalimat insight web. */
    fun formatNumber(value: BigDecimal): String {
        val abs = value.abs()
        val integral = abs.stripTrailingZeros().scale() <= 0
        val body = formatter(integral).format(abs)
        return if (value.signum() < 0) "-$body" else body
    }

    /** Titik = pemisah ribuan, koma = desimal. Input lain diabaikan. */
    fun parse(input: String?): BigDecimal? {
        if (input.isNullOrBlank()) return null
        val cleaned = input.replace(Regex("[^0-9,.-]"), "")
        if (cleaned.count { it.isDigit() } == 0) return null
        return cleaned.replace(".", "").replace(',', '.').toBigDecimalOrNull()
    }
}