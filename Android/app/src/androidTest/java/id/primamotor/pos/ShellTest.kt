package id.primamotor.pos

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import org.junit.Rule
import org.junit.Test
import id.primamotor.pos.ui.nav.AppNav
import id.primamotor.pos.ui.theme.PrimaMotorTheme

class ShellTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun bottom_bar_shows_all_tabs() {
        rule.setContent { PrimaMotorTheme { AppNav() } }
        listOf("pos", "history", "products", "cashflow", "account").forEach { route ->
            rule.onNodeWithTag("tab_$route").assertIsDisplayed()
        }
    }
}