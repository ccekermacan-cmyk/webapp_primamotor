package id.primamotor.pos.ui.pos

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.PosFeed
import id.primamotor.pos.domain.PosPricing
import java.math.BigDecimal

/**
 * Cermin `CheckoutReviewModal` web: konfirmasi ringkas sebelum `commit()`.
 * Status "BELUM (Menunggu Bukti Media)" muncul untuk pembelian tanpa lampiran.
 */
@Composable
fun CheckoutReviewDialog(
    state: PosUiState,
    operatorName: String,
    personLabel: String,
    onEditTab: (Int) -> Unit,
    onBack: () -> Unit,
    onSave: () -> Unit,
) {
    var details by remember { mutableStateOf(false) }
    val pembelian = PosPricing.isPembelian(state.draft.menu)
    val tanpaBukti = pembelian && state.draft.mediaCount == 0
    val sisa = state.total - state.paid

    AlertDialog(
        onDismissRequest = onBack,
        title = { Text("Periksa transaksi") },
        text = {
            Column(
                Modifier.heightIn(max = 520.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(
                    if (state.edit != null) "Validasi update nota terakhir" else "Periksa sebelum menyimpan",
                    style = MaterialTheme.typography.labelLarge,
                    color = PosTheme.muted,
                )
                Text(personLabel, fontWeight = FontWeight.SemiBold)
                Text(
                    "${state.draft.menu} · ${state.draft.payment} · Kasir $operatorName",
                    style = MaterialTheme.typography.bodySmall,
                    color = PosTheme.muted,
                )

                Surface(
                    color = if (tanpaBukti) Color(0xFFFFFBEB) else PosTheme.accent(state.draft.menu).light,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(10.dp)) {
                        Text(
                            when {
                                tanpaBukti -> "BELUM (Menunggu Bukti Media)"
                                state.previewStatus == "lunas" -> "LUNAS"
                                else -> "BELUM LUNAS"
                            },
                            fontWeight = FontWeight.ExtraBold,
                        )
                        if (tanpaBukti) {
                            Text(
                                "Upload bukti nota agar bisa berstatus LUNAS",
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Total tagihan")
                    Text(Money.formatRupiah(state.total), fontWeight = FontWeight.Bold)
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Dibayar")
                    Text(Money.formatRupiah(state.paid), color = PosTheme.success)
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(if (sisa.signum() >= 0) "Sisa tagihan" else "Kembalian")
                    Text(
                        Money.formatRupiah(sisa.abs()),
                        color = if (sisa.signum() > 0) PosTheme.danger else PosTheme.success,
                        fontWeight = FontWeight.SemiBold,
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    TextButton(onClick = { onEditTab(0) }) { Text("Ubah barang") }
                    TextButton(onClick = { onEditTab(1) }) { Text("Ubah pembayaran") }
                    TextButton(onClick = { onEditTab(2) }) { Text("Ubah catatan") }
                }

                TextButton(onClick = { details = !details }, modifier = Modifier.heightIn(min = 40.dp)) {
                    Text(if (details) "Sembunyikan rincian" else "Lihat rincian")
                }

                if (details) {
                    HorizontalDivider()
                    Text(
                        "Barang & jasa · ${state.qty.stripTrailingZeros().toPlainString()} item",
                        fontWeight = FontWeight.SemiBold,
                    )
                    state.lines.forEach { line ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column(Modifier.padding(end = 8.dp)) {
                                Text(PosFeed.productLabel(line.produk), style = MaterialTheme.typography.bodyMedium)
                                Text(
                                    "${line.qty.stripTrailingZeros().toPlainString()} ${line.produk.unit} x " +
                                        "${Money.formatRupiah(line.price)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = PosTheme.muted,
                                )
                                if (!pembelian) {
                                    Text(
                                        "Normal: ${Money.formatRupiah(line.produk.sell6.multiply(line.qty))}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = PosTheme.muted,
                                    )
                                }
                            }
                            Text(Money.formatRupiah(line.subtotal), fontWeight = FontWeight.SemiBold)
                        }
                    }
                    Text("Total produk: ${Money.formatRupiah(state.subtotal)}", fontWeight = FontWeight.SemiBold)

                    HorizontalDivider()
                    Text("Pembayaran per akun", fontWeight = FontWeight.SemiBold)
                    val rows = state.draft.payments.filter { it.accountId.isNotBlank() || it.nominal.isNotBlank() }
                    if (rows.isEmpty()) {
                        Text("Belum ada akun kas yang dipilih.", style = MaterialTheme.typography.bodySmall)
                    } else {
                        rows.forEachIndexed { index, line ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("#${index + 1} ${line.accountId}")
                                Text(Money.formatRupiah(Money.parse(line.nominal) ?: BigDecimal.ZERO))
                            }
                        }
                    }

                    if (state.ongkosTotal.signum() > 0) {
                        HorizontalDivider()
                        Text("Alokasi ongkos mekanik", fontWeight = FontWeight.SemiBold)
                        state.draft.mechanics.filter { it.idLama.isNotBlank() }.forEach { line ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(line.idLama)
                                Text(Money.formatRupiah(Money.parse(line.ongkos) ?: BigDecimal.ZERO))
                            }
                        }
                    }

                    if (state.isOnline) {
                        HorizontalDivider()
                        Text("Detail marketplace online", fontWeight = FontWeight.SemiBold)
                        Text("Platform: ${state.draft.marketplace}")
                        Text("Potongan admin: - ${Money.formatRupiah(Money.parse(state.draft.adminFee))}")
                        Text("Cashback: + ${Money.formatRupiah(Money.parse(state.draft.cashback))}")
                    }

                    HorizontalDivider()
                    Text("Catatan & lampiran", fontWeight = FontWeight.SemiBold)
                    Text(state.draft.noteMenu.ifBlank { "Tidak ada catatan nota." })
                    Text("Lampiran: ${state.draft.mediaCount} file", style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            Button(onClick = onSave, enabled = !state.saving, modifier = Modifier.testTag("review_save")) {
                Text(if (state.saving) "MENYIMPAN..." else "Simpan transaksi")
            }
        },
        dismissButton = { TextButton(onClick = onBack) { Text("Kembali") } },
    )
}
