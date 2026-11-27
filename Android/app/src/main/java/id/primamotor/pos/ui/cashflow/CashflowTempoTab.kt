package id.primamotor.pos.ui.cashflow

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.domain.CashflowFeed
import id.primamotor.pos.domain.Money

private val HEADER = Color(0xFF0F172A)
private val MUTED = Color(0xFF64748B)
private val HAIRLINE = Color(0xFFE2E8F0)
private val ROSE = Color(0xFFBE123C)
private val ROSE_SOFT = Color(0xFFFFE4E6)
private val AMBER = Color(0xFFB45309)
private val AMBER_SOFT = Color(0xFFFEF3C7)
private val EMERALD = Color(0xFF047857)

@Composable
fun CashflowTempoTab(
    page: TempoPage,
    filter: String,
    wallets: List<CashflowFeed.Wallet>,
    onFilter: (String) -> Unit,
    onPage: (Int) -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                "Daftar Pembelian Belum Lunas (Monitoring Jatuh Tempo Hutang)",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = HEADER,
            )
            Text(
                "Klik pada banner metrik di bawah untuk menyaring data berdasarkan keterlambatan pelunasan.",
                fontSize = 10.sp,
                color = MUTED,
            )
        }

        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            item {
                MetricCard(
                    title = "Lewat Jatuh Tempo",
                    count = page.overdueCount,
                    value = page.overdueRest,
                    caption = "Sisa Hutang Terlambat",
                    color = ROSE,
                    soft = ROSE_SOFT,
                    active = filter == "overdue",
                    tag = "cashflow_tempo_overdue",
                ) { onFilter(if (filter == "overdue") "all" else "overdue") }
                MetricCard(
                    title = "Akan Jatuh Tempo",
                    count = page.upcomingCount,
                    value = page.upcomingRest,
                    caption = "Dalam Tenggat Waktu",
                    color = AMBER,
                    soft = AMBER_SOFT,
                    active = filter == "upcoming",
                    tag = "cashflow_tempo_upcoming",
                ) { onFilter(if (filter == "upcoming") "all" else "upcoming") }
                MetricCard(
                    title = "Total Sisa Tagihan",
                    count = page.totalAll,
                    value = page.grandRest,
                    caption = "Total Kewajiban Pembayaran",
                    color = EMERALD,
                    soft = Color(0xFF0F172A),
                    active = filter == "all",
                    tag = "cashflow_tempo_all",
                ) { onFilter("all") }
            }

            if (page.days.isEmpty()) {
                item {
                    Text(
                        "Tidak ada pembelian dalam kategori filter ini.",
                        fontSize = 12.sp,
                        color = MUTED,
                        modifier = Modifier.padding(vertical = 24.dp),
                    )
                }
            }

            page.days.forEach { day ->
                item(key = "tempo_day_${day.key}") {
                    Row(
                        Modifier.fillMaxWidth().padding(top = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Surface(color = if (day.overdue) ROSE else AMBER, shape = RoundedCornerShape(8.dp)) {
                            Text(
                                if (day.overdue) {
                                    "LEWAT JATUH TEMPO (${CashflowFeed.dayText(day.key)})"
                                } else {
                                    "AKAN JATUH TEMPO (${CashflowFeed.dayText(day.key)})"
                                },
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Black,
                                color = Color.White,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 4.dp),
                            )
                        }
                        Text("Batas: ${day.label}", fontSize = 9.sp, color = MUTED, modifier = Modifier.weight(1f), maxLines = 1)
                    }
                }
                items(day.items, key = { it.id }) { row ->
                    TempoRow(row, day, wallets)
                }
            }
        }

        Surface(color = Color.White, shadowElevation = 2.dp, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(horizontal = 12.dp, vertical = 6.dp)) {
                Text(
                    "Tampil ${page.total} / ${page.totalAll} Transaksi  |  Subtotal Hal: ${Money.formatRupiah(page.pageTotal)}",
                    fontSize = 10.sp,
                    color = MUTED,
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TextButton(
                        onClick = { onPage(page.page - 1) },
                        enabled = page.page > 1,
                        modifier = Modifier.heightIn(min = 40.dp).testTag("cashflow_tempo_prev"),
                    ) { Text("SEBELUMNYA", fontSize = 10.sp) }
                    Text(
                        "${page.page} / ${page.pages}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(
                        onClick = { onPage(page.page + 1) },
                        enabled = page.page < page.pages,
                        modifier = Modifier.heightIn(min = 40.dp).testTag("cashflow_tempo_next"),
                    ) { Text("SELANJUTNYA", fontSize = 10.sp) }
                }
            }
        }
    }
}

@Composable
private fun MetricCard(
    title: String,
    count: Int,
    value: java.math.BigDecimal,
    caption: String,
    color: Color,
    soft: Color,
    active: Boolean,
    tag: String,
    onClick: () -> Unit,
) {
    Surface(
        color = if (soft == Color(0xFF0F172A)) soft else soft,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(if (active) 2.dp else 1.dp, if (active) color else HAIRLINE),
        modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp).clickable(onClick = onClick).testTag(tag),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    title.uppercase(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    color = if (soft == Color(0xFF0F172A)) Color(0xFFCBD5E1) else color,
                    modifier = Modifier.weight(1f),
                )
                Text("$count Nota", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = color)
            }
            Text(
                Money.formatRupiah(value),
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                color = if (soft == Color(0xFF0F172A)) Color(0xFF6EE7B7) else color,
            )
            Text(
                caption + "  " + if (active) "(Aktif)" else "(Klik filter)",
                fontSize = 9.sp,
                color = if (soft == Color(0xFF0F172A)) Color(0xFFCBD5E1) else MUTED,
            )
        }
    }
}

@Composable
private fun TempoRow(row: MenuRow, day: CashflowFeed.TempoDay, wallets: List<CashflowFeed.Wallet>) {
    val total = row.total
    val paid = row.dibayar
    val rest = CashflowFeed.remaining(row)
    val percent = CashflowFeed.progressPercent(paid, total)
    val supplier = wallets.firstOrNull { it.id == row.person || it.idLama == row.person }
    val name = supplier?.name ?: row.person.ifBlank { "Supplier Umum" }

    Surface(
        color = Color.White,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, if (day.overdue) ROSE_SOFT else HAIRLINE),
        modifier = Modifier.fillMaxWidth().testTag("cashflow_tempo_row"),
    ) {
        Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.height(56.dp).padding(end = 8.dp)) {
                Surface(
                    color = if (day.overdue) ROSE else AMBER,
                    shape = RoundedCornerShape(2.dp),
                    modifier = Modifier.height(56.dp).padding(end = 0.dp),
                ) {
                    Text(" ", modifier = Modifier.height(56.dp).padding(horizontal = 2.dp))
                }
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        "ID: #" + row.id.takeLast(6).uppercase(),
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = MUTED,
                    )
                    Surface(
                        color = if (day.overdue) ROSE_SOFT else AMBER_SOFT,
                        shape = RoundedCornerShape(6.dp),
                    ) {
                        Text(
                            if (day.overdue) "TERLAMBAT" else "MENUNGGU PELUNASAN",
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Black,
                            color = if (day.overdue) ROSE else AMBER,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp),
                        )
                    }
                }
                Text(name, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = HEADER, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("Progress: $percent%  Terbayar: ${Money.formatRupiah(paid)}", fontSize = 9.sp, color = MUTED)
                Box(Modifier.fillMaxWidth().height(6.dp).background(Color(0xFFF1F5F9), RoundedCornerShape(3.dp))) {
                    Box(
                        Modifier.fillMaxWidth(percent / 100f).height(6.dp).background(EMERALD, RoundedCornerShape(3.dp)),
                    )
                }
            }
            Column(Modifier.padding(start = 8.dp), horizontalAlignment = Alignment.End) {
                Text("Sisa Belum Lunas", fontSize = 8.sp, fontWeight = FontWeight.Black, color = ROSE)
                Text(Money.formatRupiah(rest), fontSize = 13.sp, fontWeight = FontWeight.Black, color = ROSE)
                Text("dari ${Money.formatRupiah(total)}", fontSize = 8.sp, color = MUTED)
            }
        }
    }
}
