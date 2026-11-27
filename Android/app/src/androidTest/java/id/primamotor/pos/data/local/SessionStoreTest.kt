package id.primamotor.pos.data.local

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import id.primamotor.pos.data.remote.UserSession
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SessionStoreTest {

    private lateinit var store: EncryptedTokenStore

    @Before
    fun setUp() {
        store = EncryptedTokenStore(ApplicationProvider.getApplicationContext<Context>())
        store.clear()
    }

    @Test
    fun cached_user_reopens_app_without_network() {
        store.save(UserSession("u1", "kasir", "Kasir Satu", 2, "active", "t1"))

        val cached = store.cachedUser()

        assertEquals("u1", cached?.id)
        assertEquals("Kasir Satu", cached?.name)
        assertEquals("t1", store.token())
    }

    @Test
    fun clear_removes_session() {
        store.save(UserSession("u1", "kasir", "Kasir", 2, "active", "t1"))
        store.clear()

        assertNull(store.cachedUser())
        assertNull(store.token())
    }
}