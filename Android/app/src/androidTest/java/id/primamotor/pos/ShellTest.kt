package id.primamotor.pos

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ShellTest {

    @get:Rule
    val rule = createAndroidComposeRule<MainActivity>()

    @Test
    fun bottom_bar_shows_all_tabs() {
        listOf("pos", "history", "products", "cashflow", "account").forEach { route ->
            rule.onNodeWithTag("tab_$route").assertIsDisplayed()
        }
    }
}