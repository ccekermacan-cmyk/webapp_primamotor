# R8 full mode: sisakan nama kelas yang dipakai refleksi JSON Room/PocketBase.
-keepattributes Signature
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** { kotlinx.serialization.KSerializer serializer(...); }
-dontwarn com.google.errorprone.annotations.**
