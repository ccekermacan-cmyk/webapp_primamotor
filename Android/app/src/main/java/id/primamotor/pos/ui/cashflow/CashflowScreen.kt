package id.primamotor.pos.ui.cashflow

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.ui.Alignment
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
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(CashflowFilter.SEMUA, CashflowFilter.MASUK, CashflowFilter.KELUAR).forEach { option ->
                FilterChip(
                    selected = filter == option,
                    onClick = { filter = option },
                    label = { Text(option) },
                    modifier = Modifier.heightIn(min = 44.dp).testTag("cashflow_filter_$option"),
                )
            }
        }
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        ) {
            Column(Modifier.padding(18.dp)) {
                Text("Selisih kas", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                Text(
                    Money.formatRupiah(CashflowFilter.net(filtered)),
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
        }
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (filtered.isEmpty()) item { id.primamotor.pos.ui.EmptyHint() }
            items(filtered, key = { it.id }) { row ->
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(row.jenis.ifBlank { row.note.ifBlank { "Kas" } }, style = MaterialTheme.typography.titleSmall)
                            Text(
                                row.note.ifBlank { row.person },
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 2,
                            )
                        }
                        Text(
                            (if (row.mutasi.lowercase() in setOf("out", "keluar")) "-" else "+") +
                                Money.formatRupiah(row.nominal.abs()),
                            style = MaterialTheme.typography.titleSmall,
                            color = if (row.mutasi.lowercase() in setOf("out", "keluar")) {
                                MaterialTheme.colorScheme.error
                            } else {
                                MaterialTheme.colorScheme.primary
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PeopleTab(rows: List<PersonRow>) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (rows.isEmpty()) item { id.primamotor.pos.ui.EmptyHint() }
        items(rows, key = { it.id }) { person ->
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surface,
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(person.nama, style = MaterialTheme.typography.titleSmall)
                    Text(
                        listOf(person.jenis, person.keterangan).filter { it.isNotBlank() }.joinToString(" • "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun ReportTab(menu: List<MenuRow>, lastSyncAt: Long?) {
    val today = CashflowFilter.dailyTotals(menu)
    val total = menu.fold(BigDecimal.ZERO) { sum, row -> sum + row.total }
    val unpaid = CashflowFilter.unpaid(menu)

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.surface,
            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Total nota", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(Money.formatRupiah(total), style = MaterialTheme.typography.headlineSmall)
                Text("Nota belum lunas: ${unpaid.size}", style = MaterialTheme.typography.bodyMedium)
            }
        }
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
        Text("Data disegarkan otomatis saat jaringan tersambung.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private object WibLabel {
    fun short(epochMillis: Long): String =
        java.time.Instant.ofEpochMilli(epochMillis)
            .atZone(id.primamotor.pos.domain.WibDate.WIB)
            .format(java.time.format.DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"))
}