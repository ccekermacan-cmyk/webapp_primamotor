package id.primamotor.pos.ui.cashflow

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import id.primamotor.pos.AppContainer
import id.primamotor.pos.domain.CashflowFeed

private val HEADER = Color(0xFF0F172A)
private val MUTED = Color(0xFF64748B)
private val CANVAS = Color(0xFFF8FAFC)

@Composable
fun CashflowRoute(container: AppContainer) {
    val vm: CashflowViewModel = viewModel { CashflowViewModel.from(container) }
    CashflowScreen(vm, container.tokenStore.token())
}

@Composable
fun CashflowScreen(viewModel: CashflowViewModel, token: String? = null) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val history by viewModel.history.collectAsStateWithLifecycle()
    val tempo by viewModel.tempo.collectAsStateWithLifecycle()
    val wallets by viewModel.wallets.collectAsStateWithLifecycle()
    val accounts by viewModel.accountOptions.collectAsStateWithLifecycle()
    val kinds by viewModel.kindOptions.collectAsStateWithLifecycle()
    val employees by viewModel.employees.collectAsStateWithLifecycle()
    val customers by viewModel.customers.collectAsStateWithLifecycle()
    val detail by viewModel.detail.collectAsStateWithLifecycle()
    val bonHistory by viewModel.bonHistory.collectAsStateWithLifecycle(emptyList())
    val snackbar = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(state.error) {
        state.error?.let {
            snackbar.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        containerColor = CANVAS,
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = {
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (state.configBon) {
                    Button(
                        onClick = viewModel::openBonForm,
                        modifier = Modifier.heightIn(min = 48.dp).testTag("cashflow_add_bon"),
                    ) { Text("+ BON") }
                }
                Button(
                    onClick = { viewModel.openCashForm() },
                    modifier = Modifier.heightIn(min = 52.dp).testTag("cashflow_add"),
                ) { Text("Catat Kas Baru") }
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Surface(color = Color(0xFFE0E7FF), shape = RoundedCornerShape(14.dp), modifier = Modifier.size(44.dp)) {
                    Box(contentAlignment = Alignment.Center) { Text("Rp", fontWeight = FontWeight.Bold, color = Color(0xFF4338CA)) }
                }
                Column(Modifier.weight(1f)) {
                    Text("Arus Kas", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = HEADER)
                    Text("Monitoring perputaran modal Prima Motor", style = MaterialTheme.typography.bodySmall, color = MUTED)
                }
            }

            Row(
                Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                TabPill("Buku Kas & Saldo", state.activeTab == "accounts", Modifier.weight(1f), "cashflow_tab_accounts") {
                    viewModel.setTab("accounts")
                }
                TabPill("Histori Kas", state.activeTab == "history", Modifier.weight(1f), "cashflow_tab_history") {
                    viewModel.setTab("history")
                }
                if (viewModel.showTempo) {
                    TabPill("Jatuh Tempo", state.activeTab == "tempo", Modifier.weight(1f), "cashflow_tab_tempo") {
                        viewModel.setTab("tempo")
                    }
                }
            }

            Box(Modifier.weight(1f).fillMaxWidth()) {
                when (state.activeTab) {
                    "accounts" -> CashflowAccountsTab(
                        wallets = wallets,
                        activeTab = state.activeAccountTab,
                        showZero = state.showZeroBalances,
                        calculating = state.calculating,
                        onTab = viewModel::setAccountTab,
                        onToggleZero = viewModel::toggleZeroBalances,
                        onRecalculate = viewModel::recalculate,
                        onWallet = { wallet ->
                            when (wallet.kind) {
                                CashflowFeed.WalletKind.KAS -> viewModel.filterByAccount(wallet.id)
                                CashflowFeed.WalletKind.KARYAWAN -> viewModel.openBonHistory(wallet)
                                else -> Unit
                            }
                        },
                        token = token,
                    )
                    "tempo" -> CashflowTempoTab(
                        page = tempo,
                        filter = state.tempoFilter,
                        wallets = wallets,
                        onFilter = viewModel::setTempoFilter,
                        onPage = viewModel::setTempoPage,
                    )
                    else -> CashflowHistoryTab(
                        state = state,
                        history = history,
                        wallets = wallets,
                        kinds = kinds,
                        onMutasi = viewModel::setMutasi,
                        onToggleAccount = viewModel::toggleAccount,
                        onToggleJenis = viewModel::toggleJenis,
                        onDates = viewModel::setDates,
                        onPreset = viewModel::applyDatePreset,
                        onClearDates = viewModel::clearDates,
                        onSearch = viewModel::setSearch,
                        onClearSearch = viewModel::clearSearch,
                        onPage = viewModel::setPage,
                        onOpen = { viewModel.openDetail(it) },
                    )
                }
            }
        }
    }

    state.alert?.let { alert ->
        AlertDialog(
            onDismissRequest = viewModel::dismissAlert,
            title = { Text(alert.title) },
            text = { Text(alert.message) },
            confirmButton = {
                TextButton(onClick = { if (alert.action == null) viewModel.dismissAlert() else viewModel.confirmAction() }) {
                    Text(alert.confirmLabel)
                }
            },
            dismissButton = if (alert.action == null) null else {
                { TextButton(onClick = viewModel::dismissAlert) { Text("Batal") } }
            },
        )
    }

    if (state.modalType == "form") {
        CashFormDialog(
            draft = state.formData,
            accounts = accounts,
            kinds = kinds,
            customers = customers,
            saving = state.saving,
            error = state.error,
            edit = state.selectedId != null,
            onChange = viewModel::updateCash,
            onMutasi = viewModel::changeMutasi,
            onSave = viewModel::saveCash,
            onDismiss = viewModel::closeForm,
        )
    }

    if (state.modalType == "formBon") {
        BonFormDialog(
            draft = state.formDataBon,
            accounts = accounts,
            employees = employees,
            saving = state.saving,
            error = state.error,
            allowCashflow = state.configBon,
            onChange = viewModel::updateBon,
            onSave = viewModel::saveBon,
            onDismiss = viewModel::closeForm,
        )
    }

    detail?.let { row ->
        CashflowDetailDialog(
            row = row,
            wallets = wallets,
            showSaldo = viewModel.showSaldo,
            canDelete = state.canDeleteSelected,
            token = token,
            onEdit = { viewModel.openCashForm(row) },
            onDelete = { viewModel.askDeleteCash(row) },
            onDismiss = viewModel::closeDetail,
        )
    }

    state.bonHistoryWallet?.let { wallet ->
        BonHistoryDialog(
            wallet = wallet,
            rows = bonHistory,
            canDelete = state.canDeleteBonHistory && state.level == 1,
            onDelete = viewModel::askDeleteBon,
            onDismiss = viewModel::closeBonHistory,
        )
    }
}

@Composable
private fun TabPill(label: String, selected: Boolean, modifier: Modifier, tag: String, onClick: () -> Unit) {
    Surface(
        color = if (selected) Color.White else Color.Transparent,
        shape = RoundedCornerShape(14.dp),
        shadowElevation = if (selected) 2.dp else 0.dp,
        modifier = modifier.heightIn(min = 44.dp).testTag(tag),
    ) {
        TextButton(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
            Text(
                label,
                fontSize = 12.sp,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                color = if (selected) HEADER else MUTED,
                maxLines = 1,
            )
        }
    }
}
