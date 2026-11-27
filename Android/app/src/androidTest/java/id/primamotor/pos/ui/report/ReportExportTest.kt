package id.primamotor.pos.ui.report

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import id.primamotor.pos.data.repo.ReportRow
import id.primamotor.pos.domain.ReportSummary
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.math.BigDecimal

/**
 * FastExcel adalah pustaka JVM; tes ini membuktikan berkas `.xlsx` benar-benar
 * terbentuk di perangkat (bukan hanya lolos kompilasi).
 */
@RunWith(AndroidJUnit4::class)
class ReportExportTest {

    private fun row() = ReportRow(
        id = "r1",
        text = "Rekap harian",
        createdAt = "2026-11-20T00:00:00.000Z",
        omsetToko = BigDecimal("500000"),
        omsetServis = BigDecimal("20000"),
        omsetMinuman = BigDecimal("10000"),
        labaPenjualan = BigDecimal("200000"),
        labaService = BigDecimal("8000"),
        labaMinuman = BigDecimal("4000"),
        operasionalToko = BigDecimal("50000"),
        pengeluaranLain = BigDecimal("5000"),
        pemasukanLain = BigDecimal("100000"),
        piutang = BigDecimal("30000"),
        hutang = BigDecimal("20000"),
        kasirToko = BigDecimal("450000"),
    )

    @Test
    fun writesRealXlsxFileOnDevice() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val summary = ReportSummary(
            omsetToko = BigDecimal("500000"),
            omsetServis = BigDecimal("20000"),
            omsetMinuman = BigDecimal("10000"),
            totalOmset = BigDecimal("530000"),
            totalLaba = BigDecimal("212000"),
            totalPengeluaran = BigDecimal("55000"),
            pemasukanLain = BigDecimal("100000"),
            labaBersih = BigDecimal("257000"),
            penyumbangTerbesar = "Penjualan Toko",
            insight = "",
        )

        val file = ReportExport.write(context, listOf(row()), summary, "2026-11-01", "2026-11-30")

        assertTrue("xlsx kosong", file.length() > 500)
        val magic = file.inputStream().use { stream -> ByteArray(2).also { stream.read(it) } }
        assertEquals("PK", String(magic, Charsets.US_ASCII))
    }
}
