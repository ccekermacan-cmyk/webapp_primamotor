package id.primamotor.pos.ui.account

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.ui.Alignment
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.repo.BonRow
import id.primamotor.pos.data.repo.GajiRow
import id.primamotor.pos.domain.LoanEntry
import id.primamotor.pos.domain.LoanSummary
import id.primamotor.pos.domain.Money

class AccountViewModel(container: AppContainer) : ViewModel() {
    private val user = container.tokenStore.cachedUser()
    val nama: String = user?.name.orEmpty().ifBlank { user?.username.orEmpty() }
    val username: String = user?.username.orEmpty()

    /** Gaji hanya milik pengguna login; baris lain tidak pernah dipancarkan. */
    val gaji = container.repositories.observeGajiSendiri(username)
    val bon = container.repositories.observeBon(user?.id.orEmpty())
}

@Composable
fun AccountRoute(container: AppContainer, onLogout: () -> Unit) {
    val vm: AccountViewModel = viewModel { AccountViewModel(container) }
    AccountScreen(vm, container, onLogout)
}

@Composable
fun AccountScreen(viewModel: AccountViewModel, container: AppContainer, onLogout: () -> Unit) {
    val gaji by viewModel.gaji.collectAsStateWithLifecycle(emptyList())
    val bon by viewModel.bon.collectAsStateWithLifecycle(emptyList())
    val loans = LoanSummary.of(bon.map(BonAdapter::toEntry), gaji.firstOrNull()?.diterima ?: java.math.BigDecimal.ZERO)

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.surface,
            border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(56.dp).background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(18.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        viewModel.nama.trim().take(2).uppercase().ifBlank { "AK" },
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Column(Modifier.weight(1f).padding(start = 14.dp)) {
                    Text(viewModel.nama.ifBlank { "Akun" }, style = MaterialTheme.typography.titleLarge)
                    Text(viewModel.username, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        Text("Gaji saya", style = MaterialTheme.typography.titleMedium)
        if (gaji.isEmpty()) {
            Text("Belum ada data gaji di cache. Data muncul setelah sinkron berhasil.", style = MaterialTheme.typography.bodyMedium)
        } else {
            LazyColumn(Modifier.weight(1f)) {
                items(gaji, key = { it.id }) { row -> GajiRowItem(row) }
                item {
                    Text("Bon", fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp))
                    Text(
                        "Dipinjam ${Money.formatRupiah(loans.borrowed)} • dibayar ${Money.formatRupiah(loans.repaid)}" +
                            (loans.rate?.let { " • $it%" } ?: ""),
                        style = MaterialTheme.typography.bodySmall,
                    )
                    bon.take(10).forEach { bonRow -> BonItem(bonRow) }
                }
            }
        }

        OutlinedButton(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).testTag("logout"),
        ) { Text("Keluar") }
    }

}

@Composable
private fun GajiRowItem(row: GajiRow) {
    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(row.ref.ifBlank { row.id }, style = MaterialTheme.typography.bodySmall)
            Text(Money.formatRupiah(row.diterima), fontWeight = FontWeight.SemiBold)
        }
        Text(
            "Pokok ${Money.formatRupiah(row.pokok)} • lembur ${Money.formatRupiah(row.lembur)} • bpjs ${Money.formatRupiah(row.bpjs)}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
    HorizontalDivider()
}

@Composable
private fun BonItem(row: BonRow) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(if (row.jenis == "out") "Pinjam" else "Bayar", style = MaterialTheme.typography.bodySmall)
        Text(Money.formatRupiah(row.nominal), style = MaterialTheme.typography.bodySmall)
    }
}

object BonAdapter {
    fun toEntry(row: BonRow) = LoanEntry(row.nominal, row.jenis)
}