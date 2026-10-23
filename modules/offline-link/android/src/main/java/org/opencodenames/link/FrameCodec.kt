package org.opencodenames.link

import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

/** One frame: unsigned big-endian length (4 bytes), then strict UTF-8. No newline parsing. */
object FrameCodec {
  const val MAX_BYTES = 32768
  fun read(input: InputStream): String {
    val stream = DataInputStream(input)
    val size = stream.readInt()
    require(size in 1..MAX_BYTES) { "Dimensione messaggio non valida" }
    val bytes = ByteArray(size)
    stream.readFully(bytes)
    return Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
      .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString()
  }
  fun write(output: OutputStream, text: String) {
    val bytes = text.toByteArray(Charsets.UTF_8)
    require(bytes.size in 1..MAX_BYTES) { "Messaggio troppo grande" }
    DataOutputStream(output).apply { writeInt(bytes.size); write(bytes); flush() }
  }
}
