package id.primamotor.pos.ui.pos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.primamotor.pos.data.repo.CashflowInput
import id.primamotor.pos.data.repo.CheckoutForm
import id.primamotor.pos.data.repo.CheckoutRepository
import id.primamotor.pos.data.repo.CheckoutResult
import id.primamotor.pos.data.repo.EditSession
import id.primamotor.pos.data.repo.MekanikInput
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.PosEditRepository
import id.primamotor.pos.data.repo.Produk
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.data.repo.UserRow
import id.primamotor.pos.data.repo.number
import id.primamotor.pos.data.repo.object_
import id.primamotor.pos.data.repo.text
import id.primamotor.pos.domain.CartLine
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.PosPricing
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

data class CartEntry(
    val produk: Produk,
    val qty: BigDecimal,
    /** Harga yang dikunci kasir (mis. saat edit nota). Null = ikut aturan tier. */
    val manualPrice: BigDecimal? = null,
)

data class PricedLine(
    val produk: Produk,
    val qty: BigDecimal,
    val price: BigDecimal,
    val basePrice: BigDecimal,
    val label: String,
    val tiered: Boolean,
    val manualPrice: BigDecimal?,
) {
    val subtotal: BigDecimal get() = price.multiply(qty)
    val normalTotal: BigDecimal get() = produk.sell6.multiply(qty)
    val costTotal: BigDecimal get() = produk.beli.multiply(qty)
}

data class PaymentLine(val accountId: String = "", val nominal: String = "")

data class MechanicLine(val idLama: String = "", val ongkos: String = "")

data class CheckoutDraft(
    val menu: String = "Penjualan",
    val personIdLama: String = "umum1",
    val personName: String = "Umum",
    val payment: String = "Tunai",
    val nominalBayar: String = "",
    val payments: List<PaymentLine> = listOf(PaymentLine()),
    val mechanics: List<MechanicLine> = listOf(MechanicLine()),
    val note: String = "",
    val noteMenu: String = "",
    val tempoDate: String = "",
    val marketplace: String = "",
    val adminFee: String = "",
    val cashback: String = "",
    val mediaCount: Int = 0,
    /** Path foto bukti; diunggah setelah nota dibuat dan jaringan tersedia. */
    val mediaPath: String? = null,
)

data class EditTarget(val menuId: String, val session: EditSession)

data class PosUiState(
    val query: String = "",
    val historyQuery: String = "",
    val cart: List<CartEntry> = emptyList(),
    val draft: CheckoutDraft = CheckoutDraft(),
    val saving: Boolean = false,
    val error: String? = null,
    val saved: CheckoutResult.Saved? = null,
    val edit: EditTarget? = null,
    val deleteTarget: MenuRow? = null,
    val settleFor: MenuRow? = null,
    val settleAccount: String = "",
) {
    val lines: List<PricedLine> get() = cart.map { entry ->
        val prices = PosPricing.Prices(
            beli = entry.produk.beli,
            sell1 = entry.produk.sell1,
            sell2 = entry.produk.sell2,
            sell3 = entry.produk.sell3,
            sell5 = entry.produk.sell5,
            sell6 = entry.produk.sell6,
            min1 = entry.produk.min1,
            min2 = entry.produk.min2,
            min3 = entry.produk.min3,
        )
        val resolved = PosPricing.resolve(
            menu = draft.menu,
            qty = entry.qty,
            personIdLama = draft.personIdLama,
            personName = draft.personName,
            prices = prices,
            manualPrice = entry.manualPrice,
        )
        PricedLine(
            produk = entry.produk,
            qty = entry.qty,
            price = resolved.price,
            basePrice = resolved.basePrice,
            label = resolved.label,
            tiered = resolved.tiered,
            manualPrice = entry.manualPrice,
        )
    }

    val subtotal: BigDecimal get() = lines.fold(BigDecimal.ZERO) { sum, line -> sum + line.subtotal }

    val ongkosTotal: BigDecimal
        get() = if (!PosPricing.isService(draft.menu)) {
            BigDecimal.ZERO
        } else {
            draft.mechanics.fold(BigDecimal.ZERO) { sum, line ->
                sum + (if (line.idLama.isBlank()) BigDecimal.ZERO else Money.parse(line.ongkos) ?: BigDecimal.ZERO)
            }
        }

    val total: BigDecimal
        get() = PosPricing.grandTotal(
            menu = draft.menu,
            subtotal = subtotal,
            ongkos = ongkosTotal,
            adminFee = Money.parse(draft.adminFee) ?: BigDecimal.ZERO,
            cashback = Money.parse(draft.cashback) ?: BigDecimal.ZERO,
        )

    val qty: BigDecimal get() = cart.fold(BigDecimal.ZERO) { sum, entry -> sum + entry.qty }

    val paid: BigDecimal
        get() = draft.payments.fold(BigDecimal.ZERO) { sum, line -> sum + (Money.parse(line.nominal) ?: BigDecimal.ZERO) }

    val isOnline: Boolean get() = PosPricing.isOnline(draft.personIdLama, draft.personName)
}

class PosViewModel(
    private val repos: Repositories,
    private val checkout: CheckoutRepository,
    private val editRepo: PosEditRepository,
    private val settlement: id.primamotor.pos.data.repo.SettlementRepository,
    val operatorName: String,
) : ViewModel() {

    private val local = MutableStateFlow(PosUiState())

    val state: StateFlow<PosUiState> = local

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

    val customers: StateFlow<List<PersonRow>> = repos.observeCustomers()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val accounts: StateFlow<List<PersonRow>> = repos.observeAccounts()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val mechanics: StateFlow<List<UserRow>> = repos.observeMekanik()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** Riwayat singkat di halaman Kasir, sama seperti tabel riwayat web. */
    val history: StateFlow<List<MenuRow>> = combine(repos.observeMenu(), local) { rows, state ->
        val query = state.historyQuery.trim().lowercase()
        rows.filter { row ->
            query.isBlank() || row.id.lowercase().contains(query) ||
                row.person.lowercase().contains(query) || row.note.lowercase().contains(query)
        }.take(50)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun setQuery(value: String) = local.update { it.copy(query = value) }

    fun setHistoryQuery(value: String) = local.update { it.copy(historyQuery = value) }

    fun setMenu(value: String) = local.update { it.copy(draft = it.draft.copy(menu = value), error = null) }

    fun updateDraft(block: (CheckoutDraft) -> CheckoutDraft) = local.update { it.copy(draft = block(it.draft)) }

    fun setCustomer(person: PersonRow) = local.update {
        it.copy(
            draft = it.draft.copy(personIdLama = person.idLama.ifBlank { person.id }, personName = person.nama),
            error = null,
        )
    }

    fun add(product: Produk, qty: BigDecimal = BigDecimal.ONE) = local.update { state ->
        if (qty.signum() <= 0) return@update state
        val existing = state.cart.firstOrNull { it.produk.id == product.id }
        val next = (existing?.qty ?: BigDecimal.ZERO) + qty
        val cart = if (existing == null) {
            state.cart + CartEntry(product, next)
        } else {
            state.cart.map { if (it.produk.id == product.id) it.copy(qty = next) else it }
        }
        val check = PosValidation.stockError(
            cart.map { CartLine(it.produk.id, it.produk.nama, it.qty, it.produk.sell1) },
            cart.map { it.produk.id to it.produk.stok }.toMap(),
            PosValidation.directionOf(state.draft.menu),
        )
        if (check != null) state.copy(error = check) else state.copy(cart = cart, error = null)
    }

    fun setQty(productId: String, qty: BigDecimal) = local.update { state ->
        if (qty.signum() <= 0) {
            state.copy(cart = state.cart.filterNot { it.produk.id == productId })
        } else {
            state.copy(cart = state.cart.map { if (it.produk.id == productId) it.copy(qty = qty) else it })
        }
    }

    fun setManualPrice(productId: String, price: BigDecimal?) = local.update { state ->
        state.copy(cart = state.cart.map { if (it.produk.id == productId) it.copy(manualPrice = price) else it })
    }

    fun remove(productId: String) = local.update { state ->
        state.copy(cart = state.cart.filterNot { it.produk.id == productId })
    }

    fun addPayment() = local.update { it.copy(draft = it.draft.copy(payments = it.draft.payments + PaymentLine())) }

    fun removePayment(index: Int) = local.update { state ->
        state.copy(draft = state.draft.copy(payments = state.draft.payments.filterIndexed { i, _ -> i != index }))
    }

    fun updatePayment(index: Int, block: (PaymentLine) -> PaymentLine) = local.update { state ->
        state.copy(
            draft = state.draft.copy(
                payments = state.draft.payments.mapIndexed { i, line -> if (i == index) block(line) else line },
            ),
        )
    }

    fun addMechanic() = local.update { it.copy(draft = it.draft.copy(mechanics = it.draft.mechanics + MechanicLine())) }

    fun removeMechanic(index: Int) = local.update { state ->
        state.copy(draft = state.draft.copy(mechanics = state.draft.mechanics.filterIndexed { i, _ -> i != index }))
    }

    fun updateMechanic(index: Int, block: (MechanicLine) -> MechanicLine) = local.update { state ->
        state.copy(
            draft = state.draft.copy(
                mechanics = state.draft.mechanics.mapIndexed { i, line -> if (i == index) block(line) else line },
            ),
        )
    }

    fun clearError() = local.update { it.copy(error = null) }

    fun dismissSaved() = local.update {
        it.copy(saved = null, cart = emptyList(), edit = null, draft = CheckoutDraft(menu = it.draft.menu))
    }

    fun askDelete(row: MenuRow) = local.update { it.copy(deleteTarget = row) }

    fun openSettle(row: MenuRow) = local.update {
        it.copy(settleFor = row, settleAccount = it.settleAccount.ifBlank { "kasir" }, error = null)
    }

    fun closeSettle() = local.update { it.copy(settleFor = null) }

    fun setSettleAccount(value: String) = local.update { it.copy(settleAccount = value) }

    /** Pelunasan cepat dari halaman Kasir, sama seperti quick settle web. */
    fun settle() {
        val row = local.value.settleFor ?: return
        val account = local.value.settleAccount
        if (account.isBlank()) {
            local.update { it.copy(error = "Pilih akun kas.") }
            return
        }
        val sisa = id.primamotor.pos.domain.Settlement.remaining(row.total, row.dibayar)
        local.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            when (val result = settlement.settle(row.id, sisa, account, operatorName)) {
                is CheckoutResult.Saved -> local.update { it.copy(saving = false, settleFor = null, saved = result) }
                is CheckoutResult.Rejected -> local.update { it.copy(saving = false, error = result.message) }
            }
        }
    }

    fun cancelDelete() = local.update { it.copy(deleteTarget = null) }

    fun confirmDelete() {
        val row = local.value.deleteTarget ?: return
        local.update { it.copy(deleteTarget = null) }
        viewModelScope.launch {
            val session = editRepo.prepare(row.id)
            if (session == null) {
                local.update { it.copy(error = "Data nota tidak ada di cache. Sinkronkan dulu.") }
                return@launch
            }
            when (val result = editRepo.delete(session)) {
                is CheckoutResult.Saved ->
                    local.update { it.copy(saved = result, edit = null) }
                is CheckoutResult.Rejected ->
                    local.update { it.copy(error = result.message) }
            }
        }
    }

    /** Muat nota ke keranjang untuk diedit, sama seperti `handleEditHistoryToCart` web. */
    fun loadForEdit(row: MenuRow) {
        viewModelScope.launch {
            val session = editRepo.prepare(row.id)
            if (session == null) {
                local.update { it.copy(error = "Item transaksi tidak dapat dimuat. Sinkronkan dulu.") }
                return@launch
            }
            val cart = session.logs.mapNotNull { entity ->
                val log = entity.object_() ?: return@mapNotNull null
                val productId = log.text("item_baru").ifBlank { log.text("item") }
                val product = repos.produkById(productId)
                val qty = log.number("qty")
                val price = log.number("price_1")
                if (product == null) {
                    val fallback = Produk(
                        id = productId.ifBlank { entity.id },
                        nama = log.text("item").ifBlank { "Item transaksi" },
                        idLama = log.text("item"),
                        kategori = "Umum",
                        merk = "",
                        jenis = row.note,
                        varian = "",
                        tipe = "",
                        unit = "Pcs",
                        barcode = "",
                        keterangan = "",
                        stok = BigDecimal.ZERO,
                        beli = log.number("price_2"),
                        sell1 = price, sell2 = price, sell3 = price, sell4 = price, sell5 = price, sell6 = price,
                        min1 = BigDecimal.ZERO, min2 = BigDecimal.ZERO, min3 = BigDecimal.ZERO,
                    )
                    CartEntry(fallback, qty, manualPrice = price)
                } else {
                    CartEntry(product, qty, manualPrice = price)
                }
            }
            val firstCash = session.cashflows.firstOrNull()?.object_()
            local.update {
                it.copy(
                    cart = cart,
                    edit = EditTarget(row.id, session),
                    draft = it.draft.copy(
                        menu = row.note.ifBlank { it.draft.menu },
                        personIdLama = session.menu.text("person").ifBlank { "umum1" },
                        payment = if (session.menu.text("payment") == "cash") "Tunai" else "Tempo",
                        tempoDate = session.menu.text("tempo"),
                        noteMenu = session.menu.text("text"),
                        marketplace = session.menu.text("marketplace"),
                        adminFee = session.menu.number("admin").stripTrailingZeros().toPlainString(),
                        cashback = session.menu.number("cashback").stripTrailingZeros().toPlainString(),
                        payments = session.cashflows.map { cf ->
                            val rowJson = cf.object_()
                            PaymentLine(rowJson?.text("account_1").orEmpty(), rowJson?.number("nominal")?.stripTrailingZeros()?.toPlainString().orEmpty())
                        }.ifEmpty { listOf(PaymentLine(firstCash?.text("account_1").orEmpty())) },
                    ),
                    error = null,
                )
            }
        }
    }

    fun commit() {
        val snapshot = local.value
        if (snapshot.saving) return
        val draft = snapshot.draft
        val payments = draft.payments.map { PaymentLine(it.accountId, it.nominal) }
        val mechanics = draft.mechanics
        val form = CheckoutForm(
            personIdLama = draft.personIdLama,
            personName = draft.personName,
            payment = draft.payment,
            nominalBayar = Money.parse(draft.nominalBayar) ?: BigDecimal.ZERO,
            cashflow = payments
                .filter { it.accountId.isNotBlank() }
                .map { CashflowInput(it.accountId, Money.parse(it.nominal) ?: BigDecimal.ZERO) },
            mekanik = mechanics
                .filter { it.idLama.isNotBlank() }
                .map { MekanikInput(it.idLama, Money.parse(it.ongkos) ?: BigDecimal.ZERO) },
            note = draft.note,
            noteMenu = draft.noteMenu,
            tempoDate = draft.tempoDate,
            marketplace = draft.marketplace,
            adminFee = Money.parse(draft.adminFee) ?: BigDecimal.ZERO,
            cashback = Money.parse(draft.cashback) ?: BigDecimal.ZERO,
            mediaCount = draft.mediaCount,
            mediaPath = draft.mediaPath,
            createdAtIso = WibDate.nowIso(),
        )

        val errors = PosValidation.checkoutErrors(
            menu = draft.menu,
            cartCount = snapshot.cart.size,
            mechanics = form.mekanik.map { PosValidation.MechanicLine(it.idLama, it.ongkos) },
            payments = payments.map { PosValidation.PaymentLine(it.accountId, Money.parse(it.nominal) ?: BigDecimal.ZERO) },
            isOnline = snapshot.isOnline,
            marketplace = draft.marketplace,
            adminFee = form.adminFee,
            noteMenu = draft.noteMenu,
            payment = draft.payment,
            tempoDate = draft.tempoDate,
        )
        errors.firstOrNull()?.let { message ->
            local.update { it.copy(error = message) }
            return
        }

        local.update { it.copy(saving = true, error = null) }
        val cart = snapshot.lines.map { line ->
            CartLine(
                productId = line.produk.id,
                nama = line.produk.nama,
                qty = line.qty,
                price = line.price,
                normalPrice = line.produk.sell6,
                cost = line.produk.beli,
            )
        }

        viewModelScope.launch {
            val edit = snapshot.edit
            val result = if (edit == null) {
                checkout.commit(draft.menu, cart, form, operatorName)
            } else {
                editRepo.update(edit.session, draft.menu, cart, form, operatorName)
            }
            when (result) {
                is CheckoutResult.Saved ->
                    local.update { it.copy(saving = false, saved = result, error = null) }
                is CheckoutResult.Rejected ->
                    local.update { it.copy(saving = false, error = result.message) }
            }
        }
    }
}
