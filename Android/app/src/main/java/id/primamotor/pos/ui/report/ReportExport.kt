package id.primamotor.pos.ui.report

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import id.primamotor.pos.data.repo.ReportRow
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.ReportFeed
import id.primamotor.pos.domain.ReportSummary
import org.dhatim.fastexcel.Workbook
import java.io.File

/**
 * Ekspor riwayat laporan ke `.xlsx` satu halaman (31 baris) memakai FastExcel.
 * Hasilnya dibagikan lewat share sheet supaya bisa dikirim ke WhatsApp/email/Drive.
 */
object ReportExport {

    private const val MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    fun write(
        context: Context,
        rows: List<ReportRow>,
        summary: ReportSummary,
        from: String,
        to: String,
    ): File {
        val file = File(context.cacheDir, "laporan-prima-motor.xlsx")
        file.outputStream().use { output ->
            val workbook = Workbook(output, "Prima Motor POS", "01.0000")
            val sheet = workbook.newWorksheet("Laporan")
            sheet.width(0, 14.0)
            sheet.width(1, 30.0)
            repeat(6) { index -> sheet.width(2 + index, 16.0) }

            sheet.value(0, 0, "LAPORAN PRIMA MOTOR")
            sheet.range(0, 0, 0, 7).style().bold().fontSize(14).set()

            val period = listOf(from, to).filter { it.isNotBlank() }.joinToString(" s/d ")
            sheet.value(1, 0, "Periode: ${period.ifBlank { "semua data" }}")

            val summaryRows = listOf(
                "Total Omset Kotor" to summary.totalOmset,
                "Laba Penjualan" to summary.totalLaba,
                "Total Pengeluaran" to summary.totalPengeluaran,
                "Estimasi Laba Bersih" to summary.labaBersih,
                "Pemasukan Lain" to summary.pemasukanLain,
            )
            summaryRows.forEachIndexed { index, (label, value) ->
                val row = 3 + index
                sheet.value(row, 0, label)
                sheet.style(row, 0).bold().set()
                sheet.value(row, 1, value.toDouble())
                sheet.style(row, 1).format("#,##0").set()
            }

            val headerRow = 3 + summaryRows.size + 1
            val headers = listOf(
                "Tanggal", "Keterangan", "Omset", "Laba", "Keluar", "Piutang", "Hutang", "Kasir Final",
            )
            headers.forEachIndexed { column, label -> sheet.value(headerRow, column, label) }
            sheet.range(headerRow, 0, headerRow, headers.lastIndex).style()
                .bold()
                .fillColor("F1F5F9")
                .set()

            rows.forEachIndexed { index, row ->
                val excelRow = headerRow + 1 + index
                sheet.value(excelRow, 0, ReportFeed.formatDate(row.createdAt))
                sheet.value(excelRow, 1, row.text.ifBlank { "-" })
                listOf(row.omset, row.labaKotor, row.pengeluaran, row.piutang, row.hutang, row.kasirToko)
                    .forEachIndexed { offset, value ->
                        val column = 2 + offset
                        sheet.value(excelRow, column, value.toDouble())
                        sheet.style(excelRow, column).format("#,##0").set()
                    }
            }

            sheet.value(headerRow + rows.size + 2, 0, "Total halaman: ${Money.formatNumber(summary.totalOmset)}")
            workbook.finish()
        }
        return file
    }

    /** Buka share sheet; penerima mendapat izin baca sementara lewat FileProvider. */
    fun share(context: Context, file: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = MIME
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "Laporan Prima Motor")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(
            Intent.createChooser(intent, "Bagikan laporan").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }
}
