package id.primamotor.pos.ui.report

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.patrykandpatrick.vico.compose.cartesian.CartesianChartHost
import com.patrykandpatrick.vico.compose.cartesian.axis.rememberBottom
import com.patrykandpatrick.vico.compose.cartesian.axis.rememberStart
import com.patrykandpatrick.vico.compose.cartesian.layer.continuous
import com.patrykandpatrick.vico.compose.cartesian.layer.rememberLineCartesianLayer
import com.patrykandpatrick.vico.compose.cartesian.rememberCartesianChart
import com.patrykandpatrick.vico.compose.common.fill as vicoFill
import com.patrykandpatrick.vico.core.cartesian.axis.HorizontalAxis
import com.patrykandpatrick.vico.core.cartesian.axis.VerticalAxis
import com.patrykandpatrick.vico.core.cartesian.data.CartesianChartModelProducer
import com.patrykandpatrick.vico.core.cartesian.data.CartesianValueFormatter
import com.patrykandpatrick.vico.core.cartesian.data.lineSeries
import com.patrykandpatrick.vico.core.cartesian.layer.LineCartesianLayer
import androidx.lifecycle.viewmodel.compose.viewModel
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.repo.ReportRow
import id.primamotor.pos.domain.ChartPoint
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.ReportFeed
import java.math.BigDecimal
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal val REPORT_HEADER = Color(0xFF0F172A)
internal val REPORT_MUTED = Color(0xFF64748B)
internal val REPORT_CANVAS = Color(0xFFF8FAFC)
private val BORDER = Color(0xFFE2E8F0)
private val EMERALD = Color(0xFF047857)
private val ROSE = Color(0xFFBE123C)
private val AMBER = Color(0xFFB45309)
private val PURPLE = Color(0xFF7E22CE)

@Composable
fun ReportRoute(container: AppContainer) {
    val vm: ReportViewModel = viewModel { ReportViewModel.from(container) }
    ReportScreen(vm)
}

@Composable
fun ReportScreen(viewModel: ReportViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val summary by viewModel.summary.collectAsStateWithLifecycle()
    val chart by viewModel.chart.collectAsStateWithLifecycle()
    val pageRows by viewModel.pageRows.collectAsStateWithLifecycle()
    val filtered by viewModel.filtered.collectAsStateWithLifecycle()
    val totalPages by viewModel.totalPages.collectAsStateWithLifecycle()
    val detail by viewModel.detailView.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    LaunchedEffect(state.message, state.error) {
        (state.error ?: state.message)?.let {
            snackbar.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    val piutang = pageRows.fold(BigDecimal.ZERO) { sum, row -> sum + row.piutang }
    val hutang = pageRows.fold(BigDecimal.ZERO) { sum, row -> sum + row.hutang }

    Scaffold(
        containerColor = REPORT_CANVAS,
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ReportHeader(
                onGenerate = viewModel::openGenerate,
                onExport = {
                    scope.launch {
                        val result = runCatching {
                            withContext(Dispatchers.IO) {
                                ReportExport.write(context, pageRows, summary, state.from, state.to)
                            }
                        }
                        result.onSuccess { ReportExport.share(context, it) }
                            .onFailure { snackbar.showSnackbar("Ekspor gagal: ${it.message ?: "coba lagi"}") }
                    }
                },
                onPrint = {
                    ReportPrinter.print(
                        context = context,
                        title = "Analitik Laporan Prima Motor",
                        from = state.from,
                        to = state.to,
                        rows = pageRows,
                        summary = summary,
                    )
                },
            )

            FilterCard(
                query = state.queryInput,
                from = state.from,
                to = state.to,
                onQuery = viewModel::setQueryInput,
                onFrom = viewModel::setFrom,
                onTo = viewModel::setTo,
                onReset = viewModel::resetFilter,
            )

            KpiGrid(
                totalOmset = summary.totalOmset,
                totalLaba = summary.totalLaba,
                totalPengeluaran = summary.totalPengeluaran,
                labaBersih = summary.labaBersih,
                piutang = piutang,
                hutang = hutang,
            )

            InsightCard(summary.insight)

            if (chart.isNotEmpty()) {
                ChartCard(chart = chart, selected = state.metrics, onToggle = viewModel::toggleMetric)
            }

            Text(
                "DETAIL RIWAYAT LAPORAN",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = REPORT_MUTED,
            )

            if (filtered.isEmpty()) {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = Color.White,
                    border = BorderStroke(1.dp, BORDER),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        "Tidak ada data laporan ditemukan untuk filter ini.",
                        fontSize = 13.sp,
                        color = REPORT_MUTED,
                        modifier = Modifier.padding(28.dp),
                    )
                }
            } else {
                ReportTable(
                    headers = listOf("Tanggal", "Keterangan", "Omset", "Laba", "Keluar", "Piutang", "Hutang", "Kasir Final"),
                    widths = listOf(96.dp, 150.dp, 108.dp, 100.dp, 96.dp, 96.dp, 96.dp, 108.dp),
                    rows = pageRows.map { row ->
                        listOf(
                            ReportFeed.formatDate(row.createdAt),
                            row.text.ifBlank { "-" },
                            Money.formatRupiah(row.omset),
                            Money.formatRupiah(row.labaKotor),
                            Money.formatRupiah(row.pengeluaran),
                            Money.formatRupiah(row.piutang),
                            Money.formatRupiah(row.hutang),
                            Money.formatRupiah(row.kasirToko),
                        )
                    },
                    tags = pageRows.map { "report_row_${it.id}" },
                    onRowClick = { index -> pageRows.getOrNull(index)?.let(viewModel::openDetail) },
                )

                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "Hal. ${state.page} / ${totalPages.coerceAtLeast(1)}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Black,
                        color = REPORT_MUTED,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { viewModel.setPage(state.page - 1) },
                            enabled = state.page > 1,
                            modifier = Modifier.heightIn(min = 44.dp).testTag("report_prev"),
                        ) { Text("Prev") }
                        OutlinedButton(
                            onClick = { viewModel.setPage(state.page + 1) },
                            enabled = state.page < totalPages,
                            modifier = Modifier.heightIn(min = 44.dp).testTag("report_next"),
                        ) { Text("Next") }
                    }
                }
            }
        }
    }

    if (state.generateOpen) {
        GenerateDialog(
            date = state.generateDate,
            busy = state.busy,
            onDate = viewModel::setGenerateDate,
            onConfirm = viewModel::generate,
            onDismiss = viewModel::closeGenerate,
        )
    }

    state.detail?.let { row ->
        ReportDetailSheet(
            row = row,
            state = state,
            view = detail,
            viewModel = viewModel,
        )
    }

    if (state.askDelete) {
        val target = state.detail
        if (target != null) {
            AlertDialog(
                onDismissRequest = viewModel::cancelDelete,
                title = { Text("Hapus Laporan") },
                text = {
                    Text("Yakin ingin menghapus laporan tanggal ${ReportFeed.formatDate(target.createdAt)} secara permanen?")
                },
                confirmButton = {
                    TextButton(
                        onClick = viewModel::confirmDelete,
                        modifier = Modifier.testTag("report_delete_confirm"),
                    ) { Text("YA, LANJUTKAN PROSES", color = MaterialTheme.colorScheme.error) }
                },
                dismissButton = { TextButton(onClick = viewModel::cancelDelete) { Text("BATALKAN") } },
            )
        }
    }
}

@Composable
private fun ReportHeader(onGenerate: () -> Unit, onExport: () -> Unit, onPrint: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Surface(color = Color(0xFFDBEAFE), shape = RoundedCornerShape(14.dp), modifier = Modifier.size(44.dp)) {
                Box(contentAlignment = Alignment.Center) { Text("AN", fontWeight = FontWeight.Black, color = Color(0xFF2563EB)) }
            }
            Column(Modifier.weight(1f)) {
                Text("Analitik Laporan", fontSize = 22.sp, fontWeight = FontWeight.Black, color = REPORT_HEADER)
                Text(
                    "Overview Mutasi & Performa Bisnis Prima Motor",
                    fontSize = 12.sp,
                    color = REPORT_MUTED,
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = onGenerate,
                modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("report_generate"),
            ) { Text("GENERATE OTOMATIS", fontSize = 11.sp, fontWeight = FontWeight.Black) }
            OutlinedButton(
                onClick = onPrint,
                modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("report_print"),
            ) { Text("UNDUH REPORT", fontSize = 11.sp, fontWeight = FontWeight.Black) }
            OutlinedButton(
                onClick = onExport,
                modifier = Modifier.weight(1f).heightIn(min = 48.dp).testTag("report_export"),
            ) { Text("XLSX", fontSize = 11.sp, fontWeight = FontWeight.Black) }
        }
    }
}

@Composable
private fun FilterCard(
    query: String,
    from: String,
    to: String,
    onQuery: (String) -> Unit,
    onFrom: (String) -> Unit,
    onTo: (String) -> Unit,
    onReset: () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        border = BorderStroke(1.dp, BORDER),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = query,
                onValueChange = onQuery,
                placeholder = { Text("Cari keterangan mutasi...", fontSize = 13.sp) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("report_search"),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = from,
                    onValueChange = onFrom,
                    label = { Text("Dari", fontSize = 11.sp) },
                    placeholder = { Text("yyyy-MM-dd", fontSize = 12.sp) },
                    singleLine = true,
                    modifier = Modifier.weight(1f).testTag("report_from"),
                )
                OutlinedTextField(
                    value = to,
                    onValueChange = onTo,
                    label = { Text("Sampai", fontSize = 11.sp) },
                    placeholder = { Text("yyyy-MM-dd", fontSize = 12.sp) },
                    singleLine = true,
                    modifier = Modifier.weight(1f).testTag("report_to"),
                )
            }
            OutlinedButton(
                onClick = onReset,
                modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp).testTag("report_reset"),
            ) { Text("RESET", fontSize = 11.sp, fontWeight = FontWeight.Black) }
        }
    }
}

@Composable
private fun KpiGrid(
    totalOmset: BigDecimal,
    totalLaba: BigDecimal,
    totalPengeluaran: BigDecimal,
    labaBersih: BigDecimal,
    piutang: BigDecimal,
    hutang: BigDecimal,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KpiCard("Total Omset Kotor", Money.formatRupiah(totalOmset), REPORT_HEADER, Modifier.weight(1f), "report_kpi_omset")
            KpiCard("Laba Penjualan", Money.formatRupiah(totalLaba), REPORT_HEADER, Modifier.weight(1f), "report_kpi_laba")
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KpiCard("Total Pengeluaran", Money.formatRupiah(totalPengeluaran), REPORT_HEADER, Modifier.weight(1f), "report_kpi_pengeluaran")
            KpiCard(
                "Estimasi Laba Bersih",
                Money.formatRupiah(labaBersih),
                if (labaBersih.signum() < 0) ROSE else EMERALD,
                Modifier.weight(1f),
                "report_kpi_bersih",
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            KpiCard("Piutang Penjualan", Money.formatRupiah(piutang), AMBER, Modifier.weight(1f), "report_kpi_piutang")
            KpiCard("Hutang Pembelian", Money.formatRupiah(hutang), PURPLE, Modifier.weight(1f), "report_kpi_hutang")
        }
    }
}

@Composable
private fun KpiCard(title: String, value: String, valueColor: Color, modifier: Modifier = Modifier, tag: String) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = Color.White,
        border = BorderStroke(1.dp, BORDER),
        modifier = modifier.testTag(tag),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Black, color = REPORT_MUTED)
            Text(value, fontSize = 16.sp, fontWeight = FontWeight.Black, color = valueColor, maxLines = 1)
        }
    }
}

@Composable
private fun InsightCard(insight: String) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = Color(0xFFFFFBEB),
        border = BorderStroke(1.dp, Color(0xFFFDE68A)),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("INSIGHT SISTEM", fontSize = 10.sp, fontWeight = FontWeight.Black, color = AMBER)
            Text("\"$insight\"", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF78350F))
        }
    }
}

@Composable
private fun ChartCard(chart: List<ChartPoint>, selected: Set<ReportMetric>, onToggle: (ReportMetric) -> Unit) {
    val active = ReportMetric.entries.filter { selected.contains(it) }
    val modelProducer = rememberChartProducer(chart, active)
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = Color.White,
        border = BorderStroke(1.dp, BORDER),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("GRAFIK TREN KEUANGAN", fontSize = 10.sp, fontWeight = FontWeight.Black, color = REPORT_MUTED)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                ReportMetric.entries.forEach { metric ->
                    FilterChip(
                        selected = selected.contains(metric),
                        onClick = { onToggle(metric) },
                        label = { Text(metric.label, fontSize = 10.sp, color = Color(metric.color)) },
                        modifier = Modifier.heightIn(min = 40.dp).testTag("report_metric_${metric.name.lowercase()}"),
                    )
                }
            }
            if (active.isEmpty() || chart.isEmpty()) {
                Text(
                    "Pilih minimal satu metrik untuk menampilkan grafik.",
                    fontSize = 11.sp,
                    color = REPORT_MUTED,
                    modifier = Modifier.padding(vertical = 12.dp),
                )
                return@Column
            }
            val series = active.map { metric ->
                LineCartesianLayer.Line(
                    fill = LineCartesianLayer.LineFill.single(vicoFill(Color(metric.color))),
                    stroke = LineCartesianLayer.LineStroke.continuous(2.dp),
                )
            }
            CartesianChartHost(
                chart = rememberCartesianChart(
                    rememberLineCartesianLayer(
                        lineProvider = LineCartesianLayer.LineProvider.series(series),
                    ),
                    startAxis = VerticalAxis.rememberStart(),
                    bottomAxis = HorizontalAxis.rememberBottom(
                        valueFormatter = CartesianValueFormatter { _, x, _ ->
                            chart.getOrNull(x.toInt())?.tanggal.orEmpty()
                        },
                    ),
                ),
                modelProducer = modelProducer,
                modifier = Modifier.fillMaxWidth().height(200.dp).testTag("report_chart"),
            )
        }
    }
}

@Composable
private fun rememberChartProducer(chart: List<ChartPoint>, active: List<ReportMetric>): CartesianChartModelProducer {
    val producer = remember { CartesianChartModelProducer() }
    LaunchedEffect(chart, active) {
        producer.runTransaction {
            lineSeries {
                active.forEach { metric -> series(chart.map { metricValue(it, metric).toDouble() }) }
            }
        }
    }
    return producer
}

private fun metricValue(point: ChartPoint, metric: ReportMetric): BigDecimal = when (metric) {
    ReportMetric.OMSET -> point.omset
    ReportMetric.PENGELUARAN -> point.pengeluaran
    ReportMetric.LABA -> point.laba
    ReportMetric.PIUTANG -> point.piutang
    ReportMetric.HUTANG -> point.hutang
}

@Composable
private fun GenerateDialog(
    date: String,
    busy: Boolean,
    onDate: (String) -> Unit,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Generate Laporan Otomatis") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                OutlinedTextField(
                    value = date,
                    onValueChange = onDate,
                    label = { Text("Tanggal Laporan", fontSize = 11.sp) },
                    placeholder = { Text("yyyy-MM-dd", fontSize = 13.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("report_generate_date"),
                )
                Text("Kosongkan untuk hari ini", fontSize = 10.sp, color = REPORT_MUTED)
            }
        },
        confirmButton = {
            TextButton(
                onClick = onConfirm,
                enabled = !busy,
                modifier = Modifier.testTag("report_generate_confirm"),
            ) { Text(if (busy) "GENERATING..." else "GENERATE SEKARANG", fontSize = 11.sp, fontWeight = FontWeight.Black) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("BATALKAN") } },
    )
}

/** Tabel horizontal dengan lebar kolom tetap; `tags` dipakai tes untuk mengklik baris. */
@Composable
internal fun ReportTable(
    headers: List<String>,
    widths: List<Dp>,
    rows: List<List<String>>,
    tags: List<String> = emptyList(),
    onRowClick: ((Int) -> Unit)? = null,
    maxHeight: Dp? = null,
) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = Color.White,
        border = BorderStroke(1.dp, BORDER),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.horizontalScroll(rememberScrollState())) {
            Row(Modifier.background(Color(0xFFF1F5F9)).padding(vertical = 6.dp)) {
                headers.forEachIndexed { index, header ->
                    Text(
                        header.uppercase(),
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Black,
                        color = REPORT_MUTED,
                        maxLines = 1,
                        modifier = Modifier.width(widths.getOrElse(index) { 100.dp }).padding(horizontal = 6.dp),
                    )
                }
            }
            HorizontalDivider(color = BORDER)
            if (maxHeight != null) {
                LazyColumn(Modifier.height(maxHeight)) {
                    itemsIndexed(rows) { index, cells -> TableRow(cells, widths, tags.getOrNull(index), onRowClick, index) }
                }
            } else {
                rows.forEachIndexed { index, cells -> TableRow(cells, widths, tags.getOrNull(index), onRowClick, index) }
            }
        }
    }
}

@Composable
private fun TableRow(
    cells: List<String>,
    widths: List<Dp>,
    tag: String?,
    onRowClick: ((Int) -> Unit)?,
    index: Int,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .let { base ->
                var modifier = base
                if (tag != null) modifier = modifier.testTag(tag)
                if (onRowClick != null) modifier = modifier.clickable { onRowClick(index) }
                modifier
            }
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        cells.forEachIndexed { cellIndex, cell ->
            Text(
                cell,
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                color = REPORT_HEADER,
                maxLines = 1,
                modifier = Modifier.width(widths.getOrElse(cellIndex) { 100.dp }).padding(horizontal = 6.dp),
            )
        }
    }
    HorizontalDivider(color = Color(0xFFF1F5F9))
}

@Composable
internal fun SectionLabel(text: String) {
    Text(text, fontSize = 10.sp, fontWeight = FontWeight.Black, color = REPORT_MUTED)
}

@Composable
internal fun FilterChipRow(
    options: List<Pair<String, String>>,
    selected: String,
    tagPrefix: String,
    onSelect: (String) -> Unit,
) {
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        options.forEach { (value, label) ->
            FilterChip(
                selected = selected == value,
                onClick = { onSelect(value) },
                label = { Text(label, fontSize = 10.sp) },
                modifier = Modifier.heightIn(min = 40.dp).testTag("${tagPrefix}_$value"),
            )
        }
    }
}

/** Daftar chip ringkasan detail; hanya nilai > 0 yang ditampilkan seperti web. */
@Composable
internal fun SummaryChips(items: List<Pair<String, String>>) {
    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        items.forEach { (label, value) ->
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = Color(0xFFF8FAFC),
                border = BorderStroke(1.dp, BORDER),
            ) {
                Column(Modifier.padding(horizontal = 10.dp, vertical = 6.dp)) {
                    Text(label.uppercase(), fontSize = 8.sp, fontWeight = FontWeight.Black, color = REPORT_MUTED)
                    Text(value, fontSize = 11.sp, fontWeight = FontWeight.Black, color = REPORT_HEADER)
                }
            }
        }
    }
}

@Composable
internal fun MissingRow(text: String) {
    Text(text, fontSize = 11.sp, color = REPORT_MUTED, modifier = Modifier.fillMaxWidth().padding(16.dp))
}
