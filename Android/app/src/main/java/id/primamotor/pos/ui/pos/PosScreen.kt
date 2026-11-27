package id.primamotor.pos.ui.pos

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import id.primamotor.pos.data.repo.MenuDetail
import id.primamotor.pos.data.repo.MenuRow
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.Produk
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.PosFeed
import id.primamotor.pos.domain.Settlement
import id.primamotor.pos.hardware.printer.ReceiptData
import id.primamotor.pos.hardware.printer.ReceiptItem
import java.math.BigDecimal

@Composable
fun PosRoute(container: id.primamotor.pos.AppContainer) {
    val user = container.tokenStore.cachedUser()
    val viewModel: PosViewModel = androidx.lifecycle.viewmodel.compose.viewModel {
        PosViewModel(
            repos = container.repositories,
            checkout = container.checkoutRepository,
            editRepo = container.editRepository,
            settlement = container.settlementRepository,
            operatorName = user?.name.orEmpty().ifBlank { user?.username.orEmpty() }.ifBlank { "kasir" },
            level = user?.level ?: 1,
            username = user?.username.orEmpty(),
            fullName = user?.name.orEmpty(),
        )
    }
    PosScreen(viewModel)
}

@Composable
fun PosScreen(viewModel: PosViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val feed by viewModel.feed.collectAsStateWithLifecycle()
    val customers by viewModel.customers.collectAsStateWithLifecycle()
    val accounts by viewModel.accounts.collectAsStateWithLifecycle()
    val mechanics by viewModel.mechanics.collectAsStateWithLifecycle()
    val persons by viewModel.persons.collectAsStateWithLifecycle()

    var cartOpen by remember { mutableStateOf(false) }
    var receipt by remember { mutableStateOf<ReceiptData?>(null) }

    LaunchedEffect(state.saved) {
        if (state.saved != null) cartOpen = false
    }
    LaunchedEffect(state.review) {
        if (state.review) cartOpen = false
    }

    BoxWithConstraints(Modifier.fillMaxSize().background(PosTheme.canvas)) {
        val wide = maxWidth >= 840.dp
        val perPage = PosFeed.pageSize(maxWidth.value.toInt())
        LaunchedEffect(perPage) { viewModel.setPerPage(perPage) }

        Column(Modifier.fillMaxSize()) {
            PosNavTabs(
                tabs = feed.tabs,
                selected = state.selectedMenu,
                onSelect = viewModel::selectMenu,
            )
            PosFilterBar(
                state = state,
                persons = persons,
                tabs = feed.tabs,
                showViewToggle = wide && !PosFeed.isOverview(state.selectedMenu) && !PosFeed.isGaji(state.selectedMenu),
                onQuery = viewModel::setQuery,
                onToggleFilters = viewModel::toggleFilters,
                onStatus = viewModel::setFilterStatus,
                onPerson = viewModel::setFilterPerson,
                onJenis = viewModel::toggleFilterJenis,
                onClearFilters = viewModel::clearFilters,
                onViewMode = viewModel::setViewMode,
            )
            state.error?.let { message ->
                Text(
                    message,
                    color = PosTheme.danger,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)
                        .testTag("pos_error"),
                )
            }

            Box(Modifier.weight(1f).fillMaxWidth()) {
                if (wide) {
                    Row(Modifier.fillMaxSize()) {
                        FeedContent(
                            state = state,
                            feed = feed,
                            persons = persons,
                            modifier = Modifier.weight(1.5f).fillMaxHeight(),
                            onAdd = viewModel::add,
                            onOpenDetail = viewModel::openDetail,
                            onSettle = viewModel::openSettle,
                        )
                        Surface(
                            modifier = Modifier.weight(1f).fillMaxHeight(),
                            color = Color.White,
                            shadowElevation = 8.dp,
                        ) {
                            Column(
                                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp),
                            ) {
                                CheckoutContent(
                                    state = state,
                                    customers = customers,
                                    accounts = accounts,
                                    mechanics = mechanics,
                                    onQty = viewModel::setQty,
                                    onRemove = viewModel::remove,
                                    onManualPrice = viewModel::setManualPrice,
                                    onDraft = viewModel::updateDraft,
                                    onCustomer = viewModel::setCustomer,
                                    onAddPayment = viewModel::addPayment,
                                    onRemovePayment = viewModel::removePayment,
                                    onUpdatePayment = viewModel::updatePayment,
                                    onAddMechanic = viewModel::addMechanic,
                                    onRemoveMechanic = viewModel::removeMechanic,
                                    onUpdateMechanic = viewModel::updateMechanic,
                                    onSubmit = viewModel::review,
                                    onCancelEdit = viewModel::cancelEdit,
                                    onTab = viewModel::setCartTab,
                                )
                            }
                        }
                    }
                } else {
                    FeedContent(
                        state = state,
                        feed = feed,
                        persons = persons,
                        modifier = Modifier.fillMaxSize(),
                        onAdd = viewModel::add,
                        onOpenDetail = viewModel::openDetail,
                        onSettle = viewModel::openSettle,
                    )
                    if (state.cart.isNotEmpty() || state.edit != null) {
                        CartFab(
                            qty = state.qty,
                            onClick = {
                                viewModel.setCartTab(0)
                                cartOpen = true
                            },
                            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
                        )
                    }
                }
            }

            PosPagination(
                page = feed.page,
                totalPages = feed.totalPages,
                onPage = viewModel::setPage,
            )

            if (!wide && (state.cart.isNotEmpty() || state.edit != null)) {
                MobileCheckoutBar(
                    state = state,
                    onOpen = {
                        viewModel.setCartTab(1)
                        cartOpen = true
                    },
                    onCart = {
                        viewModel.setCartTab(0)
                        cartOpen = true
                    },
                )
            }
        }
    }

    if (cartOpen) {
        CheckoutSheet(
            state = state,
            customers = customers,
            accounts = accounts,
            mechanics = mechanics,
            onQty = viewModel::setQty,
            onRemove = viewModel::remove,
            onManualPrice = viewModel::setManualPrice,
            onDraft = viewModel::updateDraft,
            onCustomer = viewModel::setCustomer,
            onAddPayment = viewModel::addPayment,
            onRemovePayment = viewModel::removePayment,
            onUpdatePayment = viewModel::updatePayment,
            onAddMechanic = viewModel::addMechanic,
            onRemoveMechanic = viewModel::removeMechanic,
            onUpdateMechanic = viewModel::updateMechanic,
            onSubmit = viewModel::review,
            onCancelEdit = viewModel::cancelEdit,
            onDismiss = { cartOpen = false },
            onTab = viewModel::setCartTab,
        )
    }

    if (state.review) {
        CheckoutReviewDialog(
            state = state,
            operatorName = viewModel.operatorName,
            personLabel = PosFeed.personLabel(state.draft.personIdLama, persons, state.draft.personName),
            onEditTab = { tab ->
                viewModel.cancelReview()
                viewModel.setCartTab(tab)
                cartOpen = true
            },
            onBack = viewModel::cancelReview,
            onSave = viewModel::commit,
        )
    }

    state.detail?.let { row ->
        PosDetailDialog(
            row = row,
            detail = state.detailData,
            loading = state.detailLoading,
            persons = persons,
            accounts = accounts,
            level = state.level,
            saving = state.saving,
            onClose = viewModel::closeDetail,
            onEdit = { viewModel.loadForEdit(row) },
            onDelete = { viewModel.askDelete(row) },
            onSettle = { viewModel.openSettle(row) },
            onPrint = { receipt = receiptFor(row, state.detailData, persons, viewModel.operatorName) },
        )
    }

    if (state.pendingMenu != null) {
        AlertDialog(
            onDismissRequest = viewModel::cancelMenuChange,
            title = { Text("Batalkan Transaksi?") },
            text = {
                Text(
                    "Keranjang belanja Anda saat ini akan dibersihkan jika Anda berpindah " +
                        "ke halaman menu lain. Lanjutkan?",
                )
            },
            confirmButton = {
                TextButton(onClick = viewModel::confirmMenuChange) { Text("YA, LANJUTKAN PROSES") }
            },
            dismissButton = { TextButton(onClick = viewModel::cancelMenuChange) { Text("BATALKAN") } },
        )
    }

    state.deleteTarget?.let { row ->
        AlertDialog(
            onDismissRequest = viewModel::cancelDelete,
            title = { Text("Hapus Permanen") },
            text = {
                Text(
                    "Peringatan: Menghapus nota ini akan mengembalikan seluruh stok barang " +
                        "dan menghapus jejak jurnal kas terkait. Lanjutkan?",
                )
            },
            confirmButton = {
                TextButton(onClick = viewModel::confirmDelete) {
                    Text("Hapus", color = PosTheme.danger)
                }
            },
            dismissButton = { TextButton(onClick = viewModel::cancelDelete) { Text("BATALKAN") } },
        )
    }

    state.settleFor?.let { row ->
        AlertDialog(
            onDismissRequest = viewModel::closeSettle,
            title = { Text("Pelunasan Nota") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Sisa: ${Money.formatRupiah(Settlement.remaining(row.total, row.dibayar))}")
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(accounts, key = { it.id }) { account ->
                            FilterChip(
                                selected = state.settleAccount == account.id,
                                onClick = { viewModel.setSettleAccount(account.id) },
                                label = { Text(account.nama) },
                            )
                        }
                    }
                    state.error?.let { Text(it, color = PosTheme.danger) }
                }
            },
            confirmButton = {
                TextButton(onClick = viewModel::settle, enabled = !state.saving) {
                    Text(if (state.saving) "Menyimpan..." else "Lunasi")
                }
            },
            dismissButton = { TextButton(onClick = viewModel::closeSettle) { Text("Batal") } },
        )
    }

    val saved = state.saved
    if (saved != null) {
        AlertDialog(
            onDismissRequest = viewModel::dismissSaved,
            confirmButton = {
                TextButton(onClick = viewModel::dismissSaved) { Text("Tutup") }
            },
            dismissButton = {
                val printable = state.savedReceipt
                if (printable != null) {
                    TextButton(onClick = { receipt = printable }) { Text("Cetak struk") }
                }
            },
            title = { Text("Transaksi tersimpan") },
            text = {
                Column(Modifier.testTag("pos_saved_dialog")) {
                    Text("Nota: ${saved.notaId}")
                    Text("Total: ${Money.formatRupiah(saved.total)}")
                    Text("Kembali: ${Money.formatRupiah(saved.change)}")
                    Text("Status: ${saved.status}")
                    Text("Menunggu sinkron. Cetak struk setelah printer siap.")
                }
            },
        )
    }

    receipt?.let { data ->
        ReceiptPrintSheet(receipt = data, onDismiss = { receipt = null })
    }
}

private fun receiptFor(
    row: MenuRow,
    detail: MenuDetail?,
    persons: List<PersonRow>,
    operatorName: String,
): ReceiptData = ReceiptData(
    notaId = row.ref.ifBlank { row.id },
    waktu = row.createdAt,
    kasir = row.operator.ifBlank { operatorName },
    pelanggan = PosFeed.personLabel(row.person, persons, "Umum"),
    jenis = row.jenis.ifBlank { "Penjualan" },
    items = detail?.items.orEmpty().map { ReceiptItem(it.label, it.qty, it.price) },
    total = row.total,
    bayar = row.dibayar,
    kembali = (row.dibayar - row.total).max(BigDecimal.ZERO),
    payment = if (row.payment == "cash") "Tunai" else "Tempo",
    mekanik = detail?.ongkos.orEmpty().map { it.person to it.ongkos },
)

@Composable
private fun PosNavTabs(tabs: List<PersonRow>, selected: String, onSelect: (String) -> Unit) {
    val overview = PersonRow(
        id = "overview",
        nama = "Overview",
        keterangan = "",
        jenis = "jenis menu",
        kategori = "menu",
    )
    val all = if (tabs.any { PosFeed.isOverview(it.nama) }) tabs else listOf(overview) + tabs
    LazyRow(
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(all, key = { it.id }) { tab ->
            val active = tab.nama.equals(selected, ignoreCase = true)
            val accent = PosTheme.accent(tab.nama)
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = if (active) accent.main else Color(0xFFE2E8F0),
                modifier = Modifier
                    .clickable { onSelect(tab.nama) }
                    .testTag("menu_${tab.nama}"),
            ) {
                Text(
                    tab.nama.uppercase(),
                    color = if (active) Color.White else PosTheme.muted,
                    fontWeight = FontWeight.Black,
                    fontSize = 11.sp,
                    maxLines = 1,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                )
            }
        }
    }
}

@Composable
private fun PosFilterBar(
    state: PosUiState,
    persons: List<PersonRow>,
    tabs: List<PersonRow>,
    showViewToggle: Boolean,
    onQuery: (String) -> Unit,
    onToggleFilters: () -> Unit,
    onStatus: (String) -> Unit,
    onPerson: (String) -> Unit,
    onJenis: (String) -> Unit,
    onClearFilters: () -> Unit,
    onViewMode: (String) -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            OutlinedTextField(
                value = state.query,
                onValueChange = onQuery,
                label = { Text("Cari ${state.selectedMenu}...") },
                singleLine = true,
                modifier = Modifier.weight(1f).testTag("pos_search"),
            )
            if (PosFeed.isOverview(state.selectedMenu) || PosFeed.isGaji(state.selectedMenu)) {
                OutlinedButton(
                    onClick = onToggleFilters,
                    modifier = Modifier.heightIn(min = 48.dp).testTag("pos_filter_toggle"),
                ) { Text("Filter") }
            }
            if (showViewToggle) {
                OutlinedButton(
                    onClick = { onViewMode(if (state.viewMode == "grid") "list" else "grid") },
                    modifier = Modifier.heightIn(min = 48.dp),
                ) { Text(if (state.viewMode == "grid") "List" else "Grid") }
            }
        }

        if (state.showFilters && PosFeed.isOverview(state.selectedMenu)) {
            Text("Status:", style = MaterialTheme.typography.labelMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(
                    "all" to "Semua",
                    "lunas" to "Lunas",
                    "belum" to "Belum Lunas",
                ).forEach { (value, label) ->
                    FilterChip(
                        selected = state.filterStatus == value,
                        onClick = { onStatus(value) },
                        label = { Text(label) },
                    )
                }
            }
            Text("Person:", style = MaterialTheme.typography.labelMedium)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                item {
                    FilterChip(
                        selected = state.filterPerson.isBlank(),
                        onClick = { onPerson("") },
                        label = { Text("Semua Person") },
                    )
                }
                items(persons, key = { it.id }) { person ->
                    FilterChip(
                        selected = state.filterPerson == (person.idLama.ifBlank { person.id }),
                        onClick = { onPerson(person.idLama.ifBlank { person.id }) },
                        label = { Text(person.nama) },
                    )
                }
            }
            Text("Jenis:", style = MaterialTheme.typography.labelMedium)
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(tabs.filterNot { PosFeed.isOverview(it.nama) }, key = { it.id }) { tab ->
                    FilterChip(
                        selected = state.filterJenis.contains(tab.nama),
                        onClick = { onJenis(tab.nama) },
                        label = { Text(tab.nama) },
                    )
                }
            }
            TextButton(onClick = onClearFilters) { Text("Reset Semua Filter") }
        }

        val active = state.filterStatus != "all" || state.filterPerson.isNotBlank() ||
            state.filterJenis.isNotEmpty()
        if (state.showFilters && PosFeed.isOverview(state.selectedMenu) && active) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (state.filterStatus != "all") {
                    Text(
                        "Status: ${if (state.filterStatus == "lunas") "Lunas" else "Belum Lunas"}",
                        style = MaterialTheme.typography.labelSmall,
                        color = PosTheme.accent("overview").main,
                    )
                }
                if (state.filterPerson.isNotBlank()) {
                    Text(
                        PosFeed.personLabel(state.filterPerson, persons, state.filterPerson),
                        style = MaterialTheme.typography.labelSmall,
                        color = PosTheme.accent("overview").main,
                    )
                }
                if (state.filterJenis.isNotEmpty()) {
                    Text(
                        "Jenis: ${state.filterJenis.joinToString(", ")}",
                        style = MaterialTheme.typography.labelSmall,
                        color = PosTheme.accent("overview").main,
                    )
                }
            }
        }
    }
}

@Composable
private fun FeedContent(
    state: PosUiState,
    feed: PosFeedState,
    persons: List<PersonRow>,
    modifier: Modifier,
    onAdd: (Produk) -> Unit,
    onOpenDetail: (MenuRow) -> Unit,
    onSettle: (MenuRow) -> Unit,
) {
    when {
        PosFeed.isGaji(state.selectedMenu) -> SalaryFeed(feed, modifier, onOpenDetail)
        PosFeed.isOverview(state.selectedMenu) ->
            HistoryFeed(feed, persons, modifier, onOpenDetail, onSettle)
        else -> ProductFeed(feed, state.viewMode, modifier, onAdd)
    }
}

@Composable
private fun ProductFeed(
    feed: PosFeedState,
    viewMode: String,
    modifier: Modifier,
    onAdd: (Produk) -> Unit,
) {
    if (feed.products.isEmpty()) {
        Text(
            "Tidak ada produk",
            modifier = modifier.fillMaxWidth().padding(24.dp),
            color = PosTheme.muted,
        )
        return
    }
    if (viewMode == "list") {
        LazyColumn(
            modifier = modifier.fillMaxWidth(),
            contentPadding = PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(feed.products, key = { it.id }) { product ->
                ProductCard(product, onAdd = { onAdd(product) })
            }
        }
    } else {
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 170.dp),
            modifier = modifier.fillMaxWidth(),
            contentPadding = PaddingValues(12.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(feed.products, key = { it.id }) { product ->
                ProductCard(product, onAdd = { onAdd(product) })
            }
        }
    }
}

@Composable
private fun HistoryFeed(
    feed: PosFeedState,
    persons: List<PersonRow>,
    modifier: Modifier,
    onOpenDetail: (MenuRow) -> Unit,
    onSettle: (MenuRow) -> Unit,
) {
    if (feed.groups.isEmpty()) {
        Text(
            "Belum ada riwayat transaksi",
            modifier = modifier.fillMaxWidth().padding(24.dp),
            color = PosTheme.muted,
        )
        return
    }
    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        feed.groups.forEach { group ->
            item(key = "h-${group.label}") {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(8.dp).background(PosTheme.success, CircleShape))
                    Text(
                        group.label,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(start = 8.dp),
                    )
                }
            }
            items(group.rows, key = { it.id }) { row ->
                HistoryCard(
                    row = row,
                    persons = persons,
                    onOpen = { onOpenDetail(row) },
                    onSettle = { onSettle(row) },
                )
            }
        }
    }
}

@Composable
private fun SalaryFeed(
    feed: PosFeedState,
    modifier: Modifier,
    onOpenDetail: (MenuRow) -> Unit,
) {
    val rows = feed.groups.flatMap { it.rows }
    if (rows.isEmpty()) {
        Column(modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SalaryBanner()
            Text("Belum ada data slip gaji", color = PosTheme.muted)
        }
        return
    }
    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item(key = "gaji-banner") { SalaryBanner() }
        items(rows, key = { it.id }) { row -> SalaryCard(row, onOpen = { onOpenDetail(row) }) }
    }
}

@Composable
private fun SalaryBanner() {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color(0xFF0F172A),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                "Kelola Slip Gaji Karyawan",
                color = Color.White,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "Buat slip gaji baru, tetapkan periode & rincian penambahan/pengurangan gaji.",
                color = Color(0xFF99F6E4),
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                "Pembuatan slip belum tersedia di perangkat ini.",
                color = Color(0xFFFBBF24),
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}

@Composable
private fun SalaryCard(row: MenuRow, onOpen: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen),
        color = Color.White,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, PosTheme.hairline),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("SLIP GAJI", color = PosTheme.accent("gaji").main, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                Text("Op: ${row.operator.ifBlank { "-" }}", style = MaterialTheme.typography.labelSmall)
            }
            Text(row.text.ifBlank { "Gaji Karyawan" }, fontWeight = FontWeight.SemiBold, maxLines = 2)
            val people = row.person.split(",").map { it.trim() }.filter { it.isNotBlank() }
            Text(
                "Penerima Gaji (${people.size} Person): " + people.joinToString(", "),
                style = MaterialTheme.typography.bodySmall,
                color = PosTheme.muted,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Total Bersih", style = MaterialTheme.typography.bodySmall, color = PosTheme.muted)
                Text(Money.formatRupiah(row.total), fontWeight = FontWeight.Bold, color = PosTheme.accent("gaji").main)
            }
        }
    }
}

@Composable
private fun HistoryCard(
    row: MenuRow,
    persons: List<PersonRow>,
    onOpen: () -> Unit,
    onSettle: () -> Unit,
) {
    val lunas = row.status.equals("lunas", ignoreCase = true)
    val (jenisFg, jenisBg) = PosTheme.jenisColors(row.jenis)
    val sisa = (row.total - row.dibayar).max(BigDecimal.ZERO)
    Surface(
        modifier = Modifier.fillMaxWidth().heightIn(min = 150.dp).clickable(onClick = onOpen),
        color = Color.White,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, PosTheme.hairline),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Surface(color = jenisBg, shape = RoundedCornerShape(6.dp)) {
                    Text(
                        row.jenis.ifBlank { "Nota" }.uppercase(),
                        color = jenisFg,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
                Text(
                    if (lunas) "LUNAS" else "BELUM",
                    color = if (lunas) PosTheme.success else PosTheme.danger,
                    fontWeight = FontWeight.Bold,
                    fontSize = 10.sp,
                )
            }
            Text(
                PosFeed.personLabel(row.person, persons, "PELANGGAN UMUM"),
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text("Operator: ${row.operator.ifBlank { "-" }}", style = MaterialTheme.typography.labelSmall, color = PosTheme.muted)
            Text(
                "\"${row.text.ifBlank { "Tanpa deskripsi nota." }}\"",
                style = MaterialTheme.typography.bodySmall,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                "${row.qty.stripTrailingZeros().toPlainString()} Item",
                style = MaterialTheme.typography.labelSmall,
                color = PosTheme.muted,
            )
            if (lunas) {
                Text("Total: ${Money.formatRupiah(row.total)}", color = PosTheme.success, fontWeight = FontWeight.SemiBold)
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        "Total: ${Money.formatRupiah(row.total)}",
                        style = MaterialTheme.typography.bodySmall,
                        textDecoration = TextDecoration.LineThrough,
                        color = PosTheme.muted,
                    )
                    Text(
                        "Sisa: ${Money.formatRupiah(sisa)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = PosTheme.danger,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                TextButton(onClick = onSettle, modifier = Modifier.heightIn(min = 36.dp)) {
                    Text("Pelunasan Cepat", fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun ProductCard(product: Produk, onAdd: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Color.White,
        border = BorderStroke(1.dp, PosTheme.hairline),
        modifier = Modifier.fillMaxWidth().heightIn(min = 128.dp).clickable(onClick = onAdd),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    "#${PosFeed.displayCode(product.idLama)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = PosTheme.muted,
                )
                StockPill(product)
            }
            Text(
                PosFeed.productLabel(product),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    Money.formatRupiah(product.sell6),
                    fontWeight = FontWeight.Bold,
                    color = PosTheme.accent("penjualan").main,
                )
                Text("+", fontWeight = FontWeight.Black, fontSize = 18.sp, color = PosTheme.muted)
            }
        }
    }
}

@Composable
private fun StockPill(product: Produk) {
    val habis = product.stok.signum() <= 0
    val low = product.stok <= BigDecimal(5)
    Text(
        if (habis) {
            "STOK HABIS"
        } else {
            "SISA: ${product.stok.stripTrailingZeros().toPlainString()} ${product.unit}"
        },
        fontSize = 10.sp,
        fontWeight = FontWeight.Bold,
        color = if (low) PosTheme.danger else PosTheme.success,
    )
}

@Composable
private fun PosPagination(page: Int, totalPages: Int, onPage: (Int) -> Unit) {
    Surface(color = Color.White, shadowElevation = 2.dp, modifier = Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Hal $page / $totalPages", style = MaterialTheme.typography.labelSmall)
            Row {
                TextButton(
                    onClick = { onPage(page - 1) },
                    enabled = page > 1,
                    modifier = Modifier.heightIn(min = 40.dp),
                ) { Text("<") }
                TextButton(
                    onClick = { onPage(page + 1) },
                    enabled = page < totalPages,
                    modifier = Modifier.heightIn(min = 40.dp),
                ) { Text(">") }
            }
        }
    }
}

@Composable
private fun MobileCheckoutBar(state: PosUiState, onOpen: () -> Unit, onCart: () -> Unit) {
    Surface(color = Color(0xFF0F172A), modifier = Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(Modifier.clickable(onClick = onCart)) {
                Text(
                    "Total (${state.draft.menu}) · ${state.qty.stripTrailingZeros().toPlainString()} item",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFFCBD5E1),
                )
                Text(
                    Money.formatRupiah(state.total),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleMedium,
                )
            }
            Button(
                onClick = onOpen,
                enabled = !state.saving,
                modifier = Modifier.heightIn(min = 48.dp).testTag("pos_pay_bar"),
            ) { Text(if (state.saving) "Menyimpan..." else "BAYAR (1-TAP)") }
        }
    }
}

@Composable
private fun CartFab(qty: BigDecimal, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier.size(60.dp).clickable(onClick = onClick).testTag("pos_open_cart"),
        shape = CircleShape,
        color = PosTheme.accent("penjualan").main,
        shadowElevation = 6.dp,
        border = BorderStroke(2.dp, Color.White),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                qty.stripTrailingZeros().toPlainString(),
                color = Color.White,
                fontWeight = FontWeight.Black,
            )
        }
    }
}
