package id.primamotor.pos.ui.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.primamotor.pos.data.repo.CheckoutResult
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.data.repo.SettlementRepository
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.Settlement
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.math.BigDecimal

data class HistoryUiState(
    val query: String = "",
    val onlyUnpaid: Boolean = false,
    val saving: Boolean = false,
    val error: String? = null,
    val saved: CheckoutResult.Saved? = null,
    val settleFor: MenuRow? = null,
)

class HistoryViewModel(
    private val repos: Repositories,
    private val settlement: SettlementRepository,
    private val operator: String,
) : ViewModel() {

    private val local = MutableStateFlow(HistoryUiState())

    val state: StateFlow<HistoryUiState> = local

    val accounts: StateFlow<List<PersonRow>> = repos.observeAccounts()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val menu: StateFlow<List<MenuRow>> = combine(repos.observeMenu(), local) { rows, state ->
        val query = state.query.trim().lowercase()
        rows
            .filter { row -> query.isBlank() || row.id.contains(query) || row.note.lowercase().contains(query) || row.person.lowercase().contains(query) }
            .filter { row -> !state.onlyUnpaid || row.status != "lunas" }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun setQuery(value: String) = local.update { it.copy(query = value) }

    fun toggleUnpaid() = local.update { it.copy(onlyUnpaid = !it.onlyUnpaid) }

    fun openSettle(row: MenuRow) = local.update { it.copy(settleFor = row, error = null) }

    fun closeSettle() = local.update { it.copy(settleFor = null) }

    fun clearError() = local.update { it.copy(error = null) }

    fun dismissSaved() = local.update { it.copy(saved = null) }

    fun settle(amountText: String, accountId: String) {
        val row = local.value.settleFor ?: return
        val amount = Money.parse(amountText) ?: BigDecimal.ZERO
        if (accountId.isBlank()) {
            local.update { it.copy(error = "Pilih akun kas.") }
            return
        }
        Settlement.error(row.total, row.dibayar, amount)?.let { message ->
            local.update { it.copy(error = message) }
            return
        }

        local.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            when (val result = settlement.settle(row.id, amount, accountId, operator)) {
                is CheckoutResult.Saved ->
                    local.update { it.copy(saving = false, saved = result, settleFor = null) }
                is CheckoutResult.Rejected ->
                    local.update { it.copy(saving = false, error = result.message) }
            }
        }
    }
}