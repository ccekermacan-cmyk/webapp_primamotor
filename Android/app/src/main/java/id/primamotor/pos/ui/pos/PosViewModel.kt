package id.primamotor.pos.ui.pos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.primamotor.pos.data.repo.CashflowInput
import id.primamotor.pos.data.repo.CheckoutForm
import id.primamotor.pos.data.repo.CheckoutRepository
import id.primamotor.pos.data.repo.CheckoutResult
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.Produk
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.data.repo.UserRow
import id.primamotor.pos.domain.CartLine
import id.primamotor.pos.domain.PosValidation
import id.primamotor.pos.domain.WibDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.math.BigDecimal

data class CartEntry(val produk: Produk, val qty: BigDecimal) {
    val subtotal: BigDecimal get() = produk.sell1.multiply(qty)
}

data class CheckoutDraft(
    val menu: String = "Penjualan",
    val payment: String = "Tunai",
    val nominalBayar: String = "",
    val accountId: String = "",
    val note: String = "",
    val tempoDate: String = "",
)

data class PosUiState(
    val query: String = "",
    val cart: List<CartEntry> = emptyList(),
    val draft: CheckoutDraft = CheckoutDraft(),
    val saving: Boolean = false,
    val error: String? = null,
    val saved: CheckoutResult.Saved? = null,
) {
    val total: BigDecimal get() = cart.fold(BigDecimal.ZERO) { sum, entry -> sum + entry.subtotal }
    val qty: BigDecimal get() = cart.fold(BigDecimal.ZERO) { sum, entry -> sum + entry.qty }
}

class PosViewModel(
    private val repos: Repositories,
    private val checkout: CheckoutRepository,
    private val operator: String,
) : ViewModel() {

    private val local = MutableStateFlow(PosUiState())

    val products: StateFlow<List<Produk>> = combine(repos.observeProduk(), local) { rows, state ->
        val query = state.query.trim().lowercase()
        if (query.isEmpty()) rows else rows.filter { product ->
            product.nama.lowercase().contains(query) ||
                product.barcode.contains(query) ||
                product.idLama.lowercase().contains(query) ||
                product.merk.lowercase().contains(query)
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val menus: StateFlow<List<PersonRow>> = repos.observeMenus()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val accounts: StateFlow<List<PersonRow>> = repos.observeAccounts()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val mechanics: StateFlow<List<UserRow>> = repos.observeMekanik()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val state: StateFlow<PosUiState> = local

    fun setQuery(value: String) = local.update { it.copy(query = value) }

    fun setMenu(value: String) = local.update { it.copy(draft = it.draft.copy(menu = value)) }

    fun updateDraft(block: (CheckoutDraft) -> CheckoutDraft) = local.update { it.copy(draft = block(it.draft)) }

    fun add(product: Produk, qty: BigDecimal = BigDecimal.ONE) = local.update { state ->
        val existing = state.cart.firstOrNull { it.produk.id == product.id }
        val next = (existing?.qty ?: BigDecimal.ZERO) + qty
        if (qty.signum() <= 0) return@update state
        if (PosValidation.directionOf(state.draft.menu) == "out" && next > product.stok) {
            return@update state.copy(
                error = "Stok ${product.nama} tidak cukup: tersedia ${product.stok.stripTrailingZeros().toPlainString()}.",
            )
        }
        if (existing == null) {
            state.copy(cart = state.cart + CartEntry(product, next), error = null)
        } else {
            state.copy(
                cart = state.cart.map { if (it.produk.id == product.id) it.copy(qty = next) else it },
                error = null,
            )
        }
    }

    fun setQty(productId: String, qty: BigDecimal) = local.update { state ->
        if (qty.signum() <= 0) {
            state.copy(cart = state.cart.filterNot { it.produk.id == productId })
        } else {
            state.copy(cart = state.cart.map { if (it.produk.id == productId) it.copy(qty = qty) else it })
        }
    }

    fun remove(productId: String) = local.update { state ->
        state.copy(cart = state.cart.filterNot { it.produk.id == productId })
    }

    fun clearError() = local.update { it.copy(error = null) }

    fun dismissSaved() = local.update { it.copy(saved = null, cart = emptyList(), draft = it.draft.copy(nominalBayar = "", note = "", tempoDate = "")) }

    fun commit(mechanic: List<id.primamotor.pos.data.repo.MekanikInput> = emptyList()) {
        val snapshot = local.value
        if (snapshot.saving) return
        local.update { it.copy(saving = true, error = null) }

        viewModelScope.launch {
            val draft = snapshot.draft
            val form = CheckoutForm(
                payment = draft.payment,
                nominalBayar = draft.nominalBayar.toBigDecimalOrNull() ?: BigDecimal.ZERO,
                cashflow = if (draft.accountId.isBlank()) {
                    emptyList()
                } else {
                    listOf(
                        CashflowInput(
                            accountId = draft.accountId,
                            nominal = if (draft.payment == "Tunai") snapshot.total else BigDecimal.ZERO,
                        ),
                    )
                },
                mekanik = mechanic,
                note = draft.note,
                tempoDate = draft.tempoDate,
                createdAtIso = WibDate.nowIso(),
            )
            val cart = snapshot.cart.map {
                CartLine(productId = it.produk.id, nama = it.produk.nama, qty = it.qty, price = it.produk.sell1)
            }
            when (val result = checkout.commit(draft.menu, cart, form, operator)) {
                is CheckoutResult.Saved ->
                    local.update { it.copy(saving = false, saved = result, error = null) }
                is CheckoutResult.Rejected ->
                    local.update { it.copy(saving = false, error = result.message) }
            }
        }
    }
}