package id.primamotor.pos.ui.sync

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.local.OutboxEntity
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class SyncViewModel(container: AppContainer) : ViewModel() {
    private val resolver = container.conflictResolver

    val pending: StateFlow<Int> = resolver.pendingCount()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    val open: StateFlow<List<OutboxEntity>> = resolver.observeOpen()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun retry(requestId: String) = viewModelScope.launch { resolver.retry(requestId) }

    fun void(requestId: String) = viewModelScope.launch { resolver.void(requestId) }
}

/** Strip tipis di atas: jumlah antrean sinkron, merah bila ada transaksi ditolak. */
@Composable
fun SyncStatusBar(viewModel: SyncViewModel, modifier: Modifier = Modifier) {
    val pending by viewModel.pending.collectAsStateWithLifecycle()
    val open by viewModel.open.collectAsStateWithLifecycle()
    var showConflicts by remember { mutableStateOf(false) }

    if (pending == 0 && open.isEmpty()) return

    Surface(
        modifier = modifier.fillMaxWidth(),
        color = if (open.isEmpty()) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.errorContainer,
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .clickable { showConflicts = true }
                .padding(horizontal = 12.dp, vertical = 4.dp),
        ) {
            Text(
                if (open.isEmpty()) "$pending transaksi menunggu sinkron" else "$pending menunggu • ${open.size} perlu ditinjau",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.testTag("sync_status"),
            )
        }
    }

    if (showConflicts) {
        ConflictSheet(
            open = open,
            onRetry = viewModel::retry,
            onVoid = viewModel::void,
            onDismiss = { showConflicts = false },
        )
    }
}

@Composable
private fun ConflictSheet(
    open: List<OutboxEntity>,
    onRetry: (String) -> Unit,
    onVoid: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var voidFor by remember { mutableStateOf<OutboxEntity?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text("Tutup") } },
        title = { Text("Transaksi perlu ditinjau") },
        text = {
            LazyColumn {
                items(open, key = { it.requestId }) { row ->
                    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                        Text(row.requestId.take(12), style = MaterialTheme.typography.bodySmall)
                        Text(
                            row.lastError ?: "Ditolak server",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                        )
                        Row {
                            TextButton(onClick = { onRetry(row.requestId) }) { Text("Kirim ulang") }
                            TextButton(onClick = { voidFor = row }) { Text("Batalkan") }
                        }
                    }
                }
            }
        },
    )

    voidFor?.let { row ->
        AlertDialog(
            onDismissRequest = { voidFor = null },
            confirmButton = {
                TextButton(onClick = {
                    onVoid(row.requestId)
                    voidFor = null
                }) { Text("Batalkan transaksi") }
            },
            dismissButton = { TextButton(onClick = { voidFor = null }) { Text("Kembali") } },
            title = { Text("Batalkan transaksi?") },
            text = { Text("Stok dan saldo kas lokal dibalik sesuai transaksi ini. Data di server tetap ditolak.") },
        )
    }
}
