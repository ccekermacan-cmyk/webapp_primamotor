package id.primamotor.pos.ui.report

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Button
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.local.LocalRecordEntity
import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.data.repo.number
import id.primamotor.pos.data.repo.object_
import id.primamotor.pos.data.repo.text
import id.primamotor.pos.domain.CashflowFilter
import id.primamotor.pos.domain.Money
import id.primamotor.pos.ui.EmptyHint
import id.primamotor.pos.ui.history.HistoryRoute
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import java.math.BigDecimal
import java.time.LocalDate

/** Cermin `pages/report.tsx`: Overview + rincian Menu, Log Stock, Kas, Ongkos. */
class ReportViewModel(container: AppContainer) : ViewModel() {
    val menu: StateFlow<List<MenuRow>> = container.repositories.observeMenu()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val cashflow: StateFlow<List<CashflowRow>> = container.repositories.observeCashflow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val logs: StateFlow<List<LocalRecordEntity>> = container.repositories.observeRaw("log_stock")
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val ongkos: StateFlow<List<LocalRecordEntity>> = container.repositories.observeRaw("ongkos")
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val syncAt: StateFlow<Long> = container.database.syncStateDao().observeAll()
        .map { list -> list.lastOrNull()?.lastSyncAt ?: 0L }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0L)
}

@Composable
fun ReportRoute(container: AppContainer) {
    val vm: ReportViewModel = viewModel { ReportViewModel(container) }
    ReportScreen(vm, container)
}

@Composable
fun ReportScreen(viewModel: ReportViewModel, container: AppContainer) {
    var tab by remember { mutableIntStateOf(0) }
    val labels = listOf("Overview", "\uD83D\uDCCB Menu", "\uD83D\uDCE6 Log Stock", "\uD83D\uDCB0 Kas", "\uD83D\uDD27 Ongkos")
    var from by remember { mutableStateOf("") }
    var to by remember { mutableStateOf("") }
    var ascending by remember { mutableStateOf(false) }
    var appliedFrom by remember { mutableStateOf("") }
    var appliedTo by remember { mutableStateOf("") }
    val context = LocalContext.current
    val allMenuPrint by viewModel.menu.collectAsStateWithLifecycle()
    val allCashPrint by viewModel.cashflow.collectAsStateWithLifecycle()
    val allLogsPrint by viewModel.logs.collectAsStateWithLifecycle()
    val allOngkosPrint by viewModel.ongkos.collectAsStateWithLifecycle()

    fun inRange(date: String): Boolean {
        val day = date.take(10)
        if (day.length < 10) return appliedFrom.isBlank() && appliedTo.isBlank()
        if (appliedFrom.isNotBlank() && day < appliedFrom) return false
        if (appliedTo.isNotBlank() && day > appliedTo) return false
        return true
    }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            OutlinedTextField(
                value = from,
                onValueChange = { from = it },
                label = { Text("Dari") },
                singleLine = true,
                modifier = Modifier.weight(1f).testTag("report_from"),
            )
            OutlinedTextField(
                value = to,
                onValueChange = { to = it },
                label = { Text("Sampai") },
                singleLine = true,
                modifier = Modifier.weight(1f).testTag("report_to"),
            )
        }
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            OutlinedButton(
                onClick = { appliedFrom = from.trim(); appliedTo = to.trim() },
                modifier = Modifier.weight(1f),
            ) { Text("Terapkan") }
            OutlinedButton(onClick = { from = ""; to = ""; appliedFrom = ""; appliedTo = "" }, modifier = Modifier.weight(1f)) {
                Text("Reset")
            }
            FilterChip(
                selected = ascending,
                onClick = { ascending = !ascending },
                label = { Text(if (ascending) "Terlama" else "Terbaru") },
            )
        }
        ScrollableTabRow(selectedTabIndex = tab, edgePadding = 8.dp) {
            labels.forEachIndexed { index, label ->
                Tab(
                    selected = tab == index,
                    onClick = { tab = index },
                    text = { Text(label) },
                    modifier = Modifier.testTag("report_tab_$index"),
                )
            }
        }
        Button(
            onClick = {
                ReportPrinter.print(
                    context = context,
                    title = "Report Prima Motor",
                    from = appliedFrom,
                    to = appliedTo,
                    menu = allMenuPrint.filter { inRange(it.createdAt) },
                    cashflow = allCashPrint.filter { inRange(it.createdAt) },
                    logs = allLogsPrint.filter { inRange(it.dateKey) },
                    ongkos = allOngkosPrint.filter { inRange(it.dateKey) },
                )
            },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp).heightIn(min = 48.dp).testTag("report_print"),
        ) { Text("Cetak / Unduh Report") }

        when (tab) {
            0 -> OverviewTab(
                viewModel,
                menuFilter = { row -> inRange(row.createdAt) },
                cashFilter = { row -> inRange(row.createdAt) },
                ascending = ascending,
            )
            1 -> HistoryRoute(container)
            2 -> RawTab(
                viewModel.logs.collectAsStateWithLifecycle().value.filter { inRange(it.dateKey) },
                "item", "qty", "note", ascending,
            )
            3 -> CashTab(
                viewModel.cashflow.collectAsStateWithLifecycle().value.filter { inRange(it.createdAt) },
                ascending,
            )
            else -> RawTab(
                viewModel.ongkos.collectAsStateWithLifecycle().value.filter { inRange(it.dateKey) },
                "person", "ongkos", "keterangan", ascending,
            )
        }
    }
}

@Composable
private fun OverviewTab(
    viewModel: ReportViewModel,
    menuFilter: (MenuRow) -> Boolean = { true },
    cashFilter: (CashflowRow) -> Boolean = { true },
    ascending: Boolean = false,
) {
    val allMenu by viewModel.menu.collectAsStateWithLifecycle()
    val menu = if (ascending) allMenu.reversed() else allMenu
    val filteredMenu = menu.filter(menuFilter)
    val allCash by viewModel.cashflow.collectAsStateWithLifecycle()
    val cashflow = allCash.filter(cashFilter)
    val lastSync by viewModel.syncAt.collectAsStateWithLifecycle()
    val total = filteredMenu.fold(BigDecimal.ZERO) { sum, row -> sum + row.total }
    val unpaid = CashflowFilter.unpaid(filteredMenu)
    val net = CashflowFilter.net(cashflow)
    val daily = CashflowFilter.dailyTotals(filteredMenu)

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        MetricCard("Total nota", Money.formatRupiah(total), "Nota belum lunas: ${unpaid.size}")
        MetricCard("Arus kas bersih", Money.formatRupiah(net), "Masuk dikurangi keluar dari cache")
        MetricCard(
            "Sinkron terakhir",
            if (lastSync == 0L) "Belum pernah" else formatSync(lastSync),
            "Data mengikuti server setiap jaringan tersambung",
        )

        Text("Penjualan per hari", style = MaterialTheme.typography.titleMedium)
        val barColor = MaterialTheme.colorScheme.primary
        Canvas(Modifier.fillMaxWidth().height(180.dp)) {
            if (daily.isEmpty()) return@Canvas
            val max = daily.maxOf { it.second }.toFloat().coerceAtLeast(1f)
            val slot = size.width / daily.size
            daily.forEachIndexed { index, (_, value) ->
                val barHeight = size.height * (value.toFloat() / max) * 0.9f
                drawRect(
                    color = barColor,
                    topLeft = Offset(index * slot + slot * 0.15f, size.height - barHeight),
                    size = Size(slot * 0.7f, barHeight),
                )
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            daily.forEach { (day, _) ->
                Text(day.takeLast(5), style = MaterialTheme.typography.bodySmall)
            }
        }
        Text("Grafik dari cache; server tetap sumber angka final.", style = MaterialTheme.typography.bodySmall)
    }
}

private fun formatSync(epochMillis: Long): String =
    java.time.Instant.ofEpochMilli(epochMillis)
        .atZone(id.primamotor.pos.domain.WibDate.WIB)
        .format(java.time.format.DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"))

@Composable
private fun MetricCard(title: String, value: String, note: String) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.headlineSmall)
            Text(note, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun RawTab(
    rows: List<LocalRecordEntity>,
    field1: String,
    field2: String,
    field3: String,
    ascending: Boolean = false,
) {
    var sortKey by remember { mutableStateOf("tanggal") }
    var sortAsc by remember { mutableStateOf(ascending) }
    val sorted = remember(rows, sortKey, sortAsc) {
        val comparator: Comparator<LocalRecordEntity> = when (sortKey) {
            field1 -> compareBy { it.object_()?.text(field1).orEmpty() }
            field2 -> compareBy { it.object_()?.number(field2) ?: BigDecimal.ZERO }
            else -> compareBy { it.dateKey }
        }
        rows.sortedWith(if (sortAsc) comparator else comparator.reversed())
    }
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            listOf("tanggal" to "Tanggal", field1 to field1, field2 to field2).forEach { (value, label) ->
                FilterChip(
                    selected = sortKey == value,
                    onClick = { if (sortKey == value) sortAsc = !sortAsc else { sortKey = value; sortAsc = true } },
                    label = { Text(label) },
                )
            }
        }
        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (sorted.isEmpty()) item { EmptyHint(message = "Tidak ada data ${field1}.") }
            items(sorted, key = { it.id }) { entity ->
                val row = entity.object_() ?: return@items
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(
                                row.text(field1).ifBlank { entity.id },
                                style = MaterialTheme.typography.titleSmall,
                                modifier = Modifier.weight(1f),
                            )
                            Text(row.number(field2).stripTrailingZeros().toPlainString(), fontWeight = FontWeight.Bold)
                        }
                        Text(row.text(field3), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(entity.dateKey, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun CashTab(rows: List<CashflowRow>, ascending: Boolean = false) {
    var sortKey by remember { mutableStateOf("tanggal") }
    var sortAsc by remember { mutableStateOf(ascending) }
    val sorted = remember(rows, sortKey, sortAsc) {
        val comparator: Comparator<CashflowRow> = when (sortKey) {
            "jenis" -> compareBy { it.jenis.lowercase() }
            "nominal" -> compareBy { it.nominal }
            "mutasi" -> compareBy { it.mutasi.lowercase() }
            else -> compareBy { it.createdAt }
        }
        rows.sortedWith(if (sortAsc) comparator else comparator.reversed())
    }
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            listOf("tanggal" to "Tanggal", "jenis" to "Jenis", "nominal" to "Nominal", "mutasi" to "Mutasi").forEach { (value, label) ->
                FilterChip(
                    selected = sortKey == value,
                    onClick = { if (sortKey == value) sortAsc = !sortAsc else { sortKey = value; sortAsc = true } },
                    label = { Text(label) },
                )
            }
        }
        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (sorted.isEmpty()) item { EmptyHint(message = "Tidak ada data cashflow.") }
            items(sorted, key = { it.id }) { row ->
                Surface(
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(row.jenis.ifBlank { row.note }, style = MaterialTheme.typography.titleSmall)
                            Text(
                                (if (row.mutasi.lowercase() in setOf("out", "keluar")) "-" else "+") +
                                    Money.formatRupiah(row.nominal.abs()),
                                fontWeight = FontWeight.Bold,
                                color = if (row.mutasi.lowercase() in setOf("out", "keluar")) {
                                    MaterialTheme.colorScheme.error
                                } else {
                                    MaterialTheme.colorScheme.primary
                                },
                            )
                        }
                        Text(row.note, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        HorizontalDivider()
                        Text(row.createdAt, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}
