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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.primamotor.pos.domain.CashflowFeed
import id.primamotor.pos.domain.Money
import id.primamotor.pos.ui.media.MediaImages
import id.primamotor.pos.ui.media.RemoteImage

private val HEADER = Color(0xFF0F172A)
private val MUTED = Color(0xFF64748B)
private val HAIRLINE = Color(0xFFE2E8F0)
private val POSITIVE = Color(0xFF047857)
private val NEGATIVE = Color(0xFFBE123C)

@Composable
fun CashflowAccountsTab(
    wallets: List<CashflowFeed.Wallet>,
    activeTab: CashflowFeed.WalletKind,
    showZero: Boolean,
    calculating: Boolean,
    onTab: (CashflowFeed.WalletKind) -> Unit,
    onToggleZero: () -> Unit,
    onRecalculate: () -> Unit,
    onWallet: (CashflowFeed.Wallet) -> Unit,
    token: String?,
) {
    val tabs = listOf(
        CashflowFeed.WalletKind.KAS,
        CashflowFeed.WalletKind.CUSTOMER,
        CashflowFeed.WalletKind.SUPPLIER,
        CashflowFeed.WalletKind.KARYAWAN,
    )
    val visible = wallets.filter { it.kind == activeTab }
    val shown = if (showZero) visible else CashflowFeed.positive(visible)
    val hidden = visible.size - shown.size

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            tabs.forEach { kind ->
                Surface(
                    color = if (kind == activeTab) Color(0xFF0F172A) else Color.White,
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, HAIRLINE),
                    modifier = Modifier.heightIn(min = 40.dp)
                        .testTag("cashflow_account_tab_${kind.tab}")
                        .clickable { onTab(kind) },
                ) {
                    Text(
                        kind.title,
                        fontSize = 11.sp,
                        color = if (kind == activeTab) Color.White else HEADER,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 10.dp),
                        maxLines = 1,
                    )
                }
            }
        }

        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "${shown.size} akun • ${Money.formatRupiah(CashflowFeed.subtotal(shown))}",
                fontSize = 11.sp,
                color = MUTED,
                modifier = Modifier.weight(1f),
            )
            if (activeTab == CashflowFeed.WalletKind.CUSTOMER || activeTab == CashflowFeed.WalletKind.SUPPLIER) {
                OutlinedButton(
                    onClick = onRecalculate,
                    enabled = !calculating,
                    modifier = Modifier.heightIn(min = 40.dp).testTag("cashflow_recalculate"),
                ) { Text(if (calculating) "MENGHITUNG..." else "HITUNG ULANG", fontSize = 10.sp) }
            }
            if (activeTab != CashflowFeed.WalletKind.KAS) {
                TextButton(
                    onClick = onToggleZero,
                    modifier = Modifier.heightIn(min = 40.dp).testTag("cashflow_toggle_zero"),
                ) {
                    Text(
                        if (showZero) "Sembunyikan saldo <= 0" else "Tampilkan saldo <= 0" + if (hidden > 0) " ($hidden)" else "",
                        fontSize = 10.sp,
                    )
                }
            }
        }

        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (shown.isEmpty()) {
                item { Text("Belum ada data saldo ditemukan.", fontSize = 12.sp, color = MUTED) }
            }
            items(shown, key = { "${it.kind.tab}_${it.id}" }) { wallet ->
                WalletCard(wallet, token, onClick = { onWallet(wallet) })
            }
            if (hidden > 0 && !showZero) {
                item {
                    Text(
                        "$hidden akun bersaldo <= 0 disembunyikan.",
                        fontSize = 10.sp,
                        color = MUTED,
                        modifier = Modifier.padding(vertical = 4.dp),
                    )
                }
            }
        }

        Surface(color = Color.White, shadowElevation = 2.dp, modifier = Modifier.fillMaxWidth()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Subtotal", fontSize = 11.sp, color = MUTED, modifier = Modifier.weight(1f))
                Text(
                    Money.formatRupiah(CashflowFeed.subtotal(shown)),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (CashflowFeed.subtotal(shown).signum() < 0) NEGATIVE else POSITIVE,
                )
            }
        }
    }
}

@Composable
private fun WalletCard(wallet: CashflowFeed.Wallet, token: String?, onClick: () -> Unit) {
    Surface(
        color = Color.White,
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, HAIRLINE),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).testTag("cashflow_wallet"),
    ) {
        Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(38.dp), contentAlignment = Alignment.Center) {
                if (wallet.image.isNotBlank() && token != null) {
                    RemoteImage(
                        url = MediaImages.url("user", wallet.id, wallet.image, "80x80"),
                        token = token,
                        contentDescription = wallet.name,
                        modifier = Modifier.size(38.dp).clip(CircleShape),
                    )
                } else {
                    Surface(color = Color(0xFFE0E7FF), shape = CircleShape, modifier = Modifier.size(38.dp)) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                wallet.name.take(2).uppercase(),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF4338CA),
                            )
                        }
                    }
                }
            }
            Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                Text(wallet.name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = HEADER, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(wallet.jenis.ifBlank { wallet.kind.title }, fontSize = 10.sp, color = MUTED, maxLines = 1)
            }
            Text(
                Money.formatRupiah(wallet.balance),
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.End,
                color = if (wallet.balance.signum() < 0) NEGATIVE else POSITIVE,
            )
        }
    }
}
