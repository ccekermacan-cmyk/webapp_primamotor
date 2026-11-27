package id.primamotor.pos.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.primamotor.pos.data.remote.PocketBaseException
import id.primamotor.pos.data.remote.SessionManager
import id.primamotor.pos.data.remote.UserSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LoginUiState(
    val loading: Boolean = false,
    val error: String? = null,
    val session: UserSession? = null,
)

class LoginViewModel(private val sessions: SessionManager) : ViewModel() {

    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state.asStateFlow()

    fun login(username: String, password: String) {
        if (username.isBlank() || password.isBlank()) {
            _state.update { it.copy(error = "Username dan password wajib diisi.") }
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            runCatching { sessions.login(username.trim(), password) }
                .onSuccess { session -> _state.update { it.copy(loading = false, session = session) } }
                .onFailure { error ->
                    val message = when (error) {
                        is PocketBaseException -> error.message ?: "Login gagal."
                        else -> "Login gagal. Periksa jaringan."
                    }
                    _state.update { it.copy(loading = false, error = message) }
                }
        }
    }

    fun consumeError() = _state.update { it.copy(error = null) }
}