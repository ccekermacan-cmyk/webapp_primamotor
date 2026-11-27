package id.primamotor.pos.ui.history

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.Settlement

@Composable
fun HistoryRoute(container: AppContainer) {
    val viewModel: HistoryViewModel = androidx.lifecycle.viewmodel.compose.viewModel {
        HistoryViewModel(
            repos = container.repositories,
            settlement = container.settlementRepository,
            operator = container.tokenStore.cachedUser()?.username ?: "kasir",
        )
    }
    HistoryScreen(viewModel)
}

@Composable
fun HistoryScreen(viewModel: HistoryViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val rows by viewModel.menu.collectAsStateWithLifecycle()

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::setQuery,
                label = { Text("Cari nota / pelanggan") },
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.weight(1f).testTag("history_search"),
            )
            FilterChip(
                selected = state.onlyUnpaid,
                onClick = viewModel::toggleUnpaid,
                label = { Text("Tempo") },
                modifier = Modifier.align(Alignment.CenterVertically).heightIn(min = 48.dp).testTag("history_unpaid"),
            )
        }

        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (rows.isEmpty()) item { id.primamotor.pos.ui.EmptyHint() }
            items(rows, key = { it.id }) { row ->
                val sisa = Settlement.remaining(row.total, row.dibayar)
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
                    modifier = Modifier.fillMaxWidth().clickable { viewModel.openSettle(row) },
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(row.id, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(
                                    row.person.ifBlank { "Pelanggan umum" },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            Text(Money.formatRupiah(row.total), style = MaterialTheme.typography.titleMedium)
                        }
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "${if (row.payment == "cash") "Tunai" else "Tempo"} • dibayar ${Money.formatRupiah(row.dibayar)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Surface(
                                shape = RoundedCornerShape(999.dp),
                                color = if (sisa > java.math.BigDecimal.ZERO) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
                            ) {
                                Text(
                                    if (sisa > java.math.BigDecimal.ZERO) "Sisa ${Money.formatRupiah(sisa)}" else "Lunas",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = if (sisa > java.math.BigDecimal.ZERO) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    val settleFor = state.settleFor
    if (settleFor != null) {
        SettleSheet(
            row = settleFor,
            saving = state.saving,
            error = state.error,
            accounts = viewModel.accounts.collectAsStateWithLifecycle().value,
            onSettle = viewModel::settle,
            onDismiss = viewModel::closeSettle,
        )
    }

    val saved = state.saved
    if (saved != null) {
        AlertDialog(
            onDismissRequest = viewModel::dismissSaved,
            confirmButton = { TextButton(onClick = viewModel::dismissSaved) { Text("Tutup") } },
            title = { Text("Pelunasan tersimpan") },
            text = { Text("Status nota: ${saved.status}. Menunggu sinkron.") },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettleSheet(
    row: MenuRow,
    saving: Boolean,
    error: String?,
    accounts: List<id.primamotor.pos.data.repo.PersonRow>,
    onSettle: (String, String) -> Unit,
    onDismiss: () -> Unit,
) {
    val remaining = Settlement.remaining(row.total, row.dibayar)
    var amount by remember(row.id) { mutableStateOf(remaining.stripTrailingZeros().toPlainString()) }
    var accountId by remember(row.id) { mutableStateOf(accounts.firstOrNull()?.id.orEmpty()) }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Pelunasan nota ${row.id}", style = MaterialTheme.typography.titleMedium)
            Text("Sisa tagihan: ${Money.formatRupiah(remaining)}")

            OutlinedTextField(
                value = amount,
                onValueChange = { amount = it },
                label = { Text("Nominal") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("settle_amount"),
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                accounts.take(4).forEach { account ->
                    FilterChip(
                        selected = accountId == account.id,
                        onClick = { accountId = account.id },
                        label = { Text(account.nama) },
                        modifier = Modifier.testTag("settle_account_${account.id}"),
                    )
                }
            }

            if (error != null) {
                Text(error, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("settle_error"))
            }

            Button(
                onClick = { onSettle(amount, accountId) },
                enabled = !saving,
                modifier = Modifier.fillMaxWidth().testTag("settle_submit"),
            ) { Text(if (saving) "Menyimpan..." else "Simpan pelunasan") }
        }
    }
}