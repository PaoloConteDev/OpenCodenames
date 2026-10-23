package org.opencodenames.link
import org.junit.Test
import org.junit.Assert.*
import java.io.*
class FrameCodecTest {
  @Test fun fragmentedAndCoalesced() {
    val output = ByteArrayOutputStream()
    FrameCodec.write(output, "caffè 🔑"); FrameCodec.write(output, "secondo")
    val fragmented = object : FilterInputStream(ByteArrayInputStream(output.toByteArray())) {
      override fun read(b: ByteArray, off: Int, len: Int): Int = super.read(b, off, minOf(1, len))
    }
    assertEquals("caffè 🔑", FrameCodec.read(fragmented)); assertEquals("secondo", FrameCodec.read(fragmented))
  }
  @Test fun rejectOversize() { try { FrameCodec.read(ByteArrayInputStream(byteArrayOf(127,0,0,0))); fail() } catch (_: IllegalArgumentException) {} }
  @Test fun rejectTruncation() { try { FrameCodec.read(ByteArrayInputStream(byteArrayOf(0,0,0,2,65))); fail() } catch (_: EOFException) {} }
  @Test fun rejectMalformedUtf8() { try { FrameCodec.read(ByteArrayInputStream(byteArrayOf(0,0,0,1,-1))); fail() } catch (_: java.nio.charset.CharacterCodingException) {} }
}
