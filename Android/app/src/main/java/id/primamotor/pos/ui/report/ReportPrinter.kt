package id.primamotor.pos.ui.report

import android.content.Context
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.number
import id.primamotor.pos.data.repo.object_
import id.primamotor.pos.data.repo.text
import id.primamotor.pos.domain.Money
import java.math.BigDecimal

/**
 * Cetak/unduh report lewat print service Android, cermin tombol `window.print()` web.
 * HTML dirender WebView lalu diteruskan ke PrintManager; pengguna memilih PDF atau printer.
 */
object ReportPrinter {
    // PrintManager butuh WebView tetap hidup sampai dialog print selesai.
    private var keepAlive: WebView? = null

    fun print(
        context: Context,
        title: String,
        from: String,
        to: String,
        menu: List<MenuRow>,
        cashflow: List<CashflowRow>,
        logs: List<LocalRecordEntity>,
        ongkos: List<LocalRecordEntity>,
    ) {
        val web = WebView(context)
        keepAlive = web
        web.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                val manager = context.getSystemService(Context.PRINT_SERVICE) as PrintManager
                val adapter = view.createPrintDocumentAdapter(title)
                manager.print(title, adapter, PrintAttributes.Builder().build())
            }
        }
        web.loadDataWithBaseURL(null, html(title, from, to, menu, cashflow, logs, ongkos), "text/html", "utf-8", null)
    }

    private fun html(
        title: String,
        from: String,
        to: String,
        menu: List<MenuRow>,
        cashflow: List<CashflowRow>,
        logs: List<LocalRecordEntity>,
        ongkos: List<LocalRecordEntity>,
    ): String {
        val period = listOf(from, to).filter { it.isNotBlank() }.joinToString(" s/d ")
        val menuTotal = menu.fold(BigDecimal.ZERO) { sum, row -> sum + row.total }
        val net = cashflow.fold(BigDecimal.ZERO) { sum, row ->
            sum + if (row.mutasi.lowercase() in setOf("out", "keluar")) row.nominal.negate() else row.nominal
        }
        val body = StringBuilder()
        body.append("<h1>Report Prima Motor</h1>")
        body.append("<p>Periode: ${period.ifBlank { "semua data cache" }}</p>")
        body.append("<h2>Ringkasan</h2><table><tr><th>Total nota</th><td>${Money.formatRupiah(menuTotal)}</td></tr>")
        body.append("<tr><th>Arus kas bersih</th><td>${Money.formatRupiah(net)}</td></tr>")
        body.append("<tr><th>Nota</th><td>${menu.size}</td></tr></table>")

        body.append("<h2>Menu</h2><table><tr><th>ID</th><th>Pelanggan</th><th>Jenis</th><th>Status</th><th>Total</th><th>Dibayar</th></tr>")
        menu.forEach { row ->
            body.append(
                "<tr><td>${escape(row.id)}</td><td>${escape(row.person)}</td><td>${escape(row.note)}</td>" +
                    "<td>${escape(row.status)}</td><td>${Money.formatRupiah(row.total)}</td><td>${Money.formatRupiah(row.dibayar)}</td></tr>",
            )
        }
        body.append("</table>")

        body.append("<h2>Kas</h2><table><tr><th>Tanggal</th><th>Jenis</th><th>Catatan</th><th>Mutasi</th><th>Nominal</th></tr>")
        cashflow.forEach { row ->
            body.append(
                "<tr><td>${escape(row.createdAt)}</td><td>${escape(row.jenis)}</td><td>${escape(row.note)}</td>" +
                    "<td>${escape(row.mutasi)}</td><td>${Money.formatRupiah(row.nominal)}</td></tr>",
            )
        }
        body.append("</table>")

        body.append("<h2>Log Stock</h2><table><tr><th>Tanggal</th><th>Item</th><th>Qty</th><th>Arah</th><th>Ref</th></tr>")
        logs.forEach { entity ->
            val row = entity.object_() ?: return@forEach
            body.append(
                "<tr><td>${escape(entity.dateKey)}</td><td>${escape(row.text("item_baru").ifBlank { row.text("item") })}</td>" +
                    "<td>${row.number("qty").stripTrailingZeros().toPlainString()}</td><td>${escape(row.text("boolean"))}</td>" +
                    "<td>${escape(row.text("ref_baru").ifBlank { row.text("ref") })}</td></tr>",
            )
        }
        body.append("</table>")

        body.append("<h2>Ongkos</h2><table><tr><th>Tanggal</th><th>Mekanik</th><th>Ongkos</th><th>Ref</th></tr>")
        ongkos.forEach { entity ->
            val row = entity.object_() ?: return@forEach
            body.append(
                "<tr><td>${escape(entity.dateKey)}</td><td>${escape(row.text("person"))}</td>" +
                    "<td>${Money.formatRupiah(row.number("ongkos"))}</td><td>${escape(row.text("ref_baru").ifBlank { row.text("ref") })}</td></tr>",
            )
        }
        body.append("</table>")

        return """
            <html><head><meta charset="utf-8"><style>
            body{font-family:sans-serif;font-size:11px;color:#0f172a}
            h1{font-size:18px}h2{font-size:14px;margin-top:18px}
            table{width:100%;border-collapse:collapse;margin-top:6px}
            th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left}
            th{background:#f1f5f9}
            </style></head><body>$body</body></html>
        """.trimIndent()
    }

    private fun escape(value: String): String =
        value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
}
