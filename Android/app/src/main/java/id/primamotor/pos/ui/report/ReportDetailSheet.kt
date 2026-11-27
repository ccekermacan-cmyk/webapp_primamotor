package id.primamotor.pos.ui.report

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.primamotor.pos.data.repo.ReportRow
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.ReportDetailTab
import id.primamotor.pos.domain.ReportFeed
import id.primamotor.pos.domain.ReportLog
import java.math.BigDecimal

private val GREEN = Color(0xFF047857)
private val RED = Color(0xFFBE123C)
private val ORANGE = Color(0xFFC2410C)
private val AMBER = Color(0xFFB45309)
private val PURPLE = Color(0xFF7E22CE)
private val BLUE = Color(0xFF1D4ED8)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ReportDetailSheet(
    row: ReportRow,
    state: ReportUiState,
    view: ReportDetailView,
    viewModel: ReportViewModel,
) {
    ModalBottomSheet(onDismissRequest = viewModel::closeDetail) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "Detail Laporan ${ReportFeed.formatDate(row.createdAt)}",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = REPORT_HEADER,
                    )
                    Text(row.text.ifBlank { "Tidak ada keterangan" }, fontSize = 12.sp, color = REPORT_MUTED)
                }
                OutlinedButton(
                    onClick = viewModel::refreshDetail,
                    modifier = Modifier.heightIn(min = 44.dp).testTag("report_detail_refresh"),
                ) { Text("Refresh", fontSize = 11.sp) }
            }

            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                ReportDetailTab.entries.forEach { tab ->
                    TabPill(
                        label = tab.label,
                        selected = state.detailTab == tab,
                        tag = "report_detail_tab_${tab.name.lowercase()}",
                    ) { viewModel.setDetailTab(tab) }
                }
            }

            when (state.detailTab) {
                ReportDetailTab.OVERVIEW -> OverviewTab(row, view)
                ReportDetailTab.MENU -> MenuTab(state, view, viewModel)
                ReportDetailTab.LOG -> LogTab(state, view, viewModel)
                ReportDetailTab.KAS -> KasTab(state, view, viewModel)
                ReportDetailTab.ONGKOS -> OngkosTab(state, view, viewModel)
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (viewModel.canDelete) {
                    OutlinedButton(
                        onClick = viewModel::askDelete,
                        modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("report_delete"),
                    ) { Text("HAPUS LAPORAN", fontSize = 11.sp, fontWeight = FontWeight.Black, color = RED) }
                }
                OutlinedButton(
                    onClick = viewModel::closeDetail,
                    modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("report_detail_close"),
                ) { Text("TUTUP", fontSize = 11.sp, fontWeight = FontWeight.Black) }
            }
        }
    }
}

@Composable
private fun TabPill(label: String, selected: Boolean, tag: String, onClick: () -> Unit) {
    Surface(
        color = if (selected) BLUE else Color.White,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, if (selected) BLUE else Color(0xFFE2E8F0)),
        modifier = Modifier.heightIn(min = 44.dp).clickable(onClick = onClick).testTag(tag),
    ) {
        Box(Modifier.padding(horizontal = 12.dp, vertical = 10.dp), contentAlignment = Alignment.Center) {
            Text(
                label,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = if (selected) Color.White else REPORT_MUTED,
            )
        }
    }
}

@Composable
private fun OverviewTab(row: ReportRow, view: ReportDetailView) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionLabel("PENDAPATAN KOTOR (OMSET)")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DetailCard("Omset Toko", Money.formatRupiah(row.omsetToko), BLUE, Modifier.weight(1f))
            DetailCard(
                "Omset Servis (Jasa)",
                Money.formatRupiah(if (view.ongkos.isEmpty()) row.omsetServis else view.ongkosStats.total),
                BLUE,
                Modifier.weight(1f),
            )
        }
        DetailCard("Omset Minuman", Money.formatRupiah(row.omsetMinuman), BLUE, Modifier.fillMaxWidth())

        SectionLabel("MARGIN KEUNTUNGAN KOTOR (LABA)")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DetailCard("Laba Penjualan Toko", Money.formatRupiah(row.labaPenjualan), GREEN, Modifier.weight(1f))
            DetailCard("Laba Sparepart Servis", Money.formatRupiah(row.labaService), GREEN, Modifier.weight(1f))
        }
        DetailCard("Laba Minuman", Money.formatRupiah(row.labaMinuman), GREEN, Modifier.fillMaxWidth())

        SectionLabel("OPERASIONAL & BIAYA LAINNYA")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DetailCard("Pengeluaran Toko", Money.formatRupiah(row.operasionalToko), RED, Modifier.weight(1f))
            DetailCard("Pengeluaran Lainnya", Money.formatRupiah(row.pengeluaranLain), RED, Modifier.weight(1f))
        }
        DetailCard("Pemasukan Lainnya", "+${Money.formatRupiah(row.pemasukanLain)}", GREEN, Modifier.fillMaxWidth())

        SectionLabel("ARUS KAS & HUTANG PIUTANG")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DetailCard("Kasir Toko (Fisik/Transfer)", Money.formatRupiah(row.kasirToko), REPORT_HEADER, Modifier.weight(1f))
            DetailCard("Piutang (Customer)", Money.formatRupiah(row.piutang), AMBER, Modifier.weight(1f))
        }
        DetailCard("Hutang (Supplier)", Money.formatRupiah(row.hutang), PURPLE, Modifier.fillMaxWidth())
    }
}

@Composable
private fun DetailCard(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = Color(0xFFF8FAFC),
        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
        modifier = modifier,
    ) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(label.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, color = REPORT_MUTED)
            Text(value, fontSize = 13.sp, fontWeight = FontWeight.Black, color = color)
        }
    }
}

@Composable
private fun MenuTab(state: ReportUiState, view: ReportDetailView, viewModel: ReportViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            FilterChip(
                selected = state.menuJenis.contains("semua"),
                onClick = viewModel::selectAllMenuJenis,
                label = { Text("Semua Jenis Menu", fontSize = 10.sp) },
                modifier = Modifier.heightIn(min = 40.dp).testTag("report_menu_jenis_all"),
            )
            view.menuJenis.forEach { jenis ->
                FilterChip(
                    selected = state.menuJenis.contains(jenis) && !state.menuJenis.contains("semua"),
                    onClick = { viewModel.toggleMenuJenis(jenis) },
                    label = { Text(jenis, fontSize = 10.sp) },
                    modifier = Modifier.heightIn(min = 40.dp),
                )
            }
        }
        FilterChipRow(
            options = listOf("semua" to "Semua Status", "lunas" to "Lunas", "belum" to "Belum Lunas"),
            selected = state.menuStatus,
            tagPrefix = "report_menu_status",
            onSelect = viewModel::setMenuStatus,
        )
        DetailSearch(state.detailSearch, viewModel::setDetailSearch)
        SortChips(
            prefix = "report_sort_menu",
            options = listOf(
                "created_at" to "Waktu", "id" to "ID", "operator" to "Operator", "person" to "Pihak",
                "jenis" to "Jenis", "status" to "Status", "qty" to "Qty", "total" to "Total", "dibayar" to "Terbayar",
            ),
            current = state.menuSort,
            onSort = viewModel::sortMenu,
        )

        if (view.menus.isEmpty()) {
            MissingRow("Tidak ada data menu.")
        } else {
            ReportTable(
                headers = listOf(
                    "ID Ref", "Waktu", "Operator", "Pihak/Orang", "Jenis", "Metode", "Status",
                    "Qty", "Marketplace", "Admin", "Cashback", "Total Invoice", "Terbayar", "Catatan",
                ),
                widths = listOf(70.dp, 56.dp, 90.dp, 110.dp, 90.dp, 80.dp, 70.dp, 50.dp, 90.dp, 80.dp, 80.dp, 100.dp, 90.dp, 140.dp),
                rows = view.menus.map { menu ->
                    listOf(
                        menu.id.takeLast(6),
                        ReportFeed.timeLabel(menu.createdAt),
                        menu.operator.ifBlank { "-" },
                        menu.person.ifBlank { menu.personBaru.ifBlank { "Umum" } },
                        menu.jenis,
                        menu.payment.ifBlank { "-" },
                        menu.status,
                        menu.qty.stripTrailingZeros().toPlainString(),
                        menu.marketplace.ifBlank { "-" },
                        Money.formatRupiah(menu.admin),
                        Money.formatRupiah(menu.cashback),
                        Money.formatRupiah(menu.total),
                        Money.formatRupiah(menu.dibayar),
                        menu.text.ifBlank { menu.note.ifBlank { "-" } },
                    )
                },
                tags = view.menus.map { "report_menu_row_${it.id}" },
                onRowClick = { index -> view.menus.getOrNull(index)?.let { viewModel.openMenuLog(it.id) } },
                maxHeight = 320.dp,
            )
        }

        SummaryChips(
            listOfNotNull(
                ("Jml Transaksi" to "${view.menuStats.count} Nota").takeIf { view.menuStats.count > 0 },
                ("Total Qty" to "${view.menuStats.qty.stripTrailingZeros().toPlainString()} Item").takeIf { view.menuStats.qty.signum() > 0 },
                ("Total Admin MP" to Money.formatRupiah(view.menuStats.admin)).takeIf { view.menuStats.admin.signum() > 0 },
                ("Total Transaksi" to Money.formatRupiah(view.menuStats.total)).takeIf { view.menuStats.total.signum() > 0 },
                ("Telah Dibayar" to Money.formatRupiah(view.menuStats.dibayar)).takeIf { view.menuStats.dibayar.signum() > 0 },
                ("Piutang (Penjualan)" to Money.formatRupiah(view.menuStats.piutang)).takeIf { view.menuStats.piutang.signum() > 0 },
                ("Hutang Pembelian" to Money.formatRupiah(view.menuStats.hutang)).takeIf { view.menuStats.hutang.signum() > 0 },
            ),
        )
    }
}

@Composable
private fun LogTab(state: ReportUiState, view: ReportDetailView, viewModel: ReportViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChipRow(
            options = listOf("semua" to "Semua Mutasi", "in" to "Masuk (In)", "out" to "Keluar (Out)"),
            selected = state.logDirection,
            tagPrefix = "report_log_dir",
            onSelect = viewModel::setLogDirection,
        )
        if (state.logRef.isNotBlank()) {
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = Color(0xFFEFF6FF),
                border = BorderStroke(1.dp, Color(0xFFBFDBFE)),
                modifier = Modifier.clickable { viewModel.setLogRef("") }.testTag("report_log_clear"),
            ) {
                Text(
                    "Ref: ${state.logRef} (ketuk untuk hapus filter)",
                    fontSize = 10.sp,
                    color = BLUE,
                    modifier = Modifier.padding(10.dp),
                )
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (viewModel.isAdmin) {
                OutlinedButton(
                    onClick = viewModel::fixHargaBeli,
                    enabled = !state.fixing,
                    modifier = Modifier.heightIn(min = 44.dp).testTag("report_detail_fix"),
                ) { Text(if (state.fixing) "Menyinkronkan..." else "Sesuaikan Harga Beli Hari Ini", fontSize = 10.sp) }
            }
        }
        DetailSearch(state.detailSearch, viewModel::setDetailSearch)
        SortChips(
            prefix = "report_sort_log",
            options = listOf(
                "created_at" to "Waktu", "operator" to "Operator", "boolean" to "Arah",
                "qty" to "Qty", "price_1" to "Harga", "ref_baru" to "Ref",
            ),
            current = state.logSort,
            onSort = viewModel::sortLog,
        )

        if (view.logs.isEmpty()) {
            MissingRow("Tidak ada data log stock.")
        } else {
            ReportTable(
                headers = listOf(
                    "Waktu", "Operator", "In/Out", "ID Lama", "Nama Barang", "Qty",
                    "Harga Satuan", "Subtotal Jual", "Subtotal Modal", "Laba Kotor", "Ref Nota", "Catatan",
                ),
                widths = listOf(56.dp, 90.dp, 56.dp, 80.dp, 160.dp, 50.dp, 90.dp, 100.dp, 100.dp, 90.dp, 90.dp, 130.dp),
                rows = view.logs.map { log ->
                    val laba = ReportFeed.labaOf(log, view.menusById)
                    listOf(
                        ReportFeed.timeLabel(log.createdAt),
                        log.operator.ifBlank { "-" },
                        log.direction,
                        log.item.ifBlank { "-" },
                        log.displayName.ifBlank { "-" },
                        log.qty.stripTrailingZeros().toPlainString(),
                        Money.formatRupiah(log.price1),
                        Money.formatRupiah(log.subJual),
                        Money.formatRupiah(log.subModal),
                        Money.formatRupiah(laba),
                        log.refBaru.ifBlank { "-" },
                        log.note.ifBlank { "-" },
                    )
                },
                tags = view.logs.map { "report_log_row_${it.id}" },
                maxHeight = 320.dp,
            )
        }

        SummaryChips(
            listOfNotNull(
                ("Jml Pergerakan" to "${view.logStats.movements} Baris").takeIf { view.logStats.movements > 0 },
                ("Total Qty In" to "${view.logStats.qtyIn.stripTrailingZeros().toPlainString()} Item").takeIf { view.logStats.qtyIn.signum() > 0 },
                ("Total Qty Out" to "${view.logStats.qtyOut.stripTrailingZeros().toPlainString()} Item").takeIf { view.logStats.qtyOut.signum() > 0 },
                ("Estimasi Penjualan" to Money.formatRupiah(view.logStats.penjualan)).takeIf { view.logStats.penjualan.signum() > 0 },
                ("Laba Kotor Est." to Money.formatRupiah(view.logStats.laba)).takeIf { view.logStats.laba.signum() > 0 },
            ),
        )
    }
}

@Composable
private fun KasTab(state: ReportUiState, view: ReportDetailView, viewModel: ReportViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChipRow(
            options = listOf("semua" to "Semua Mutasi", "in" to "Masuk (In)", "out" to "Keluar (Out)"),
            selected = state.cashMutasi,
            tagPrefix = "report_cash_mutasi",
            onSelect = viewModel::setCashMutasi,
        )
        AccountChips(
            label = "Semua Akun",
            options = view.cashAccounts,
            selected = state.cashAccount,
            tagPrefix = "report_cash_account",
            onSelect = viewModel::setCashAccount,
        )
        AccountChips(
            label = "Semua Jenis Kas",
            options = view.cashJenis,
            selected = state.cashJenis,
            tagPrefix = "report_cash_jenis",
            onSelect = viewModel::setCashJenis,
        )
        DetailSearch(state.detailSearch, viewModel::setDetailSearch)
        SortChips(
            prefix = "report_sort_cash",
            options = listOf("created_at" to "Waktu", "jenis" to "Jenis", "mutasi" to "Mutasi", "nominal" to "Nominal"),
            current = state.cashSort,
            onSort = viewModel::sortCash,
        )

        if (view.cash.isEmpty()) {
            MissingRow("Tidak ada data cashflow.")
        } else {
            ReportTable(
                headers = listOf(
                    "Waktu", "Operator", "Pihak / Note", "Jenis", "Mutasi", "Akun Sumber",
                    "Akun Tujuan", "Nominal", "Ref Nota", "Catatan Tambahan",
                ),
                widths = listOf(56.dp, 90.dp, 120.dp, 100.dp, 60.dp, 100.dp, 100.dp, 100.dp, 90.dp, 130.dp),
                rows = view.cash.map { cash ->
                    val isIn = cash.mutasi == "in" || cash.mutasi.equals("Masuk", ignoreCase = true)
                    listOf(
                        ReportFeed.timeLabel(cash.createdAt),
                        cash.operator.ifBlank { "-" },
                        cash.persontext.ifBlank { cash.person.ifBlank { "-" } },
                        cash.jenis,
                        cash.mutasi,
                        cash.acc1.ifBlank { cash.account1.ifBlank { "-" } },
                        cash.acc2.ifBlank { cash.account2.ifBlank { "-" } },
                        (if (isIn) "+" else "-") + Money.formatRupiah(cash.nominal.abs()),
                        cash.refBaru.ifBlank { "-" },
                        cash.note.ifBlank { "-" },
                    )
                },
                tags = view.cash.map { "report_cash_row_${it.id}" },
                maxHeight = 320.dp,
            )
        }

        SummaryChips(
            listOfNotNull(
                ("Total Jurnal Kas" to "${view.cashStats.count} Aktivitas").takeIf { view.cashStats.count > 0 },
                ("Total Kas Masuk" to "+${Money.formatRupiah(view.cashStats.masuk)}").takeIf { view.cashStats.masuk.signum() > 0 },
                ("Total Kas Keluar" to "-${Money.formatRupiah(view.cashStats.keluar)}").takeIf { view.cashStats.keluar.signum() > 0 },
                ("Nett / Selisih Kas" to Money.formatRupiah(view.cashStats.nett)).takeIf { view.cashStats.nett.signum() != 0 },
            ),
        )
    }
}

@Composable
private fun OngkosTab(state: ReportUiState, view: ReportDetailView, viewModel: ReportViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                "${view.ongkosStats.count} DATA ONGKOS",
                fontSize = 10.sp,
                fontWeight = FontWeight.Black,
                color = REPORT_MUTED,
            )
        }
        DetailSearch(state.detailSearch, viewModel::setDetailSearch)

        if (view.ongkos.isEmpty()) {
            MissingRow("Tidak ada data ongkos.")
        } else {
            ReportTable(
                headers = listOf("ID Lama", "Mekanik", "Operator", "Ref", "Ref Nota", "Tanggal", "Ongkos"),
                widths = listOf(90.dp, 110.dp, 90.dp, 90.dp, 90.dp, 90.dp, 100.dp),
                rows = view.ongkos.map { ongkos ->
                    listOf(
                        ongkos.idLama.ifBlank { "-" },
                        ongkos.person.ifBlank { "-" },
                        ongkos.operator.ifBlank { "-" },
                        ongkos.ref.ifBlank { "-" },
                        ongkos.refBaru.ifBlank { "-" },
                        ongkos.date.take(10).ifBlank { "-" },
                        Money.formatRupiah(ongkos.ongkos),
                    )
                },
                tags = view.ongkos.map { "report_ongkos_row_${it.id}" },
                maxHeight = 320.dp,
            )
        }

        SummaryChips(
            listOfNotNull(
                ("Jml Transaksi" to "${view.ongkosStats.count} Entri").takeIf { view.ongkosStats.count > 0 },
                ("Total Ongkos" to Money.formatRupiah(view.ongkosStats.total)).takeIf { view.ongkosStats.total.signum() > 0 },
            ),
        )

        if (view.ongkosStats.perMekanik.isNotEmpty()) {
            SectionLabel("REKAP PER MEKANIK")
            view.ongkosStats.perMekanik.forEach { (nama, total) ->
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(Modifier.padding(10.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(nama, fontSize = 11.sp, fontWeight = FontWeight.Black, color = REPORT_MUTED)
                        Text(Money.formatRupiah(total), fontSize = 11.sp, fontWeight = FontWeight.Black, color = GREEN)
                    }
                }
            }
        }
    }
}

@Composable
private fun AccountChips(
    label: String,
    options: List<String>,
    selected: String,
    tagPrefix: String,
    onSelect: (String) -> Unit,
) {
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        FilterChip(
            selected = selected == "semua",
            onClick = { onSelect("semua") },
            label = { Text(label, fontSize = 10.sp) },
            modifier = Modifier.heightIn(min = 40.dp).testTag("${tagPrefix}_semua"),
        )
        options.forEach { option ->
            FilterChip(
                selected = selected == option,
                onClick = { onSelect(option) },
                label = { Text(option, fontSize = 10.sp) },
                modifier = Modifier.heightIn(min = 40.dp).testTag("${tagPrefix}_$option"),
            )
        }
    }
}

@Composable
private fun DetailSearch(value: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        placeholder = { Text("Cari di detail...", fontSize = 12.sp) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth().testTag("report_detail_search"),
    )
}

@Composable
private fun SortChips(
    prefix: String,
    options: List<Pair<String, String>>,
    current: Pair<String, Boolean>,
    onSort: (String) -> Unit,
) {
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        options.forEach { (key, label) ->
            val active = current.first == key
            FilterChip(
                selected = active,
                onClick = { onSort(key) },
                label = {
                    Text(
                        label + if (active) (if (current.second) " \u2191" else " \u2193") else "",
                        fontSize = 10.sp,
                    )
                },
                modifier = Modifier.heightIn(min = 40.dp).testTag("${prefix}_$key"),
            )
        }
    }
}
