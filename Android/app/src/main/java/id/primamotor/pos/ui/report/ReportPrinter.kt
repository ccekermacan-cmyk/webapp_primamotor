package id.primamotor.pos.ui.report

import android.content.Context
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient
import id.primamotor.pos.data.repo.ReportRow
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.ReportFeed
import id.primamotor.pos.domain.ReportSummary

/**
 * Cetak/unduh report lewat print service Android, cermin tombol `window.print()` web.
 * Isi sama dengan tabel riwayat laporan: ringkasan periode + kolom Tanggal sampai Kasir Final.
 */
object ReportPrinter {
    // PrintManager butuh WebView tetap hidup sampai dialog print selesai.
    private var keepAlive: WebView? = null

    fun print(
        context: Context,
        title: String,
        from: String,
        to: String,
        rows: List<ReportRow>,
        summary: ReportSummary,
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
        web.loadDataWithBaseURL(null, html(title, from, to, rows, summary), "text/html", "utf-8", null)
    }

    private fun html(
        title: String,
        from: String,
        to: String,
        rows: List<ReportRow>,
        summary: ReportSummary,
    ): String {
        val period = listOf(from, to).filter { it.isNotBlank() }.joinToString(" s/d ")
        val body = StringBuilder()
        body.append("<h1>${escape(title)}</h1>")
        body.append("<p>Periode: ${escape(period.ifBlank { "semua data" })}</p>")
        body.append("<h2>Ringkasan</h2><table>")
        body.append("<tr><th>Total Omset Kotor</th><td>${Money.formatRupiah(summary.totalOmset)}</td></tr>")
        body.append("<tr><th>Laba Penjualan</th><td>${Money.formatRupiah(summary.totalLaba)}</td></tr>")
        body.append("<tr><th>Total Pengeluaran</th><td>${Money.formatRupiah(summary.totalPengeluaran)}</td></tr>")
        body.append("<tr><th>Estimasi Laba Bersih</th><td>${Money.formatRupiah(summary.labaBersih)}</td></tr>")
        body.append("</table>")

        body.append("<h2>Detail Riwayat Laporan</h2><table>")
        body.append(
            "<tr><th>Tanggal</th><th>Keterangan</th><th>Omset</th><th>Laba</th>" +
                "<th>Keluar</th><th>Piutang</th><th>Hutang</th><th>Kasir Final</th></tr>",
        )
        rows.forEach { row ->
            body.append(
                "<tr><td>${ReportFeed.formatDate(row.createdAt)}</td><td>${escape(row.text.ifBlank { "-" })}</td>" +
                    "<td>${Money.formatRupiah(row.omset)}</td><td>${Money.formatRupiah(row.labaKotor)}</td>" +
                    "<td>${Money.formatRupiah(row.pengeluaran)}</td><td>${Money.formatRupiah(row.piutang)}</td>" +
                    "<td>${Money.formatRupiah(row.hutang)}</td><td>${Money.formatRupiah(row.kasirToko)}</td></tr>",
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
