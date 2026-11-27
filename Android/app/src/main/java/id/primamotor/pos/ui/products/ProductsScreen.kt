package id.primamotor.pos.ui.products

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.repo.ProductDraft
import id.primamotor.pos.data.repo.Produk
import id.primamotor.pos.domain.Money
import id.primamotor.pos.hardware.scanner.ScannerScreen
import java.math.BigDecimal

@Composable
fun ProductsRoute(container: AppContainer) {
    val vm: ProductViewModel = viewModel {
        ProductViewModel(container.repositories, container.productRepository)
    }
    ProductsScreen(vm)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductsScreen(viewModel: ProductViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val products by viewModel.products.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.message) {
        state.message?.let {
            snackbar.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        floatingActionButton = {
            Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = viewModel::openScanner, modifier = Modifier.testTag("products_scan")) { Text("Scan") }
                Button(onClick = { viewModel.edit(null) }, modifier = Modifier.testTag("products_add")) { Text("Tambah") }
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::setQuery,
                label = { Text("Cari nama / barcode") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(12.dp).testTag("products_search"),
            )
            LazyColumn(Modifier.fillMaxSize()) {
                if (products.isEmpty()) item { id.primamotor.pos.ui.EmptyHint() }
                items(products, key = { it.id }) { product ->
                    ProdukRow(product) { viewModel.edit(product) }
                    HorizontalDivider()
                }
            }
        }
    }

    val draft = state.draft
    if (draft != null) {
        ProductFormSheet(
            draft = draft,
            saving = state.saving,
            error = state.error,
            onChange = viewModel::updateDraft,
            onSave = viewModel::save,
            onScan = viewModel::openScanner,
            onDismiss = viewModel::closeForm,
        )
    }

    if (state.scanning) {
        ScannerScreen(onResult = viewModel::onScanned, onClose = viewModel::closeScanner)
    }
}

@Composable
private fun ProdukRow(product: Produk, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(product.nama, style = MaterialTheme.typography.bodyLarge)
            Text(
                listOf(product.merk, product.barcode).filter { it.isNotBlank() }.joinToString(" • ") +
                    " • stok ${product.stok.stripTrailingZeros().toPlainString()}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(Money.formatRupiah(product.sell1))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProductFormSheet(
    draft: ProductDraft,
    saving: Boolean,
    error: String?,
    onChange: ((ProductDraft) -> ProductDraft) -> Unit,
    onSave: () -> Unit,
    onScan: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(if (draft.id == null) "Produk baru" else "Ubah produk", style = MaterialTheme.typography.titleMedium)

            Field("Nama", draft.nama, "product_nama") { value -> onChange { it.copy(nama = value) } }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = draft.barcode,
                    onValueChange = { value -> onChange { it.copy(barcode = value.trim()) } },
                    label = { Text("Barcode") },
                    singleLine = true,
                    modifier = Modifier.weight(1f).testTag("product_barcode"),
                )
                TextButton(onClick = onScan) { Text("Scan") }
            }
            Field("ID lama", draft.idLama, "product_id_lama") { value -> onChange { it.copy(idLama = value) } }
            Field("Kategori", draft.kategori, "product_kategori") { value -> onChange { it.copy(kategori = value) } }
            Field("Merk", draft.merk, "product_merk") { value -> onChange { it.copy(merk = value) } }
            NumberField("Harga beli", draft.beli, "product_beli") { value -> onChange { it.copy(beli = value) } }
            NumberField("Harga jual", draft.sell1, "product_sell1") { value -> onChange { it.copy(sell1 = value) } }
            NumberField("Stok", draft.stok, "product_stok") { value -> onChange { it.copy(stok = value) } }

            if (error != null) {
                Text(error, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("product_error"))
            }

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDismiss) { Text("Batal") }
                Button(onClick = onSave, enabled = !saving, modifier = Modifier.testTag("product_save")) {
                    Text(if (saving) "Menyimpan..." else "Simpan")
                }
            }
        }
    }
}

@Composable
private fun Field(label: String, value: String, tag: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth().testTag(tag),
    )
}

@Composable
private fun NumberField(label: String, value: BigDecimal, tag: String, onChange: (BigDecimal) -> Unit) {
    OutlinedTextField(
        value = value.stripTrailingZeros().toPlainString().takeIf { it != "0" }.orEmpty(),
        onValueChange = { raw -> Money.parse(raw)?.let(onChange) ?: onChange(BigDecimal.ZERO) },
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth().testTag(tag),
    )
}