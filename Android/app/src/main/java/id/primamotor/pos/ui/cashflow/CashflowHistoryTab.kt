package id.primamotor.pos.ui.cashflow

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.primamotor.pos.data.repo.CashflowKind
import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.domain.CashflowFeed
import id.primamotor.pos.domain.Money

private val MUTED = Color(0xFF64748B)
private val HAIRLINE = Color(0xFFE2E8F0)
private val INCOMING = Color(0xFF047857)
private val OUTGOING = Color(0xFFBE123C)

@Composable
fun CashflowHistoryTab(
    state: CashflowUiState,
    history: HistoryPage,
    wallets: List<CashflowFeed.Wallet>,
    kinds: List<CashflowKind>,
    onMutasi: (String) -> Unit,
    onToggleAccount: (String) -> Unit,
    onToggleJenis: (String) -> Unit,
    onDates: (String, String) -> Unit,
    onPreset: (Int) -> Unit,
    onClearDates: () -> Unit,
    onSearch: (String) -> Unit,
    onClearSearch: () -> Unit,
    onPage: (Int) -> Unit,
    onOpen: (CashflowRow) -> Unit,
) {
    var panel by remember { mutableStateOf<String?>(null) }
    var mobileFilter by remember { mutableStateOf(false) }
    val accounts = wallets.filter { it.kind == CashflowFeed.WalletKind.KAS }
    val jenis = when (state.formData.mutasi) {
        "Masuk" -> kinds.filter { it.arah == "in" }
        else -> kinds.filter { it.arah == "out" }
    }.ifEmpty { kinds }

    Column(Modifier.fillMaxSize()) {
        Surface(color = Color.White, shadowElevation = 1.dp, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(horizontal = 12.dp, vertical = 6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(CashflowFeed.SEMUA, CashflowFeed.MASUK, CashflowFeed.KELUAR).forEach { value ->
                        FilterChip(
                            selected = state.filter.mutasi == value,
                            onClick = { onMutasi(value) },
                            label = { Text(value, fontSize = 11.sp) },
                            modifier = Modifier.heightIn(min = 40.dp).testTag("cashflow_mutasi_$value"),
                        )
                    }
                    Box(Modifier.weight(1f))
                    TextButton(
                        onClick = { mobileFilter = true },
                        modifier = Modifier.heightIn(min = 40.dp).testTag("cashflow_mobile_filter"),
                    ) { Text("Filter", fontSize = 11.sp) }
                }
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    PanelToggle("Akun", panel == "account", "cashflow_panel_account") { panel = panel.toggle("account") }
                    PanelToggle("Jenis", panel == "jenis", "cashflow_panel_jenis") { panel = panel.toggle("jenis") }
                    PanelToggle("Tanggal", panel == "tanggal", "cashflow_panel_tanggal") { panel = panel.toggle("tanggal") }
                    PanelToggle("Cari", panel == "search", "cashflow_panel_search") { panel = panel.toggle("search") }
                }

                when (panel) {
                    "account" -> ChipRow(
                        values = accounts.map { it.id to it.name },
                        selected = state.filter.accountIds,
                        tagPrefix = "cashflow_account",
                        onPick = onToggleAccount,
                        onClose = { panel = null },
                    )
                    "jenis" -> ChipRow(
                        values = jenis.map { (it.idLama.ifBlank { it.id }) to it.nama },
                        selected = state.filter.jenisKeys,
                        tagPrefix = "cashflow_jenis",
                        onPick = onToggleJenis,
                        onClose = { panel = null },
                    )
                    "tanggal" -> DatePanel(
                        from = state.filter.from,
                        to = state.filter.to,
                        onDates = onDates,
                        onPreset = onPreset,
                        onClear = { onClearDates(); panel = null },
                    )
                    "search" -> Row(
                        Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        OutlinedTextField(
                            value = state.searchInput,
                            onValueChange = onSearch,
                            placeholder = { Text("Cari transaksi (Nota/Ket)...", fontSize = 12.sp) },
                            singleLine = true,
                            modifier = Modifier.weight(1f).testTag("cashflow_search"),
                        )
                        TextButton(onClick = { onClearSearch(); panel = null }) { Text("X") }
                    }
                }
            }
        }

        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (history.groups.isEmpty()) {
                item { Text("Belum ada data transaksi kas ditemukan.", color = MUTED, modifier = Modifier.padding(16.dp)) }
            }
            history.groups.forEach { (day, rows) ->
                item(key = "day_$day") {
                    Text(
                        day,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = MUTED,
                        modifier = Modifier.padding(top = 6.dp, bottom = 2.dp),
                    )
                }
                items(rows, key = { it.id }) { row ->
                    HistoryRow(row, wallets, onClick = { onOpen(row) })
                }
            }
        }

        Surface(color = Color.White, shadowElevation = 2.dp, modifier = Modifier.fillMaxWidth()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Hal. ${history.page} / ${history.pages}", fontSize = 11.sp, modifier = Modifier.weight(1f))
                TextButton(
                    onClick = { onPage(history.page - 1) },
                    enabled = history.page > 1,
                    modifier = Modifier.heightIn(min = 40.dp).testTag("cashflow_prev"),
                ) { Text("Sebelumnya", fontSize = 11.sp) }
                TextButton(
                    onClick = { onPage(history.page + 1) },
                    enabled = history.page < history.pages,
                    modifier = Modifier.heightIn(min = 40.dp).testTag("cashflow_next"),
                ) { Text("Berikutnya", fontSize = 11.sp) }
            }
        }
    }

    if (mobileFilter) {
        MobileFilterDialog(
            state = state,
            accounts = accounts,
            kinds = kinds,
            onMutasi = onMutasi,
            onToggleAccount = onToggleAccount,
            onToggleJenis = onToggleJenis,
            onDates = onDates,
            onSearch = onSearch,
            onDismiss = { mobileFilter = false },
        )
    }
}

private fun String?.toggle(value: String): String? = if (this == value) null else value

@Composable
private fun PanelToggle(label: String, active: Boolean, tag: String, onClick: () -> Unit) {
    Surface(
        color = if (active) Color(0xFFE0E7FF) else Color.Transparent,
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier.heightIn(min = 36.dp).testTag(tag),
    ) {
        TextButton(onClick = onClick, contentPadding = PaddingValues(horizontal = 8.dp)) {
            Text(label, fontSize = 11.sp, color = if (active) Color(0xFF4338CA) else MUTED)
        }
    }
}

@Composable
private fun ChipRow(
    values: List<Pair<String, String>>,
    selected: Set<String>,
    tagPrefix: String,
    onPick: (String) -> Unit,
    onClose: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        values.forEach { (id, label) ->
            FilterChip(
                selected = id in selected,
                onClick = { onPick(id) },
                label = { Text(label, fontSize = 11.sp, maxLines = 1) },
                modifier = Modifier.heightIn(min = 38.dp).testTag("${tagPrefix}_$id"),
            )
        }
        TextButton(onClick = onClose) { Text("X") }
    }
}

@Composable
private fun DatePanel(
    from: String,
    to: String,
    onDates: (String, String) -> Unit,
    onPreset: (Int) -> Unit,
    onClear: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            OutlinedTextField(
                value = from,
                onValueChange = { onDates(it, to) },
                label = { Text("Dari", fontSize = 11.sp) },
                placeholder = { Text("YYYY-MM-DD", fontSize = 11.sp) },
                singleLine = true,
                modifier = Modifier.weight(1f).testTag("cashflow_from"),
            )
            OutlinedTextField(
                value = to,
                onValueChange = { onDates(from, it) },
                label = { Text("Sampai", fontSize = 11.sp) },
                placeholder = { Text("YYYY-MM-DD", fontSize = 11.sp) },
                singleLine = true,
                modifier = Modifier.weight(1f).testTag("cashflow_to"),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            listOf(0 to "Hari Ini", 7 to "7 Hari", 30 to "30 Hari").forEach { (days, label) ->
                TextButton(onClick = { onPreset(days) }) { Text(label, fontSize = 11.sp) }
            }
            TextButton(onClick = onClear) { Text("X", fontSize = 11.sp) }
        }
    }
}

@Composable
private fun HistoryRow(row: CashflowRow, wallets: List<CashflowFeed.Wallet>, onClick: () -> Unit) {
    val transfer = CashflowFeed.isTransfer(row)
    val incoming = CashflowFeed.isMasuk(row)
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, HAIRLINE),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).testTag("cashflow_row"),
    ) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    CashflowFeed.shortCode(row),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = MUTED,
                )
                Surface(
                    color = Color(0xFFF1F5F9),
                    shape = RoundedCornerShape(6.dp),
                    modifier = Modifier.padding(horizontal = 6.dp),
                ) {
                    Text(row.jenis.ifBlank { "-" }, fontSize = 9.sp, modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp))
                }
                Box(Modifier.weight(1f))
                Text(
                    "${CashflowFeed.sign(row)} ${Money.formatRupiah(row.nominal.abs())}",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (transfer) Color(0xFF4338CA) else if (incoming) INCOMING else OUTGOING,
                )
            }
            Text(row.note.ifBlank { "-" }, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(
                listOfNotNull(
                    CashflowFeed.personName(row.person, row.persontext, wallets).takeIf { it.isNotBlank() },
                    CashflowFeed.accountName(wallets.firstOrNull { it.id == row.account1 || it.idLama == row.acc1 || it.name == row.account1 }, row.account1),
                    row.account2.takeIf { it.isNotBlank() }?.let { target ->
                        "→ " + CashflowFeed.accountName(wallets.firstOrNull { it.id == target || it.idLama == row.acc2 || it.name == target }, target)
                    },
                ).joinToString(" • "),
                fontSize = 10.sp,
                color = MUTED,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(row.operator.ifBlank { "-" }, fontSize = 10.sp, color = MUTED)
                Box(Modifier.weight(1f))
                if (transfer) Text("TRANSFER  ", fontSize = 9.sp, color = Color(0xFF4338CA))
                Text(CashflowFeed.clock(row), fontSize = 10.sp, color = MUTED)
                row.saldoAkhir?.let { saldo ->
                    Text(
                        "  Saldo Akhir: ${Money.formatRupiah(saldo)}",
                        fontSize = 9.sp,
                        color = if (saldo.signum() < 0) OUTGOING else MUTED,
                    )
                }
            }
        }
    }
}
