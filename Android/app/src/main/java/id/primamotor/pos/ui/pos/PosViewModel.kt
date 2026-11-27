package id.primamotor.pos.ui.pos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.primamotor.pos.data.repo.CashflowInput
import id.primamotor.pos.data.repo.CheckoutForm
import id.primamotor.pos.data.repo.CheckoutRepository
import id.primamotor.pos.data.repo.CheckoutResult
import id.primamotor.pos.data.repo.EditSession
import id.primamotor.pos.data.repo.MekanikInput
import id.primamotor.pos.data.repo.MenuDetail
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.PosEditRepository
import id.primamotor.pos.data.repo.Produk
import id.primamotor.pos.data.repo.Repositories
import id.primamotor.pos.data.repo.UserRow
import id.primamotor.pos.data.repo.number
import id.primamotor.pos.data.repo.object_
import id.primamotor.pos.data.repo.strings
import id.primamotor.pos.data.repo.text
import id.primamotor.pos.domain.CartLine
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.PosFeed
import id.primamotor.pos.domain.PosPricing
import id.primamotor.pos.domain.PosValidation
import id.primamotor.pos.domain.WibDate
import id.primamotor.pos.hardware.printer.ReceiptData
import id.primamotor.pos.hardware.printer.ReceiptItem
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
    val selectedMenu: String = "Overview",
    val viewMode: String = "grid",
    val showFilters: Boolean = false,
    val filterStatus: String = "all",
    val filterPerson: String = "",
    val filterJenis: Set<String> = emptySet(),
    val page: Int = 1,
    val perPage: Int = 9,
    val subRefs: Set<String> = emptySet(),
    val cart: List<CartEntry> = emptyList(),
    val draft: CheckoutDraft = CheckoutDraft(),
    val cartTab: Int = 0,
    val saving: Boolean = false,
    val error: String? = null,
    val saved: CheckoutResult.Saved? = null,
    val savedReceipt: ReceiptData? = null,
    val edit: EditTarget? = null,
    val deleteTarget: MenuRow? = null,
    val settleFor: MenuRow? = null,
    val settleAccount: String = "",
    val pendingMenu: String? = null,
    val review: Boolean = false,
    val detail: MenuRow? = null,
    val detailData: MenuDetail? = null,
    val detailLoading: Boolean = false,
    val level: Int = 1,
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

    /** Sama seperti web: pembelian tanpa bukti selalu `belum`. */
    val previewStatus: String
        get() = when {
            PosPricing.isPembelian(draft.menu) && draft.mediaCount == 0 -> "belum"
            paid >= total -> "lunas"
            else -> "belum"
        }
}

data class PosFeedState(
    val tabs: List<PersonRow> = emptyList(),
    val products: List<Produk> = emptyList(),
    val groups: List<PosFeed.DateGroup> = emptyList(),
    val page: Int = 1,
    val totalPages: Int = 1,
)

class PosViewModel(
    private val repos: Repositories,
    private val checkout: CheckoutRepository,
    private val editRepo: PosEditRepository,
    private val settlement: id.primamotor.pos.data.repo.SettlementRepository,
    val operatorName: String,
    level: Int = 1,
    private val username: String = "",
    private val fullName: String = "",
) : ViewModel() {

    private val local = MutableStateFlow(PosUiState(level = level))

    val state: StateFlow<PosUiState> = local

    val menuOptions: StateFlow<List<PersonRow>> = repos.observeMenus()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val customers: StateFlow<List<PersonRow>> = repos.observeCustomers()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val accounts: StateFlow<List<PersonRow>> = repos.observeAccounts()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val mechanics: StateFlow<List<UserRow>> = repos.observeMekanik()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val persons: StateFlow<List<PersonRow>> = repos.observePerson()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val feed: StateFlow<PosFeedState> = combine(
        repos.observeProduk(),
        repos.observeMenu(),
        repos.observeMenus(),
        persons,
        local,
    ) { products, menus, tabs, persons, snapshot ->
        val visibleTabs = if (snapshot.level == 10) {
            tabs.filter { PosFeed.isOverview(it.nama) }
        } else {
            tabs
        }
        when {
            PosFeed.isOverview(snapshot.selectedMenu) -> {
                val rows = PosFeed.history(
                    rows = menus,
                    filter = PosFeed.HistoryFilter(
                        query = snapshot.query,
                        status = snapshot.filterStatus,
                        personId = snapshot.filterPerson,
                        jenis = snapshot.filterJenis,
                        level = snapshot.level,
                        username = username,
                        fullName = fullName,
                        subRefs = snapshot.subRefs,
                    ),
                    persons = persons,
                )
                val (pageRows, pages) = PosFeed.slice(rows, snapshot.page, snapshot.perPage)
                PosFeedState(visibleTabs, emptyList(), PosFeed.groupByDate(pageRows), snapshot.page.coerceIn(1, pages), pages)
            }

            PosFeed.isGaji(snapshot.selectedMenu) -> {
                val rows = PosFeed.history(
                    rows = menus.filter { it.jenis.contains("gaji", ignoreCase = true) },
                    filter = PosFeed.HistoryFilter(
                        query = snapshot.query,
                        subRefs = snapshot.subRefs,
                    ),
                    persons = persons,
                )
                val (pageRows, pages) = PosFeed.slice(rows, snapshot.page, snapshot.perPage)
                PosFeedState(visibleTabs, emptyList(), PosFeed.groupByDate(pageRows), snapshot.page.coerceIn(1, pages), pages)
            }

            else -> {
                val rows = PosFeed.products(products, snapshot.selectedMenu, snapshot.query)
                val (pageRows, pages) = PosFeed.slice(rows, snapshot.page, snapshot.perPage)
                PosFeedState(visibleTabs, pageRows, emptyList(), snapshot.page.coerceIn(1, pages), pages)
            }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), PosFeedState())

    fun setQuery(value: String) {
        local.update { it.copy(query = value, page = 1, subRefs = emptySet()) }
        viewModelScope.launch {
            val refs = repos.searchRefs(value)
            local.update { it.copy(subRefs = refs) }
        }
    }

    fun setPerPage(value: Int) = local.update {
        if (it.perPage == value) it else it.copy(perPage = value, page = 1)
    }

    fun setPage(value: Int) = local.update { it.copy(page = value.coerceAtLeast(1)) }

    fun setViewMode(value: String) = local.update { it.copy(viewMode = value) }

    fun toggleFilters() = local.update { it.copy(showFilters = !it.showFilters) }

    fun setFilterStatus(value: String) = local.update { it.copy(filterStatus = value, page = 1) }

    fun setFilterPerson(value: String) = local.update { it.copy(filterPerson = value, page = 1) }

    fun toggleFilterJenis(value: String) = local.update { state ->
        val next = if (state.filterJenis.contains(value)) {
            state.filterJenis - value
        } else {
            state.filterJenis + value
        }
        state.copy(filterJenis = next, page = 1)
    }

    fun clearFilters() = local.update {
        it.copy(filterStatus = "all", filterPerson = "", filterJenis = emptySet(), page = 1)
    }

    /** Pindah menu seperti `handleMenuChange`: keranjang aktif harus dikonfirmasi dulu. */
    fun selectMenu(value: String) {
        val current = local.value
        if (current.selectedMenu.equals(value, ignoreCase = true)) return
        if (current.cart.isNotEmpty() || current.edit != null) {
            local.update { it.copy(pendingMenu = value) }
        } else {
            applyMenu(value)
        }
    }

    fun confirmMenuChange() {
        val target = local.value.pendingMenu ?: return
        applyMenu(target)
    }

    fun cancelMenuChange() = local.update { it.copy(pendingMenu = null) }

    private fun applyMenu(value: String) {
        local.update {
            it.copy(
                selectedMenu = value,
                page = 1,
                pendingMenu = null,
                cart = emptyList(),
                edit = null,
                error = null,
                query = it.query,
                draft = CheckoutDraft(menu = if (PosFeed.isOverview(value)) it.draft.menu else value),
            )
        }
    }

    fun setCartTab(value: Int) = local.update { it.copy(cartTab = value, error = null) }

    fun updateDraft(block: (CheckoutDraft) -> CheckoutDraft) = local.update { it.copy(draft = block(it.draft)) }

    fun setCustomer(person: PersonRow) = local.update {
        it.copy(
            draft = it.draft.copy(
                personIdLama = person.idLama.ifBlank { person.id },
                personName = person.nama,
                // Web mengisi marketplace untuk pelanggan online dan mengosongkannya lagi saat offline.
                marketplace = if (PosPricing.isOnline(person.idLama.ifBlank { person.id }, person.nama)) {
                    it.draft.marketplace.ifBlank { "Shopee" }
                } else {
                    ""
                },
            ),
            error = null,
        )
    }

    /** Tambah produk dengan batas stok realtime seperti `addToCart` web. */
    fun add(product: Produk, qty: BigDecimal = BigDecimal.ONE) {
        val snapshot = local.value
        if (qty.signum() <= 0) return
        val existing = snapshot.cart.firstOrNull { it.produk.id == product.id }
        val next = (existing?.qty ?: BigDecimal.ZERO) + qty
        if (!PosFeed.isPembelian(snapshot.draft.menu) && next > product.stok) {
            local.update {
                it.copy(
                    error = "Sisa pasokan fisik untuk barang ini hanya tersisa " +
                        "${product.stok.stripTrailingZeros().toPlainString()} ${product.unit}.",
                )
            }
            return
        }
        val cart = if (existing == null) {
            snapshot.cart + CartEntry(product, next)
        } else {
            snapshot.cart.map { if (it.produk.id == product.id) it.copy(qty = next) else it }
        }
        local.update { it.copy(cart = cart, error = null) }
    }

    fun setQty(productId: String, qty: BigDecimal) = local.update { state ->
        val entry = state.cart.firstOrNull { it.produk.id == productId } ?: return@update state
        if (qty.signum() <= 0) {
            state.copy(cart = state.cart.filterNot { it.produk.id == productId }, error = null)
        } else if (!PosFeed.isPembelian(state.draft.menu) && qty > entry.produk.stok) {
            state.copy(
                error = "Maksimal gudang (${entry.produk.stok.stripTrailingZeros().toPlainString()} unit).",
            )
        } else {
            state.copy(
                cart = state.cart.map { if (it.produk.id == productId) it.copy(qty = qty) else it },
                error = null,
            )
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

    /** Hasil simpan ditutup: keranjang dan mode edit selesai. */
    fun dismissSaved() = local.update {
        it.copy(
            saved = null,
            savedReceipt = null,
            review = false,
            cart = emptyList(),
            cartTab = 0,
            edit = null,
            error = null,
            draft = CheckoutDraft(menu = if (PosFeed.isOverview(it.selectedMenu)) it.draft.menu else it.selectedMenu),
        )
    }

    fun cancelEdit() = local.update {
        it.copy(
            edit = null,
            cart = emptyList(),
            cartTab = 0,
            error = null,
            draft = CheckoutDraft(menu = if (PosFeed.isOverview(it.selectedMenu)) it.draft.menu else it.selectedMenu),
        )
    }

    fun askDelete(row: MenuRow) = local.update { it.copy(deleteTarget = row) }

    fun openSettle(row: MenuRow) = local.update {
        it.copy(
            settleFor = row,
            settleAccount = it.settleAccount.ifBlank { accounts.value.firstOrNull()?.id.orEmpty() },
            error = null,
        )
    }

    fun closeSettle() = local.update { it.copy(settleFor = null, error = null) }

    fun setSettleAccount(value: String) = local.update { it.copy(settleAccount = value) }

    /** Pelunasan cepat dari kartu riwayat atau detail nota. */
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
                is CheckoutResult.Saved -> local.update {
                    it.copy(saving = false, settleFor = null, detail = null, saved = result)
                }
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
                    local.update { it.copy(saved = result, detail = null, edit = null) }
                is CheckoutResult.Rejected ->
                    local.update { it.copy(error = result.message) }
            }
        }
    }

    fun openDetail(row: MenuRow) {
        local.update { it.copy(detail = row, detailData = null, detailLoading = true, error = null) }
        viewModelScope.launch {
            val detail = repos.menuDetail(row.id)
            local.update { it.copy(detailData = detail, detailLoading = false) }
        }
    }

    fun closeDetail() = local.update { it.copy(detail = null, detailData = null, detailLoading = false, error = null) }

    /** Muat nota ke keranjang untuk diedit, sama seperti `handleEditHistoryToCart` web. */
    fun loadForEdit(row: MenuRow) {
        viewModelScope.launch {
            val session = editRepo.prepare(row.id)
            if (session == null) {
                local.update { it.copy(error = "Item transaksi tidak dapat dimuat. Sinkronkan dulu.") }
                return@launch
            }
            val menu = session.menu
            val jenis = menu.text("jenis").ifBlank { row.jenis }.ifBlank {
                local.value.draft.menu
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
                        jenis = jenis,
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
            val personId = menu.text("person").ifBlank { "umum1" }
            val person = persons.value.firstOrNull { it.idLama == personId || it.id == personId }
            val files = menu.get("file")?.let { menu.strings("file") }.orEmpty()
            local.update {
                it.copy(
                    cart = cart,
                    review = false,
                    cartTab = 0,
                    edit = EditTarget(row.id, session),
                    detail = null,
                    draft = CheckoutDraft(
                        menu = jenis,
                        personIdLama = personId,
                        personName = person?.nama.orEmpty().ifBlank { personId },
                        payment = if (menu.text("payment") == "cash") "Tunai" else "Tempo",
                        nominalBayar = row.dibayar.stripTrailingZeros().toPlainString(),
                        payments = session.cashflows.map { cf ->
                            val cash = cf.object_()
                            PaymentLine(
                                cash?.text("account_1").orEmpty(),
                                cash?.number("nominal")?.stripTrailingZeros()?.toPlainString().orEmpty(),
                            )
                        }.ifEmpty { listOf(PaymentLine()) },
                        mechanics = session.ongkos.map { fee ->
                            val rowJson = fee.object_()
                            MechanicLine(
                                rowJson?.text("person").orEmpty(),
                                rowJson?.number("ongkos")?.stripTrailingZeros()?.toPlainString().orEmpty(),
                            )
                        }.ifEmpty { listOf(MechanicLine()) },
                        note = session.cashflows.firstNotNullOfOrNull { cf ->
                            cf.object_()?.text("note")?.takeIf { value -> value.isNotBlank() }
                        }.orEmpty(),
                        noteMenu = menu.text("text"),
                        tempoDate = menu.text("tempo"),
                        marketplace = menu.text("marketplace"),
                        adminFee = menu.number("admin").stripTrailingZeros().toPlainString(),
                        cashback = menu.number("cashback").stripTrailingZeros().toPlainString(),
                        mediaCount = files.size,
                    ),
                    error = null,
                )
            }
        }
    }

    /** Validasi checkout, lalu buka review. Pesan pertama langsung ditampilkan. */
    fun review() {
        val snapshot = local.value
        if (snapshot.saving) return
        val error = validationError(snapshot)
        if (error != null) {
            local.update { it.copy(error = error) }
            return
        }
        local.update { it.copy(review = true, error = null) }
    }

    fun cancelReview() = local.update { it.copy(review = false) }

    private fun validationError(snapshot: PosUiState): String? {
        val draft = snapshot.draft
        val errors = PosValidation.checkoutErrors(
            menu = draft.menu,
            cartCount = snapshot.cart.size,
            mechanics = draft.mechanics
                .filter { it.idLama.isNotBlank() }
                .map { PosValidation.MechanicLine(it.idLama, Money.parse(it.ongkos) ?: BigDecimal.ZERO) },
            payments = draft.payments.map { PosValidation.PaymentLine(it.accountId, Money.parse(it.nominal) ?: BigDecimal.ZERO) },
            isOnline = snapshot.isOnline,
            marketplace = draft.marketplace,
            adminFee = Money.parse(draft.adminFee) ?: BigDecimal.ZERO,
            noteMenu = draft.noteMenu,
            payment = draft.payment,
            tempoDate = draft.tempoDate,
        )
        return errors.firstOrNull()
    }

    fun commit() {
        val snapshot = local.value
        if (snapshot.saving) return
        val draft = snapshot.draft
        val senderName = snapshot.draft.personName
        val form = CheckoutForm(
            personIdLama = draft.personIdLama,
            personName = draft.personName,
            payment = draft.payment,
            nominalBayar = Money.parse(draft.nominalBayar) ?: BigDecimal.ZERO,
            cashflow = draft.payments
                .filter { it.accountId.isNotBlank() }
                .map { CashflowInput(it.accountId, Money.parse(it.nominal) ?: BigDecimal.ZERO) },
            mekanik = draft.mechanics
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

        validationError(snapshot)?.let { message ->
            local.update { it.copy(error = message, review = false) }
            return
        }

        local.update { it.copy(saving = true, review = false, error = null) }
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
                is CheckoutResult.Saved -> {
                    val receipt = ReceiptData(
                        notaId = result.notaId,
                        waktu = WibDate.nowIso().take(16).replace('T', ' '),
                        kasir = operatorName,
                        pelanggan = senderName,
                        jenis = draft.menu,
                        items = snapshot.lines.map { ReceiptItem(it.produk.nama, it.qty, it.price) },
                        total = result.total,
                        bayar = snapshot.paid,
                        kembali = (snapshot.paid - result.total).max(BigDecimal.ZERO),
                        payment = draft.payment,
                        mekanik = draft.mechanics
                            .filter { it.idLama.isNotBlank() }
                            .map { it.idLama to (Money.parse(it.ongkos) ?: BigDecimal.ZERO) },
                    )
                    local.update { it.copy(saving = false, saved = result, savedReceipt = receipt, error = null) }
                }
                is CheckoutResult.Rejected ->
                    local.update { it.copy(saving = false, error = result.message) }
            }
        }
    }
}
