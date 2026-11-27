package id.primamotor.pos.ui.salary

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.primamotor.pos.data.repo.GajiRow
import id.primamotor.pos.domain.Money

/** Rincian slip gaji, dipakai halaman Akun dan tab Gaji pada detail karyawan. */
@Composable
fun SlipDialog(row: GajiRow, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Rincian Gaji") },
        text = {
            Column(
                Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                SlipLine("Referensi", row.ref.ifBlank { row.id })
                SlipLine("Tanggal", row.createdAt)
                HorizontalDivider()
                SlipLine("Gaji pokok", Money.formatRupiah(row.pokok))
                SlipLine("Tunjangan", Money.formatRupiah(row.tunjangan))
                SlipLine("Lembur", Money.formatRupiah(row.lembur))
                SlipLine("Bonus", Money.formatRupiah(row.bonus))
                SlipLine("Qty", row.qty.stripTrailingZeros().toPlainString())
                SlipLine("Alfa", Money.formatRupiah(row.alfa))
                SlipLine("Setengah hari", Money.formatRupiah(row.setengahHari))
                SlipLine("Sakit", Money.formatRupiah(row.sakit))
                SlipLine("Telat", Money.formatRupiah(row.telat))
                SlipLine("BPJS", Money.formatRupiah(row.bpjs))
                SlipLine("Bon diambil", Money.formatRupiah(row.bonDiambil))
                SlipLine("Bon dibayar", Money.formatRupiah(row.bonDibayar))
                HorizontalDivider()
                SlipLine("Diterima", Money.formatRupiah(row.diterima))
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Tutup") } },
    )
}

@Composable
private fun SlipLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodySmall)
    }
}
