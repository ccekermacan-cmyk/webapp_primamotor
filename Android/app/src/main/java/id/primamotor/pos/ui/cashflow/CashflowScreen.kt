package id.primamotor.pos.ui.cashflow

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.domain.CashflowFilter
import id.primamotor.pos.domain.Money
import java.math.BigDecimal

class CashflowViewModel(container: AppContainer) : androidx.lifecycle.ViewModel() {
    val repos = container.repositories
    val cashflow = repos.observeCashflow()
    val people = repos.observePerson()
    val menu = repos.observeMenu()
    val syncState = container.database.syncStateDao().observeAll()
}

@Composable
fun CashflowRoute(container: AppContainer) {
    val vm: CashflowViewModel = viewModel { CashflowViewModel(container) }
    CashflowScreen(vm)
}

@Composable
fun CashflowScreen(viewModel: CashflowViewModel) {
    var tab by remember { mutableIntStateOf(0) }
    val cashflow by viewModel.cashflow.collectAsStateWithLifecycle(emptyList())
    val people by viewModel.people.collectAsStateWithLifecycle(emptyList())
    val menu by viewModel.menu.collectAsStateWithLifecycle(emptyList())
    val sync by viewModel.syncState.collectAsStateWithLifecycle(emptyList())

    Column(Modifier.fillMaxSize()) {
        TabRow(selectedTabIndex = tab) {
            listOf("Kas", "Pelanggan", "Laporan").forEachIndexed { index, label ->
                Tab(
                    selected = tab == index,
                    onClick = { tab = index },
                    text = { Text(label) },
                    modifier = Modifier.testTag("cashflow_tab_$index"),
                )
            }
        }
        when (tab) {
            0 -> CashTab(cashflow)
            1 -> PeopleTab(people)
            else -> ReportTab(menu, sync.lastOrNull()?.lastSyncAt)
        }
    }
}

@Composable
private fun CashTab(rows: List<CashflowRow>) {
    var filter by remember { mutableStateOf(CashflowFilter.SEMUA) }
    val filtered = CashflowFilter.byMutation(rows, filter)
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(CashflowFilter.SEMUA, CashflowFilter.MASUK, CashflowFilter.KELUAR).forEach { option ->
                FilterChip(
                    selected = filter == option,
                    onClick = { filter = option },
                    label = { Text(option) },
                    modifier = Modifier.testTag("cashflow_filter_$option"),
                )
            }
        }
        Text(
            "Selisih: ${Money.formatRupiah(CashflowFilter.net(filtered))}",
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 12.dp),
        )
        LazyColumn(Modifier.fillMaxSize()) {
            items(filtered, key = { it.id }) { row ->
                Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(row.jenis.ifBlank { row.note.ifBlank { "Kas" } })
                        Text(
                            (if (row.mutasi.lowercase() in setOf("out", "keluar")) "-" else "+") +
                                Money.formatRupiah(row.nominal.abs()),
                            color = if (row.mutasi.lowercase() in setOf("out", "keluar")) {
                                MaterialTheme.colorScheme.error
                            } else {
                                MaterialTheme.colorScheme.primary
                            },
                        )
                    }
                    Text(row.note, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun PeopleTab(rows: List<PersonRow>) {
    LazyColumn(Modifier.fillMaxSize()) {
        items(rows, key = { it.id }) { person ->
            Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)) {
                Text(person.nama, fontWeight = FontWeight.SemiBold)
                Text(
                    listOf(person.jenis, person.keterangan).filter { it.isNotBlank() }.joinToString(" • "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            HorizontalDivider()
        }
    }
}

@Composable
private fun ReportTab(menu: List<MenuRow>, lastSyncAt: Long?) {
    val today = CashflowFilter.dailyTotals(menu)
    val total = menu.fold(BigDecimal.ZERO) { sum, row -> sum + row.total }
    val unpaid = CashflowFilter.unpaid(menu)

    Column(Modifier.fillMaxSize().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Total nota: ${Money.formatRupiah(total)}", fontWeight = FontWeight.Bold)
        Text("Nota belum lunas: ${unpaid.size}")
        Text(
            if (lastSyncAt == null || lastSyncAt == 0L) {
                "Data terakhir: belum pernah sinkron"
            } else {
                "Data terakhir: ${WibLabel.short(lastSyncAt)}"
            },
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.testTag("report_last_sync"),
        )

        Text("Penjualan per hari", style = MaterialTheme.typography.titleSmall)
        val barColor = MaterialTheme.colorScheme.primary
        Canvas(Modifier.fillMaxWidth().height(160.dp)) {
            if (today.isEmpty()) return@Canvas
            val max = today.maxOf { it.second }.toFloat().coerceAtLeast(1f)
            val slot = size.width / today.size
            today.forEachIndexed { index, (_, value) ->
                val barHeight = size.height * (value.toFloat() / max) * 0.9f
                drawRect(
                    color = barColor,
                    topLeft = Offset(index * slot + slot * 0.15f, size.height - barHeight),
                    size = Size(slot * 0.7f, barHeight),
                )
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            today.forEach { (day, _) ->
                Text(day.takeLast(5), style = MaterialTheme.typography.bodySmall)
            }
        }
        Text("Grafik dari cache; server tetap sumber angka final.", style = MaterialTheme.typography.bodySmall)
    }
}

private object WibLabel {
    fun short(epochMillis: Long): String =
        java.time.Instant.ofEpochMilli(epochMillis)
            .atZone(id.primamotor.pos.domain.WibDate.WIB)
            .format(java.time.format.DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"))
}