package id.primamotor.pos

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import org.junit.Rule
import org.junit.Test
import id.primamotor.pos.ui.nav.AppNav
import id.primamotor.pos.ui.theme.PrimaMotorTheme

class ShellTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun bottom_bar_shows_all_tabs() {
        rule.setContent { PrimaMotorTheme { AppNav(levelNumber = 1) } }
        // Menu utama ada di drawer, sama seperti sidebar web.
        rule.onNodeWithTag("nav_menu").performClick()
        rule.waitForIdle()
        listOf("pos", "products", "person", "cashflow", "report", "account", "settings").forEach { route ->
            rule.onNodeWithTag("tab_$route").assertIsDisplayed()
        }
    }
}