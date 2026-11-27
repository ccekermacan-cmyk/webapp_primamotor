package id.primamotor.pos.ui.products

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.repo.ProductDraft
import id.primamotor.pos.data.repo.Produk
import id.primamotor.pos.domain.Money
import id.primamotor.pos.hardware.scanner.ScannerScreen
import id.primamotor.pos.ui.media.rememberPhotoCapture
import java.math.BigDecimal

@Composable
fun ProductsRoute(container: AppContainer) {
    val user = container.tokenStore.cachedUser()
    val vm: ProductViewModel = viewModel {
        ProductViewModel(
            repos = container.repositories,
            writer = container.productRepository,
            sessions = container.sessions,
            identity = user?.username.orEmpty(),
            operator = user?.let { it.name.ifBlank { it.username } }.orEmpty().ifBlank { "Admin" },
        )
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
            Column(Modifier.fillMaxWidth().padding(16.dp)) {
                Text("Produk", style = MaterialTheme.typography.headlineSmall)
                Text(
                    "Katalog barang dan jasa, sama dengan halaman Produk web",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::setQuery,
                label = { Text("Cari nama / barcode / kategori") },
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).testTag("products_search"),
            )
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                listOf("all" to "Semua", "menipis" to "Menipis", "habis" to "Habis").forEach { (value, label) ->
                    FilterChip(
                        selected = state.filterStok == value,
                        onClick = { viewModel.setFilterStok(value) },
                        label = { Text(label) },
                        modifier = Modifier.heightIn(min = 40.dp).testTag("products_filter_$label"),
                    )
                }
            }
            LazyColumn(Modifier.fillMaxSize()) {
                if (products.isEmpty()) item { id.primamotor.pos.ui.EmptyHint(message = "Tidak ada produk ditemukan.") }
                items(products, key = { it.id }) { product ->
                    ProdukRow(
                        product = product,
                        onClick = { viewModel.show(product) },
                        onStock = { delta -> viewModel.adjustStock(product, delta) },
                    )
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

    state.detail?.let { product ->
        ProductDetailSheet(
            product = product,
            canDelete = true,
            onEdit = { viewModel.edit(product) },
            onCopy = { viewModel.copy(product) },
            onDelete = { viewModel.askDelete(product) },
            onDismiss = viewModel::closeDetail,
        )
    }

    state.deleteTarget?.let {
        AlertDialog(
            onDismissRequest = viewModel::cancelDelete,
            title = { Text("Hapus Produk") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Hapus ${it.nama}? Butuh password akun dan jaringan, sama seperti web.")
                    OutlinedTextField(
                        value = state.deletePassword,
                        onValueChange = viewModel::setDeletePassword,
                        label = { Text("Password akun") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth().testTag("product_delete_password"),
                    )
                    state.deleteError?.let { message ->
                        Text(message, color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = viewModel::confirmDelete, enabled = !state.verifying) {
                    Text(if (state.verifying) "Memeriksa..." else "Hapus", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = viewModel::cancelDelete) { Text("Batal") } },
        )
    }

    if (state.scanning) {
        ScannerScreen(onResult = viewModel::onScanned, onClose = viewModel::closeScanner)
    }
}

@Composable
private fun ProdukRow(product: Produk, onClick: () -> Unit, onStock: (Int) -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.surfaceVariant),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 5.dp).clickable(onClick = onClick),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(product.nama, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
                Text(
                    listOf(product.merk, product.barcode, product.kategori).filter { it.isNotBlank() }.joinToString(" • "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "stok ${product.stok.stripTrailingZeros().toPlainString()} ${product.unit}",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (product.stok.signum() <= 0) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(Money.formatRupiah(product.sell6), style = MaterialTheme.typography.titleSmall)
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    OutlinedButton(
                        onClick = { onStock(-1) },
                        enabled = product.stok.signum() > 0,
                        modifier = Modifier.heightIn(min = 40.dp),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp),
                    ) { Text("−", style = MaterialTheme.typography.titleMedium) }
                    OutlinedButton(
                        onClick = { onStock(1) },
                        modifier = Modifier.heightIn(min = 40.dp),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp),
                    ) { Text("+", style = MaterialTheme.typography.titleMedium) }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProductDetailSheet(
    product: Produk,
    canDelete: Boolean,
    onEdit: () -> Unit,
    onCopy: () -> Unit,
    onDelete: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(product.nama, style = MaterialTheme.typography.titleLarge)
            Text(
                listOf(product.kategori, product.merk, product.jenis, product.varian).filter { it.isNotBlank() }.joinToString(" • "),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (product.keterangan.isNotBlank()) Text(product.keterangan, style = MaterialTheme.typography.bodyMedium)
            HorizontalDivider(Modifier.padding(vertical = 6.dp))
            DetailRow("Reference ID", product.idLama.ifBlank { product.id })
            DetailRow("Barcode", product.barcode.ifBlank { "-" })
            DetailRow("Tipe", product.tipe.ifBlank { "-" })
            DetailRow("Unit", product.unit)
            DetailRow("Stok", "${product.stok.stripTrailingZeros().toPlainString()} (min ${product.min1.stripTrailingZeros().toPlainString()})")
            HorizontalDivider(Modifier.padding(vertical = 6.dp))
            DetailRow("Harga beli", Money.formatRupiah(product.beli))
            DetailRow("Grosir besar", Money.formatRupiah(product.sell1) + " (min ${product.min1.stripTrailingZeros().toPlainString()})")
            DetailRow("Grosir sedang", Money.formatRupiah(product.sell2) + " (min ${product.min2.stripTrailingZeros().toPlainString()})")
            DetailRow("Grosir kecil", Money.formatRupiah(product.sell3) + " (min ${product.min3.stripTrailingZeros().toPlainString()})")
            DetailRow("Harga pelanggan", Money.formatRupiah(product.sell5))
            DetailRow("Harga retail", Money.formatRupiah(product.sell6))
            HorizontalDivider(Modifier.padding(vertical = 6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onEdit, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) { Text("Edit") }
                OutlinedButton(onClick = onCopy, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) { Text("Salin") }
            }
            if (canDelete) {
                OutlinedButton(onClick = onDelete, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                    Text("Hapus produk", color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodySmall)
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
    val capture = rememberPhotoCapture { path -> onChange { it.copy(mediaPath = path) } }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(if (draft.id == null) "Tambah Produk" else "Ubah Produk", style = MaterialTheme.typography.titleLarge)

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
            Field("Reference ID", draft.idLama, "product_id_lama") { value -> onChange { it.copy(idLama = value) } }
            Field("Kategori", draft.kategori, "product_kategori") { value -> onChange { it.copy(kategori = value) } }
            Field("Merk", draft.merk, "product_merk") { value -> onChange { it.copy(merk = value) } }
            Field("Jenis (Section)", draft.jenis, "product_jenis") { value -> onChange { it.copy(jenis = value) } }
            Field("Varian", draft.varian, "product_varian") { value -> onChange { it.copy(varian = value) } }
            Field("Keterangan", draft.keterangan, "product_keterangan") { value -> onChange { it.copy(keterangan = value) } }
            Field("Tipe (pisahkan koma)", draft.tipe, "product_tipe") { value -> onChange { it.copy(tipe = value) } }
            Field("Unit", draft.unit, "product_unit") { value -> onChange { it.copy(unit = value) } }

            HorizontalDivider()
            Text("Harga & Stok", style = MaterialTheme.typography.labelLarge)
            NumberField("Harga beli", draft.beli, "product_beli") { value -> onChange { it.copy(beli = value) } }
            NumberField("Harga retail (Sell 6)", draft.sell6, "product_sell6") { value -> onChange { it.copy(sell6 = value) } }
            NumberField("Harga pelanggan (Sell 5)", draft.sell5, "product_sell5") { value -> onChange { it.copy(sell5 = value) } }
            NumberField("Grosir kecil (Sell 3)", draft.sell3, "product_sell3") { value -> onChange { it.copy(sell3 = value) } }
            NumberField("Min qty grosir kecil", draft.min3, "product_min3") { value -> onChange { it.copy(min3 = value) } }
            NumberField("Grosir sedang (Sell 2)", draft.sell2, "product_sell2") { value -> onChange { it.copy(sell2 = value) } }
            NumberField("Min qty grosir sedang", draft.min2, "product_min2") { value -> onChange { it.copy(min2 = value) } }
            NumberField("Grosir besar (Sell 1)", draft.sell1, "product_sell1") { value -> onChange { it.copy(sell1 = value) } }
            NumberField("Min qty grosir besar", draft.min1, "product_min1") { value -> onChange { it.copy(min1 = value) } }
            NumberField("Stok", draft.stok, "product_stok") { value -> onChange { it.copy(stok = value) } }

            OutlinedButton(onClick = capture, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                Text(if (draft.mediaPath == null) "Ambil foto produk (unggah saat online)" else "Foto siap diunggah saat online")
            }

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
        onValueChange = { raw -> onChange(Money.parse(raw) ?: BigDecimal.ZERO) },
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth().testTag(tag),
    )
}
