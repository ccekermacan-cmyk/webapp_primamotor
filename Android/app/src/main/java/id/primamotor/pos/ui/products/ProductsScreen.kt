package id.primamotor.pos.ui.products

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import id.primamotor.pos.AppContainer
import id.primamotor.pos.data.repo.ProductDraft
import id.primamotor.pos.data.repo.ProductLog
import id.primamotor.pos.data.repo.Produk
import id.primamotor.pos.domain.Money
import id.primamotor.pos.domain.ProductFeed
import id.primamotor.pos.hardware.scanner.ScannerScreen
import id.primamotor.pos.ui.media.RemoteImage
import id.primamotor.pos.ui.media.MediaImages
import id.primamotor.pos.ui.media.rememberPhotoCapture
import java.math.BigDecimal
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val PRODUCT_TIME = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale("id", "ID"))
private val PRODUCT_CLOCK = DateTimeFormatter.ofPattern("HH:mm:ss")

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
            level = user?.level ?: 1,
        )
    }
    ProductsScreen(vm, container.tokenStore.token())
}

@Composable
fun ProductsScreen(viewModel: ProductViewModel, token: String? = null) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val page by viewModel.products.collectAsStateWithLifecycle()
    val kategori by viewModel.kategoriOptions.collectAsStateWithLifecycle()
    val detail by viewModel.detail.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.message) {
        state.message?.let {
            snackbar.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    BoxWithConstraints(Modifier.fillMaxSize().background(Color(0xFFF8FAFC))) {
        val wide = maxWidth >= 640.dp
        val perPage = ProductFeed.pageSize(maxWidth.value.toInt())
        LaunchedEffect(perPage) { viewModel.setPerPage(perPage) }

        Scaffold(
            snackbarHost = { SnackbarHost(snackbar) },
            containerColor = Color.Transparent,
            floatingActionButton = {
                if (!wide) {
                    Button(
                        onClick = { viewModel.edit(null) },
                        modifier = Modifier.heightIn(min = 52.dp).testTag("products_add"),
                    ) { Text("+ Produk Baru") }
                }
            },
        ) { padding ->
            Column(Modifier.fillMaxSize().padding(padding)) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("Manajemen Produk", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        Text(
                            "Total ${page.total} produk terdaftar",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF64748B),
                        )
                    }
                    if (wide) {
                        Button(
                            onClick = { viewModel.edit(null) },
                            modifier = Modifier.heightIn(min = 48.dp).testTag("products_add"),
                        ) { Text("+ Produk Baru") }
                    }
                }

                SearchRow(
                    state = state,
                    wide = wide,
                    onQuery = viewModel::setQuery,
                    onToggleFilters = viewModel::toggleFilters,
                    onView = viewModel::setViewMode,
                )

                if (wide || state.showFilters) {
                    FilterRow(
                        state = state,
                        kategori = kategori,
                        onKategori = viewModel::setFilterKategori,
                        onStok = viewModel::setFilterStok,
                    )
                }

                state.error?.let { message ->
                    Text(
                        message,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }

                Box(Modifier.weight(1f).fillMaxWidth()) {
                    if (page.rows.isEmpty()) {
                        Text(
                            "Tidak ada produk ditemukan.",
                            modifier = Modifier.fillMaxWidth().padding(24.dp),
                            color = Color(0xFF64748B),
                        )
                    } else if (state.viewMode == "grid") {
                        ProductGrid(
                            rows = page.rows,
                            token = token,
                            state = state,
                            onOpen = viewModel::openDetail,
                            onEdit = { viewModel.edit(it) },
                            onCopy = viewModel::requestCopy,
                            onDelete = viewModel::askDelete,
                            onStock = viewModel::adjustStock,
                        )
                    } else {
                        ProductTable(
                            rows = page.rows,
                            token = token,
                            state = state,
                            onOpen = viewModel::openDetail,
                            onSort = viewModel::sort,
                            onEdit = viewModel::edit,
                        )
                    }
                }

                Pagination(
                    page = page.page,
                    totalPages = page.totalPages,
                    loading = state.saving,
                    onPage = viewModel::setPage,
                )
            }
        }
    }

    state.draft?.let { draft ->
        ProductFormDialog(
            draft = draft,
            saving = state.saving,
            error = state.error,
            onChange = viewModel::updateDraft,
            onSave = viewModel::save,
            onDismiss = viewModel::closeForm,
        )
    }

    detail?.let { product ->
        ProductDetailDialog(
            product = product,
            state = state,
            token = token,
            onEdit = { viewModel.edit(product) },
            onCopy = { viewModel.requestCopy(product) },
            onDelete = { viewModel.askDelete(product) },
            onLogPage = viewModel::setLogPage,
            onRelated = viewModel::openDetail,
            onDismiss = viewModel::closeDetail,
        )
    }

    state.copyTarget?.let { product ->
        AlertDialog(
            onDismissRequest = viewModel::cancelCopy,
            title = { Text("Salin Produk Ini?") },
            text = {
                Text(
                    "Anda akan menduplikasi semua atribut dari ${ProductFeed.fullName(product)}. " +
                        "Stok awal pada produk baru akan di-reset menjadi 0.",
                )
            },
            confirmButton = { TextButton(onClick = viewModel::confirmCopy) { Text("Ya, Salin Data") } },
            dismissButton = { TextButton(onClick = viewModel::cancelCopy) { Text("Batal") } },
        )
    }

    state.deleteTarget?.let { product ->
        AlertDialog(
            onDismissRequest = viewModel::cancelDelete,
            title = { Text("Konfirmasi Hapus Produk") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Yakin ingin menghapus ${ProductFeed.fullName(product)}? Tindakan ini tidak dapat dibatalkan.")
                    OutlinedTextField(
                        value = state.deletePassword,
                        onValueChange = viewModel::setDeletePassword,
                        label = { Text("Password Admin") },
                        placeholder = { Text("Masukkan password untuk konfirmasi") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth().testTag("product_delete_password"),
                    )
                    state.deleteError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = {
                TextButton(onClick = viewModel::confirmDelete, enabled = !state.verifying) {
                    Text(if (state.verifying) "Menghapus..." else "Hapus Permanen", color = MaterialTheme.colorScheme.error)
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
private fun SearchRow(
    state: ProductsUiState,
    wide: Boolean,
    onQuery: (String) -> Unit,
    onToggleFilters: () -> Unit,
    onView: (String) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            listOf("grid" to "Grid", "list" to "List").forEach { (value, label) ->
                Surface(
                    color = if (state.viewMode == value) Color(0xFFF97316) else Color.White,
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier.clickable { onView(value) },
                ) {
                    Text(
                        label,
                        color = if (state.viewMode == value) Color.White else Color(0xFF475569),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 8.dp),
                    )
                }
            }
        }
        OutlinedTextField(
            value = state.query,
            onValueChange = onQuery,
            placeholder = { Text("Cari produk...") },
            singleLine = true,
            modifier = Modifier.weight(1f).heightIn(min = 52.dp).testTag("products_search"),
        )
        if (!wide) {
            OutlinedButton(
                onClick = onToggleFilters,
                modifier = Modifier.heightIn(min = 52.dp).testTag("products_filter_toggle"),
            ) { Text("Filter") }
        }
    }
}

@Composable
private fun FilterRow(
    state: ProductsUiState,
    kategori: List<String>,
    onKategori: (String) -> Unit,
    onStok: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box {
            OutlinedButton(
                onClick = { open = true },
                modifier = Modifier.heightIn(min = 48.dp).testTag("products_kategori"),
            ) {
                Text(
                    if (state.filterKategori == "all") "Semua Kategori" else state.filterKategori,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                DropdownMenuItem(
                    text = { Text("Semua Kategori") },
                    onClick = { onKategori("all"); open = false },
                )
                kategori.forEach { item ->
                    DropdownMenuItem(
                        text = { Text(item) },
                        onClick = { onKategori(item); open = false },
                    )
                }
            }
        }
        listOf("all" to "Semua", "menipis" to "Menipis", "habis" to "Habis").forEach { (value, label) ->
            FilterChip(
                selected = state.filterStok == value,
                onClick = { onStok(value) },
                label = { Text(label) },
                modifier = Modifier.heightIn(min = 44.dp).testTag("products_filter_$label"),
            )
        }
    }
}

@Composable
private fun ProductGrid(
    rows: List<Produk>,
    token: String?,
    state: ProductsUiState,
    onOpen: (Produk) -> Unit,
    onEdit: (Produk) -> Unit,
    onCopy: (Produk) -> Unit,
    onDelete: (Produk) -> Unit,
    onStock: (Produk, Int) -> Unit,
) {
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 160.dp),
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(rows, key = { it.id }) { product ->
            ProductCard(
                product = product,
                objectUrl = product.files.firstOrNull()?.let { MediaImages.url(product.id, it, "300x225") },
                token = token,
                showMargin = state.showMargin,
                canDelete = state.level == 1,
                busy = state.saving,
                onOpen = { onOpen(product) },
                onEdit = { onEdit(product) },
                onCopy = { onCopy(product) },
                onDelete = { onDelete(product) },
                onStock = { delta -> onStock(product, delta) },
            )
        }
    }
}

@Composable
private fun ProductCard(
    product: Produk,
    objectUrl: String?,
    token: String?,
    showMargin: Boolean,
    canDelete: Boolean,
    busy: Boolean,
    onOpen: () -> Unit,
    onEdit: () -> Unit,
    onCopy: () -> Unit,
    onDelete: () -> Unit,
    onStock: (Int) -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Color.White,
        border = BorderStroke(1.dp, Color(0xFFE2E8F0)),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOpen).testTag("product_card"),
    ) {
        Column(Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(Modifier.fillMaxWidth().height(96.dp).background(Color(0xFFF1F5F9), RoundedCornerShape(12.dp))) {
                RemoteImage(
                    url = objectUrl,
                    token = token,
                    contentDescription = ProductFeed.fullName(product),
                    modifier = Modifier.fillMaxSize(),
                    placeholder = "Foto",
                )
                if (ProductFeed.isHabis(product)) {
                    Badge("HABIS", Color(0xFF991B1B), Color(0xFFFEE2E2), Modifier.align(Alignment.TopStart).padding(4.dp))
                } else if (ProductFeed.isMenipis(product)) {
                    Badge("MENIPIS", Color(0xFF92400E), Color(0xFFFEF3C7), Modifier.align(Alignment.TopStart).padding(4.dp))
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Badge(ProductFeed.displayCode(product.idLama), Color(0xFF334155), Color(0xFFF1F5F9))
                Badge(product.unit.ifBlank { "-" }, Color(0xFF475569), Color(0xFFF8FAFC))
            }
            Text(
                ProductFeed.fullName(product),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text("Stok", fontSize = 10.sp, color = Color(0xFF94A3B8))
                    Text(
                        "${product.stok.stripTrailingZeros().toPlainString()} ${product.unit}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = when {
                            ProductFeed.isHabis(product) -> Color(0xFFDC2626)
                            ProductFeed.isMenipis(product) -> Color(0xFFD97706)
                            else -> Color(0xFF059669)
                        },
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Harga", fontSize = 10.sp, color = Color(0xFF94A3B8))
                    Text(Money.formatRupiah(product.sell6), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
            if (showMargin) {
                ProductFeed.retailMargin(product)?.let { percent ->
                    Text(
                        "Mgn $percent%",
                        fontSize = 10.sp,
                        color = if (product.sell6 > product.beli) Color(0xFF059669) else Color(0xFFDC2626),
                    )
                }
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onEdit, modifier = Modifier.heightIn(min = 32.dp), contentPadding = PaddingValues(2.dp)) {
                    Text("Edit", fontSize = 11.sp)
                }
                TextButton(onClick = onCopy, modifier = Modifier.heightIn(min = 32.dp), contentPadding = PaddingValues(2.dp)) {
                    Text("Salin", fontSize = 11.sp)
                }
                if (canDelete) {
                    TextButton(onClick = onDelete, modifier = Modifier.heightIn(min = 32.dp), contentPadding = PaddingValues(2.dp)) {
                        Text("Hapus", fontSize = 11.sp, color = Color(0xFFDC2626))
                    }
                }
                Box(Modifier.weight(1f))
                TextButton(
                    onClick = { onStock(-1) },
                    enabled = !busy && product.stok.signum() > 0,
                    modifier = Modifier.heightIn(min = 32.dp).width(32.dp),
                    contentPadding = PaddingValues(0.dp),
                ) { Text("−", color = Color(0xFFDC2626), fontWeight = FontWeight.Bold) }
                Text(
                    product.stok.stripTrailingZeros().toPlainString(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 2.dp),
                )
                TextButton(
                    onClick = { onStock(1) },
                    enabled = !busy,
                    modifier = Modifier.heightIn(min = 32.dp).width(32.dp),
                    contentPadding = PaddingValues(0.dp),
                ) { Text("+", color = Color(0xFF059669), fontWeight = FontWeight.Bold) }
            }
        }
    }
}

@Composable
private fun Badge(text: String, foreground: Color, background: Color, modifier: Modifier = Modifier) {
    Surface(color = background, shape = RoundedCornerShape(6.dp), modifier = modifier) {
        Text(
            text,
            color = foreground,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp),
        )
    }
}

@Composable
private fun ProductTable(
    rows: List<Produk>,
    token: String?,
    state: ProductsUiState,
    onOpen: (Produk) -> Unit,
    onSort: (String) -> Unit,
    onEdit: (Produk) -> Unit,
) {
    val scroll = rememberScrollState()
    Column(Modifier.fillMaxSize().horizontalScroll(scroll)) {
        Row(Modifier.width(760.dp).padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            SortHeader("Kode", "id_lama", state, onSort, Modifier.width(74.dp))
            Text("", Modifier.width(48.dp))
            SortHeader("Nama Produk", "nama", state, onSort, Modifier.weight(1f))
            SortHeader("Stok", "stok", state, onSort, Modifier.width(70.dp))
            SortHeader("Harga Pelanggan", "harga_customer", state, onSort, Modifier.width(110.dp))
            SortHeader("Harga Retail", "harga_retail", state, onSort, Modifier.width(110.dp))
            Text("Aksi", Modifier.width(110.dp).padding(4.dp), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
        HorizontalDivider()
        LazyColumn(Modifier.weight(1f).width(760.dp), contentPadding = PaddingValues(12.dp)) {
            items(rows, key = { it.id }) { product ->
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 6.dp).clickable { onOpen(product) },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        ProductFeed.displayCode(product.idLama),
                        Modifier.width(74.dp),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                    )
                    RemoteImage(
                        url = product.files.firstOrNull()?.let { MediaImages.url(product.id, it, "80x80") },
                        token = token,
                        contentDescription = null,
                        modifier = Modifier.width(48.dp).height(40.dp).background(Color(0xFFF1F5F9), RoundedCornerShape(6.dp)),
                        placeholder = "-",
                    )
                    Text(
                        ProductFeed.fullName(product),
                        Modifier.weight(1f),
                        fontSize = 12.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        "${product.stok.stripTrailingZeros().toPlainString()} ${product.unit}",
                        Modifier.width(70.dp),
                        fontSize = 12.sp,
                        color = if (ProductFeed.isHabis(product)) Color(0xFFDC2626) else Color(0xFF059669),
                    )
                    Text(Money.formatRupiah(product.sell5), Modifier.width(110.dp), fontSize = 12.sp, color = Color(0xFF7C3AED))
                    Text(Money.formatRupiah(product.sell6), Modifier.width(110.dp), fontSize = 12.sp, color = Color(0xFF2563EB))
                    Row(Modifier.width(110.dp)) {
                        TextButton(onClick = { onEdit(product) }, contentPadding = PaddingValues(2.dp)) {
                            Text("Edit", fontSize = 11.sp)
                        }
                        TextButton(onClick = { onOpen(product) }, contentPadding = PaddingValues(2.dp)) {
                            Text("Salin", fontSize = 11.sp)
                        }
                    }
                }
                HorizontalDivider(color = Color(0xFFF1F5F9))
            }
        }
    }
}

@Composable
private fun SortHeader(
    label: String,
    field: String,
    state: ProductsUiState,
    onSort: (String) -> Unit,
    modifier: Modifier,
) {
    val active = state.sortField == field
    TextButton(onClick = { onSort(field) }, modifier = modifier.heightIn(min = 40.dp), contentPadding = PaddingValues(4.dp)) {
        Text(
            label + if (active) (if (state.sortOrder == "asc") " ↑" else " ↓") else "",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
        )
    }
}

@Composable
private fun Pagination(page: Int, totalPages: Int, loading: Boolean, onPage: (Int) -> Unit) {
    Surface(color = Color.White, shadowElevation = 2.dp, modifier = Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Hal $page/${totalPages.coerceAtLeast(1)}", style = MaterialTheme.typography.labelSmall)
            Row {
                TextButton(
                    onClick = { onPage(page - 1) },
                    enabled = page > 1 && !loading,
                    modifier = Modifier.heightIn(min = 40.dp),
                ) { Text("<") }
                TextButton(
                    onClick = { onPage(page + 1) },
                    enabled = page < totalPages && !loading,
                    modifier = Modifier.heightIn(min = 40.dp),
                ) { Text(">") }
            }
        }
    }
}

@Composable
private fun ProductDetailDialog(
    product: Produk,
    state: ProductsUiState,
    token: String?,
    onEdit: () -> Unit,
    onCopy: () -> Unit,
    onDelete: () -> Unit,
    onLogPage: (Int) -> Unit,
    onRelated: (Produk) -> Unit,
    onDismiss: () -> Unit,
) {
    var image by remember(product.id) { mutableStateOf(0) }
    var copied by remember(product.id) { mutableStateOf(false) }
    val context = androidx.compose.ui.platform.LocalContext.current
    val files = product.files
    val index = image.coerceIn(0, (files.size - 1).coerceAtLeast(0))
    val url = files.getOrNull(index)?.let { MediaImages.url(product.id, it) }

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            Modifier.fillMaxWidth(0.96f).fillMaxHeight(0.94f),
            color = Color.White,
            shape = RoundedCornerShape(20.dp),
        ) {
            Column(Modifier.fillMaxSize().padding(14.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("Detail Spesifikasi Produk", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Box(Modifier.weight(1f))
                    TextButton(onClick = onDismiss) { Text("Tutup") }
                }
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        Modifier.fillMaxWidth().height(170.dp).background(Color(0xFFF1F5F9), RoundedCornerShape(14.dp)),
                    ) {
                        RemoteImage(
                            url = url,
                            token = token,
                            contentDescription = ProductFeed.fullName(product),
                            modifier = Modifier.fillMaxSize(),
                            placeholder = "Belum ada gambar",
                        )
                        if (files.size > 1) {
                            Row(
                                Modifier.fillMaxWidth().align(Alignment.BottomCenter).padding(6.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                TextButton(onClick = { image = (index - 1 + files.size) % files.size }) { Text("‹") }
                                Text("${index + 1}/${files.size}", color = Color(0xFF0F172A), fontSize = 11.sp)
                                TextButton(onClick = { image = (index + 1) % files.size }) { Text("›") }
                            }
                        }
                        if (ProductFeed.isHabis(product)) {
                            Badge("HABIS", Color(0xFF991B1B), Color(0xFFFEE2E2), Modifier.align(Alignment.TopStart).padding(6.dp))
                        }
                    }

                    Text("ID: ${ProductFeed.displayCode(product.idLama)}", fontSize = 11.sp, color = Color(0xFF64748B))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            ProductFeed.fullName(product),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f),
                        )
                        Badge(product.unit.ifBlank { "-" }, Color(0xFF334155), Color(0xFFF1F5F9))
                    }
                    TextButton(
                        onClick = {
                            val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE)
                                as? android.content.ClipboardManager
                            val ok = runCatching {
                                clipboard?.setPrimaryClip(
                                    android.content.ClipData.newPlainText("Produk", ProductFeed.fullName(product)),
                                )
                                clipboard != null
                            }.getOrDefault(false)
                            copied = ok
                            android.widget.Toast.makeText(
                                context,
                                if (ok) "Nama produk disalin." else "Nama produk belum dapat disalin. Periksa izin clipboard.",
                                android.widget.Toast.LENGTH_SHORT,
                            ).show()
                        },
                    ) { Text(if (copied) "Tersalin" else "Salin Nama Produk") }

                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (ProductFeed.isHabis(product)) Badge("Habis", Color(0xFF991B1B), Color(0xFFFEE2E2))
                        if (ProductFeed.isMenipis(product)) Badge("Menipis", Color(0xFF92400E), Color(0xFFFEF3C7))
                        Badge(
                            "Stok: ${product.stok.stripTrailingZeros().toPlainString()} ${product.unit}",
                            Color(0xFF065F46),
                            Color(0xFFD1FAE5),
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Button(onClick = onEdit, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) { Text("Edit Data") }
                        OutlinedButton(onClick = onCopy, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) { Text("Salin") }
                        if (state.canDelete) {
                            OutlinedButton(onClick = onDelete, modifier = Modifier.weight(1f).heightIn(min = 48.dp)) {
                                Text("Hapus", color = MaterialTheme.colorScheme.error)
                            }
                        }
                    }

                    Surface(color = Color(0xFFF8FAFC), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(10.dp)) {
                            Text("Harga Beli (Modal)", fontSize = 11.sp, color = Color(0xFF64748B))
                            Text(Money.formatRupiah(product.beli), fontWeight = FontWeight.Bold)
                        }
                    }

                    Text("Skema Harga (Tiering)", fontWeight = FontWeight.Bold)
                    Row(Modifier.fillMaxWidth()) {
                        Text("Tier", Modifier.weight(1.4f), fontSize = 10.sp, color = Color(0xFF94A3B8))
                        Text("Minimum", Modifier.weight(0.9f), fontSize = 10.sp, color = Color(0xFF94A3B8))
                        Text("Harga", Modifier.weight(1f), fontSize = 10.sp, color = Color(0xFF94A3B8))
                        Text("Profit", Modifier.weight(0.9f), fontSize = 10.sp, color = Color(0xFF94A3B8))
                    }
                    val tiers = listOf(
                        Triple("Tier 1 (Grosir Besar)", product.min1, product.sell1),
                        Triple("Tier 2 (Grosir Sedang)", product.min2, product.sell2),
                        Triple("Tier 3 (Grosir Kecil)", product.min3, product.sell3),
                        Triple("Tier 4", null, product.sell4),
                        Triple("Tier 5 (Pelanggan)", null, product.sell5),
                        Triple("Tier 6 (Default Ecer)", null, product.sell6),
                    )
                    tiers.forEach { (label, minimum, sell) ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
                            Text(label, Modifier.weight(1.4f), fontSize = 11.sp)
                            Text(
                                minimum?.let { "≥ ${it.stripTrailingZeros().toPlainString()}" } ?: "-",
                                Modifier.weight(0.9f),
                                fontSize = 11.sp,
                            )
                            Text(Money.formatRupiah(sell), Modifier.weight(1f), fontSize = 11.sp)
                            Text(
                                ProductFeed.tierMargin(product.beli, sell) ?: "-",
                                Modifier.weight(0.9f),
                                fontSize = 11.sp,
                                color = Color(0xFF059669),
                            )
                        }
                    }

                    Text("Riwayat Keluar/Masuk", fontWeight = FontWeight.Bold)
                    if (state.detailLogs.isEmpty()) {
                        Text("Belum ada riwayat transaksi.", color = Color(0xFF64748B), fontSize = 12.sp)
                    } else {
                        Row(Modifier.fillMaxWidth()) {
                            Text("Tanggal", Modifier.weight(1.4f), fontSize = 10.sp, color = Color(0xFF94A3B8))
                            Text("Operator", Modifier.weight(0.9f), fontSize = 10.sp, color = Color(0xFF94A3B8))
                            Text("Status", Modifier.weight(0.7f), fontSize = 10.sp, color = Color(0xFF94A3B8))
                            Text("Qty", Modifier.weight(0.5f), fontSize = 10.sp, color = Color(0xFF94A3B8))
                            Text("Harga", Modifier.weight(0.9f), fontSize = 10.sp, color = Color(0xFF94A3B8))
                        }
                        state.detailLogs.forEach { log -> LogRow(log) }
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "Hal ${state.detailLogPage} / ${state.detailLogPages.coerceAtLeast(1)}",
                                fontSize = 10.sp,
                                color = Color(0xFF64748B),
                            )
                            Row {
                                TextButton(
                                    onClick = { onLogPage(state.detailLogPage - 1) },
                                    enabled = state.detailLogPage > 1,
                                ) { Text("‹") }
                                TextButton(
                                    onClick = { onLogPage(state.detailLogPage + 1) },
                                    enabled = state.detailLogPage < state.detailLogPages,
                                ) { Text("›") }
                            }
                        }
                    }

                    if (files.isNotEmpty()) {
                        Text("Lampiran Gambar Produk", fontWeight = FontWeight.Bold)
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            items(files, key = { it }) { file ->
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    RemoteImage(
                                        url = MediaImages.url(product.id, file, "200x200"),
                                        token = token,
                                        contentDescription = "lampiran",
                                        modifier = Modifier.size(84.dp).background(Color(0xFFF1F5F9), RoundedCornerShape(8.dp)),
                                        placeholder = "file",
                                    )
                                    Text(file, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                            }
                        }
                    }

                    if (state.related.isNotEmpty()) {
                        Text("Produk Serupa / Terkait", fontWeight = FontWeight.Bold)
                        state.related.forEach { other ->
                            Surface(
                                color = Color(0xFFF8FAFC),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth().clickable { onRelated(other) },
                            ) {
                                Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                    RemoteImage(
                                        url = other.files.firstOrNull()?.let { MediaImages.url(other.id, it, "80x80") },
                                        token = token,
                                        contentDescription = null,
                                        modifier = Modifier.size(40.dp).background(Color(0xFFE2E8F0), RoundedCornerShape(6.dp)),
                                        placeholder = "-",
                                    )
                                    Column(Modifier.weight(1f).padding(start = 8.dp)) {
                                        Text(ProductFeed.fullName(other), fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        Text("ID: ${ProductFeed.displayCode(other.idLama)}", fontSize = 10.sp, color = Color(0xFF64748B))
                                    }
                                    Badge(
                                        if (ProductFeed.isHabis(other)) "HABIS" else "Stok: ${other.stok.stripTrailingZeros().toPlainString()}",
                                        Color(0xFF334155),
                                        Color(0xFFF1F5F9),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LogRow(log: ProductLog) {
    val zone = ZoneId.of("Asia/Jakarta")
    val instant = runCatching { Instant.parse(log.createdAt).atZone(zone) }.getOrNull()
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1.4f)) {
            Text(instant?.format(PRODUCT_TIME) ?: log.createdAt, fontSize = 10.sp)
            Text(instant?.format(PRODUCT_CLOCK) ?: "-", fontSize = 9.sp, color = Color(0xFF94A3B8))
        }
        Text(log.operator.ifBlank { "-" }, Modifier.weight(0.9f), fontSize = 10.sp)
        Text(
            log.direction,
            Modifier.weight(0.7f),
            fontSize = 10.sp,
            color = if (log.direction == "in") Color(0xFF059669) else Color(0xFFE11D48),
        )
        Text(log.qty.stripTrailingZeros().toPlainString(), Modifier.weight(0.5f), fontSize = 10.sp)
        Text(Money.formatRupiah(log.price), Modifier.weight(0.9f), fontSize = 10.sp)
    }
}

@Composable
private fun ProductFormDialog(
    draft: ProductDraft,
    saving: Boolean,
    error: String?,
    onChange: ((ProductDraft) -> ProductDraft) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
) {
    val capture = rememberPhotoCapture { path -> onChange { it.copy(mediaPath = path) } }
    var tipeInput by remember { mutableStateOf("") }
    val tipeList = draft.tipe.split(',').map { it.trim() }.filter { it.isNotBlank() }.distinct()
    val edit = draft.id != null

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            Modifier.fillMaxWidth(0.96f).fillMaxHeight(0.94f),
            color = Color.White,
            shape = RoundedCornerShape(20.dp),
        ) {
            Column(Modifier.fillMaxSize().padding(14.dp)) {
                Text(
                    if (edit) "Edit Produk" else "Tambah/Copy Produk",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Column(Modifier.weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Informasi Dasar", fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = draft.idLama,
                        onValueChange = { value -> onChange { it.copy(idLama = value.take(5)) } },
                        label = { Text("ID Lama") },
                        singleLine = true,
                        enabled = !edit,
                        modifier = Modifier.fillMaxWidth().testTag("product_id_lama"),
                    )
                    Field("Kategori", draft.kategori, "product_kategori") { value -> onChange { it.copy(kategori = value) } }
                    Field("Merk *", draft.merk, "product_merk") { value -> onChange { it.copy(merk = value) } }
                    Field("Jenis", draft.jenis, "product_jenis") { value -> onChange { it.copy(jenis = value) } }
                    Field("Varian", draft.varian, "product_varian") { value -> onChange { it.copy(varian = value) } }
                    Field("Keterangan", draft.keterangan, "product_keterangan") { value -> onChange { it.copy(keterangan = value) } }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Satuan (Unit)", fontSize = 12.sp)
                        listOf("pcs", "m").forEach { unit ->
                            FilterChip(
                                selected = draft.unit.equals(unit, ignoreCase = true),
                                onClick = { onChange { it.copy(unit = unit) } },
                                label = { Text(unit) },
                            )
                        }
                    }
                    OutlinedTextField(
                        value = draft.barcode,
                        onValueChange = { value -> onChange { it.copy(barcode = value.trim()) } },
                        label = { Text("Barcode") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().testTag("product_barcode"),
                    )
                    Text("Tipe Motor (Tekan Enter untuk menambah)", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        items(tipeList, key = { it }) { tipe ->
                            Surface(color = Color(0xFFEEF2FF), shape = RoundedCornerShape(8.dp)) {
                                Row(
                                    Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(tipe, fontSize = 11.sp)
                                    Text(
                                        " ×",
                                        modifier = Modifier.clickable {
                                            onChange { it.copy(tipe = (tipeList - tipe).joinToString(", ")) }
                                        },
                                        fontSize = 12.sp,
                                    )
                                }
                            }
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        OutlinedTextField(
                            value = tipeInput,
                            onValueChange = { tipeInput = it },
                            placeholder = { Text("Ketik tipe motor...") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        TextButton(
                            onClick = {
                                val value = tipeInput.trim()
                                if (value.isNotBlank() && !tipeList.contains(value)) {
                                    onChange { it.copy(tipe = (tipeList + value).joinToString(", ")) }
                                    tipeInput = ""
                                }
                            },
                        ) { Text("Tambah") }
                    }

                    HorizontalDivider()
                    Text("Manajemen Stok", fontWeight = FontWeight.Bold)
                    NumberField("Stok Awal", draft.stok1, "product_stok1") { value -> onChange { it.copy(stok1 = value) } }
                    NumberField("Stok Menipis", draft.stok2, "product_stok2") { value -> onChange { it.copy(stok2 = value) } }
                    NumberField("Stok Realtime", draft.stok, "product_stok") { value -> onChange { it.copy(stok = value) } }

                    HorizontalDivider()
                    Text("Skema Harga (Tiering)", fontWeight = FontWeight.Bold)
                    NumberField("Harga Beli Dasar (Modal)", draft.beli, "product_beli") { value -> onChange { it.copy(beli = value) } }
                    PriceRow("Sell 1", draft.sell1, "product_sell1", draft.beli) { value -> onChange { it.copy(sell1 = value) } }
                    PriceRow("Min 1 Qty", draft.min1, "product_min1", null) { value -> onChange { it.copy(min1 = value) } }
                    PriceRow("Sell 2", draft.sell2, "product_sell2", draft.beli) { value -> onChange { it.copy(sell2 = value) } }
                    PriceRow("Min 2 Qty", draft.min2, "product_min2", null) { value -> onChange { it.copy(min2 = value) } }
                    PriceRow("Sell 3", draft.sell3, "product_sell3", draft.beli) { value -> onChange { it.copy(sell3 = value) } }
                    PriceRow("Min 3 Qty", draft.min3, "product_min3", null) { value -> onChange { it.copy(min3 = value) } }
                    PriceRow("Sell 4", draft.sell4, "product_sell4", draft.beli) { value -> onChange { it.copy(sell4 = value) } }
                    PriceRow("Sell 5 (Pelanggan)", draft.sell5, "product_sell5", draft.beli) { value -> onChange { it.copy(sell5 = value) } }
                    PriceRow("Sell 6 (Default Ecer)", draft.sell6, "product_sell6", draft.beli) { value -> onChange { it.copy(sell6 = value) } }

                    HorizontalDivider()
                    Text("Gambar Produk", fontWeight = FontWeight.Bold)
                    OutlinedButton(onClick = capture, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                        Text(if (draft.mediaPath == null) "+ Upload" else "Foto siap diunggah saat online")
                    }
                    Text(
                        if (draft.mediaPath == null) "Belum ada file gambar" else "1 file terpilih",
                        fontSize = 11.sp,
                        color = Color(0xFF64748B),
                    )

                    if (error != null) {
                        Text(error, color = MaterialTheme.colorScheme.error, modifier = Modifier.testTag("product_error"))
                    }
                }
                HorizontalDivider()
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss, enabled = !saving) { Text("Batal") }
                    Button(
                        onClick = onSave,
                        enabled = !saving,
                        modifier = Modifier.testTag("product_save"),
                    ) { Text(if (saving) "Menyimpan..." else "Simpan Data") }
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
        onValueChange = { raw -> onChange(raw.filter(Char::isDigit).toBigDecimalOrNull() ?: BigDecimal.ZERO) },
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth().testTag(tag),
    )
}

@Composable
private fun PriceRow(
    label: String,
    value: BigDecimal,
    tag: String,
    beli: BigDecimal?,
    onChange: (BigDecimal) -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        OutlinedTextField(
            value = value.stripTrailingZeros().toPlainString().takeIf { it != "0" }.orEmpty(),
            onValueChange = { raw -> onChange(raw.filter(Char::isDigit).toBigDecimalOrNull() ?: BigDecimal.ZERO) },
            label = { Text(label) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.weight(1f).testTag(tag),
        )
        beli?.let {
            val percent = ProductFeed.tierMargin(it, value)
            if (percent != null) Text(percent, fontSize = 10.sp, color = Color(0xFF059669))
        }
    }
}
