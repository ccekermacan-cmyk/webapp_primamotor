package id.primamotor.pos.ui.pos

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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import id.primamotor.pos.hardware.printer.BluetoothPrinter
import id.primamotor.pos.hardware.printer.PrintResult
import id.primamotor.pos.hardware.printer.ReceiptData
import id.primamotor.pos.hardware.printer.ReceiptTemplate
import kotlinx.coroutines.launch

/** Pratinjau teks 32 kolom + pilih printer Bluetooth yang sudah dipasangkan. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReceiptPrintSheet(receipt: ReceiptData, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val printer = remember { BluetoothPrinter(context) }
    val prefs = remember { id.primamotor.pos.hardware.printer.PrinterSettings(context) }
    val scope = rememberCoroutineScope()
    var devices by remember { mutableStateOf(printer.bondedPrinters()) }
    var selected by remember {
        mutableStateOf(devices.firstOrNull { it.address == prefs.address }?.address ?: devices.firstOrNull()?.address)
    }
    var message by remember { mutableStateOf<String?>(null) }
    var printing by remember { mutableStateOf(false) }

    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        devices = printer.bondedPrinters()
        selected = devices.firstOrNull()?.address
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().padding(16.dp).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Pratinjau struk", style = MaterialTheme.typography.titleMedium)
            Text(
                text = String(ReceiptTemplate.render(receipt), Charsets.US_ASCII)
                    .replace("\u001B\u0040", "")
                    .replace("\u001B\u0061\u0000", "")
                    .replace("\u001B\u0061\u0001", "")
                    .replace("\u001B\u0045\u0001", "")
                    .replace("\u001B\u0045\u0000", "")
                    .replace("\u001B\u0064\u0003", "")
                    .replace("\u001D\u0056\u0001", ""),
                fontFamily = FontFamily.Monospace,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.testTag("receipt_preview"),
            )

            if (devices.isEmpty()) {
                Text("Belum ada printer Bluetooth yang dipasangkan. Pasangkan printer di pengaturan Android.")
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    devices.take(3).forEach { device ->
                        FilterChip(
                            selected = selected == device.address,
                            onClick = { selected = device.address },
                            label = { Text(device.name ?: device.address) },
                        )
                    }
                }
            }

            if (message != null) {
                Text(message!!, style = MaterialTheme.typography.bodySmall, modifier = Modifier.testTag("receipt_message"))
            }

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDismiss) { Text("Tutup") }
                Button(
                    enabled = !printing && selected != null && printer.hasPermission(),
                    onClick = {
                        val address = selected ?: return@Button
                        printing = true
                        scope.launch {
                            val result = printer.print(address, ReceiptTemplate.render(receipt))
                            message = when (result) {
                                is PrintResult.Printed -> "Terkirim ke ${result.device}."
                                is PrintResult.Failed -> result.message
                            }
                            printing = false
                        }
                    },
                    modifier = Modifier.testTag("receipt_print"),
                ) { Text(if (printing) "Mengirim..." else "Cetak") }
            }

            if (!printer.hasPermission() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                TextButton(onClick = { permission.launch(Manifest.permission.BLUETOOTH_CONNECT) }) {
                    Text("Izinkan Bluetooth")
                }
            }
        }
    }
}