package id.primamotor.pos.ui.pos

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import id.primamotor.pos.data.repo.MenuDetail
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.PosFeed
import id.primamotor.pos.domain.WibDate
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.format.DateTimeFormatter
import java.util.Locale

private val TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")

private fun displayTime(raw: String): String =
    WibDate.parseInstant(raw)?.atZone(WibDate.WIB)?.format(TIME) ?: raw

/**
 * Cermin `PosDetailModal` web: tab Ringkasan / Barang & jasa / Pembayaran,
 * laba kotor hanya untuk level 1, tombol Hapus / Pelunasan / Edit / Cetak / Bagikan / Tutup.
 */
@Composable
fun PosDetailDialog(
    row: MenuRow,
    detail: MenuDetail?,
    loading: Boolean,
    persons: List<PersonRow>,
    accounts: List<PersonRow>,
    level: Int,
    saving: Boolean,
    onClose: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onSettle: () -> Unit,
    onPrint: () -> Unit,
) {
    val context = LocalContext.current
    var tab by remember(row.id) { mutableIntStateOf(0) }
    val laba = detail?.labaKotor ?: BigDecimal.ZERO
    val person = PosFeed.personLabel(row.person, persons, "Pelanggan umum")
    val sisa = row.total - row.dibayar

    Dialog(onDismissRequest = onClose) {
        Surface(
            modifier = Modifier.fillMaxWidth().fillMaxHeight(0.92f),
            color = MaterialTheme.colorScheme.surface,
            shape = MaterialTheme.shapes.large,
            border = BorderStroke(1.dp, PosTheme.hairline),
        ) {
            Column(Modifier.fillMaxWidth().padding(14.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Detail transaksi", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(displayTime(row.createdAt), style = MaterialTheme.typography.bodySmall, color = PosTheme.muted)
                }

                TabRow(selectedTabIndex = tab, modifier = Modifier.fillMaxWidth()) {
                    listOf("Ringkasan", "Barang & jasa", "Pembayaran").forEachIndexed { index, label ->
                        Tab(
                            selected = tab == index,
                            onClick = { tab = index },
                            text = { Text(label, style = MaterialTheme.typography.labelMedium) },
                            modifier = Modifier.heightIn(min = 44.dp),
                        )
                    }
                }

                Column(
                    Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())
                        .padding(vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    when (tab) {
                        0 -> SummaryTab(row, detail, person, laba, sisa, level, loading)
                        1 -> ItemsTab(detail, laba, level, loading)
                        else -> PaymentsTab(detail, accounts, level, loading)
                    }
                }

                HorizontalDivider()
                Row(
                    Modifier.fillMaxWidth().padding(top = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    TextButton(onClick = onDelete, enabled = !saving) {
                        Text("Hapus", color = PosTheme.danger)
                    }
                    if (!row.status.equals("lunas", ignoreCase = true)) {
                        TextButton(onClick = onSettle, enabled = !saving) { Text("Pelunasan") }
                    }
                    TextButton(onClick = onEdit, enabled = !saving) { Text("Edit") }
                    TextButton(onClick = onPrint, enabled = !saving) { Text("Cetak") }
                    if (row.status.equals("lunas", ignoreCase = true)) {
                        TextButton(onClick = { share(context, row, person, detail) }) { Text("Bagikan") }
                    }
                    Button(onClick = onClose, modifier = Modifier.weight(1f)) { Text("Tutup") }
                }
            }
        }
    }
}

@Composable
private fun SummaryTab(
    row: MenuRow,
    detail: MenuDetail?,
    person: String,
    laba: BigDecimal,
    sisa: BigDecimal,
    level: Int,
    loading: Boolean,
) {
    Surface(color = PosTheme.accent(row.jenis).light, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(10.dp)) {
            Text(row.ref.ifBlank { row.id }, fontWeight = FontWeight.Bold)
            Text(
                "${row.status.ifBlank { "belum" }} · ${row.jenis.ifBlank { "-" }}",
                style = MaterialTheme.typography.bodySmall,
            )
            Text(person, style = MaterialTheme.typography.bodyMedium)
            Text(
                "Operator: ${row.operator.ifBlank { "System" }}",
                style = MaterialTheme.typography.bodySmall,
                color = PosTheme.muted,
            )
        }
    }

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text("Total tagihan")
        Text(Money.formatRupiah(row.total), fontWeight = FontWeight.Bold)
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text("Dibayar")
        Text(Money.formatRupiah(row.dibayar), color = PosTheme.success)
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(if (sisa.signum() >= 0) "Sisa tagihan" else "Kembalian")
        Text(
            Money.formatRupiah(sisa.abs()),
            color = if (sisa.signum() > 0) PosTheme.danger else PosTheme.success,
        )
    }

    if (row.marketplace.isNotBlank()) {
        Text("Marketplace: ${row.marketplace}")
        Text("Admin: -${Money.formatRupiah(row.admin)}", color = PosTheme.danger)
        Text("CB: +${Money.formatRupiah(row.cashback)}", color = PosTheme.success)
    }

    if (level == 1 && detail != null && detail.totalTransaksi.signum() != 0) {
        val basis = detail.totalTransaksi + detail.totalOngkos - row.admin + row.cashback
        val margin = if (basis.signum() == 0) {
            BigDecimal.ZERO
        } else {
            laba.multiply(BigDecimal(100)).divide(basis, 1, RoundingMode.HALF_UP)
        }
        Text("Total Laba Kotor: ${Money.formatRupiah(laba)}", fontWeight = FontWeight.SemiBold)
        Text("Persentase Margin: $margin %", style = MaterialTheme.typography.bodySmall)
    }

    Text("Catatan nota", fontWeight = FontWeight.SemiBold)
    Text(row.text.ifBlank { "Tidak ada catatan nota." })
    Text(
        "Lampiran: ${row.files.size} file",
        style = MaterialTheme.typography.bodySmall,
        color = PosTheme.muted,
    )
    if (loading) Text("Memuat rincian...", style = MaterialTheme.typography.bodySmall)
}

@Composable
private fun ItemsTab(detail: MenuDetail?, laba: BigDecimal, level: Int, loading: Boolean) {
    if (loading) {
        Text("Memuat rincian...")
        return
    }
    val items = detail?.items.orEmpty()
    if (items.isEmpty()) {
        Text("Tidak ada barang pada nota ini.", color = PosTheme.muted)
        return
    }
    var search by remember { mutableStateOf("") }
    OutlinedTextField(
        value = search,
        onValueChange = { search = it },
        label = { Text("Cari produk di nota ini...") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
    )
    val shown = items.filter {
        search.isBlank() ||
            it.label.contains(search, ignoreCase = true) ||
            it.code.contains(search, ignoreCase = true)
    }
    Text("${shown.size} / ${items.size}", style = MaterialTheme.typography.bodySmall, color = PosTheme.muted)
    Text("Rincian Item (Log Stok Terjual)", fontWeight = FontWeight.SemiBold)
    shown.forEach { item ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(Modifier.padding(end = 8.dp)) {
                Text(item.label, style = MaterialTheme.typography.bodyMedium)
                Text(
                    "Qty: ${item.qty.stripTrailingZeros().toPlainString()} @ ${Money.formatRupiah(item.price)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = PosTheme.muted,
                )
                if (level == 1) {
                    Text(
                        "ID ${item.id} · kode ${item.code} · ${item.direction} · " +
                            "jual ${Money.formatRupiah(item.price)} · modal ${Money.formatRupiah(item.cost)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = PosTheme.muted,
                    )
                    item.stockStart?.let { Text("Stok awal: ${it.stripTrailingZeros().toPlainString()}") }
                    item.stockEnd?.let { Text("Stok akhir: ${it.stripTrailingZeros().toPlainString()}") }
                    val barisLaba = item.price.multiply(item.qty) - item.cost
                    val persen = if (item.price.signum() == 0) {
                        BigDecimal.ZERO
                    } else {
                        barisLaba.multiply(BigDecimal(100))
                            .divide(item.price.multiply(item.qty), 1, RoundingMode.HALF_UP)
                    }
                    Text(
                        "Laba: ${Money.formatRupiah(barisLaba)} ($persen%)",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (barisLaba.signum() < 0) PosTheme.danger else PosTheme.success,
                    )
                }
            }
            Text(
                Money.formatRupiah(item.price.multiply(item.qty)),
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
    detail?.ongkos?.takeIf { it.isNotEmpty() }?.let { fees ->
        HorizontalDivider()
        Text("Potongan Mekanik", fontWeight = FontWeight.SemiBold)
        fees.forEach { fee ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(fee.person.ifBlank { "-" })
                Text(Money.formatRupiah(fee.ongkos))
            }
        }
    }
    if (level == 1) {
        Text("Total laba kotor: ${Money.formatRupiah(laba)}", fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun PaymentsTab(detail: MenuDetail?, accounts: List<PersonRow>, level: Int, loading: Boolean) {
    Text("Rekaman Jurnal Kas", fontWeight = FontWeight.SemiBold)
    if (loading) {
        Text("Memuat rincian...")
        return
    }
    val rows = detail?.cashflows.orEmpty()
    if (rows.isEmpty()) {
        Text(
            "Data jurnal kas tidak ditemukan atau sedang diselaraskan...",
            color = PosTheme.muted,
        )
        return
    }
    rows.forEach { cash ->
        val account = accounts.firstOrNull { it.id == cash.accountId }?.nama ?: cash.accountId
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = PosTheme.canvas,
            border = BorderStroke(1.dp, PosTheme.hairline),
        ) {
            Column(Modifier.padding(10.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(Money.formatRupiah(cash.nominal), fontWeight = FontWeight.Bold)
                    Text(cash.mutasi.uppercase(Locale("id", "ID")), style = MaterialTheme.typography.bodySmall)
                }
                Text("Account: $account", style = MaterialTheme.typography.bodySmall)
                if (level == 1 || level == 2 || level == 5) {
                    cash.saldoAwal?.let { Text("Saldo Awal: ${Money.formatRupiah(it)}") }
                    cash.saldoAkhir?.let { Text("Saldo Akhir: ${Money.formatRupiah(it)}") }
                }
                if (cash.note.isNotBlank()) {
                    Text("\" ${cash.note} \"", style = MaterialTheme.typography.bodySmall, color = PosTheme.muted)
                }
            }
        }
    }
}

private fun share(
    context: Context,
    row: MenuRow,
    person: String,
    detail: MenuDetail?,
) {
    val body = buildString {
        appendLine("*${row.jenis.uppercase(Locale("id", "ID"))}*")
        appendLine("ID: ${row.ref.ifBlank { row.id }}")
        appendLine(displayTime(row.createdAt))
        appendLine("Pelanggan: $person")
        appendLine("Total: ${Money.formatRupiah(row.total)}")
        appendLine("Dibayar: ${Money.formatRupiah(row.dibayar)}")
        appendLine()
        appendLine("Items:")
        detail?.items.orEmpty().forEach { item ->
            appendLine(
                "${item.label} | Qty: ${item.qty.stripTrailingZeros().toPlainString()} @ " +
                    "${Money.formatRupiah(item.price)} = ${Money.formatRupiah(item.price.multiply(item.qty))}",
            )
        }
    }
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
    val ok = runCatching {
        clipboard?.setPrimaryClip(ClipData.newPlainText("Nota", body))
        clipboard != null
    }.getOrDefault(false)
    Toast.makeText(
        context,
        if (ok) "Detail transaksi disalin ke clipboard!" else "Gagal menyalin ke clipboard",
        Toast.LENGTH_SHORT,
    ).show()
}
