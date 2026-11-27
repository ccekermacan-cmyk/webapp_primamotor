package id.primamotor.pos.hardware.printer

import android.content.Context

/** Printer pilihan disimpan per perangkat, bukan per akun: tidak ikut terhapus saat logout. */
class PrinterSettings(context: Context) {

    private val prefs = context.getSharedPreferences("printer", Context.MODE_PRIVATE)

    var address: String?
        get() = prefs.getString(KEY_ADDRESS, null)
        private set(value) {
            prefs.edit().putString(KEY_ADDRESS, value).apply()
        }

    var name: String?
        get() = prefs.getString(KEY_NAME, null)
        private set(value) {
            prefs.edit().putString(KEY_NAME, value).apply()
        }

    fun save(address: String, name: String?) {
        this.address = address
        this.name = name
    }

    private companion object {
        const val KEY_ADDRESS = "address"
        const val KEY_NAME = "name"
    }
}
