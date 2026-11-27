package id.primamotor.pos.hardware.printer

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.util.UUID

sealed interface PrintResult {
    data class Printed(val device: String) : PrintResult
    data class Failed(val message: String) : PrintResult
}

/** Printer gagal tidak boleh menggagalkan transaksi: pemanggil hanya menampilkan pesan. */
class BluetoothPrinter(private val context: Context) {

    fun bondedPrinters(): List<BluetoothDevice> {
        if (!hasPermission()) return emptyList()
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: return emptyList()
        return runCatching { adapter.bondedDevices.toList() }.getOrDefault(emptyList())
    }

    fun hasPermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        return ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) ==
            PackageManager.PERMISSION_GRANTED
    }

    suspend fun print(address: String, bytes: ByteArray): PrintResult = withContext(Dispatchers.IO) {
        if (!hasPermission()) return@withContext PrintResult.Failed("Izin Bluetooth diperlukan.")
        val adapter = BluetoothAdapter.getDefaultAdapter()
            ?: return@withContext PrintResult.Failed("Perangkat ini tidak punya Bluetooth.")
        if (!adapter.isEnabled) return@withContext PrintResult.Failed("Bluetooth belum aktif.")

        val device = runCatching { adapter.getRemoteDevice(address) }.getOrNull()
            ?: return@withContext PrintResult.Failed("Printer tidak ditemukan.")
        var socket: BluetoothSocket? = null
        try {
            socket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID)
            adapter.cancelDiscovery()
            socket.connect()
            socket.outputStream.use { out ->
                out.write(bytes)
                out.flush()
            }
            PrintResult.Printed(device.name ?: address)
        } catch (error: IOException) {
            PrintResult.Failed("Gagal mencetak: ${error.message ?: "koneksi printer terputus"}")
        } finally {
            runCatching { socket?.close() }
        }
    }

    private companion object {
        val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }
}