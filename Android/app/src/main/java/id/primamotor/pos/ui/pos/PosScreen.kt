package id.primamotor.pos.ui.pos

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import id.primamotor.pos.data.repo.Produk
import id.primamotor.pos.domain.Money

@Composable
fun PosRoute(container: id.primamotor.pos.AppContainer) {
    val viewModel: PosViewModel = androidx.lifecycle.viewmodel.compose.viewModel {
        PosViewModel(
            repos = container.repositories,
            checkout = container.checkoutRepository,
            operator = container.tokenStore.cachedUser()?.username ?: "kasir",
        )
    }
    PosScreen(viewModel)
}

@Composable
fun PosScreen(viewModel: PosViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val products by viewModel.products.collectAsStateWithLifecycle()
    val menus by viewModel.menus.collectAsStateWithLifecycle()
    var cartOpen by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = state.query,
            onValueChange = viewModel::setQuery,
            label = { Text("Cari nama / barcode") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(12.dp).testTag("pos_search"),
        )

        if (menus.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                menus.take(4).forEach { menu ->
                    FilterChip(
                        selected = state.draft.menu == menu.nama,
                        onClick = { viewModel.setMenu(menu.nama) },
                        label = { Text(menu.nama) },
                        modifier = Modifier.testTag("menu_${menu.nama}"),
                    )
                }
            }
        }

        LazyColumn(Modifier.weight(1f).fillMaxWidth(), contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp)) {
            items(products, key = { it.id }) { product ->
                ProductRow(product = product, onAdd = { viewModel.add(product) })
                HorizontalDivider()
            }
        }

        if (state.error != null) {
            Text(
                text = state.error!!,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp).testTag("pos_error"),
            )
        }

        Surface(shadowElevation = 8.dp) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column {
                    Text("${state.qty.stripTrailingZeros().toPlainString()} item", style = MaterialTheme.typography.bodyMedium)
                    Text(
                        Money.formatRupiah(state.total),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Button(
                    onClick = { cartOpen = true },
                    enabled = state.cart.isNotEmpty(),
                    modifier = Modifier.testTag("pos_open_cart"),
                ) { Text("Keranjang") }
            }
        }
    }

    if (cartOpen) {
        CheckoutSheet(
            state = state,
            accounts = viewModel.accounts.collectAsStateWithLifecycle().value,
            onQty = viewModel::setQty,
            onRemove = viewModel::remove,
            onDraft = viewModel::updateDraft,
            onSubmit = viewModel::commit,
            onDismiss = { cartOpen = false },
        )
    }

    val saved = state.saved
    if (saved != null) {
        AlertDialog(
            onDismissRequest = viewModel::dismissSaved,
            confirmButton = {
                TextButton(onClick = viewModel::dismissSaved) { Text("Tutup") }
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
private fun ProductRow(product: Produk, onAdd: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onAdd).padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(product.nama, style = MaterialTheme.typography.bodyLarge)
            Text(
                "${product.merk} ${product.varian}".trim() + " • stok ${product.stok.stripTrailingZeros().toPlainString()}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(Money.formatRupiah(product.sell1), fontWeight = FontWeight.SemiBold)
    }
}