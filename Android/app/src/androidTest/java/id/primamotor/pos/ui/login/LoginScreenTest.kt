package id.primamotor.pos.ui.login

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import id.primamotor.pos.ui.theme.PrimaMotorTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class LoginScreenTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun submits_typed_credentials() {
        var captured: Pair<String, String>? = null
        rule.setContent {
            PrimaMotorTheme {
                LoginScreen(state = LoginUiState(), onLogin = { user, pass -> captured = user to pass })
            }
        }

        rule.onNodeWithTag("login_username").performTextInput("kasir")
        rule.onNodeWithTag("login_password").performTextInput("rahasia")
        rule.onNodeWithTag("login_submit").performClick()

        assertEquals("kasir" to "rahasia", captured)
    }

    @Test
    fun shows_error_message() {
        rule.setContent {
            PrimaMotorTheme {
                LoginScreen(state = LoginUiState(error = "Password salah."), onLogin = { _, _ -> })
            }
        }

        rule.onNodeWithTag("login_error").assertIsDisplayed()
    }

    @Test
    fun submit_disabled_while_loading() {
        rule.setContent {
            PrimaMotorTheme {
                LoginScreen(state = LoginUiState(loading = true), onLogin = { _, _ -> })
            }
        }

        rule.onNodeWithTag("login_submit").assertIsNotEnabled()
    }

    @Test
    fun submit_enabled_when_idle() {
        rule.setContent {
            PrimaMotorTheme {
                LoginScreen(state = LoginUiState(), onLogin = { _, _ -> })
            }
        }

        rule.onNodeWithTag("login_submit").assertIsEnabled()
        rule.onNodeWithText("Masuk").assertIsDisplayed()
    }
}