package id.primamotor.pos.ui.cashflow

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
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
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.update
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.repo.BonDraft
import id.primamotor.pos.data.repo.BonRow
import id.primamotor.pos.data.repo.CashDraft
import id.primamotor.pos.data.repo.CashSave
import id.primamotor.pos.data.repo.CashflowKind
import id.primamotor.pos.data.repo.CashflowRow
import id.primamotor.pos.data.repo.UserRow
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.domain.CashflowFilter
import id.primamotor.pos.domain.CashflowHistoryFilter
import id.primamotor.pos.domain.Money
import java.math.BigDecimal

data class CashflowUiState(
    val cashOpen: Boolean = false,
    val bonOpen: Boolean = false,
    val cash: CashDraft = CashDraft(),
    val bon: BonDraft = BonDraft(),
    val saving: Boolean = false,
    val error: String? = null,
    val message: String? = null,
    val deleteCash: CashflowRow? = null,
    val deleteBon: BonRow? = null,
)

class CashflowViewModel(private val container: AppContainer) : androidx.lifecycle.ViewModel() {
    val repos = container.repositories
    val cashflow = repos.observeCashflow()
    val people = repos.observePerson()
    val menu = repos.observeMenu()
    val accounts = repos.observeAccounts()
    val kinds = repos.observeCashflowJenis()
    val users = repos.observeUser()
    val syncState = container.database.syncStateDao().observeAll()
    val level: Int = container.tokenStore.cachedUser()?.level ?: 0
    val operator: String = container.tokenStore.cachedUser()?.let { it.name.ifBlank { it.username } }.orEmpty().ifBlank { "Admin" }
    val userId: String = container.tokenStore.cachedUser()?.id.orEmpty()

    private val local = kotlinx.coroutines.flow.MutableStateFlow(CashflowUiState())
    val state: kotlinx.coroutines.flow.StateFlow<CashflowUiState> = local

    val bonHistory: kotlinx.coroutines.flow.Flow<List<BonRow>> = repos.observeBon(userId)

    fun openCash() = local.update { it.copy(cashOpen = true, error = null) }
    fun openBon() = local.update { it.copy(bonOpen = true, error = null) }
    fun closeForms() = local.update { it.copy(cashOpen = false, bonOpen = false, error = null) }
    fun updateCash(block: (CashDraft) -> CashDraft) = local.update { it.copy(cash = block(it.cash)) }
    fun updateBon(block: (BonDraft) -> BonDraft) = local.update { it.copy(bon = block(it.bon)) }
    fun clearMessage() = local.update { it.copy(message = null) }

    fun askDeleteCash(row: CashflowRow) = local.update { it.copy(deleteCash = row) }
    fun askDeleteBon(row: BonRow) = local.update { it.copy(deleteBon = row) }
    fun cancelDelete() = local.update { it.copy(deleteCash = null, deleteBon = null) }

    fun saveCash() {
        val snapshot = local.value
        if (snapshot.saving) return
        local.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            when (val result = container.cashflowRepository.catatKas(snapshot.cash, operator)) {
                is CashSave.Saved -> local.update {
                    it.copy(saving = false, cashOpen = false, cash = CashDraft(), message = "Transaksi kas tersimpan. Menunggu sinkron.")
                }
                is CashSave.Rejected -> local.update { it.copy(saving = false, error = result.message) }
            }
        }
    }

    fun saveBon() {
        val snapshot = local.value
        if (snapshot.saving) return
        local.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            when (val result = container.cashflowRepository.catatBon(snapshot.bon, operator)) {
                is CashSave.Saved -> local.update {
                    it.copy(saving = false, bonOpen = false, bon = BonDraft(), message = "Bon tersimpan. Menunggu sinkron.")
                }
                is CashSave.Rejected -> local.update { it.copy(saving = false, error = result.message) }
            }
        }
    }

    fun confirmDelete() {
        val snapshot = local.value
        local.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            val ok = snapshot.deleteCash?.let { container.cashflowRepository.deleteCashflow(it.id) }
                ?: snapshot.deleteBon?.let { container.cashflowRepository.deleteBon(it.id) }
                ?: false
            local.update {
                it.copy(
                    saving = false,
                    deleteCash = null,
                    deleteBon = null,
                    message = if (ok) "Data dihapus. Server membalik nilai lama saat tersambung." else "Data tidak ditemukan di cache.",
                )
            }
        }
    }
}

@Composable
fun CashflowRoute(container: AppContainer) {
    val vm: CashflowViewModel = viewModel { CashflowViewModel(container) }
    CashflowScreen(vm)
}

@Composable
fun CashflowScreen(viewModel: CashflowViewModel) {
    var tab by remember { mutableIntStateOf(1) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val cashflow by viewModel.cashflow.collectAsStateWithLifecycle(emptyList())
    val people by viewModel.people.collectAsStateWithLifecycle(emptyList())
    val menu by viewModel.menu.collectAsStateWithLifecycle(emptyList())
    val accounts by viewModel.accounts.collectAsStateWithLifecycle(emptyList())
    val kinds by viewModel.kinds.collectAsStateWithLifecycle(emptyList())
    val users by viewModel.users.collectAsStateWithLifecycle(emptyList())
    val bonHistory by viewModel.bonHistory.collectAsStateWithLifecycle(emptyList())
    val sync by viewModel.syncState.collectAsStateWithLifecycle(emptyList())
    val level = viewModel.level
    val snackbarHost = remember { androidx.compose.material3.SnackbarHostState() }
    LaunchedEffect(state.message) {
        state.message?.let { snackbarHost.showSnackbar(it); viewModel.clearMessage() }
    }
    // Sama seperti web: tab Jatuh Tempo hanya untuk level 1, 2, 5, 6.
    val showTempo = level in setOf(1, 2, 5, 6)

    androidx.compose.material3.Scaffold(
        snackbarHost = { androidx.compose.material3.SnackbarHost(snackbarHost) },
        floatingActionButton = {
            Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = viewModel::openBon, modifier = Modifier.testTag("cashflow_add_bon")) { Text("Bon") }
                Button(onClick = viewModel::openCash, modifier = Modifier.testTag("cashflow_add")) { Text("Catat Kas") }
            }
        },
    ) { padding ->
    Column(Modifier.fillMaxSize().padding(padding)) {
        TabRow(selectedTabIndex = tab) {
            val labels = if (showTempo) {
                listOf("Buku Kas & Saldo", "Histori Kas", "Jatuh Tempo")
            } else {
                listOf("Buku Kas & Saldo", "Histori Kas")
            }
            labels.forEachIndexed { index, label ->
                Tab(
                    selected = tab == index,
                    onClick = { tab = index },
                    text = { Text(label) },
                    modifier = Modifier.testTag("cashflow_tab_$index"),
                )
            }
        }
        when (tab) {
            0 -> AccountsTab(cashflow, people, bonHistory, onDeleteBon = viewModel::askDeleteBon)
            1 -> CashTab(cashflow, accounts, kinds, onDelete = viewModel::askDeleteCash)
            else -> TempoTab(menu)
        }
    }
    }

    if (state.cashOpen) {
        CashFormSheet(
            draft = state.cash,
            kinds = kinds,
            accounts = accounts,
            people = people,
            saving = state.saving,
            error = state.error,
            onChange = viewModel::updateCash,
            onSave = viewModel::saveCash,
            onDismiss = viewModel::closeForms,
        )
    }

    if (state.bonOpen) {
        BonFormSheet(
            draft = state.bon,
            accounts = accounts,
            people = people,
            users = users,
            saving = state.saving,
            error = state.error,
            onChange = viewModel::updateBon,
            onSave = viewModel::saveBon,
            onDismiss = viewModel::closeForms,
        )
    }

    (state.deleteCash ?: state.deleteBon)?.let { target ->
        AlertDialog(
            onDismissRequest = viewModel::cancelDelete,
            title = { Text("Hapus Data") },
            text = {
                Text(
                    when (target) {
                        is CashflowRow -> "Hapus transaksi ${target.jenis} ${Money.formatRupiah(target.nominal)}? Saldo dikembalikan saat server mengeksekusi."
                        else -> "Hapus bon ini? Cashflow terkait ikut dibatalkan."
                    },
                )
            },
            confirmButton = {
                TextButton(onClick = viewModel::confirmDelete, enabled = !state.saving) {
                    Text("Hapus", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = viewModel::cancelDelete) { Text("Batal") } },
        )
    }
}

@Composable
private fun CashTab(rows: List<CashflowRow>, accounts: List<PersonRow>, kinds: List<CashflowKind>, onDelete: (CashflowRow) -> Unit) {
    var search by remember { mutableStateOf("") }
    var mutasi by remember { mutableStateOf("semua") }
    var from by remember { mutableStateOf("") }
    var to by remember { mutableStateOf("") }
    var selectedAccounts by remember { mutableStateOf(setOf<String>()) }
    var selectedJenis by remember { mutableStateOf(setOf<String>()) }
    var page by remember { mutableStateOf(1) }
    var detail by remember { mutableStateOf<CashflowRow?>(null) }
    val perPage = 20

    val jenisOptions = kinds.filter {
        when (mutasi) {
            "masuk" -> it.arah == "in"
            "keluar" -> it.arah == "out"
            else -> true
        }
    }.distinctBy { it.idLama.ifBlank { it.id } }

    val filtered = CashflowHistoryFilter.apply(
        rows = rows,
        search = search,
        mutasi = mutasi,
        accountIds = selectedAccounts,
        jenis = selectedJenis,
        from = from,
        to = to,
    )
    val totalPages = maxOf(1, (filtered.size + perPage - 1) / perPage)
    val safePage = page.coerceIn(1, totalPages)
    val paged = filtered.drop((safePage - 1) * perPage).take(perPage)

    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = search,
            onValueChange = { search = it; page = 1 },
            label = { Text("Cari ref / catatan / pihak / jenis") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp).testTag("cashflow_search"),
        )
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("semua" to "Semua", "masuk" to "Masuk", "keluar" to "Keluar").forEach { (value, label) ->
                FilterChip(
                    selected = mutasi == value,
                    onClick = { mutasi = value; selectedJenis = emptySet(); page = 1 },
                    label = { Text(label) },
                    modifier = Modifier.heightIn(min = 44.dp).testTag("cashflow_filter_$label"),
                )
            }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = from,
                onValueChange = { from = it; page = 1 },
                label = { Text("Dari") },
                singleLine = true,
                modifier = Modifier.weight(1f).testTag("cashflow_from"),
            )
            OutlinedTextField(
                value = to,
                onValueChange = { to = it; page = 1 },
                label = { Text("Sampai") },
                singleLine = true,
                modifier = Modifier.weight(1f).testTag("cashflow_to"),
            )
        }
        if (accounts.isNotEmpty()) {
            Text("Dompet", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(horizontal = 16.dp))
            LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(accounts, key = { it.id }) { account ->
                    FilterChip(
                        selected = account.id in selectedAccounts,
                        onClick = {
                            selectedAccounts = if (account.id in selectedAccounts) selectedAccounts - account.id else selectedAccounts + account.id
                            page = 1
                        },
                        label = { Text(account.nama) },
                    )
                }
            }
        }
        if (jenisOptions.isNotEmpty()) {
            Text("Jenis", style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(horizontal = 16.dp))
            LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(jenisOptions, key = { it.id }) { kind ->
                    val value = kind.idLama.ifBlank { kind.id }
                    FilterChip(
                        selected = value in selectedJenis,
                        onClick = {
                            selectedJenis = if (value in selectedJenis) selectedJenis - value else selectedJenis + value
                            page = 1
                        },
                        label = { Text(kind.nama) },
                    )
                }
            }
        }
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        ) {
            Column(Modifier.padding(18.dp)) {
                Text("Selisih kas", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                Text(
                    Money.formatRupiah(CashflowFilter.net(filtered)),
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Text("${filtered.size} transaksi", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
            }
        }
        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (paged.isEmpty()) item { id.primamotor.pos.ui.EmptyHint(message = "Tidak ada data cashflow.") }
            items(paged, key = { it.id }) { row ->
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
                    modifier = Modifier.fillMaxWidth().clickable { detail = row },
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
                        Column(horizontalAlignment = Alignment.End) {
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
                            Text(row.createdAt.take(10), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedButton(onClick = { if (safePage > 1) page = safePage - 1 }, enabled = safePage > 1) { Text("Sebelumnya") }
            Text("Halaman $safePage / $totalPages", style = MaterialTheme.typography.bodySmall)
            OutlinedButton(onClick = { if (safePage < totalPages) page = safePage + 1 }, enabled = safePage < totalPages) { Text("Berikutnya") }
        }
    }

    detail?.let { row ->
        CashflowDetail(row, accounts, onDismiss = { detail = null }, onDelete = { detail = null; onDelete(row) })
    }
}

@Composable
private fun CashflowDetail(
    row: CashflowRow,
    accounts: List<PersonRow>,
    onDismiss: () -> Unit,
    onDelete: () -> Unit,
) {
    val isOut = row.mutasi.lowercase() in setOf("out", "keluar")
    val isTransfer = row.jenis.lowercase().contains("transfer")
    fun accountName(id: String) = accounts.firstOrNull { it.id == id || it.idLama == id }?.nama?.ifBlank { id } ?: id.ifBlank { "-" }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Detail Transaksi") },
        text = {
            Column(
                Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    (if (isTransfer) "↔ " else if (isOut) "- " else "+ ") + Money.formatRupiah(row.nominal.abs()),
                    style = MaterialTheme.typography.headlineSmall,
                    color = if (isOut) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                )
                HorizontalDivider()
                DetailLine("ID Transaksi", row.ref.ifBlank { row.id })
                DetailLine("Waktu Transaksi", row.createdAt)
                DetailLine("Operator", row.operator.ifBlank { "-" })
                DetailLine("Kategori/Jenis", row.jenis.ifBlank { "-" })
                DetailLine("Akun Sumber", accountName(row.account1))
                if (row.account2.isNotBlank()) DetailLine("Akun Tujuan", accountName(row.account2))
                DetailLine("Pihak Terkait", row.persontext.ifBlank { row.person }.ifBlank { "-" })
                DetailLine("Catatan", row.note.ifBlank { "-" })
                if (row.refBaru.isNotBlank()) DetailLine("Ref Transaksi POS", row.refBaru)
                if (row.saldoAwal != null || row.saldoAkhir != null) {
                    HorizontalDivider()
                    Text("Saldo akun sumber", style = MaterialTheme.typography.labelMedium)
                    DetailLine("Sebelum", row.saldoAwal?.let(Money::formatRupiah) ?: "-")
                    DetailLine("Sesudah", row.saldoAkhir?.let(Money::formatRupiah) ?: "-")
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDelete) { Text("Hapus", color = MaterialTheme.colorScheme.error) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Tutup") } },
    )
}

@Composable
private fun DetailLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1f),
            textAlign = androidx.compose.ui.text.style.TextAlign.End,
        )
    }
}

@Composable
private fun AccountsTab(
    cashflow: List<CashflowRow>,
    accounts: List<PersonRow>,
    bonHistory: List<BonRow> = emptyList(),
    onDeleteBon: (BonRow) -> Unit = {},
) {
    val balances = cashflow.groupBy { it.account1 }
        .mapValues { (_, rows) -> rows.fold(BigDecimal.ZERO) { sum, row -> sum + row.signed() } }
    val active = accounts.filter { (balances[it.id] ?: it.number1).signum() != 0 }
    val zero = accounts.filter { (balances[it.id] ?: it.number1).signum() == 0 }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Text("Buku Rekening & Kas", style = MaterialTheme.typography.titleMedium)
        }
        if (accounts.isEmpty()) item { id.primamotor.pos.ui.EmptyHint(message = "Tidak ada akun kas.") }
        items(active, key = { it.id }) { account ->
            AccountCard(account, balances[account.id] ?: account.number1)
        }
        if (zero.isNotEmpty()) {
            item { Text("Akun Kosong/Minus", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            items(zero, key = { it.id }) { account ->
                AccountCard(account, balances[account.id] ?: account.number1)
            }
        }
        item { Text("Riwayat Bon", style = MaterialTheme.typography.titleSmall) }
        if (bonHistory.isEmpty()) item { Text("Belum ada bon.", style = MaterialTheme.typography.bodySmall) }
        items(bonHistory, key = { it.id }) { bon ->
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surface,
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(bon.note.ifBlank { "Bon karyawan" }, style = MaterialTheme.typography.titleSmall)
                        Text(
                            "Bon ${Money.formatRupiah(bon.nominal)} • ${bon.operator}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    TextButton(onClick = { onDeleteBon(bon) }) { Text("Hapus", color = MaterialTheme.colorScheme.error) }
                }
            }
        }
    }
}

@Composable
private fun AccountCard(account: PersonRow, balance: BigDecimal) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(account.nama, style = MaterialTheme.typography.titleSmall)
                Text(account.keterangan, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(
                Money.formatRupiah(balance),
                style = MaterialTheme.typography.titleSmall,
                color = if (balance.signum() < 0) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
            )
        }
    }
}

@Composable
private fun TempoTab(menu: List<MenuRow>) {
    val unpaid = CashflowFilter.unpaid(menu)
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (unpaid.isEmpty()) item { id.primamotor.pos.ui.EmptyHint(message = "Tidak ada nota jatuh tempo.") }
        items(unpaid, key = { it.id }) { row ->
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surface,
                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(row.id, style = MaterialTheme.typography.titleSmall)
                        Text(Money.formatRupiah(row.total), style = MaterialTheme.typography.titleSmall)
                    }
                    Text(
                        "${row.person.ifBlank { "Pelanggan umum" }} • dibayar ${Money.formatRupiah(row.dibayar)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

private fun CashflowRow.signed(): BigDecimal =
    if (mutasi.lowercase() in setOf("out", "keluar")) nominal.negate() else nominal

@Composable
private fun PeopleTab(rows: List<PersonRow>) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (rows.isEmpty()) item { id.primamotor.pos.ui.EmptyHint(message = "Tidak ada data untuk kategori ini.") }
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
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CashFormSheet(
    draft: CashDraft,
    kinds: List<CashflowKind>,
    accounts: List<PersonRow>,
    people: List<PersonRow>,
    saving: Boolean,
    error: String?,
    onChange: ((CashDraft) -> CashDraft) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val capture = id.primamotor.pos.ui.media.rememberPhotoCapture { path -> onChange { it.copy(mediaPath = path) } }
    val transfer = draft.jenis.lowercase().contains("transfer")
    val showPerson = draft.mutasi.equals("Keluar", true) && draft.jenis.lowercase() == "bonkaryawan"

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Catat Kas", style = MaterialTheme.typography.titleLarge)

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Masuk", "Keluar").forEach { mutasi ->
                    FilterChip(
                        selected = draft.mutasi == mutasi,
                        onClick = { onChange { it.copy(mutasi = mutasi) } },
                        label = { Text(if (mutasi == "Masuk") "Kas Masuk" else "Kas Keluar") },
                        modifier = Modifier.heightIn(min = 44.dp).testTag("cash_mutasi_$mutasi"),
                    )
                }
            }

            Text("Jenis Cashflow", style = MaterialTheme.typography.labelLarge)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(kinds, key = { it.id }) { kind ->
                    val arah = kind.arah.ifBlank { "out" }
                    if (arah == "in" != (draft.mutasi == "Masuk")) return@items
                    val value = kind.idLama.ifBlank { kind.id }
                    FilterChip(
                        selected = draft.jenis == value,
                        onClick = { onChange { it.copy(jenis = value) } },
                        label = { Text(kind.nama) },
                    )
                }
            }

            Text("Akun Sumber", style = MaterialTheme.typography.labelLarge)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(accounts, key = { it.id }) { account ->
                    FilterChip(
                        selected = draft.accountId == account.id,
                        onClick = { onChange { it.copy(accountId = account.id) } },
                        label = { Text("${account.nama} (${Money.formatRupiah(account.number1)})") },
                    )
                }
            }

            if (transfer) {
                Text("Akun Tujuan", style = MaterialTheme.typography.labelLarge)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(accounts, key = { it.id }) { account ->
                        FilterChip(
                            selected = draft.account2Id == account.id,
                            onClick = { onChange { it.copy(account2Id = account.id) } },
                            label = { Text(account.nama) },
                        )
                    }
                }
            }

            if (showPerson) {
                Text("Pihak (Customer / Karyawan)", style = MaterialTheme.typography.labelLarge)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(people, key = { it.id }) { person ->
                        FilterChip(
                            selected = draft.personId == person.id,
                            onClick = {
                                onChange {
                                    it.copy(
                                        personId = person.id,
                                        personText = person.idLama.ifBlank { person.nama },
                                    )
                                }
                            },
                            label = { Text(person.nama) },
                        )
                    }
                }
            }

            OutlinedTextField(
                value = draft.nominal.stripTrailingZeros().toPlainString().takeIf { it != "0" }.orEmpty(),
                onValueChange = { raw -> onChange { it.copy(nominal = Money.parse(raw) ?: BigDecimal.ZERO) } },
                label = { Text("Nominal Rupiah") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth().testTag("cash_nominal"),
            )
            OutlinedTextField(
                value = draft.note,
                onValueChange = { value -> onChange { it.copy(note = value) } },
                label = { Text("Catatan") },
                modifier = Modifier.fillMaxWidth().testTag("cash_note"),
            )
            OutlinedButton(onClick = capture, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                Text(if (draft.mediaPath == null) "Lampiran bukti (unggah saat online)" else "Bukti siap diunggah")
            }
            if (error != null) Text(error, color = MaterialTheme.colorScheme.error)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDismiss) { Text("Batal") }
                Button(onClick = onSave, enabled = !saving, modifier = Modifier.testTag("cash_save")) {
                    Text(if (saving) "Menyimpan..." else "Simpan transaksi")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BonFormSheet(
    draft: BonDraft,
    accounts: List<PersonRow>,
    people: List<PersonRow>,
    users: List<UserRow>,
    saving: Boolean,
    error: String?,
    onChange: ((BonDraft) -> BonDraft) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val capture = id.primamotor.pos.ui.media.rememberPhotoCapture { path -> onChange { it.copy(mediaPath = path) } }
    var search by remember { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Tambah Bon Karyawan", style = MaterialTheme.typography.titleLarge)

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                androidx.compose.material3.Checkbox(
                    checked = draft.catatCashflow,
                    onCheckedChange = { checked -> onChange { it.copy(catatCashflow = checked) } },
                )
                Text("Catat ke Cashflow (pengeluaran kas)")
            }

            if (draft.catatCashflow) {
                Text("Akun asal", style = MaterialTheme.typography.labelLarge)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(accounts, key = { it.id }) { account ->
                        FilterChip(
                            selected = draft.accountId == account.id,
                            onClick = { onChange { it.copy(accountId = account.id) } },
                            label = { Text(account.nama) },
                        )
                    }
                }
            }

            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                label = { Text("Cari nama pihak") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Text("Pihak (Customer / Karyawan)", style = MaterialTheme.typography.labelLarge)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                val needle = search.trim().lowercase()
                items(
                    people.filter { needle.isBlank() || it.nama.lowercase().contains(needle) },
                    key = { "p_${it.id}" },
                ) { person ->
                    FilterChip(
                        selected = draft.personRecordId == person.id,
                        onClick = {
                            onChange {
                                it.copy(
                                    personRecordId = person.id,
                                    personUserId = "",
                                    personText = person.idLama.ifBlank { person.nama },
                                )
                            }
                        },
                        label = { Text(person.nama) },
                    )
                }
                items(
                    users.filter { needle.isBlank() || it.name.lowercase().contains(needle) },
                    key = { "u_${it.id}" },
                ) { user ->
                    FilterChip(
                        selected = draft.personUserId == user.id,
                        onClick = {
                            onChange {
                                it.copy(
                                    personUserId = user.id,
                                    personRecordId = "",
                                    personText = user.username.ifBlank { user.name },
                                )
                            }
                        },
                        label = { Text("${user.name.ifBlank { user.username }} (Karyawan)") },
                    )
                }
            }
            if (draft.personText.isNotBlank()) Text("Dipilih: ${draft.personText}")

            OutlinedTextField(
                value = draft.nominal.stripTrailingZeros().toPlainString().takeIf { it != "0" }.orEmpty(),
                onValueChange = { raw -> onChange { it.copy(nominal = Money.parse(raw) ?: BigDecimal.ZERO) } },
                label = { Text("Nominal") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth().testTag("bon_nominal"),
            )
            OutlinedTextField(
                value = draft.note,
                onValueChange = { value -> onChange { it.copy(note = value) } },
                label = { Text("Catatan") },
                modifier = Modifier.fillMaxWidth().testTag("bon_note"),
            )
            OutlinedButton(onClick = capture, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                Text(if (draft.mediaPath == null) "Lampiran bukti (unggah saat online)" else "Bukti siap diunggah")
            }
            if (error != null) Text(error, color = MaterialTheme.colorScheme.error)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDismiss) { Text("Batal") }
                Button(onClick = onSave, enabled = !saving, modifier = Modifier.testTag("bon_save")) {
                    Text(if (saving) "Menyimpan..." else "Simpan bon")
                }
            }
        }
    }
}
