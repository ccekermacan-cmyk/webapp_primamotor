package id.primamotor.pos.ui.pos

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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import id.primamotor.pos.data.repo.Produk
import id.primamotor.pos.domain.Money
import id.primamotor.pos.ui.EmptyHint

@Composable
fun PosRoute(container: id.primamotor.pos.AppContainer) {
    val viewModel: PosViewModel = androidx.lifecycle.viewmodel.compose.viewModel {
        PosViewModel(
            repos = container.repositories,
            checkout = container.checkoutRepository,
            operatorName = container.tokenStore.cachedUser()?.username ?: "kasir",
        )
    }
    PosScreen(viewModel)
}

@Composable
fun PosScreen(viewModel: PosViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val products by viewModel.products.collectAsStateWithLifecycle()
    val menus by viewModel.menus.collectAsStateWithLifecycle()
    val accounts by viewModel.accounts.collectAsStateWithLifecycle()
    var cartOpen by remember { mutableStateOf(false) }
    var showReceipt by remember { mutableStateOf(false) }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        // Tiga kolom di tablet/lanskap (seperti web), dua area di HP potret.
        val wide = maxWidth >= 840.dp
        if (wide) {
            Row(Modifier.fillMaxSize()) {
                CatalogPane(
                    state = state,
                    products = products,
                    menus = menus,
                    viewModel = viewModel,
                    modifier = Modifier.weight(1.5f).fillMaxHeight(),
                )
                Surface(
                    modifier = Modifier.weight(1f).fillMaxHeight(),
                    color = MaterialTheme.colorScheme.surface,
                    shadowElevation = 8.dp,
                ) {
                    Column(Modifier.fillMaxSize().padding(16.dp)) {
                        CheckoutContent(
                            state = state,
                            accounts = accounts,
                            onQty = viewModel::setQty,
                            onRemove = viewModel::remove,
                            onDraft = viewModel::updateDraft,
                            onSubmit = viewModel::commit,
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
                            onClick = { cartOpen = true },
                            enabled = state.cart.isNotEmpty(),
                            modifier = Modifier.heightIn(min = 52.dp).testTag("pos_open_cart"),
                        ) { Text("Keranjang", style = MaterialTheme.typography.labelLarge) }
                    }
                }
            }
        }
    }

    if (cartOpen) {
        CheckoutSheet(
            state = state,
            accounts = accounts,
            onQty = viewModel::setQty,
            onRemove = viewModel::remove,
            onDraft = viewModel::updateDraft,
            onSubmit = viewModel::commit,
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
                items = state.cart.map { entry ->
                    id.primamotor.pos.hardware.printer.ReceiptItem(entry.produk.nama, entry.qty, entry.produk.sell1)
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
                Column {
                    Text("Nota: ${saved.notaId}")
                    Text("Total: ${Money.formatRupiah(saved.total)}")
                    Text("Kembali: ${Money.formatRupiah(saved.change)}")
                    Text("Status: ${saved.status}")
                    Text("Menunggu sinkron. Cetak struk setelah printer siap.")
                }
            },
            modifier = Modifier.testTag("pos_saved_dialog"),
        )
    }
}

@Composable
private fun CatalogPane(
    state: PosUiState,
    products: List<Produk>,
    menus: List<id.primamotor.pos.data.repo.PersonRow>,
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
                items(menus, key = { it.nama }) { menu ->
                    FilterChip(
                        selected = state.draft.menu == menu.nama,
                        onClick = { viewModel.setMenu(menu.nama) },
                        label = { Text(menu.nama, style = MaterialTheme.typography.labelMedium) },
                        modifier = Modifier.heightIn(min = 44.dp).testTag("menu_${menu.nama}"),
                    )
                }
            }
        }

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
private fun ProductCard(product: Produk, onAdd: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
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
                    Money.formatRupiah(product.sell1),
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
