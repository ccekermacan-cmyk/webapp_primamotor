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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import id.primamotor.pos.data.repo.PersonRow
import id.primamotor.pos.data.repo.Produk
import id.primamotor.pos.domain.Money
import id.primamotor.pos.ui.EmptyHint

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
        )
    }
    PosScreen(viewModel)
}

@Composable
fun PosScreen(viewModel: PosViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val products by viewModel.products.collectAsStateWithLifecycle()
    val menus by viewModel.menus.collectAsStateWithLifecycle()
    val customers by viewModel.customers.collectAsStateWithLifecycle()
    val accounts by viewModel.accounts.collectAsStateWithLifecycle()
    val mechanics by viewModel.mechanics.collectAsStateWithLifecycle()
    val history by viewModel.history.collectAsStateWithLifecycle()
    var cartOpen by remember { mutableStateOf(false) }
    var showReceipt by remember { mutableStateOf(false) }
    var tab by remember { mutableIntStateOf(0) }

    // Nota tersimpan menutup keranjang agar dialog hasil tidak tertutup bottom sheet.
    LaunchedEffect(state.saved) {
        if (state.saved != null) cartOpen = false
    }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FilterChip(
                selected = tab == 0,
                onClick = { tab = 0 },
                label = { Text("Kasir") },
                modifier = Modifier.heightIn(min = 44.dp).testTag("pos_tab_catalog"),
            )
            FilterChip(
                selected = tab == 1,
                onClick = { tab = 1 },
                label = { Text("Riwayat") },
                modifier = Modifier.heightIn(min = 44.dp).testTag("pos_tab_history"),
            )
            if (state.edit != null) {
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = MaterialTheme.colorScheme.primaryContainer,
                ) {
                    Text(
                        "Mode edit nota",
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    )
                }
            }
        }

        if (tab == 1) {
            HistoryPane(
                state = state,
                rows = history,
                accounts = accounts,
                onQuery = viewModel::setHistoryQuery,
                onEdit = { viewModel.loadForEdit(it); tab = 0 },
                onDelete = viewModel::askDelete,
                onSettle = viewModel::openSettle,
                onCloseSettle = viewModel::closeSettle,
                onSettleAccount = viewModel::setSettleAccount,
                onSettleConfirm = viewModel::settle,
            )
        } else {
            CatalogArea(
                state = state,
                products = products,
                menus = menus,
                customers = customers,
                accounts = accounts,
                mechanics = mechanics,
                viewModel = viewModel,
                onOpenCart = { cartOpen = true },
            )
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
            onSubmit = viewModel::commit,
            onCancelEdit = { viewModel.dismissSaved() },
            onDismiss = { cartOpen = false },
        )
    }

    val saved = state.saved
    if (showReceipt && saved != null) {
        ReceiptPrintSheet(
            receipt = id.primamotor.pos.hardware.printer.ReceiptData(
                notaId = saved.notaId,
                waktu = id.primamotor.pos.domain.WibDate.nowIso(),
                kasir = viewModel.operatorName,
                items = state.lines.map { line ->
                    id.primamotor.pos.hardware.printer.ReceiptItem(line.produk.nama, line.qty, line.price)
                },
                total = saved.total,
                bayar = saved.total + saved.change,
                kembali = saved.change,
                payment = state.draft.payment,
            ),
            onDismiss = { showReceipt = false },
        )
    }
    if (saved != null) {
        AlertDialog(
            onDismissRequest = viewModel::dismissSaved,
            confirmButton = {
                TextButton(onClick = viewModel::dismissSaved) { Text("Tutup") }
            },
            dismissButton = {
                TextButton(onClick = { showReceipt = true }) { Text("Cetak struk") }
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

    state.deleteTarget?.let { row ->
        AlertDialog(
            onDismissRequest = viewModel::cancelDelete,
            title = { Text("Hapus Transaksi") },
            text = { Text("Hapus nota ${row.id}? Stok dan saldo dikembalikan, lalu server mengeksekusi pembatalan atomik saat tersambung.") },
            confirmButton = {
                TextButton(onClick = viewModel::confirmDelete) {
                    Text("Hapus", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = viewModel::cancelDelete) { Text("Batal") } },
        )
    }
}

@Composable
private fun CatalogArea(
    state: PosUiState,
    products: List<Produk>,
    menus: List<PersonRow>,
    customers: List<PersonRow>,
    accounts: List<PersonRow>,
    mechanics: List<id.primamotor.pos.data.repo.UserRow>,
    viewModel: PosViewModel,
    onOpenCart: () -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        // Dua area di HP potret, katalog + panel kanan di tablet/lanskap (breakpoint web 840 dp).
        val wide = maxWidth >= 840.dp
        if (wide) {
            Row(Modifier.fillMaxSize()) {
                CatalogPane(
                    state = state,
                    products = products,
                    menus = menus,
                    customers = customers,
                    viewModel = viewModel,
                    modifier = Modifier.weight(1.5f).fillMaxHeight(),
                )
                Surface(
                    modifier = Modifier.weight(1f).fillMaxHeight(),
                    color = MaterialTheme.colorScheme.surface,
                    shadowElevation = 8.dp,
                ) {
                    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
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
                            onSubmit = viewModel::commit,
                            onCancelEdit = { viewModel.dismissSaved() },
                        )
                    }
                }
            }
        } else {
            Column(Modifier.fillMaxSize()) {
                CatalogPane(
                    state = state,
                    products = products,
                    menus = menus,
                    customers = customers,
                    viewModel = viewModel,
                    modifier = Modifier.weight(1f),
                )
                Surface(shadowElevation = 10.dp) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Column {
                            Text(
                                "${state.qty.stripTrailingZeros().toPlainString()} item",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Text(
                                Money.formatRupiah(state.total),
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.ExtraBold,
                            )
                        }
                        Button(
                            onClick = onOpenCart,
                            enabled = state.cart.isNotEmpty() || state.edit != null,
                            modifier = Modifier.heightIn(min = 52.dp).testTag("pos_open_cart"),
                        ) { Text("Keranjang", style = MaterialTheme.typography.labelLarge) }
                    }
                }
            }
        }
    }
}

@Composable
private fun CatalogPane(
    state: PosUiState,
    products: List<Produk>,
    menus: List<PersonRow>,
    customers: List<PersonRow>,
    viewModel: PosViewModel,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = state.query,
            onValueChange = viewModel::setQuery,
            label = { Text("Cari nama / barcode") },
            singleLine = true,
            textStyle = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.fillMaxWidth().padding(16.dp).testTag("pos_search"),
        )

        if (menus.isNotEmpty()) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(menus, key = { it.id }) { menu ->
                    FilterChip(
                        selected = state.draft.menu == menu.nama,
                        onClick = { viewModel.setMenu(menu.nama) },
                        label = { Text(menu.nama, style = MaterialTheme.typography.labelMedium) },
                        modifier = Modifier.heightIn(min = 44.dp).testTag("menu_${menu.nama}"),
                    )
                }
            }
        }

        CustomerPicker(state = state, customers = customers, onCustomer = viewModel::setCustomer)

        if (products.isEmpty()) {
            EmptyHint()
        } else {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(minSize = 180.dp),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxSize(),
            ) {
                items(products, key = { it.id }) { product ->
                    ProductCard(product = product, onAdd = { viewModel.add(product) })
                }
            }
        }

        if (state.error != null) {
            Text(
                text = state.error!!,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp).testTag("pos_error"),
            )
        }
    }
}

@Composable
private fun CustomerPicker(state: PosUiState, customers: List<PersonRow>, onCustomer: (PersonRow) -> Unit) {
    Column {
        Text(
            "Pelanggan: ${state.draft.personName}",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 16.dp),
        )
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(customers, key = { it.id }) { person ->
                val isSelected = state.draft.personIdLama == person.idLama.ifBlank { person.id }
                FilterChip(
                    selected = isSelected,
                    onClick = { onCustomer(person) },
                    label = { Text(person.nama, style = MaterialTheme.typography.labelMedium) },
                    modifier = Modifier.heightIn(min = 40.dp).testTag("customer_${person.id}"),
                )
            }
        }
    }
}

@Composable
private fun HistoryPane(
    state: PosUiState,
    rows: List<id.primamotor.pos.data.repo.MenuRow>,
    accounts: List<PersonRow>,
    onQuery: (String) -> Unit,
    onEdit: (id.primamotor.pos.data.repo.MenuRow) -> Unit,
    onDelete: (id.primamotor.pos.data.repo.MenuRow) -> Unit,
    onSettle: (id.primamotor.pos.data.repo.MenuRow) -> Unit,
    onCloseSettle: () -> Unit,
    onSettleAccount: (String) -> Unit,
    onSettleConfirm: () -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = state.historyQuery,
            onValueChange = onQuery,
            label = { Text("Cari nota / pelanggan") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(16.dp).testTag("pos_history_search"),
        )
        if (state.error != null) {
            Text(
                state.error,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
        }
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (rows.isEmpty()) item { EmptyHint() }
            items(rows, key = { it.id }) { row ->
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(row.id, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(Money.formatRupiah(row.total), fontWeight = FontWeight.Bold)
                        }
                        Text(
                            "${row.note.ifBlank { row.person }} • ${if (row.payment == "cash") "Tunai" else "Tempo"}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            if (row.status != "lunas") {
                                TextButton(onClick = { onSettle(row) }) { Text("Lunasi") }
                            }
                            TextButton(onClick = { onEdit(row) }) { Text("Edit") }
                            TextButton(onClick = { onDelete(row) }) {
                                Text("Hapus", color = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                }
            }
        }
    }

    val target = state.settleFor
    if (target != null) {
        AlertDialog(
            onDismissRequest = onCloseSettle,
            title = { Text("Pelunasan Nota") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Sisa: ${Money.formatRupiah(id.primamotor.pos.domain.Settlement.remaining(target.total, target.dibayar))}")
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(accounts, key = { it.id }) { account ->
                            FilterChip(
                                selected = state.settleAccount == account.id,
                                onClick = { onSettleAccount(account.id) },
                                label = { Text(account.nama) },
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = onSettleConfirm, enabled = !state.saving) { Text("Lunasi") }
            },
            dismissButton = { TextButton(onClick = onCloseSettle) { Text("Batal") } },
        )
    }
}

@Composable
private fun ProductCard(product: Produk, onAdd: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onAdd),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(12.dp))
                    .padding(vertical = 14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    product.nama.trim().take(2).uppercase(),
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
            Text(
                product.nama,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                "${product.merk} ${product.varian}".trim(),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    Money.formatRupiah(product.sell6),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    "stok ${product.stok.stripTrailingZeros().toPlainString()}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
