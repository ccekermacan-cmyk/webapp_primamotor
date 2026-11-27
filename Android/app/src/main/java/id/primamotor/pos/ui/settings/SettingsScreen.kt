package id.primamotor.pos.ui.settings

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import id.primamotor.pos.AppContainer
import id.primamotor.pos.domain.WibDate
import java.time.Instant
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsSheet(container: AppContainer, onLogout: () -> Unit, onDismiss: () -> Unit) {
    val viewModel: SettingsViewModel = viewModel { SettingsViewModel(container) }
    val pending by viewModel.pending.collectAsStateWithLifecycle()
    val sync by viewModel.syncState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        viewModel.refreshDevices()
    }

    val lastSync = sync.maxOfOrNull { it.lastSyncAt } ?: 0L

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().padding(16.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Pengaturan", style = MaterialTheme.typography.titleMedium)
            HorizontalDivider()

            Text("Printer struk", fontWeight = FontWeight.Bold)
            if (viewModel.devices.isEmpty()) {
                Text(
                    "Belum ada printer Bluetooth yang dipasangkan. Pasangkan printer di pengaturan Android.",
                    style = MaterialTheme.typography.bodySmall,
                )
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    viewModel.devices.take(4).forEach { device ->
                        FilterChip(
                            selected = viewModel.selectedAddress == device.address,
                            onClick = { viewModel.selectPrinter(device.address) },
                            label = { Text(device.name ?: device.address) },
                            modifier = Modifier.testTag("printer_${device.address}"),
                        )
                    }
                }
                Button(onClick = viewModel::refreshDevices) { Text("Muat ulang daftar") }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !viewModel.hasBluetoothPermission()) {
                OutlinedButton(onClick = { permission.launch(Manifest.permission.BLUETOOTH_CONNECT) }) {
                    Text("Izinkan Bluetooth")
                }
            }

            HorizontalDivider()
            Text("Sinkronisasi", fontWeight = FontWeight.Bold)
            Text("$pending transaksi menunggu", modifier = Modifier.testTag("settings_pending"))
            Text(
                if (lastSync == 0L) {
                    "Data terakhir: belum pernah sinkron"
                } else {
                    "Data terakhir: " + Instant.ofEpochMilli(lastSync)
                        .atZone(WibDate.WIB)
                        .format(DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"))
                },
                style = MaterialTheme.typography.bodySmall,
            )

            HorizontalDivider()
            Text("Aplikasi", fontWeight = FontWeight.Bold)
            Text("Versi ${viewModel.version}", modifier = Modifier.testTag("settings_version"))

            OutlinedButton(
                onClick = {
                    onLogout()
                    onDismiss()
                },
                modifier = Modifier.testTag("settings_logout"),
            ) { Text("Keluar") }
            Text(
                "Antrean sinkron tetap tersimpan. Cache gaji pribadi dihapus. Printer tersimpan di perangkat ini.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}
