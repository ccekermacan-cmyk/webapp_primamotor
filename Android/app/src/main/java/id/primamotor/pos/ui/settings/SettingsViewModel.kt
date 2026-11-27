package id.primamotor.pos.ui.settings

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.primamotor.pos.AppContainer
import id.primamotor.pos.BuildConfig
import id.primamotor.pos.hardware.printer.BluetoothPrinter
import id.primamotor.pos.hardware.printer.PrinterSettings
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class SettingsViewModel(container: AppContainer) : ViewModel() {

    private val engine = container.syncEngine
    private val prefs = PrinterSettings(container.context)
    private val printer = BluetoothPrinter(container.context)

    val version: String = BuildConfig.VERSION_NAME

    var devices by mutableStateOf(printer.bondedPrinters())
        private set

    var selectedAddress by mutableStateOf(prefs.address)
        private set

    var syncing by mutableStateOf(false)
        private set

    var syncMessage by mutableStateOf<String?>(null)
        private set

    val pending: StateFlow<Int> = container.conflictResolver.pendingCount()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    val syncState = container.database.syncStateDao().observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun refreshDevices() {
        devices = printer.bondedPrinters()
    }

    fun selectPrinter(address: String) {
        val device = devices.firstOrNull { it.address == address }
        prefs.save(address, device?.name)
        selectedAddress = address
    }

    fun hasBluetoothPermission(): Boolean = printer.hasPermission()

    fun syncNow() {
        if (syncing) return
        syncing = true
        syncMessage = null
        viewModelScope.launch {
            val outcome = runCatching { engine.run() }
            outcome.fold(
                onSuccess = { result ->
                    syncing = false
                    syncMessage = result.error?.let { "Gagal: $it" }
                        ?: "Selesai: ${result.pushed} terkirim, ${result.pulled} diterima."
                },
                onFailure = { error ->
                    syncing = false
                    syncMessage = "Gagal: ${error.message ?: "tidak diketahui"}"
                },
            )
        }
    }
}
