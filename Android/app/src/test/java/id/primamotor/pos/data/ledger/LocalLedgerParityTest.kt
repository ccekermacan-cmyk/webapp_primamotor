package id.primamotor.pos.data.ledger

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import java.math.BigDecimal

/**
 * Paritas dengan `Backend/pb_hooks/lib/atomic_ledger.js` memakai fixture yang sama
 * dengan tes integrasi server: `Backend/tests/integration/local_ledger_fixtures.json`.
 */
class LocalLedgerParityTest {

    @Test
    fun every_fixture_case_matches_expected_deltas() {
        val fixture = fixtureFile()
        val cases = Json.parseToJsonElement(fixture.readText()).jsonObject["cases"]!!.jsonArray
        val failures = mutableListOf<String>()

        for (case in cases) {
            val obj = case.jsonObject
            val name = obj["name"]!!.jsonPrimitive.content
            val actual = when (obj["type"]!!.jsonPrimitive.content) {
                "cash" -> LocalLedger.cashEffect(cash(obj["old"]), cash(obj["new"])).values
                "stock" -> LocalLedger.stockEffect(stock(obj["old"]), stock(obj["new"])).values
                "bon" -> LocalLedger.bonEffect(bon(obj["old"]), bon(obj["new"])).values
                else -> error("Tipe fixture tidak dikenal: $name")
            }
            val expected = obj["expect"]!!.jsonObject.mapValues { BigDecimal(it.value.jsonPrimitive.content) }

            if (!sameAmounts(expected, actual)) {
                failures += "$name expected=$expected actual=$actual"
            }
        }

        assertEquals("Fixture ledger tidak cocok:\n${failures.joinToString("\n")}", emptyList<String>(), failures)
    }

    private fun sameAmounts(expected: Map<String, BigDecimal>, actual: Map<String, BigDecimal>): Boolean {
        if (expected.keys != actual.keys) return false
        return expected.all { (key, value) -> value.compareTo(actual.getValue(key)) == 0 }
    }

    private fun fixtureFile(): File {
        val root = System.getProperty("repo.root") ?: ".."
        val file = File(root, "Backend/tests/integration/local_ledger_fixtures.json")
        check(file.exists()) { "Fixture tidak ditemukan: ${file.absolutePath}" }
        return file
    }

    private fun JsonObject?.field(name: String): String =
        this?.get(name)?.let { if (it is JsonNull) "" else it.jsonPrimitive.content } ?: ""

    private fun amount(obj: JsonObject?): BigDecimal =
        obj.field("nominal").takeIf { it.isNotEmpty() }?.let(::BigDecimal) ?: BigDecimal.ZERO

    private fun cash(element: kotlinx.serialization.json.JsonElement?): CashflowEntry? {
        if (element == null || element is JsonNull) return null
        val obj = element.jsonObject
        return CashflowEntry(
            account1 = obj.field("account_1"),
            account2 = obj.field("account_2"),
            nominal = amount(obj),
            mutasi = obj.field("mutasi"),
            jenis = obj.field("jenis"),
        )
    }

    private fun stock(element: kotlinx.serialization.json.JsonElement?): StockEntry? {
        if (element == null || element is JsonNull) return null
        val obj = element.jsonObject
        return StockEntry(
            itemId = obj.field("item"),
            qty = BigDecimal(obj.field("qty")),
            direction = obj.field("boolean"),
        )
    }

    private fun bon(element: kotlinx.serialization.json.JsonElement?): BonEntry? {
        if (element == null || element is JsonNull) return null
        val obj = element.jsonObject
        return BonEntry(
            nominal = amount(obj),
            jenis = obj.field("jenis"),
            personId = obj.field("person"),
            userId = obj.field("user"),
        )
    }
}