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

data class SyncUiState(
    val running: Boolean = false,
    val pushed: Int = 0,
    val pulled: Int = 0,
    val error: String? = null,
)

class SyncViewModel(container: AppContainer) : ViewModel() {
    private val resolver = container.conflictResolver
    private val engine = container.syncEngine
    private val local = kotlinx.coroutines.flow.MutableStateFlow(SyncUiState())

    val state: StateFlow<SyncUiState> = local

    fun syncNow() {
        if (local.value.running) return
        local.value = local.value.copy(running = true, error = null)
        viewModelScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            val outcome = runCatching { engine.run() }
            local.value = outcome.fold(
                onSuccess = { SyncUiState(running = false, pushed = it.pushed, pulled = it.pulled, error = it.error) },
                onFailure = { SyncUiState(running = false, error = it.message ?: "Sinkron gagal.") },
            )
        }
    }

    fun clearMessage() {
        local.value = local.value.copy(error = null, pushed = 0, pulled = 0)
    }

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
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showConflicts by remember { mutableStateOf(false) }

    if (pending == 0 && open.isEmpty() && !state.running && state.error == null) return

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
                when {
                    state.running -> "Menyinkronkan..."
                    state.error != null -> "Sinkron gagal: ${state.error}"
                    open.isNotEmpty() -> "$pending menunggu • ${open.size} perlu ditinjau"
                    else -> "$pending transaksi menunggu sinkron"
                },
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
