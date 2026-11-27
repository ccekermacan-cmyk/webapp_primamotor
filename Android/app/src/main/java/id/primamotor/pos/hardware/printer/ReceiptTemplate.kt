package id.primamotor.pos.hardware.printer

import java.io.ByteArrayOutputStream
import java.math.BigDecimal

/** Potongan perintah ESC/POS minimum yang dipakai struk. */
object EscPos {
    val INIT = byteArrayOf(0x1B, 0x40)
    val BOLD_ON = byteArrayOf(0x1B, 0x45, 1)
    val BOLD_OFF = byteArrayOf(0x1B, 0x45, 0)
    val ALIGN_LEFT = byteArrayOf(0x1B, 0x61, 0)
    val ALIGN_CENTER = byteArrayOf(0x1B, 0x61, 1)
    val CUT = byteArrayOf(0x1D, 0x56, 0x01)

    fun feed(lines: Int): ByteArray = byteArrayOf(0x1B, 0x64, lines.coerceIn(0, 255).toByte())
}

data class ReceiptItem(
    val nama: String,
    val qty: BigDecimal,
    val price: BigDecimal,
) {
    val total: BigDecimal get() = price.multiply(qty)
}

data class ReceiptData(
    val notaId: String,
    val waktu: String,
    val kasir: String,
    val pelanggan: String = "Umum",
    val jenis: String = "Penjualan",
    val items: List<ReceiptItem>,
    val total: BigDecimal,
    val bayar: BigDecimal,
    val kembali: BigDecimal,
    val payment: String = "Tunai",
    val mekanik: List<Pair<String, BigDecimal>> = emptyList(),
    val lebar: Int = 32,
)

/**
 * Template teks 32 kolom (kertas 58 mm).
 * Karakter di luar ASCII diganti `?` agar printer murah tidak mencetak sampah.
 */
object ReceiptTemplate {

    fun render(data: ReceiptData): ByteArray {
        val out = ByteArrayOutputStream()
        out.write(EscPos.INIT)
        out.write(EscPos.ALIGN_CENTER)
        out.write(EscPos.BOLD_ON)
        line(out, "PRIMA MOTOR", data.lebar)
        out.write(EscPos.BOLD_OFF)
        line(out, data.jenis, data.lebar)
        out.write(EscPos.ALIGN_LEFT)
        separator(out, data.lebar)
        line(out, "Nota : ${data.notaId}", data.lebar)
        line(out, "Waktu: ${data.waktu}", data.lebar)
        line(out, "Kasir: ${data.kasir}", data.lebar)
        line(out, "Plgn : ${data.pelanggan}", data.lebar)
        separator(out, data.lebar)

        data.items.forEach { item ->
            line(out, item.nama, data.lebar)
            columns(
                out,
                "${item.qty.stripTrailingZeros().toPlainString()} x ${money(item.price)}",
                money(item.total),
                data.lebar,
            )
        }

        separator(out, data.lebar)
        columns(out, "TOTAL", money(data.total), data.lebar)
        columns(out, "BAYAR", money(data.bayar), data.lebar)
        columns(out, "KEMBALI", money(data.kembali), data.lebar)

        if (data.mekanik.isNotEmpty()) {
            separator(out, data.lebar)
            data.mekanik.forEach { (nama, ongkos) ->
                line(out, "Jasa $nama ${money(ongkos)}", data.lebar)
            }
        }

        separator(out, data.lebar)
        out.write(EscPos.ALIGN_CENTER)
        line(out, "Terima kasih", data.lebar)
        line(out, "Barang yang sudah dibeli", data.lebar)
        line(out, "tidak dapat ditukar", data.lebar)
        out.write(EscPos.feed(3))
        out.write(EscPos.CUT)
        return out.toByteArray()
    }

    fun money(value: BigDecimal): String {
        val abs = value.abs()
        val integral = abs.stripTrailingZeros().scale() <= 0
        val body = if (integral) abs.toBigInteger().toString() else abs.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString()
        return (if (value.signum() < 0) "-" else "") + grouped(body)
    }

    private fun grouped(raw: String): String {
        val dot = raw.indexOf('.')
        val digits = if (dot >= 0) raw.substring(0, dot) else raw
        val rest = if (dot >= 0) raw.substring(dot) else ""
        val builder = StringBuilder()
        digits.reversed().forEachIndexed { index, char ->
            if (index > 0 && index % 3 == 0) builder.append('.')
            builder.append(char)
        }
        return builder.reverse().toString() + rest
    }

    private fun line(out: ByteArrayOutputStream, text: String, width: Int) {
        out.write(ascii(text).take(width).toByteArray(Charsets.US_ASCII))
        out.write(byteArrayOf(0x0A))
    }

    private fun columns(out: ByteArrayOutputStream, left: String, right: String, width: Int) {
        val gap = (width - ascii(left).length - ascii(right).length).coerceAtLeast(1)
        line(out, ascii(left) + " ".repeat(gap) + ascii(right), width)
    }

    private fun separator(out: ByteArrayOutputStream, width: Int) {
        line(out, "-".repeat(width), width)
    }

    /** ESC/POS 58 mm umumnya ASCII/CP437; karakter lain jadi `?`. */
    fun ascii(text: String): String = text.map { if (it.code in 32..126) it else '?' }.joinToString("")
}